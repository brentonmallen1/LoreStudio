from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from ..config import settings

# bcrypt reads at most 72 bytes. Up to version 4 it dropped the rest silently; 5 refuses a
# longer password. Cutting it here keeps every hash made before working, and long passwords too.
BCRYPT_MAX_BYTES = 72


def _secret(password: str) -> bytes:
    return password.encode()[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_secret(password), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_secret(plain), hashed.encode())


def create_access_token(subject: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.secret_key,
        algorithm="HS256",
    )


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None
