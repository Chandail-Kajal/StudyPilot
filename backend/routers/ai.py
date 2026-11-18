from fastapi import APIRouter

from routers.common import *
from schemas import *
from services import ai_service


router = APIRouter()


@router.post("/api/syllabus/parse-and-plan")
async def parse_and_plan_syllabus(
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form("Mid-term exams"),
    exam_date: Optional[str] = Form(None),
    sitting_capacity_mins: Optional[int] = Form(45),
    daily_goal_mins: Optional[int] = Form(180),
    api_key: Optional[str] = Form(None),
    user: Optional[dict] = Depends(get_optional_user)
):
    return await ai_service.parse_and_plan_syllabus(file, exam_name, exam_date, sitting_capacity_mins, daily_goal_mins, api_key, user)


@router.post("/api/ai/plan-schedule")
async def ai_plan_schedule(req: AIPlanScheduleRequest, user: Optional[dict] = Depends(get_optional_user)):
    return await ai_service.ai_plan_schedule(req, user)


@router.post("/api/ai/mock-test")
async def ai_create_mock_test(req: AIMockTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    return await ai_service.ai_create_mock_test(req, user)


@router.post("/api/ai/full-syllabus-test")
async def ai_create_full_syllabus_test(req: AIFullSyllabusTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    return await ai_service.ai_create_full_syllabus_test(req, user)


@router.post("/api/ai/extract-important-topics")
async def ai_extract_important_topics(req: AIExtractImportanceRequest, user: Optional[dict] = Depends(get_optional_user)):
    return await ai_service.ai_extract_important_topics(req, user)


@router.post("/api/ai/submit-test")
def ai_submit_test(req: AISubmitTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    return ai_service.ai_submit_test(req, user)


@router.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, user: Optional[dict] = Depends(get_optional_user)):
    return await ai_service.ai_chat(req, user)


@router.get("/api/ai/tests-history")
def get_mock_tests_history(user: dict = Depends(get_current_user)):
    return ai_service.get_mock_tests_history(user)


@router.get("/api/ai/providers")
async def get_ai_providers_endpoint(user: dict = Depends(get_current_user)):
    return await ai_service.get_ai_providers_endpoint(user)

