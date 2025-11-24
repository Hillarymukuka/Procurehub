"""Seed the database with the standard department directory."""

from __future__ import annotations

from app.database import SessionLocal
from app.models.department import Department
from app.utils.reference_data import DEFAULT_DEPARTMENTS, ensure_departments


def add_departments() -> None:
    """Ensure all default departments exist in the database."""
    session = SessionLocal()
    try:
        added_count = ensure_departments(session, DEFAULT_DEPARTMENTS)
        if added_count:
            session.commit()
        else:
            session.rollback()

        total_departments = session.query(Department).count()
        print(f"Departments added this run: {added_count}")
        print(f"Total departments in database: {total_departments}")
    except Exception as exc:  # pragma: no cover - utility script
        session.rollback()
        raise RuntimeError("Failed to seed departments") from exc
    finally:
        session.close()


if __name__ == "__main__":
    add_departments()
