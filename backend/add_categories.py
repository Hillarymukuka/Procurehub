"""Seed the database with the standard procurement category catalogue."""

from __future__ import annotations

from app.database import SessionLocal
from app.models.category import ProcurementCategory
from app.utils.reference_data import DEFAULT_CATEGORIES, ensure_categories


def add_categories() -> None:
    """Ensure all default categories exist in the database."""
    session = SessionLocal()
    try:
        added_count = ensure_categories(session, DEFAULT_CATEGORIES)
        if added_count:
            session.commit()
        else:
            session.rollback()

        total_categories = session.query(ProcurementCategory).count()
        print(f"Categories added this run: {added_count}")
        print(f"Total categories in database: {total_categories}")
    except Exception as exc:  # pragma: no cover - utility script
        session.rollback()
        raise RuntimeError("Failed to seed procurement categories") from exc
    finally:
        session.close()


if __name__ == "__main__":
    add_categories()
