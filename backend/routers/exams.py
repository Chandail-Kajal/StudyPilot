from fastapi import APIRouter

from routers.common import *
from schemas import *
from services import exams_service


router = APIRouter()


@router.get("/api/exams")
def get_user_exams(user: dict = Depends(get_current_user)):
    return exams_service.get_user_exams(user)


@router.post("/api/exams")
def create_user_exam(req: ExamCreateRequest, user: dict = Depends(get_current_user)):
    return exams_service.create_user_exam(req, user)


@router.post("/api/exams/create-with-syllabus")
async def create_exam_with_syllabus(
    exam_name: str = Form(...),
    exam_date: Optional[str] = Form(None),
    exam_category: Optional[str] = Form("competitive"),
    education_level: Optional[str] = Form("competitive"),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    return await exams_service.create_exam_with_syllabus(exam_name, exam_date, exam_category, education_level, file, user)


@router.get("/api/exams/{exam_id}")
def get_single_exam_details(exam_id: str, user: dict = Depends(get_current_user)):
    return exams_service.get_single_exam_details(exam_id, user)


@router.put("/api/exams/{exam_id}")
def update_user_exam(exam_id: str, req: ExamUpdateRequest, user: dict = Depends(get_current_user)):
    return exams_service.update_user_exam(exam_id, req, user)


@router.delete("/api/exams/{exam_id}")
def delete_user_exam(exam_id: str, user: dict = Depends(get_current_user)):
    return exams_service.delete_user_exam(exam_id, user)


@router.post("/api/syllabus/upload-preview")
async def syllabus_upload_preview(
    file: UploadFile = File(...),
    exam_id: Optional[str] = Form(None),
    exam_name: Optional[str] = Form(None),
    scope: Optional[str] = Form("complete"), # "complete" or "subject"
    subject_name: Optional[str] = Form(None),
    column_mapping: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    return await exams_service.syllabus_upload_preview(file, exam_id, exam_name, scope, subject_name, column_mapping, user)


@router.post("/api/syllabus/paste-preview")
async def syllabus_paste_preview(req: PasteSyllabusRequest, user: dict = Depends(get_current_user)):
    return await exams_service.syllabus_paste_preview(req, user)


@router.post("/api/syllabus/confirm-import")
def syllabus_confirm_import(req: ConfirmImportRequest, user: dict = Depends(get_current_user)):
    return exams_service.syllabus_confirm_import(req, user)


@router.get("/api/syllabus/uploads/{exam_id}")
def get_syllabus_uploads(exam_id: str, user: dict = Depends(get_current_user)):
    return exams_service.get_syllabus_uploads(exam_id, user)


@router.get("/api/syllabus/hierarchy/{exam_id}")
def get_syllabus_hierarchy(exam_id: str, user: dict = Depends(get_current_user)):
    return exams_service.get_syllabus_hierarchy(exam_id, user)


@router.post("/api/syllabus/subjects")
def create_subject(req: SubjectCreateRequest, user: dict = Depends(get_current_user)):
    return exams_service.create_subject(req, user)


@router.delete("/api/syllabus/subjects/{subject_id}")
def delete_subject(subject_id: str, user: dict = Depends(get_current_user)):
    return exams_service.delete_subject(subject_id, user)


@router.post("/api/syllabus/topics")
def create_topic(req: TopicCreateRequest, user: dict = Depends(get_current_user)):
    return exams_service.create_topic(req, user)


@router.delete("/api/syllabus/topics/{topic_id}")
def delete_topic(topic_id: str, user: dict = Depends(get_current_user)):
    return exams_service.delete_topic(topic_id, user)


@router.get("/api/progress/{exam_id}")
def get_topic_progress_list(exam_id: str, user: dict = Depends(get_current_user)):
    return exams_service.get_topic_progress_list(exam_id, user)


@router.put("/api/progress/{topic_id}")
def update_topic_progress(topic_id: str, req: TopicProgressUpdateRequest, user: dict = Depends(get_current_user)):
    return exams_service.update_topic_progress(topic_id, req, user)

