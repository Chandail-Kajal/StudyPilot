from datetime import datetime

from fastapi import APIRouter


router = APIRouter()


@router.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "StudyPilot API",
        "timestamp": datetime.now().isoformat(),
    }
