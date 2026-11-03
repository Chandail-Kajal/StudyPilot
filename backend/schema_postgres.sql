-- StudyPilot Relational Database Schema for PostgreSQL
-- Supports all 18 core tables, foreign keys with CASCADE, indexes, and constraints.

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'competitive_exam',
    sitting_capacity_mins INTEGER DEFAULT 45,
    goal_mins INTEGER DEFAULT 180,
    settings_focus INTEGER DEFAULT 25,
    settings_short INTEGER DEFAULT 5,
    settings_long INTEGER DEFAULT 15,
    exam_name VARCHAR(255) DEFAULT 'Target Examination',
    exam_date DATE,
    ai_api_key TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. exams
CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    exam_category VARCHAR(100) NOT NULL DEFAULT 'competitive',
    exam_date DATE,
    target_score NUMERIC(6, 2) DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id);

-- 3. syllabus_uploads
CREATE TABLE IF NOT EXISTS syllabus_uploads (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL,
    file_path TEXT,
    upload_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    processing_status VARCHAR(50) NOT NULL DEFAULT 'parsed',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_uploads_exam ON syllabus_uploads(exam_id);

-- 4. subjects
CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(30) DEFAULT '#3E7BE0',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subjects_exam ON subjects(exam_id);

-- 5. syllabus_units
CREATE TABLE IF NOT EXISTS syllabus_units (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    unit_name VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_units_subject ON syllabus_units(subject_id);

-- 6. chapters
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(64) PRIMARY KEY,
    unit_id VARCHAR(64) NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
    chapter_name VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chapters_unit ON chapters(unit_id);

-- 7. topics
CREATE TABLE IF NOT EXISTS topics (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    unit_id VARCHAR(64) REFERENCES syllabus_units(id) ON DELETE SET NULL,
    chapter_id VARCHAR(64) REFERENCES chapters(id) ON DELETE SET NULL,
    topic_name VARCHAR(255) NOT NULL,
    subtopic_name VARCHAR(255),
    difficulty VARCHAR(30) DEFAULT 'medium',
    estimated_minutes INTEGER DEFAULT 60,
    importance VARCHAR(30) DEFAULT 'medium',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_unit ON topics(unit_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON topics(chapter_id);

-- 8. topic_progress
CREATE TABLE IF NOT EXISTS topic_progress (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    completion_percentage INTEGER DEFAULT 0,
    stage INTEGER DEFAULT 0,
    next_revision_date DATE,
    last_studied_at TIMESTAMP WITH TIME ZONE,
    last_revised_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_topic UNIQUE (user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user_topic ON topic_progress(user_id, topic_id);

-- 9. study_plans
CREATE TABLE IF NOT EXISTS study_plans (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    daily_study_minutes INTEGER DEFAULT 180,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plans_user_exam ON study_plans(user_id, exam_id);

-- 10. study_plan_tasks
CREATE TABLE IF NOT EXISTS study_plan_tasks (
    id VARCHAR(64) PRIMARY KEY,
    study_plan_id VARCHAR(64) NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    estimated_minutes INTEGER DEFAULT 45,
    priority VARCHAR(30) DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    activity_type VARCHAR(50) DEFAULT 'learn',
    missed INTEGER DEFAULT 0,
    original_date DATE,
    notes TEXT,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    title TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON study_plan_tasks(study_plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON study_plan_tasks(scheduled_date);

-- 11. question_bank
CREATE TABLE IF NOT EXISTS question_bank (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    unit_id VARCHAR(64) REFERENCES syllabus_units(id) ON DELETE SET NULL,
    topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(30) DEFAULT 'medium',
    marks NUMERIC(4, 2) DEFAULT 1.0,
    negative_marks NUMERIC(4, 2) DEFAULT 0.25,
    source_type VARCHAR(50) DEFAULT 'demo_seed',
    verified_status VARCHAR(50) DEFAULT 'verified',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_qb_exam ON question_bank(exam_id);
CREATE INDEX IF NOT EXISTS idx_qb_topic ON question_bank(topic_id);

-- 12. mock_tests
CREATE TABLE IF NOT EXISTS mock_tests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(50) NOT NULL DEFAULT 'full_syllabus',
    subject_id VARCHAR(64) REFERENCES subjects(id) ON DELETE SET NULL,
    duration_minutes INTEGER DEFAULT 60,
    total_questions INTEGER NOT NULL DEFAULT 10,
    total_marks NUMERIC(6, 2) NOT NULL DEFAULT 10.0,
    negative_marking_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mock_tests_user_exam ON mock_tests(user_id, exam_id);

-- 13. mock_test_topics
CREATE TABLE IF NOT EXISTS mock_test_topics (
    id VARCHAR(64) PRIMARY KEY,
    mock_test_id VARCHAR(64) NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_test_topics ON mock_test_topics(mock_test_id);

-- 14. test_attempts
CREATE TABLE IF NOT EXISTS test_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mock_test_id VARCHAR(64) NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    score NUMERIC(6, 2),
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    unanswered_count INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress'
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON test_attempts(user_id);

-- 15. test_attempt_answers
CREATE TABLE IF NOT EXISTS test_attempt_answers (
    id VARCHAR(64) PRIMARY KEY,
    attempt_id VARCHAR(64) NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id VARCHAR(64) NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
    selected_answer TEXT,
    is_correct BOOLEAN,
    marks_awarded NUMERIC(4, 2),
    time_taken_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attempt_answers ON test_attempt_answers(attempt_id);

-- 16. revision_sessions
CREATE TABLE IF NOT EXISTS revision_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    mock_test_id VARCHAR(64) REFERENCES mock_tests(id) ON DELETE SET NULL,
    trigger_topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    score NUMERIC(6, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress'
);
CREATE INDEX IF NOT EXISTS idx_rev_sessions_user ON revision_sessions(user_id);

-- 17. revision_session_topics
CREATE TABLE IF NOT EXISTS revision_session_topics (
    id VARCHAR(64) PRIMARY KEY,
    revision_session_id VARCHAR(64) NOT NULL REFERENCES revision_sessions(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rev_topics ON revision_session_topics(revision_session_id);

-- 18. monthly_assessments
CREATE TABLE IF NOT EXISTS monthly_assessments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    assessment_month INTEGER NOT NULL CHECK (assessment_month BETWEEN 1 AND 12),
    assessment_year INTEGER NOT NULL,
    mock_test_id VARCHAR(64) REFERENCES mock_tests(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_monthly_user_exam ON monthly_assessments(user_id, exam_id);

-- 19. topic_learning_content (Interactive AI Learning Studio)
CREATE TABLE IF NOT EXISTS topic_learning_content (
    id VARCHAR(64) PRIMARY KEY,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    education_level VARCHAR(50) NOT NULL DEFAULT 'competitive',
    summary TEXT,
    prerequisites JSONB,
    sections JSONB NOT NULL,
    interactive_elements JSONB NOT NULL,
    key_takeaways JSONB,
    comprehension_checks JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (topic_id, education_level)
);
CREATE INDEX IF NOT EXISTS idx_tlc_topic_level ON topic_learning_content(topic_id, education_level);

-- 20. topic_interactions (Comprehension & Activity Tracking)
CREATE TABLE IF NOT EXISTS topic_interactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    has_studied BOOLEAN DEFAULT FALSE,
    has_mastered BOOLEAN DEFAULT FALSE,
    comprehension_score NUMERIC(5, 2) DEFAULT 0.0,
    sections_completed JSONB DEFAULT '[]'::jsonb,
    flashcards_reviewed INTEGER DEFAULT 0,
    quiz_attempts INTEGER DEFAULT 0,
    last_interacted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_ti_user_topic ON topic_interactions(user_id, topic_id);

-- 21. topic_chats (In-Topic Conversational AI Tutor)
CREATE TABLE IF NOT EXISTS topic_chats (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_topic_chats_user_topic ON topic_chats(user_id, topic_id);

-- 22. topic_practice_attempts (Topic-Wise Question Practice)
CREATE TABLE IF NOT EXISTS topic_practice_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question_id VARCHAR(64) NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct BOOLEAN,
    difficulty VARCHAR(50) DEFAULT 'medium',
    hint_used BOOLEAN DEFAULT FALSE,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_practice_user_topic ON topic_practice_attempts(user_id, topic_id);

-- 23. recovery_plans (Smart Recovery Planner)
CREATE TABLE IF NOT EXISTS recovery_plans (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    study_plan_id VARCHAR(64) NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    missed_days_count INTEGER NOT NULL DEFAULT 0,
    missed_task_ids JSONB NOT NULL,
    rescheduled_tasks JSONB NOT NULL,
    feasibility_analysis JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_recovery_user_exam ON recovery_plans(user_id, exam_id);

-- 24. previous_year_papers (PYP Library)
CREATE TABLE IF NOT EXISTS previous_year_papers (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    paper_name VARCHAR(255) NOT NULL,
    paper_type VARCHAR(50) NOT NULL DEFAULT 'official',
    subject_name VARCHAR(255),
    duration_minutes INTEGER DEFAULT 120,
    total_questions INTEGER DEFAULT 50,
    total_marks NUMERIC(6, 2) DEFAULT 100.0,
    source TEXT NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'verified',
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pyp_exam_year ON previous_year_papers(exam_id, year);

-- 25. pyp_questions (Extracted PYP Questions)
CREATE TABLE IF NOT EXISTS pyp_questions (
    id VARCHAR(64) PRIMARY KEY,
    paper_id VARCHAR(64) NOT NULL REFERENCES previous_year_papers(id) ON DELETE CASCADE,
    subject_id VARCHAR(64),
    unit_id VARCHAR(64),
    topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(50) DEFAULT 'medium',
    marks NUMERIC(4, 2) DEFAULT 2.0,
    negative_marks NUMERIC(4, 2) DEFAULT 0.5,
    topic_name VARCHAR(255),
    subject_name VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_pyp_q_paper ON pyp_questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_pyp_q_topic ON pyp_questions(topic_id);

-- 26. topic_trend_analysis (AI Exam Trend Analyzer & Important Topics)
CREATE TABLE IF NOT EXISTS topic_trend_analysis (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    topic_id VARCHAR(64) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    topic_name VARCHAR(255) NOT NULL,
    frequency_count INTEGER DEFAULT 0,
    frequency_category VARCHAR(50) NOT NULL DEFAULT 'moderate',
    years_appeared JSONB NOT NULL DEFAULT '[]'::jsonb,
    weightage_percent NUMERIC(5, 2) DEFAULT 0.0,
    evidence_notes TEXT,
    recommended_action TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (exam_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_trend_exam_topic ON topic_trend_analysis(exam_id, topic_id);

-- 27. predicted_papers (AI Predicted Practice Papers)
CREATE TABLE IF NOT EXISTS predicted_papers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    generation_mode VARCHAR(50) NOT NULL DEFAULT 'exam_pattern',
    target_date VARCHAR(50),
    duration_minutes INTEGER DEFAULT 60,
    total_questions INTEGER DEFAULT 20,
    total_marks NUMERIC(6, 2) DEFAULT 40.0,
    negative_marking_enabled BOOLEAN DEFAULT TRUE,
    questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    disclaimer TEXT NOT NULL DEFAULT 'AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam.',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pred_user_exam ON predicted_papers(user_id, exam_id);
