import re
from collections import deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import router as auth_router
from app.collaboration import router as collaboration_router
from app.config import get_settings
from app.database import DatabaseError, close_database, configure_database
from app.discovery import router as discovery_router
from app.groups import router as groups_router
from app.messaging import router as messaging_router
from app.profiles import router as profiles_router
from app.realtime import router as realtime_router
from app.sessions import router as sessions_router

settings = get_settings()
MAX_MATERIAL_REQUEST_BYTES = 6 * 1024 * 1024
MATERIAL_UPLOAD_PATH = re.compile(r"^/api/v1/groups/[^/]+/materials$")


class MaterialBodyLimit:
    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or not MATERIAL_UPLOAD_PATH.fullmatch(scope["path"])
        ):
            await self.application(scope, receive, send)
            return

        chunks = deque()
        size = 0
        while True:
            message = await receive()
            if message["type"] != "http.request":
                return
            size += len(message.get("body", b""))
            if size > MAX_MATERIAL_REQUEST_BYTES:
                await JSONResponse(
                    status_code=413,
                    content={"detail": "Material request exceeds the 6 MB limit."},
                )(scope, receive, send)
                return
            chunks.append(message)
            if not message.get("more_body", False):
                break

        async def replay():
            if chunks:
                return chunks.popleft()
            return await receive()

        await self.application(scope, replay, send)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_database()
    yield
    close_database()


app = FastAPI(
    title="Study Buddy API",
    version="0.1.0",
    description="Student profiles and study preferences for Study Buddy.",
    lifespan=lifespan,
)
app.add_middleware(MaterialBodyLimit)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(profiles_router)
app.include_router(auth_router)
app.include_router(discovery_router)
app.include_router(groups_router)
app.include_router(messaging_router)
app.include_router(sessions_router)
app.include_router(collaboration_router)
app.include_router(realtime_router)


@app.exception_handler(DatabaseError)
async def handle_database_error(_: Request, error: DatabaseError) -> JSONResponse:
    if error.code == "P0001" and "rate limit exceeded" in error.message.lower():
        return JSONResponse(
            status_code=429,
            content={"detail": "You’re doing that too often. Please try again later."},
        )
    if error.code in {"P0001", "23505", "23514", "23503"}:
        return JSONResponse(
            status_code=409,
            content={"detail": error.message},
        )
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is unavailable. Please try again later."},
    )


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
