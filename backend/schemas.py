from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: Optional[str] = "competitive_exam"
    exam_name: Optional[str] = "Target Examination"
    exam_date: Optional[str] = None
    goal_mins: Optional[int] = 180
    prototype_data: Optional[dict] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    exam_name: Optional[str] = None
    exam_date: Optional[str] = None
    goal_mins: Optional[int] = None
    settings_focus: Optional[int] = None
    settings_short: Optional[int] = None
    settings_long: Optional[int] = None
    ai_api_key: Optional[str] = None


class AIKeyUpdateRequest(BaseModel):
    api_key: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class SyncPlanRequest(BaseModel):
    plan: dict


class ImportPlanRequest(BaseModel):
    plan: dict


class AIPlanScheduleRequest(BaseModel):
    syllabus: list = []
    exam_name: Optional[str] = "Mid-term exams"
    exam_date: Optional[str] = None
    sitting_capacity_mins: Optional[int] = 45
    daily_goal_mins: Optional[int] = 180
    yesterday_topics: Optional[list] = None
    api_key: Optional[str] = None


class AIMockTestRequest(BaseModel):
    topics: list = []
    subject_name: Optional[str] = "General"
    num_questions: Optional[int] = 5
    difficulty: Optional[str] = "medium"
    importance_filter: Optional[str] = None
    extract_maximum: Optional[bool] = False
    api_key: Optional[str] = None


class AIFullSyllabusTestRequest(BaseModel):
    syllabus: list = []
    duration_mins: Optional[int] = 60
    difficulty: Optional[str] = "moderate"
    test_number: Optional[int] = 1
    num_questions: Optional[int] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    role: Optional[str] = "competitive_exam"
    api_key: Optional[str] = None


class AIExtractImportanceRequest(BaseModel):
    syllabus: list = []
    exam_name: Optional[str] = "Mid-term exams"
    exam_date: Optional[str] = None
    api_key: Optional[str] = None


class AISubmitTestRequest(BaseModel):
    test_id: str
    title: str
    subject: Optional[str] = "General"
    topics: list = []
    questions: list = []
    user_answers: dict = {}
    time_taken_seconds: Optional[int] = 0


class AIChatRequest(BaseModel):
    message: str
    history: list = []
    syllabus: list = []
    exam_name: Optional[str] = "Mid-term exams"
    exam_date: Optional[str] = None
    yesterday_topics: Optional[list] = None
    current_sitting_capacity: Optional[int] = 45
    api_key: Optional[str] = None


class ExamCreateRequest(BaseModel):
    exam_name: str
    exam_category: Optional[str] = "competitive"
    education_level: Optional[str] = "competitive"
    exam_date: Optional[str] = None
    target_score: Optional[float] = None
    learning_preferences: Optional[dict] = None
    initial_subjects: Optional[List[str]] = None
    daily_study_mins: Optional[int] = None
    sitting_capacity_mins: Optional[int] = None
    preparation_level: Optional[str] = None


class PasteSyllabusRequest(BaseModel):
    raw_text: str
    exam_id: Optional[str] = None
    exam_name: Optional[str] = None
    scope: Optional[str] = "complete"
    subject_name: Optional[str] = None


class ExamUpdateRequest(BaseModel):
    exam_name: Optional[str] = None
    exam_category: Optional[str] = None
    education_level: Optional[str] = None
    exam_date: Optional[str] = None
    target_score: Optional[float] = None
    status: Optional[str] = None
    learning_preferences: Optional[dict] = None


class ConfirmImportRequest(BaseModel):
    exam_id: str
    file_name: str
    file_format: Optional[str] = "xlsx"
    rows: list = []


class SubjectCreateRequest(BaseModel):
    exam_id: str
    subject_name: str
    description: Optional[str] = None
    color: Optional[str] = "#3E7BE0"


class SubjectUpdateRequest(BaseModel):
    subject_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class TopicCreateRequest(BaseModel):
    subject_id: str
    unit_id: Optional[str] = None
    chapter_id: Optional[str] = None
    topic_name: str
    subtopic_name: Optional[str] = None
    difficulty: Optional[str] = "medium"
    estimated_minutes: Optional[int] = 45
    importance: Optional[str] = "medium"


class TopicUpdateRequest(BaseModel):
    topic_name: Optional[str] = None
    subtopic_name: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_minutes: Optional[int] = None
    importance: Optional[str] = None


class TopicProgressUpdateRequest(BaseModel):
    stage: Optional[int] = None
    completion_percentage: Optional[int] = None
    status: Optional[str] = None


class TestConfigureRequest(BaseModel):
    exam_id: str
    test_name: str
    test_type: str = "full_syllabus" # topic_wise, unit_wise, subject_wise, monthly, full_syllabus
    subject_id: Optional[str] = None
    topic_ids: Optional[list] = []
    duration_minutes: Optional[int] = 60
    num_questions: Optional[int] = 10
    difficulty: Optional[str] = "medium"
    negative_marking_enabled: Optional[bool] = True


class SubmitAttemptRequest(BaseModel):
    attempt_id: str
    user_answers: dict = {}
    time_taken_seconds: Optional[int] = 0


class StartRevisionRequest(BaseModel):
    exam_id: str
    topic_id: Optional[str] = None
    topic_ids: Optional[list] = []


class UpdateTaskDetailsRequest(BaseModel):
    scheduled_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = None
    activity_type: Optional[str] = None


class AddCustomTaskRequest(BaseModel):
    exam_id: str
    topic_id: Optional[str] = None
    title: str
    scheduled_date: str
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "09:45"
    activity_type: Optional[str] = "class"
    estimated_minutes: Optional[int] = 45
    priority: Optional[str] = "medium"
    notes: Optional[str] = None


class TopicInteractionUpdateRequest(BaseModel):
    sections_completed: Optional[list] = []
    flashcards_reviewed: Optional[int] = 0
    quiz_attempts: Optional[int] = 0
    comprehension_score: Optional[float] = 0.0
    video_watched_seconds: Optional[int] = 0
    audio_listened_seconds: Optional[int] = 0
    incorrect_answers_count: Optional[int] = 0
    repeated_explanations_count: Optional[int] = 0
    mark_studied: Optional[bool] = False
    mark_mastered: Optional[bool] = False


class TopicChatRequest(BaseModel):
    message: str
    history: Optional[list] = []


class TopicPracticeSubmitRequest(BaseModel):
    question_id: str
    difficulty: str
    question_text: str
    correct_answer: str
    user_answer: str
    question_type: Optional[str] = "single_choice"
    time_spent_seconds: Optional[int] = 0
    used_hint: Optional[bool] = False


class AdaptivePlanCreateRequest(BaseModel):
    exam_id: str
    daily_study_hours: Optional[float] = 3.0
    available_days: Optional[list] = ["mon", "tue", "wed", "thu", "fri", "sat"]
    sitting_times: Optional[list] = ["morning", "evening"]
    buffer_days: Optional[int] = 5
    learning_pace: Optional[str] = "normal"
    break_interval_mins: Optional[int] = 45
    revision_ratio: Optional[float] = 0.25
    exam_date: Optional[str] = None


class RecoveryApplyRequest(BaseModel):
    plan_id: str
    apply_mode: Optional[str] = "accept_proposal"


class PYPCreateRequest(BaseModel):
    exam_id: str
    year: int
    title: str
    subject: Optional[str] = "All Subjects"
    paper_type: Optional[str] = "official"
    source: Optional[str] = "Official Examination Board"
    verification_status: Optional[str] = "verified"
    total_questions: Optional[int] = 50
    total_marks: Optional[float] = 100.0
    duration_minutes: Optional[int] = 120
    raw_content: Optional[str] = None
    questions: Optional[list] = []


class PredictedPaperGenerateRequest(BaseModel):
    exam_id: str
    subject_name: Optional[str] = "All Subjects"
    generation_mode: Optional[str] = "exam_pattern"
    num_questions: Optional[int] = 20
    target_date: Optional[str] = None
    time_limit_mins: Optional[int] = 60


class GenerateVideoRequest(BaseModel):
    engine: Optional[str] = "remotion"  # 'remotion', 'manim', 'hybrid'
