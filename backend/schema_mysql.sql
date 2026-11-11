-- StudyPilot Relational Database Schema for MySQL
-- Complete schema for all 27 tables + auth session tables matching runtime database.

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'competitive_exam',
    sitting_capacity_mins INT DEFAULT 45,
    goal_mins INT DEFAULT 180,
    settings_focus INT DEFAULT 25,
    settings_short INT DEFAULT 5,
    settings_long INT DEFAULT 15,
    exam_name VARCHAR(255) DEFAULT 'Target Examination',
    exam_date VARCHAR(50) NULL,
    ai_api_key TEXT NULL,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tokens (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    expires_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_resets (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    expires_at VARCHAR(100) NOT NULL,
    used INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_plans (
    user_id VARCHAR(64) PRIMARY KEY,
    plan_json LONGTEXT NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    version INT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    exam_category VARCHAR(100) NOT NULL DEFAULT 'competitive',
    education_level VARCHAR(64) DEFAULT 'competitive',
    exam_date VARCHAR(50) NULL,
    target_score DECIMAL(6, 2) NULL,
    learning_preferences LONGTEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exams_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syllabus_uploads (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL,
    file_path TEXT NULL,
    upload_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    processing_status VARCHAR(50) NOT NULL DEFAULT 'parsed',
    uploaded_at VARCHAR(100) NOT NULL,
    processed_at VARCHAR(100) NULL,
    error_message TEXT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_uploads_exam (exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    color VARCHAR(30) DEFAULT '#3E7BE0',
    display_order INT DEFAULT 0,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_subjects_exam (exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syllabus_units (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    INDEX idx_units_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(64) PRIMARY KEY,
    unit_id VARCHAR(64) NOT NULL,
    chapter_name VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    FOREIGN KEY (unit_id) REFERENCES syllabus_units(id) ON DELETE CASCADE,
    INDEX idx_chapters_unit (unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topics (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL,
    unit_id VARCHAR(64) NULL,
    chapter_id VARCHAR(64) NULL,
    topic_name VARCHAR(255) NOT NULL,
    subtopic_name VARCHAR(255) NULL,
    difficulty VARCHAR(30) DEFAULT 'medium',
    estimated_minutes INT DEFAULT 60,
    importance VARCHAR(30) DEFAULT 'medium',
    display_order INT DEFAULT 0,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES syllabus_units(id) ON DELETE SET NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    INDEX idx_topics_subject (subject_id),
    INDEX idx_topics_unit (unit_id),
    INDEX idx_topics_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_progress (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    completion_percentage INT DEFAULT 0,
    stage INT DEFAULT 0,
    next_revision_date VARCHAR(50) NULL,
    last_studied_at VARCHAR(100) NULL,
    last_revised_at VARCHAR(100) NULL,
    updated_at VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_user_topic (user_id, topic_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_progress_user_topic (user_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS study_plans (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    start_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50) NULL,
    daily_study_minutes INT DEFAULT 180,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    available_days LONGTEXT NULL,
    sitting_times LONGTEXT NULL,
    buffer_days INT DEFAULT 3,
    learning_pace VARCHAR(50) DEFAULT 'moderate',
    missed_tasks_count INT DEFAULT 0,
    last_replan_at VARCHAR(100) NULL,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_plans_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS study_plan_tasks (
    id VARCHAR(64) PRIMARY KEY,
    study_plan_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    scheduled_date VARCHAR(50) NOT NULL,
    estimated_minutes INT DEFAULT 45,
    priority VARCHAR(30) DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at VARCHAR(100) NULL,
    activity_type VARCHAR(50) DEFAULT 'learn',
    missed INT DEFAULT 0,
    original_date VARCHAR(50) NULL,
    notes TEXT NULL,
    start_time VARCHAR(10) NULL,
    end_time VARCHAR(10) NULL,
    title TEXT NULL,
    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_tasks_plan (study_plan_id),
    INDEX idx_tasks_date (scheduled_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_bank (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    unit_id VARCHAR(64) NULL,
    topic_id VARCHAR(64) NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    options LONGTEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT NULL,
    difficulty VARCHAR(30) DEFAULT 'medium',
    marks DECIMAL(4, 2) DEFAULT 1.0,
    negative_marks DECIMAL(4, 2) DEFAULT 0.25,
    source_type VARCHAR(50) DEFAULT 'demo_seed',
    verified_status VARCHAR(50) DEFAULT 'verified',
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES syllabus_units(id) ON DELETE SET NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    INDEX idx_qb_exam (exam_id),
    INDEX idx_qb_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mock_tests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(50) NOT NULL DEFAULT 'full_syllabus',
    subject_id VARCHAR(64) NULL,
    duration_minutes INT DEFAULT 60,
    total_questions INT NOT NULL DEFAULT 10,
    total_marks DECIMAL(6, 2) NOT NULL DEFAULT 10.0,
    negative_marking_enabled TINYINT(1) DEFAULT 1,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    INDEX idx_mock_tests_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mock_test_topics (
    id VARCHAR(64) PRIMARY KEY,
    mock_test_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    FOREIGN KEY (mock_test_id) REFERENCES mock_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_mtt_test (mock_test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS test_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    mock_test_id VARCHAR(64) NOT NULL,
    started_at VARCHAR(100) NOT NULL,
    submitted_at VARCHAR(100) NULL,
    score DECIMAL(6, 2) DEFAULT 0.0,
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    unanswered_count INT DEFAULT 0,
    time_taken_seconds INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    FOREIGN KEY (mock_test_id) REFERENCES mock_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_attempts_user_exam (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS test_attempt_answers (
    id VARCHAR(64) PRIMARY KEY,
    attempt_id VARCHAR(64) NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    selected_answer TEXT NULL,
    is_correct TINYINT(1) DEFAULT 0,
    marks_awarded DECIMAL(4, 2) DEFAULT 0.0,
    time_taken_seconds INT DEFAULT 0,
    FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE,
    INDEX idx_taa_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS revision_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    mock_test_id VARCHAR(64) NULL,
    trigger_topic_id VARCHAR(64) NULL,
    started_at VARCHAR(100) NOT NULL,
    completed_at VARCHAR(100) NULL,
    score DECIMAL(6, 2) DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'scheduled',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_rev_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS revision_session_topics (
    id VARCHAR(64) PRIMARY KEY,
    revision_session_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    review_order INT DEFAULT 0,
    completed TINYINT(1) DEFAULT 0,
    FOREIGN KEY (revision_session_id) REFERENCES revision_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_rst_session (revision_session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS monthly_assessments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    assessment_month INT NOT NULL,
    assessment_year INT NOT NULL,
    mock_test_id VARCHAR(64) NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_monthly_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_learning_content (
    id VARCHAR(64) PRIMARY KEY,
    topic_id VARCHAR(64) NOT NULL,
    education_level VARCHAR(64) NOT NULL,
    summary TEXT NULL,
    prerequisites LONGTEXT NULL,
    sections LONGTEXT NOT NULL,
    interactive_elements LONGTEXT NOT NULL,
    key_takeaways LONGTEXT NULL,
    comprehension_checks LONGTEXT NULL,
    version INT DEFAULT 1,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_tlc_topic_level (topic_id, education_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_interactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    has_studied BOOLEAN DEFAULT TRUE,
    has_mastered BOOLEAN DEFAULT FALSE,
    comprehension_score DECIMAL(5, 2) DEFAULT 0.0,
    sections_completed LONGTEXT NULL,
    flashcards_reviewed INT DEFAULT 0,
    quiz_attempts INT DEFAULT 0,
    video_watched_seconds INT DEFAULT 0,
    audio_listened_seconds INT DEFAULT 0,
    incorrect_answers_count INT DEFAULT 0,
    repeated_explanations_count INT DEFAULT 0,
    last_interacted_at VARCHAR(100) NULL,
    updated_at VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_user_topic (user_id, topic_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_ti_user_topic (user_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_chats (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_topic_chats_user_topic (user_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_practice_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    user_answer TEXT NULL,
    is_correct BOOLEAN NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    hint_used BOOLEAN DEFAULT FALSE,
    feedback TEXT NULL,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE,
    INDEX idx_practice_user_topic (user_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recovery_plans (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    study_plan_id VARCHAR(64) NOT NULL,
    missed_days_count INT NOT NULL DEFAULT 0,
    missed_task_ids LONGTEXT NOT NULL,
    rescheduled_tasks LONGTEXT NOT NULL,
    feasibility_analysis LONGTEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at VARCHAR(100) NOT NULL,
    applied_at VARCHAR(100) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
    INDEX idx_recovery_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS previous_year_papers (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    paper_name VARCHAR(255) NOT NULL,
    paper_type VARCHAR(50) NOT NULL DEFAULT 'official',
    subject_name VARCHAR(255) NULL,
    duration_minutes INT DEFAULT 120,
    total_questions INT DEFAULT 50,
    total_marks DECIMAL(6, 2) DEFAULT 100.0,
    source TEXT NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'verified',
    file_path VARCHAR(500) NULL,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_pyp_exam_year (exam_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pyp_questions (
    id VARCHAR(64) PRIMARY KEY,
    paper_id VARCHAR(64) NOT NULL,
    subject_id VARCHAR(64) NULL,
    unit_id VARCHAR(64) NULL,
    topic_id VARCHAR(64) NULL,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    options LONGTEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    marks DECIMAL(4, 2) DEFAULT 2.0,
    negative_marks DECIMAL(4, 2) DEFAULT 0.5,
    topic_name VARCHAR(255) NULL,
    subject_name VARCHAR(255) NULL,
    FOREIGN KEY (paper_id) REFERENCES previous_year_papers(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    INDEX idx_pyp_q_paper (paper_id),
    INDEX idx_pyp_q_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS topic_trend_analysis (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    topic_name VARCHAR(255) NOT NULL,
    frequency_count INT DEFAULT 0,
    frequency_category VARCHAR(50) NOT NULL DEFAULT 'moderate',
    years_appeared LONGTEXT NOT NULL,
    weightage_percent DECIMAL(5, 2) DEFAULT 0.0,
    evidence_notes TEXT NULL,
    recommended_action TEXT NULL,
    updated_at VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_trend_exam_topic (exam_id, topic_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_trend_exam_topic (exam_id, topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS predicted_papers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    generation_mode VARCHAR(50) NOT NULL DEFAULT 'exam_pattern',
    target_date VARCHAR(50) NULL,
    duration_minutes INT DEFAULT 60,
    total_questions INT DEFAULT 20,
    total_marks DECIMAL(6, 2) DEFAULT 40.0,
    negative_marking_enabled BOOLEAN DEFAULT TRUE,
    questions_json LONGTEXT NOT NULL,
    disclaimer TEXT NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_pred_user_exam (user_id, exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS educational_videos (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    exam_id VARCHAR(64) NULL,
    title VARCHAR(255) NOT NULL,
    engine VARCHAR(50) NOT NULL DEFAULT 'remotion',
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    duration_seconds DECIMAL(6, 2) DEFAULT 0.0,
    video_url TEXT NULL,
    audio_url TEXT NULL,
    thumbnail_url TEXT NULL,
    script_json LONGTEXT NULL,
    scenes_json LONGTEXT NULL,
    subtitles_json LONGTEXT NULL,
    error_message TEXT NULL,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    INDEX idx_video_topic (topic_id),
    INDEX idx_video_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
