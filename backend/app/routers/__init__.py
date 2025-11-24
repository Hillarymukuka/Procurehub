"""API routers for ProcuraHub."""

from fastapi import APIRouter

from . import admin, auth, messages, requests, rfqs, suppliers, setup

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(rfqs.router, prefix="/rfqs", tags=["rfqs"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(requests.router, prefix="/requests", tags=["requests"])
api_router.include_router(setup.router, tags=["setup"])

