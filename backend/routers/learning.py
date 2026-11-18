from fastapi import APIRouter, Body

from routers.common import *
from schemas import *
from services import learning_service


router = APIRouter()


@router.get("/api/learning/topic/{topic_id}")
async def get_interactive_topic_studio(topic_id: str, user: dict = Depends(get_current_user)):
    return await learning_service.get_interactive_topic_studio(topic_id, user)


@router.post("/api/learning/topic/{topic_id}/interaction")
def update_topic_interaction(topic_id: str, req: TopicInteractionUpdateRequest, user: dict = Depends(get_current_user)):
    return learning_service.update_topic_interaction(topic_id, req, user)


@router.post("/api/learning/topic/{topic_id}/chat")
async def chat_with_in_topic_tutor(topic_id: str, req: TopicChatRequest, user: dict = Depends(get_current_user)):
    return await learning_service.chat_with_in_topic_tutor(topic_id, req, user)


@router.post("/api/learning/topic/{topic_id}/video/generate")
@router.post("/api/topics/{topic_id}/video/generate")
async def generate_topic_video_endpoint(topic_id: str, req: GenerateVideoRequest = GenerateVideoRequest(), user: dict = Depends(get_current_user)):
    return await learning_service.generate_topic_video_endpoint(topic_id, req, user)


@router.get("/api/learning/topic/{topic_id}/video")
@router.get("/api/topics/{topic_id}/video")
async def get_topic_video_endpoint(topic_id: str, user: dict = Depends(get_current_user)):
    return await learning_service.get_topic_video_endpoint(topic_id, user)


@router.post("/api/learning/topic/{topic_id}/video/regenerate")
@router.post("/api/topics/{topic_id}/video/regenerate")
async def regenerate_topic_video_endpoint(topic_id: str, req: GenerateVideoRequest = GenerateVideoRequest(), user: dict = Depends(get_current_user)):
    return await learning_service.regenerate_topic_video_endpoint(topic_id, req, user)


@router.get("/api/learning/topic/{topic_id}/chat-history")
def get_topic_chat_history(topic_id: str, user: dict = Depends(get_current_user)):
    return learning_service.get_topic_chat_history(topic_id, user)


@router.get("/api/learning/topic/{topic_id}/practice")
async def get_topic_practice_questions(topic_id: str, difficulty: Optional[str] = "intermediate", user: dict = Depends(get_current_user)):
    return await learning_service.get_topic_practice_questions(topic_id, difficulty, user)


@router.post("/api/learning/topic/{topic_id}/practice/submit")
def submit_topic_practice_question(topic_id: str, req: TopicPracticeSubmitRequest, user: dict = Depends(get_current_user)):
    return learning_service.submit_topic_practice_question(topic_id, req, user)


@router.get("/api/learning/topic/{topic_id}/lessons")
def get_topic_lessons_endpoint(topic_id: str, user: dict = Depends(get_current_user)):
    return learning_service.get_topic_lessons_endpoint(topic_id, user)


@router.post("/api/learning/topic/{topic_id}/lessons/decompose")
def decompose_topic_lessons_endpoint(topic_id: str, user: dict = Depends(get_current_user)):
    return learning_service.decompose_topic_lessons_endpoint(topic_id, user)


@router.put("/api/learning/lesson/{lesson_id}/status")
def update_lesson_status_endpoint(lesson_id: str, req: Dict[str, Any] = Body(...), user: dict = Depends(get_current_user)):
    return learning_service.update_lesson_status_endpoint(lesson_id, req, user)


