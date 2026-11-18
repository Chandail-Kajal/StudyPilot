from fastapi import APIRouter

from routers.common import *
from schemas import *
from services import study_service


router = APIRouter()


@router.get("/api/study-plans/{exam_id}")
def get_study_plan(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_study_plan(exam_id, user)


@router.put("/api/study-plans/tasks/{task_id}")
def toggle_study_task(task_id: str, user: dict = Depends(get_current_user)):
    return study_service.toggle_study_task(task_id, user)


@router.patch("/api/study-plans/tasks/{task_id}")
def update_task_details(task_id: str, req: UpdateTaskDetailsRequest, user: dict = Depends(get_current_user)):
    return study_service.update_task_details(task_id, req, user)


@router.post("/api/study-plans/custom-task")
def add_custom_study_task(req: AddCustomTaskRequest, user: dict = Depends(get_current_user)):
    return study_service.add_custom_study_task(req, user)


@router.delete("/api/study-plans/tasks/{task_id}")
def delete_study_task(task_id: str, user: dict = Depends(get_current_user)):
    return study_service.delete_study_task(task_id, user)


@router.get("/api/revision/due/{exam_id}")
def get_due_revisions(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_due_revisions(exam_id, user)


@router.post("/api/revision/sessions")
def start_revision_session(req: StartRevisionRequest, user: dict = Depends(get_current_user)):
    return study_service.start_revision_session(req, user)


@router.put("/api/revision/sessions/{session_id}/complete")
def complete_revision_session(session_id: str, score: Optional[float] = 100.0, user: dict = Depends(get_current_user)):
    return study_service.complete_revision_session(session_id, score, user)


@router.get("/api/tests/available/{exam_id}")
def get_available_tests(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_available_tests(exam_id, user)


@router.post("/api/tests/configure")
def configure_mock_test(req: TestConfigureRequest, user: dict = Depends(get_current_user)):
    return study_service.configure_mock_test(req, user)


@router.get("/api/tests/{test_id}/start")
def start_test_attempt(test_id: str, user: dict = Depends(get_current_user)):
    return study_service.start_test_attempt(test_id, user)


@router.post("/api/tests/{test_id}/submit")
def submit_test_attempt(test_id: str, req: SubmitAttemptRequest, user: dict = Depends(get_current_user)):
    return study_service.submit_test_attempt(test_id, req, user)


@router.get("/api/tests/attempts/{attempt_id}")
def get_attempt_review(attempt_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_attempt_review(attempt_id, user)


@router.get("/api/tests/history/{exam_id}")
def get_exam_tests_history(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_exam_tests_history(exam_id, user)


@router.get("/api/analytics/{exam_id}")
def get_exam_analytics(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_exam_analytics(exam_id, user)


@router.post("/api/admin/seed")
def trigger_database_seed():
    return study_service.trigger_database_seed()


@router.post("/api/planner/adaptive-create")
def create_adaptive_study_plan(req: AdaptivePlanCreateRequest, user: dict = Depends(get_current_user)):
    return study_service.create_adaptive_study_plan(req, user)


@router.get("/api/planner/adaptive-plan/{exam_id}")
def get_adaptive_study_plan(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_adaptive_study_plan(exam_id, user)


@router.get("/api/planner/recovery/analyze/{exam_id}")
def analyze_smart_recovery(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.analyze_smart_recovery(exam_id, user)


@router.post("/api/planner/recovery/apply/{recovery_id}")
def apply_smart_recovery_plan(recovery_id: str, req: RecoveryApplyRequest, user: dict = Depends(get_current_user)):
    return study_service.apply_smart_recovery_plan(recovery_id, req, user)


@router.get("/api/pyp/papers/{exam_id}")
def get_previous_year_papers(
    exam_id: str,
    year: Optional[int] = None,
    subject: Optional[str] = None,
    paper_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    return study_service.get_previous_year_papers(exam_id, year, subject, paper_type, verification_status, user)


@router.post("/api/pyp/papers")
def create_previous_year_paper(req: PYPCreateRequest, user: dict = Depends(get_current_user)):
    return study_service.create_previous_year_paper(req, user)


@router.get("/api/pyp/papers/detail/{paper_id}")
def get_pyp_paper_detail(paper_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_pyp_paper_detail(paper_id, user)


@router.get("/api/pyp/trends/{exam_id}")
def get_pyp_trend_analysis(exam_id: str, refresh: Optional[bool] = False, user: dict = Depends(get_current_user)):
    return study_service.get_pyp_trend_analysis(exam_id, refresh, user)


@router.post("/api/predicted-paper/generate")
async def generate_ai_predicted_paper(req: PredictedPaperGenerateRequest, user: dict = Depends(get_current_user)):
    return await study_service.generate_ai_predicted_paper(req, user)


@router.get("/api/predicted-paper/{paper_id}")
def get_predicted_paper_detail(paper_id: str, user: dict = Depends(get_current_user)):
    return study_service.get_predicted_paper_detail(paper_id, user)


@router.get("/api/predicted-paper/list/{exam_id}")
def list_predicted_papers(exam_id: str, user: dict = Depends(get_current_user)):
    return study_service.list_predicted_papers(exam_id, user)

