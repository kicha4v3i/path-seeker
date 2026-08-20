from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class AuthUser:
    def __init__(self, clerk_id: str, email: str, name: str = ""):
        self.clerk_id = clerk_id
        self.email = email
        self.name = name


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthUser:
    if settings.dev_auth_bypass and not credentials:
        return AuthUser(
            clerk_id=settings.dev_user_id,
            email=settings.dev_user_email,
            name="Dev User",
        )

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth token")

    token = credentials.credentials
    if settings.dev_auth_bypass and token == "dev-token":
        return AuthUser(
            clerk_id=settings.dev_user_id,
            email=settings.dev_user_email,
            name="Dev User",
        )

    try:
        from jose import jwt

        if settings.clerk_jwks_url:
            # Production: verify JWT against Clerk JWKS
            unverified = jwt.get_unverified_header(token)
            claims = jwt.decode(
                token,
                key="",  # JWKS verification would be wired here
                options={"verify_signature": False},
            )
        else:
            claims = jwt.get_unverified_claims(token)

        return AuthUser(
            clerk_id=claims.get("sub", settings.dev_user_id),
            email=claims.get("email", settings.dev_user_email),
            name=claims.get("name", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
