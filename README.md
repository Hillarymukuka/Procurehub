# ProcuraHub

ProcuraHub is a demonstration procurement hub that streamlines supplier onboarding, request-for-quotation (RFQ) distribution, and finance approvals. The stack combines a FastAPI backend with a React + TailwindCSS frontend. SQLite is used by default with a ready path to PostgreSQL.

## Features
- Role-based access for SuperAdmin, Procurement, Requester, Finance, and Supplier teams.
- Supplier self-registration with document uploads (incorporation, tax clearance, company profile) persisted under `uploads/`.
- RFQ lifecycle management: creation, automated supplier invitations within matching categories, submission tracking, and automatic closure once deadlines pass.
- Fairness heuristics ensure supplier invitations rotate by least-engaged suppliers first.
- Supplier portal to review invitations, view active RFQs, and upload quotations.
- Finance approvals for quotations with notification emails for invitations and approvals (console logger by default).

## Project Structure
```
backend/    # FastAPI application
frontend/   # React + TailwindCSS single-page app
uploads/    # Storage for uploaded supplier documents & quotations
```

## Backend (FastAPI)

### Prerequisites
- Python 3.11+ recommended
- Virtual environment (optional)

### Setup
```bash
cd backend
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API serves under `http://localhost:8000` with uploads exposed at `/uploads`. Default database is SQLite at `backend/procurahub.db`. Override via environment variable:

```bash
export DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/procurahub
```

Create a `.env` file to fine-tune settings (see `backend/app/config.py` for all options). A SuperAdmin account must exist to create internal staff accounts; you can insert a row directly or create a small script using the models.

## Frontend (React + TailwindCSS)

### Prerequisites
- Node.js 18+

### Setup
```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies API traffic to `http://localhost:8000`. Adjust `VITE_API_BASE_URL` in a `.env` file if your backend runs elsewhere.

## Key Backend Endpoints
- `POST /api/auth/token` – OAuth2 password flow login (returns JWT).
- `POST /api/auth/users` – Create internal user (SuperAdmin only).
- `POST /api/suppliers/register` – Supplier registration with multipart form uploads.
- `GET /api/rfqs` & `POST /api/rfqs` – RFQ listing and creation (Procurement/SuperAdmin).
- `POST /api/rfqs/{id}/quotations` – Supplier quotation submission with attachments.
- `POST /api/rfqs/{id}/quotations/{quotation_id}/approve` – Finance approvals.

## Email & Notifications
Email dispatch currently logs to the application logger (`procurahub.email`). Toggle real SMTP integration later within `backend/app/services/email.py`. Approval emails notify suppliers when finance accepts their quotation.

## Fairness Logic
Suppliers include an invitation counter and timestamp. When an RFQ is opened, suppliers in the same category are sorted by least invitations and earliest invite time to guarantee fair rotation. Batch size defaults to 25 (configurable via `INVITATION_BATCH_SIZE`).

## Notes
- Uploaded files are stored relative to the project root under `uploads/`; ensure this path stays protected in production.
- RFQs are auto-closed whenever relevant API endpoints run; long-lived deployments should schedule `close_expired_rfqs` periodically.
- The frontend assumes a JWT in `localStorage` under `procurahub.token` and drives behaviour from `/api/auth/me`.

## Next Steps
1. Provision an initial SuperAdmin account and change the default `SECRET_KEY`.
2. Add production-ready email delivery and background workers for deadline enforcement.
3. Harden security (rate limiting, audit logging) before exposing externally.
4. Connect to PostgreSQL when moving beyond demos.

