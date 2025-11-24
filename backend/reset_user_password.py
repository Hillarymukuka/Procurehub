"""Utility script to reset a user's password with a properly hashed value."""

from __future__ import annotations

import argparse
import sys
from getpass import getpass

from app.database import SessionLocal
from app.models import User
from app.utils.security import get_password_hash


def _prompt_for_password() -> str:
    """Prompt for a password twice and ensure they match."""
    password = getpass("New password: ")
    confirm = getpass("Confirm password: ")
    if password != confirm:
        raise ValueError("Passwords do not match.")
    if not password:
        raise ValueError("Password cannot be empty.")
    return password


def reset_password(email: str, password: str | None, *, dry_run: bool = False) -> None:
    """Reset the password for the given user email."""
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email.lower()).first()
        if not user:
            print(f"[!] No user found with email: {email}")
            return

        new_password = password
        if new_password is None:
            new_password = _prompt_for_password()

        hashed = get_password_hash(new_password)

        print(f"[*] Updating password for user: {user.email} (role: {user.role})")
        if dry_run:
            print("[*] Dry-run enabled; not committing changes.")
            return

        user.hashed_password = hashed
        session.commit()
        print("[✓] Password updated successfully.")
    except ValueError as exc:
        print(f"[!] {exc}")
    except Exception as exc:  # pragma: no cover - defensive
        session.rollback()
        print(f"[!] Failed to update password: {exc}")
    finally:
        session.close()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset a ProcuraHub user's password with a secure hash."
    )
    parser.add_argument(
        "--email",
        required=True,
        help="User email address to update (case-insensitive).",
    )
    parser.add_argument(
        "--password",
        help="New password to set. If omitted, you will be prompted securely.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without writing to the database.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv or sys.argv[1:])
    reset_password(args.email, args.password, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
