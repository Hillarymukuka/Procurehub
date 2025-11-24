"""Authentication and user management helpers."""

import logging
from typing import Optional

from passlib.exc import InvalidHashError, MalformedHashError, UnknownHashError
from sqlalchemy.orm import Session

from ..models import User, UserRole
from ..schemas import UserCreate
from ..utils.security import get_password_hash, verify_password

logger = logging.getLogger("procurahub.auth")


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None

    try:
        if not verify_password(password, user.hashed_password):
            return None
    except (ValueError, TypeError, UnknownHashError, MalformedHashError, InvalidHashError):
        logger.warning("Invalid password hash stored for user %s", user.email)
        return None

    return user


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(
        email=user_in.email.lower(),
        full_name=user_in.full_name,
        role=UserRole(user_in.role),
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.flush()
    return user
