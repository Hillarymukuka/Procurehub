"""Reset the SQLite database and seed baseline demo data."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.database import Base, SessionLocal, engine
from app.models import (
    Department,
    ProcurementCategory,
    PurchaseRequest,
    RequestStatus,
    SupplierCategory,
    SupplierCategoryType,
    SupplierProfile,
    User,
    UserRole,
)
from app.utils.migrations import run_startup_migrations
from app.utils.security import get_password_hash


def _reset_sqlite_file() -> None:
    """Remove the existing SQLite file so we start fresh."""
    if engine.url.drivername != "sqlite":
        return

    db_path_str = engine.url.database
    if not db_path_str:
        return

    db_path = Path(db_path_str)
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)


def _create_departments(session: SessionLocal) -> dict[str, Department]:
    departments = {
        "Information Technology": "Delivers digital solutions and maintains core business platforms.",
        "Operations": "Keeps everyday business functions running seamlessly across the organisation.",
        "Finance": "Manages budgeting, financial reporting, and compliance oversight.",
    }
    department_objects: dict[str, Department] = {}
    for name, description in departments.items():
        department = Department(name=name, description=description)
        session.add(department)
        department_objects[name] = department
    session.flush()
    return department_objects


def _create_categories(session: SessionLocal) -> set[str]:
    categories = {
        "Software & Licensing": "Business applications, SaaS subscriptions, and engineering tooling.",
        "Office Furniture": "Ergonomic desks, seating, and collaborative workspace fittings.",
        "Logistics Services": "Distribution, warehousing, and fleet-based delivery services.",
        "Safety Equipment": "Protective gear and compliance items for field teams.",
    }
    for name, description in categories.items():
        session.add(ProcurementCategory(name=name, description=description))
    session.flush()
    return set(categories.keys())


def _create_users(session: SessionLocal) -> dict[str, User]:
    seed_users = [
        ("admin@procurahub.local", "System Administrator", UserRole.superadmin, "ChangeMeNow!1"),
        ("miriam.kunda@procure.demo", "Miriam Kunda", UserRole.procurement, "ProcureLead!1"),
        ("thabo.phiri@finance.demo", "Thabo Phiri", UserRole.finance, "FinanceCtrl!1"),
        ("lucy.mwale@acme.demo", "Lucy Mwale", UserRole.requester, "RequesterOne!1"),
        ("elijah.tembo@acme.demo", "Elijah Tembo", UserRole.requester, "RequesterTwo!1"),
        ("hello@smartoffice.co.zm", "Smart Office Supplies", UserRole.supplier, "SupplierOne!1"),
        ("team@zanlogistics.co.zm", "Zambezi Logistics", UserRole.supplier, "SupplierTwo!1"),
    ]

    user_objects: dict[str, User] = {}
    for email, full_name, role, password in seed_users:
        user = User(
            email=email.lower(),
            full_name=full_name,
            hashed_password=get_password_hash(password),
            role=role,
            is_active=True,
        )
        session.add(user)
        session.flush()
        user_objects[email] = user

        if role == UserRole.supplier:
            profile = SupplierProfile(
                user_id=user.id,
                company_name=full_name,
                contact_email=email.lower(),
                contact_phone="+260-960-000000",
                address="Plot 21 Independence Avenue, Lusaka",
                preferred_currency="ZMW",
            )
            session.add(profile)
            session.flush()

            focus_categories = {
                "hello@smartoffice.co.zm": ["Office Furniture", "Software & Licensing"],
                "team@zanlogistics.co.zm": ["Logistics Services", "Safety Equipment"],
            }.get(email.lower(), [])

            for index, category_name in enumerate(focus_categories[:2]):
                category_type = SupplierCategoryType.primary if index == 0 else SupplierCategoryType.secondary
                session.add(SupplierCategory(supplier_id=profile.id, name=category_name, category_type=category_type))
    session.flush()
    return user_objects


def _create_requests(
    session: SessionLocal,
    users: dict[str, User],
    departments: dict[str, Department],
    categories: set[str],
) -> None:
    now = datetime.now(tz=timezone.utc)
    requester_payloads = [
        {
            "requester_email": "lucy.mwale@acme.demo",
            "title": "Upgrade Collaboration Workstations",
            "description": (
                "Procure six high-memory laptops with docking stations to support the data "
                "visualisation sprint for Q1."
            ),
            "justification": (
                "Existing machines struggle with the analytics toolchain, affecting sprint velocity. "
                "Upgrades unblock delivery."
            ),
            "category": "Software & Licensing",
            "department": "Information Technology",
            "needed_by_days": 28,
        },
        {
            "requester_email": "elijah.tembo@acme.demo",
            "title": "Operations Field Safety Kits",
            "description": (
                "Requesting twenty complete safety kits for the northern depots, including reflective "
                "vests, hard hats, and gloves."
            ),
            "justification": (
                "New field crews join in the next month and require compliant gear before deployment."
            ),
            "category": "Safety Equipment",
            "department": "Operations",
            "needed_by_days": 21,
        },
    ]

    for payload in requester_payloads:
        requester = users[payload["requester_email"]]
        department = departments[payload["department"]]
        category = payload["category"]
        if category not in categories:
            raise ValueError(f"Unknown category '{category}' referenced in seed data")

        request = PurchaseRequest(
            title=payload["title"],
            description=payload["description"],
            justification=payload["justification"],
            category=category,
            department_id=department.id,
            needed_by=now + timedelta(days=payload["needed_by_days"]),
            requester_id=requester.id,
            proposed_budget_amount=Decimal("0"),
            proposed_budget_currency="ZMW",
            status=RequestStatus.pending_procurement,
        )
        session.add(request)


def reset_database() -> None:
    """Drop the existing data and seed a clean demo environment."""
    _reset_sqlite_file()

    # Recreate schema and apply lightweight migrations.
    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)

    session = SessionLocal()
    try:
        departments = _create_departments(session)
        categories = _create_categories(session)
        users = _create_users(session)
        _create_requests(session, users, departments, categories)
        session.commit()
        print("Database reset complete. Created:")
        print(f" - Departments: {len(departments)}")
        print(f" - Categories: {len(categories)}")
        print(f" - Users: {len(users)} (including 2 suppliers with profiles)")
        print(" - Purchase Requests: 2 pending procurement review")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    reset_database()