"""Lightweight schema alignment helpers for demo deployments.

These helpers keep the SQLite / PostgreSQL demo database in sync with the
latest SQLAlchemy models without requiring a full migration framework.
They are intentionally conservative and only add columns that were
introduced after the initial release.
"""

from __future__ import annotations

import logging
from typing import Dict

from sqlalchemy import inspect, text, or_
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


logger = logging.getLogger("procurahub.migrations")


def _supplier_profile_column_definitions(dialect_name: str) -> Dict[str, str]:
    """Return the SQL column definitions per dialect for SupplierProfile."""
    if dialect_name == "postgresql":
        return {
            "invitations_sent": "INTEGER NOT NULL DEFAULT 0",
            "last_invited_at": "TIMESTAMPTZ NULL",
            "total_awarded_value": "NUMERIC(12, 2) NOT NULL DEFAULT 0",
            "created_at": "TIMESTAMPTZ NULL DEFAULT NOW()",
            "updated_at": "TIMESTAMPTZ NULL",
        }

    # Default fallback also covers SQLite
    return {
        "invitations_sent": "INTEGER DEFAULT 0",
        "last_invited_at": "DATETIME",
        "total_awarded_value": "NUMERIC DEFAULT 0",
        "created_at": "DATETIME DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "DATETIME",
    }


def _ensure_supplier_profile_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    if "supplier_profiles" not in inspector.get_table_names():
        # Table will be created via Base.metadata.create_all later.
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("supplier_profiles")
    }
    required_columns = _supplier_profile_column_definitions(engine.dialect.name)

    missing_columns = [
        column for column in required_columns if column not in existing_columns
    ]
    if not missing_columns:
        return

    logger.info(
        "Aligning supplier_profiles table by adding missing columns: %s",
        ", ".join(missing_columns),
    )

    statements = []
    for column in missing_columns:
        definition = required_columns[column]
        statements.append(
            text(f"ALTER TABLE supplier_profiles ADD COLUMN {column} {definition}")
        )
        if column in {"invitations_sent", "total_awarded_value"}:
            # Ensure historical rows get the default value instead of NULL.
            statements.append(
                text(
                    f"UPDATE supplier_profiles "
                    f"SET {column} = COALESCE({column}, 0)"
                )
            )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(statement)


def _supplier_category_column_definitions(dialect_name: str) -> Dict[str, str]:
    """Return SQL column definitions for SupplierCategory adjustments."""
    column_type = "VARCHAR(20)"
    return {"category_type": column_type}


def _ensure_supplier_category_columns(engine: Engine) -> None:
    """Ensure supplier categories have typed primary/secondary designation."""
    inspector = inspect(engine)
    if "supplier_categories" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("supplier_categories")}
    required_columns = _supplier_category_column_definitions(engine.dialect.name)
    missing_columns = [column for column in required_columns if column not in existing_columns]

    statements = [
        text(f"ALTER TABLE supplier_categories ADD COLUMN {column} {required_columns[column]}")
        for column in missing_columns
    ]

    if statements:
        logger.info(
            "Aligning supplier_categories table by adding columns: %s",
            ", ".join(missing_columns),
        )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(statement)

    # Normalise existing rows and remove extras beyond primary/secondary when column newly added.
    if "category_type" not in existing_columns:
        Session = sessionmaker(bind=engine)
        session = Session()
        try:
            from ..models.supplier import SupplierCategoryType, SupplierProfile
            from sqlalchemy.orm import selectinload

            suppliers = (
                session.query(SupplierProfile)
                .options(selectinload(SupplierProfile.categories))
                .all()
            )

            for supplier in suppliers:
                categories = sorted(supplier.categories, key=lambda category: category.id)
                for index, category in enumerate(categories):
                    if index == 0:
                        category.category_type = SupplierCategoryType.primary
                    elif index == 1:
                        category.category_type = SupplierCategoryType.secondary
                    else:
                        session.delete(category)
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("Failed to normalise supplier categories")
        finally:
            session.close()




def _ensure_rfq_number_column(engine: Engine) -> None:
    """Ensure RFQs have a human-readable rfq_number."""
    inspector = inspect(engine)
    if "rfqs" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("rfqs")}
    if "rfq_number" not in existing_columns:
        logger.info("Adding rfq_number column to rfqs table")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE rfqs ADD COLUMN rfq_number VARCHAR(30)"))

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        from ..models.rfq import RFQ
        from ..services.rfq import generate_rfq_number

        rfqs = (
            session.query(RFQ)
            .filter(or_(RFQ.rfq_number == None, RFQ.rfq_number == ""))  # noqa: E711
            .all()
        )
        for rfq in rfqs:
            rfq.rfq_number = generate_rfq_number(rfq.id, getattr(rfq, "created_at", None))
        session.commit()
    except Exception:  # pragma: no cover - defensive
        session.rollback()
        logger.exception("Failed to backfill rfq_number values")
    finally:
        session.close()


def _ensure_messages_table(engine: Engine) -> None:
    """Ensure the messages table exists with correct schema."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if "messages" in tables:
        return

    logger.info("Creating messages table")

    dialect_name = engine.dialect.name
    if dialect_name == "postgresql":
        create_sql = """
        CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id),
            recipient_id INTEGER NOT NULL REFERENCES users(id),
            supplier_id INTEGER NOT NULL REFERENCES supplier_profiles(id),
            subject VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'sent',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at TIMESTAMPTZ NULL
        )
        """
    else:  # SQLite
        create_sql = """
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL REFERENCES users(id),
            recipient_id INTEGER NOT NULL REFERENCES users(id),
            supplier_id INTEGER NOT NULL REFERENCES supplier_profiles(id),
            subject VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'sent',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME NULL
        )
        """

    with engine.begin() as connection:
        connection.execute(text(create_sql))


def _department_table_sql(dialect_name: str) -> str:
    if dialect_name == "postgresql":
        return """
        CREATE TABLE departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NULL
        )
        """

    return """
    CREATE TABLE departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL
    )
    """


def _ensure_departments_table(engine: Engine) -> None:
    inspector = inspect(engine)
    if "departments" in inspector.get_table_names():
        return

    logger.info("Creating departments table")
    create_sql = _department_table_sql(engine.dialect.name)
    with engine.begin() as connection:
        connection.execute(text(create_sql))


def _quotation_tax_column_definitions(dialect_name: str) -> Dict[str, str]:
    """Return SQL column definitions for Quotation tax fields per dialect."""
    if dialect_name == "postgresql":
        numeric_5_2 = "NUMERIC(5, 2)"
        numeric_14_2 = "NUMERIC(14, 2)"
    else:
        numeric_5_2 = "NUMERIC(5, 2)"
        numeric_14_2 = "NUMERIC(14, 2)"

    return {
        "vat_rate": numeric_5_2,
        "tot_rate": numeric_5_2,
        "vat_amount": numeric_14_2,
        "tot_amount": numeric_14_2,
        "total_amount": numeric_14_2,
    }


def _ensure_quotation_tax_columns(engine: Engine) -> None:
    """Ensure recently added tax columns exist on rfq_quotations."""
    inspector = inspect(engine)
    if "rfq_quotations" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("rfq_quotations")
    }
    required_columns = _quotation_tax_column_definitions(engine.dialect.name)

    missing_columns = [
        column for column in required_columns if column not in existing_columns
    ]
    if not missing_columns:
        return

    logger.info(
        "Aligning rfq_quotations table by adding tax columns: %s",
        ", ".join(missing_columns),
    )

    statements = [
        text(
            f"ALTER TABLE rfq_quotations ADD COLUMN {column} {required_columns[column]}"
        )
        for column in missing_columns
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(statement)


def _request_document_table_sql(dialect_name: str) -> str:
    if dialect_name == "postgresql":
        return """
        CREATE TABLE request_documents (
            id SERIAL PRIMARY KEY,
            request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
            file_path VARCHAR(500) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            uploaded_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """

    return """
    CREATE TABLE request_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
        file_path VARCHAR(500) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        uploaded_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """


def _rfq_document_table_sql(dialect_name: str) -> str:
    if dialect_name == "postgresql":
        return """
        CREATE TABLE rfq_documents (
            id SERIAL PRIMARY KEY,
            rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
            file_path VARCHAR(500) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            uploaded_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """

    return """
    CREATE TABLE rfq_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
        file_path VARCHAR(500) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        uploaded_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """


def _ensure_request_documents_table(engine: Engine) -> None:
    inspector = inspect(engine)
    if "request_documents" in inspector.get_table_names():
        return

    logger.info("Creating request_documents table")
    create_sql = _request_document_table_sql(engine.dialect.name)
    with engine.begin() as connection:
        connection.execute(text(create_sql))


def _ensure_rfq_documents_table(engine: Engine) -> None:
    inspector = inspect(engine)
    if "rfq_documents" in inspector.get_table_names():
        return

    logger.info("Creating rfq_documents table")
    create_sql = _rfq_document_table_sql(engine.dialect.name)
    with engine.begin() as connection:
        connection.execute(text(create_sql))


def _purchase_request_column_definitions(dialect_name: str) -> Dict[str, str]:
    timestamp = "TIMESTAMPTZ" if dialect_name == "postgresql" else "DATETIME"
    integer = "INTEGER"
    if dialect_name == "postgresql":
        fk_users = "INTEGER REFERENCES users(id) ON DELETE SET NULL"
        fk_departments = "INTEGER REFERENCES departments(id) ON DELETE SET NULL"
        fk_rfqs = "INTEGER REFERENCES rfqs(id) ON DELETE SET NULL"
    else:
        fk_users = "INTEGER REFERENCES users(id) ON DELETE SET NULL"
        fk_departments = "INTEGER REFERENCES departments(id) ON DELETE SET NULL"
        fk_rfqs = "INTEGER REFERENCES rfqs(id) ON DELETE SET NULL"

    return {
        "justification": "TEXT",
        "department_id": fk_departments,
        "finance_budget_amount": "NUMERIC(14, 2)",
        "finance_budget_currency": "VARCHAR(16)",
        "finance_notes": "TEXT",
        "finance_reviewer_id": fk_users,
        "finance_reviewed_at": timestamp,
        "procurement_rejection_reason": "TEXT",
        "finance_rejection_reason": "TEXT",
        "rfq_invited_at": timestamp,
    }


def _create_purchase_requests_table(engine: Engine) -> None:
    logger.info("Creating purchase_requests table")
    dialect_name = engine.dialect.name
    if dialect_name == "postgresql":
        create_sql = """
        CREATE TABLE purchase_requests (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            justification TEXT NULL,
            category VARCHAR(120) NOT NULL,
            department_id INTEGER NULL REFERENCES departments(id) ON DELETE SET NULL,
            budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(16) NOT NULL DEFAULT 'ZMW',
            finance_budget_amount NUMERIC(14, 2) NULL,
            finance_budget_currency VARCHAR(16) NULL,
            needed_by TIMESTAMPTZ NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending_procurement',
            procurement_notes TEXT NULL,
            finance_notes TEXT NULL,
            requester_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            approved_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            finance_reviewer_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            rfq_id INTEGER NULL REFERENCES rfqs(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NULL,
            approved_at TIMESTAMPTZ NULL,
            finance_reviewed_at TIMESTAMPTZ NULL,
            rfq_invited_at TIMESTAMPTZ NULL,
            procurement_rejection_reason TEXT NULL,
            finance_rejection_reason TEXT NULL
        )
        """
    else:
        create_sql = """
        CREATE TABLE purchase_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            justification TEXT NULL,
            category VARCHAR(120) NOT NULL,
            department_id INTEGER NULL REFERENCES departments(id) ON DELETE SET NULL,
            budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(16) NOT NULL DEFAULT 'ZMW',
            finance_budget_amount NUMERIC(14, 2) NULL,
            finance_budget_currency VARCHAR(16) NULL,
            needed_by DATETIME NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending_procurement',
            procurement_notes TEXT NULL,
            finance_notes TEXT NULL,
            requester_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            approved_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            finance_reviewer_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            rfq_id INTEGER NULL REFERENCES rfqs(id) ON DELETE SET NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL,
            approved_at DATETIME NULL,
            finance_reviewed_at DATETIME NULL,
            rfq_invited_at DATETIME NULL,
            procurement_rejection_reason TEXT NULL,
            finance_rejection_reason TEXT NULL
        )
        """

    with engine.begin() as connection:
        connection.execute(text(create_sql))


def _ensure_purchase_requests_table(engine: Engine) -> None:
    """Ensure the purchase_requests table exists for requester workflow."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "purchase_requests" not in tables:
        _create_purchase_requests_table(engine)
        return

    existing_columns = {column["name"] for column in inspector.get_columns("purchase_requests")}
    required_columns = _purchase_request_column_definitions(engine.dialect.name)

    missing_columns = [column for column in required_columns if column not in existing_columns]
    statements = []
    for column in missing_columns:
        statements.append(text(f"ALTER TABLE purchase_requests ADD COLUMN {column} {required_columns[column]}"))

    if statements:
        logger.info("Aligning purchase_requests table by adding columns: %s", ", ".join(missing_columns))

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(statement)
        # Populate justification for legacy rows
        if "justification" in required_columns and "justification" in existing_columns or "justification" in missing_columns:
            connection.execute(
                text(
                    "UPDATE purchase_requests SET justification = COALESCE(justification, description)"
                )
            )
        # Normalize legacy statuses
        connection.execute(
            text(
                "UPDATE purchase_requests SET status = 'pending_procurement' WHERE status = 'pending'"
            )
        )
        connection.execute(
            text(
                "UPDATE purchase_requests SET status = 'finance_approved' WHERE status = 'approved'"
            )
        )
        connection.execute(
            text(
                "UPDATE purchase_requests SET status = 'rejected_by_procurement' WHERE status = 'denied'"
            )
        )
        connection.execute(
            text(
                "UPDATE purchase_requests "
                "SET status = 'rfq_issued' "
                "WHERE status = 'finance_approved' AND rfq_id IS NOT NULL AND rfq_invited_at IS NOT NULL"
            )
        )


def _seed_reference_data(engine: Engine) -> None:
    """Ensure default departments and categories exist."""
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        from .reference_data import ensure_categories, ensure_departments

        added_departments = ensure_departments(session)
        added_categories = ensure_categories(session)

        if added_departments or added_categories:
            session.commit()
            logger.info(
                "Seeded reference data: %s new departments, %s new categories",
                added_departments,
                added_categories,
            )
        else:
            session.rollback()
    except Exception:
        session.rollback()
        logger.exception("Failed seeding reference data")
    finally:
        session.close()


def run_startup_migrations(engine: Engine) -> None:
    """Apply minimal schema adjustments required by the latest code."""
    try:
        _ensure_supplier_profile_columns(engine)
        _ensure_supplier_category_columns(engine)
        _ensure_rfq_number_column(engine)
        _ensure_messages_table(engine)
        _ensure_departments_table(engine)
        _ensure_purchase_requests_table(engine)
        _ensure_rfq_documents_table(engine)
        _ensure_request_documents_table(engine)
        _ensure_quotation_tax_columns(engine)
        _seed_reference_data(engine)
    except Exception:  # pragma: no cover - startup safety
        logger.exception("Failed to apply startup schema checks")
