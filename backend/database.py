import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_PATH = os.path.join(os.path.dirname(__file__), "studypilot.db")

class MySQLRow(dict):
    """Row adapter that allows dictionary key access, integer index access, and dict methods."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)

    def keys(self):
        return super().keys()

class MySQLCursorWrapper:
    """Cursor wrapper that transparently converts SQLite-style syntax to MySQL."""
    def __init__(self, cursor):
        self._cur = cursor
        self._is_pragma = False

    def execute(self, query, params=None):
        if query.strip().upper().startswith("PRAGMA"):
            self._is_pragma = True
            return self
        self._is_pragma = False
        import re
        q = query.replace("?", "%s")
        q = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT IGNORE INTO', q, flags=re.IGNORECASE)
        q = re.sub(r'INSERT\s+OR\s+REPLACE\s+INTO', 'REPLACE INTO', q, flags=re.IGNORECASE)
        q = re.sub(r'COLLATE\s+NOCASE', '', q, flags=re.IGNORECASE)
        q = re.sub(r'\bRANDOM\(\)', 'RAND()', q, flags=re.IGNORECASE)
        if re.search(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+NOTHING', q, flags=re.IGNORECASE):
            q = re.sub(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+NOTHING', '', q, flags=re.IGNORECASE)
            q = re.sub(r'INSERT\s+INTO', 'INSERT IGNORE INTO', q, flags=re.IGNORECASE)
        if re.search(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+UPDATE\s+SET', q, flags=re.IGNORECASE):
            q = re.sub(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+UPDATE\s+SET', 'ON DUPLICATE KEY UPDATE', q, flags=re.IGNORECASE)
            q = re.sub(r'excluded\.(\w+)', r'VALUES(\1)', q, flags=re.IGNORECASE)
        if params is not None:
            return self._cur.execute(q, params)
        return self._cur.execute(q)

    def executemany(self, query, params_seq):
        self._is_pragma = False
        import re
        q = query.replace("?", "%s")
        q = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT IGNORE INTO', q, flags=re.IGNORECASE)
        q = re.sub(r'INSERT\s+OR\s+REPLACE\s+INTO', 'REPLACE INTO', q, flags=re.IGNORECASE)
        q = re.sub(r'COLLATE\s+NOCASE', '', q, flags=re.IGNORECASE)
        q = re.sub(r'\bRANDOM\(\)', 'RAND()', q, flags=re.IGNORECASE)
        if re.search(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+NOTHING', q, flags=re.IGNORECASE):
            q = re.sub(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+NOTHING', '', q, flags=re.IGNORECASE)
            q = re.sub(r'INSERT\s+INTO', 'INSERT IGNORE INTO', q, flags=re.IGNORECASE)
        if re.search(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+UPDATE\s+SET', q, flags=re.IGNORECASE):
            q = re.sub(r'ON\s+CONFLICT\s*\(.*?\)\s*DO\s+UPDATE\s+SET', 'ON DUPLICATE KEY UPDATE', q, flags=re.IGNORECASE)
            q = re.sub(r'excluded\.(\w+)', r'VALUES(\1)', q, flags=re.IGNORECASE)
        return self._cur.executemany(q, params_seq)

    def fetchone(self):
        if self._is_pragma:
            return None
        r = self._cur.fetchone()
        return MySQLRow(r) if r is not None else None

    def fetchall(self):
        if self._is_pragma:
            return []
        rows = self._cur.fetchall()
        return [MySQLRow(r) for r in rows]

    @property
    def description(self):
        return self._cur.description

    @property
    def lastrowid(self):
        return self._cur.lastrowid

    def close(self):
        self._cur.close()

class MySQLConnectionWrapper:
    """Connection wrapper around PyMySQL connection matching sqlite3 connection interface."""
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        return MySQLCursorWrapper(self._conn.cursor())

    def execute(self, query, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def executemany(self, query, params_seq):
        cur = self.cursor()
        cur.executemany(query, params_seq)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

class MySQLRow(dict):
    """Row adapter that allows dictionary key access, integer index access, and dict methods."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)

    def keys(self):
        return super().keys()

class MySQLConnectionWrapper:
    """Connection wrapper around PyMySQL connection matching sqlite3 connection interface."""
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        return MySQLCursorWrapper(self._conn.cursor())

    def execute(self, query, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def executemany(self, query, params_seq):
        cur = self.cursor()
        cur.executemany(query, params_seq)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

def get_db():
    db_type = os.getenv("DB_TYPE", "mysql").lower()
    if db_type == "mysql":
        try:
            import pymysql
            import pymysql.cursors
            host = os.getenv("MYSQL_HOST", "localhost")
            port = int(os.getenv("MYSQL_PORT", 3306))
            user = os.getenv("MYSQL_USER", "root")
            password = os.getenv("MYSQL_PASSWORD", "root")
            database = os.getenv("MYSQL_DB", "studypilot_db")

            raw_conn = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
            return MySQLConnectionWrapper(raw_conn)
        except Exception as e:
            print(f"[Database Notice] MySQL connection failed ({e}). Falling back to SQLite.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enforce foreign key constraints in SQLite
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    db_type = os.getenv("DB_TYPE", "mysql").lower()
    if db_type == "mysql":
        try:
            import pymysql
            host = os.getenv("MYSQL_HOST", "localhost")
            port = int(os.getenv("MYSQL_PORT", 3306))
            user = os.getenv("MYSQL_USER", "root")
            password = os.getenv("MYSQL_PASSWORD", "root")
            database = os.getenv("MYSQL_DB", "studypilot_db")

            m_init = pymysql.connect(host=host, port=port, user=user, password=password)
            with m_init.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            m_init.close()

            schema_path = os.path.join(os.path.dirname(__file__), "schema_mysql.sql")
            if os.path.exists(schema_path):
                conn = get_db()
                cur = conn.cursor()
                with open(schema_path, "r", encoding="utf-8") as f:
                    for stmt in f.read().split(";"):
                        s = stmt.strip()
                        if s:
                            try:
                                cur.execute(s)
                            except Exception:
                                pass
                conn.commit()
                conn.close()
            return
        except Exception as e:
            print(f"[Database Notice] MySQL init failed ({e}). Initializing SQLite.")

    conn = get_db()
    cursor = conn.cursor()
    
    # 1. users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'competitive_exam',
        sitting_capacity_mins INTEGER DEFAULT 45,
        goal_mins INTEGER DEFAULT 180,
        settings_focus INTEGER DEFAULT 25,
        settings_short INTEGER DEFAULT 5,
        settings_long INTEGER DEFAULT 15,
        exam_name TEXT DEFAULT 'Target Examination',
        exam_date TEXT,
        ai_api_key TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # Migration for users table
    cursor.execute("PRAGMA table_info(users);")
    user_cols = [row["name"] for row in cursor.fetchall()]
    if "updated_at" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT '';")
    if "sitting_capacity_mins" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN sitting_capacity_mins INTEGER DEFAULT 45;")
    if "ai_api_key" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN ai_api_key TEXT DEFAULT NULL;")
    if "role" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'competitive_exam';")
    if "exam_name" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN exam_name TEXT DEFAULT 'Target Examination';")
    if "exam_date" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN exam_date TEXT DEFAULT NULL;")
    if "goal_mins" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN goal_mins INTEGER DEFAULT 180;")
    if "settings_focus" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN settings_focus INTEGER DEFAULT 25;")
    if "settings_short" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN settings_short INTEGER DEFAULT 5;")
    if "settings_long" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN settings_long INTEGER DEFAULT 15;")

    # Auth tokens & Password resets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Legacy cloud sync table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_plans (
        user_id TEXT PRIMARY KEY,
        plan_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # 2. exams
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_name TEXT NOT NULL,
        exam_category TEXT NOT NULL DEFAULT 'competitive',
        exam_date TEXT,
        target_score REAL DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id);")

    # 3. syllabus_uploads
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS syllabus_uploads (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_format TEXT NOT NULL,
        file_path TEXT,
        upload_status TEXT NOT NULL DEFAULT 'uploaded',
        processing_status TEXT NOT NULL DEFAULT 'parsed',
        uploaded_at TEXT NOT NULL,
        processed_at TEXT,
        error_message TEXT,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_uploads_exam ON syllabus_uploads(exam_id);")

    # 4. subjects
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3E7BE0',
        display_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subjects_exam ON subjects(exam_id);")

    # 5. syllabus_units
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS syllabus_units (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        unit_name TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_units_subject ON syllabus_units(subject_id);")

    # 6. chapters
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        chapter_name TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (unit_id) REFERENCES syllabus_units (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chapters_unit ON chapters(unit_id);")

    # 7. topics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        unit_id TEXT,
        chapter_id TEXT,
        topic_name TEXT NOT NULL,
        subtopic_name TEXT,
        difficulty TEXT DEFAULT 'medium',
        estimated_minutes INTEGER DEFAULT 60,
        importance TEXT DEFAULT 'medium',
        display_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES syllabus_units (id) ON DELETE SET NULL,
        FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_topics_unit ON topics(unit_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_topics_chapter ON topics(chapter_id);")

    # 8. topic_progress
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        completion_percentage INTEGER DEFAULT 0,
        stage INTEGER DEFAULT 0,
        next_revision_date TEXT,
        last_studied_at TEXT,
        last_revised_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, topic_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_progress_user_topic ON topic_progress(user_id, topic_id);")

    # 9. study_plans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        daily_study_minutes INTEGER DEFAULT 180,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plans_user_exam ON study_plans(user_id, exam_id);")

    # 10. study_plan_tasks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plan_tasks (
        id TEXT PRIMARY KEY,
        study_plan_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        estimated_minutes INTEGER DEFAULT 45,
        priority TEXT DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TEXT,
        activity_type TEXT DEFAULT 'learn',
        missed INTEGER DEFAULT 0,
        original_date TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        start_time TEXT DEFAULT NULL,
        end_time TEXT DEFAULT NULL,
        title TEXT DEFAULT NULL,
        FOREIGN KEY (study_plan_id) REFERENCES study_plans (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_plan ON study_plan_tasks(study_plan_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_date ON study_plan_tasks(scheduled_date);")

    # 11. question_bank
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS question_bank (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        unit_id TEXT,
        topic_id TEXT,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'single_choice',
        options TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'medium',
        marks REAL DEFAULT 1.0,
        negative_marks REAL DEFAULT 0.25,
        source_type TEXT DEFAULT 'demo_seed',
        verified_status TEXT DEFAULT 'verified',
        created_at TEXT NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES syllabus_units (id) ON DELETE SET NULL,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_qb_exam ON question_bank(exam_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_qb_topic ON question_bank(topic_id);")

    # 12. mock_tests migration & creation
    cursor.execute("PRAGMA table_info(mock_tests);")
    mt_cols = [row["name"] for row in cursor.fetchall()]
    if mt_cols and "exam_id" not in mt_cols:
        # Recreate mock_tests to match relational schema
        cursor.execute("DROP TABLE IF EXISTS mock_tests;")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_tests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        test_type TEXT NOT NULL DEFAULT 'full_syllabus',
        subject_id TEXT,
        duration_minutes INTEGER DEFAULT 60,
        total_questions INTEGER NOT NULL DEFAULT 10,
        total_marks REAL NOT NULL DEFAULT 10.0,
        negative_marking_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mock_tests_user_exam ON mock_tests(user_id, exam_id);")

    # 13. mock_test_topics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_test_topics (
        id TEXT PRIMARY KEY,
        mock_test_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        FOREIGN KEY (mock_test_id) REFERENCES mock_tests (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_topics ON mock_test_topics(mock_test_id);")

    # 14. test_attempts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS test_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mock_test_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        submitted_at TEXT,
        score REAL,
        correct_count INTEGER DEFAULT 0,
        incorrect_count INTEGER DEFAULT 0,
        unanswered_count INTEGER DEFAULT 0,
        time_taken_seconds INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'in_progress',
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (mock_test_id) REFERENCES mock_tests (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_user ON test_attempts(user_id);")

    # 15. test_attempt_answers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS test_attempt_answers (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        selected_answer TEXT,
        is_correct INTEGER,
        marks_awarded REAL,
        time_taken_seconds INTEGER,
        FOREIGN KEY (attempt_id) REFERENCES test_attempts (id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES question_bank (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempt_answers ON test_attempt_answers(attempt_id);")

    # 16. revision_sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS revision_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        mock_test_id TEXT,
        trigger_topic_id TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        score REAL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (mock_test_id) REFERENCES mock_tests (id) ON DELETE SET NULL,
        FOREIGN KEY (trigger_topic_id) REFERENCES topics (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rev_sessions_user ON revision_sessions(user_id);")

    # 17. revision_session_topics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS revision_session_topics (
        id TEXT PRIMARY KEY,
        revision_session_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        FOREIGN KEY (revision_session_id) REFERENCES revision_sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rev_topics ON revision_session_topics(revision_session_id);")

    # 18. monthly_assessments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS monthly_assessments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        assessment_month INTEGER NOT NULL,
        assessment_year INTEGER NOT NULL,
        mock_test_id TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (mock_test_id) REFERENCES mock_tests (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_monthly_user_exam ON monthly_assessments(user_id, exam_id);")

    # Migration for exams table (education_level & learning_preferences)
    cursor.execute("PRAGMA table_info(exams);")
    exam_cols = [row["name"] for row in cursor.fetchall()]
    if "education_level" not in exam_cols:
        cursor.execute("ALTER TABLE exams ADD COLUMN education_level TEXT DEFAULT 'competitive';")
    if "learning_preferences" not in exam_cols:
        cursor.execute("ALTER TABLE exams ADD COLUMN learning_preferences TEXT DEFAULT '{}';")

    # Migration for study_plans table (adaptive parameters)
    cursor.execute("PRAGMA table_info(study_plans);")
    sp_cols = [row["name"] for row in cursor.fetchall()]
    if "available_days" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN available_days TEXT DEFAULT '[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"]';")
    if "sitting_times" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN sitting_times TEXT DEFAULT '[\"morning\",\"evening\"]';")
    if "buffer_days" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN buffer_days INTEGER DEFAULT 3;")
    if "learning_pace" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN learning_pace TEXT DEFAULT 'moderate';")
    if "missed_tasks_count" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN missed_tasks_count INTEGER DEFAULT 0;")
    if "last_replan_at" not in sp_cols:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN last_replan_at TEXT DEFAULT NULL;")

    # Migration for study_plan_tasks table
    cursor.execute("PRAGMA table_info(study_plan_tasks);")
    spt_cols = [row["name"] for row in cursor.fetchall()]
    if "activity_type" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN activity_type TEXT DEFAULT 'learn';")
    if "missed" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN missed INTEGER DEFAULT 0;")
    if "original_date" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN original_date TEXT DEFAULT NULL;")
    if "notes" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN notes TEXT DEFAULT NULL;")
    if "start_time" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN start_time TEXT DEFAULT NULL;")
    if "end_time" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN end_time TEXT DEFAULT NULL;")
    if "title" not in spt_cols:
        cursor.execute("ALTER TABLE study_plan_tasks ADD COLUMN title TEXT DEFAULT NULL;")

    # 19. topic_learning_content (Interactive AI Learning Studio)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_learning_content (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        education_level TEXT NOT NULL DEFAULT 'competitive',
        summary TEXT,
        prerequisites TEXT,
        sections TEXT NOT NULL,
        interactive_elements TEXT NOT NULL,
        key_takeaways TEXT,
        comprehension_checks TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (topic_id, education_level),
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tlc_topic_level ON topic_learning_content(topic_id, education_level);")

    # 20. topic_interactions (Comprehension & Activity Tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_interactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        has_studied INTEGER DEFAULT 0,
        has_mastered INTEGER DEFAULT 0,
        comprehension_score REAL DEFAULT 0.0,
        sections_completed TEXT DEFAULT '[]',
        flashcards_reviewed INTEGER DEFAULT 0,
        quiz_attempts INTEGER DEFAULT 0,
        last_interacted_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, topic_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ti_user_topic ON topic_interactions(user_id, topic_id);")

    # 21. topic_chats (In-Topic Conversational AI Tutor)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_topic_chats_user_topic ON topic_chats(user_id, topic_id);")

    # 22. topic_practice_attempts (Topic-Wise Question Practice)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_practice_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        user_answer TEXT,
        is_correct INTEGER,
        difficulty TEXT DEFAULT 'medium',
        hint_used INTEGER DEFAULT 0,
        feedback TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES question_bank (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_practice_user_topic ON topic_practice_attempts(user_id, topic_id);")

    # 23. recovery_plans (Smart Recovery Planner for Missed Sessions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recovery_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        study_plan_id TEXT NOT NULL,
        missed_days_count INTEGER NOT NULL DEFAULT 0,
        missed_task_ids TEXT NOT NULL,
        rescheduled_tasks TEXT NOT NULL,
        feasibility_analysis TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        applied_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (study_plan_id) REFERENCES study_plans (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recovery_user_exam ON recovery_plans(user_id, exam_id);")

    # 24. previous_year_papers (PYP Library)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS previous_year_papers (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        exam_name TEXT NOT NULL,
        year INTEGER NOT NULL,
        paper_name TEXT NOT NULL,
        paper_type TEXT NOT NULL DEFAULT 'official',
        subject_name TEXT,
        duration_minutes INTEGER DEFAULT 120,
        total_questions INTEGER DEFAULT 50,
        total_marks REAL DEFAULT 100.0,
        source TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'verified',
        file_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pyp_exam_year ON previous_year_papers(exam_id, year);")

    # 25. pyp_questions (Extracted PYP Questions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pyp_questions (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        subject_id TEXT,
        unit_id TEXT,
        topic_id TEXT,
        question_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'single_choice',
        options TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'medium',
        marks REAL DEFAULT 2.0,
        negative_marks REAL DEFAULT 0.5,
        topic_name TEXT,
        subject_name TEXT,
        FOREIGN KEY (paper_id) REFERENCES previous_year_papers (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE SET NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pyp_q_paper ON pyp_questions(paper_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pyp_q_topic ON pyp_questions(topic_id);")

    # 26. topic_trend_analysis (AI Exam Trend Analyzer & Important Topics)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_trend_analysis (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        topic_name TEXT NOT NULL,
        frequency_count INTEGER DEFAULT 0,
        frequency_category TEXT NOT NULL DEFAULT 'moderate',
        years_appeared TEXT NOT NULL DEFAULT '[]',
        weightage_percent REAL DEFAULT 0.0,
        evidence_notes TEXT,
        recommended_action TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (exam_id, topic_id),
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_trend_exam_topic ON topic_trend_analysis(exam_id, topic_id);")

    # 27. predicted_papers (AI Predicted Practice Papers)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predicted_papers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        title TEXT NOT NULL,
        generation_mode TEXT NOT NULL DEFAULT 'exam_pattern',
        target_date TEXT,
        duration_minutes INTEGER DEFAULT 60,
        total_questions INTEGER DEFAULT 20,
        total_marks REAL DEFAULT 40.0,
        negative_marking_enabled INTEGER DEFAULT 1,
        questions_json TEXT NOT NULL DEFAULT '[]',
        disclaimer TEXT NOT NULL DEFAULT 'AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam.',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pred_user_exam ON predicted_papers(user_id, exam_id);")

    conn.commit()
    conn.close()

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    pwd_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, expected_hash)

def generate_default_plan(exam_name="Target Examination", exam_date=None, goal_mins=180, role="competitive_exam", include_sample=False):
    today_dt = datetime.now()
    if not exam_date:
        exam_dt = today_dt + timedelta(days=28)
        exam_date = exam_dt.strftime("%Y-%m-%d")

    return {
        "v": 1,
        "role": role,
        "subjects": [],
        "tasks": [],
        "sessions": [],
        "exam": {
            "name": exam_name,
            "date": exam_date
        },
        "goalMins": goal_mins,
        "settings": {
            "focus": 25,
            "short": 5,
            "long": 15
        }
    }
