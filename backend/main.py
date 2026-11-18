import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db


init_db()

from routers.api import router as api_router
from routers.system import router as system_router


app = FastAPI(title="StudyPilot API", version="1.0.0")
app.include_router(system_router)
app.include_router(api_router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
for directory in ("videos", "audio", "uploads"):
    os.makedirs(os.path.join(static_dir, directory), exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
