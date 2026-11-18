from fastapi import APIRouter

from routers.account import router as account_router
from routers.ai import router as ai_router
from routers.exams import router as exams_router
from routers.learning import router as learning_router
from routers.study import router as study_router


router = APIRouter()
router.include_router(account_router)
router.include_router(ai_router)
router.include_router(exams_router)
router.include_router(learning_router)
router.include_router(study_router)
