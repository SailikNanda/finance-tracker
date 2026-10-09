"""Fail-closed authentication for the optional single-owner legacy API."""
import secrets
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from config import settings

bearer = HTTPBearer(auto_error=False)

def require_owner(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> None:
    token = settings.api_auth_token
    if len(token) < 32:
        raise HTTPException(status_code=503, detail="Legacy backend is disabled until API_AUTH_TOKEN (32+ characters) is configured")
    if credentials is None or credentials.scheme.lower() != "bearer" or not secrets.compare_digest(credentials.credentials, token):
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
