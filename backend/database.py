import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "studypilot.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT NOT NULL,
        exam_name TEXT DEFAULT 'Mid-term exams',
        exam_date TEXT,
        goal_mins INTEGER DEFAULT 180,
        settings_focus INTEGER DEFAULT 25,
        settings_short INTEGER DEFAULT 5,
        settings_long INTEGER DEFAULT 15,
        created_at TEXT NOT NULL
    );
    """)

    # Auth tokens table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Password reset requests
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

    # User plans (cloud sync data)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_plans (
        user_id TEXT PRIMARY KEY,
        plan_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Mock tests history
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_tests (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        subject TEXT,
        topics_json TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        score INTEGER DEFAULT NULL,
        total_questions INTEGER NOT NULL,
        answers_json TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT DEFAULT NULL
    );
    """)

    # Migration for users table
    cursor.execute("PRAGMA table_info(users);")
    cols = [row["name"] for row in cursor.fetchall()]
    if "sitting_capacity_mins" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN sitting_capacity_mins INTEGER DEFAULT 45;")
    if "ai_api_key" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN ai_api_key TEXT DEFAULT NULL;")

    conn.commit()
    conn.close()

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # PBKDF2 with SHA256, 100,000 iterations
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

def generate_default_plan(exam_name="Mid-term exams", exam_date=None, goal_mins=180):
    today_dt = datetime.now()
    t_str = today_dt.strftime("%Y-%m-%d")
    
    if not exam_date:
        exam_dt = today_dt + timedelta(days=23)
        exam_date = exam_dt.strftime("%Y-%m-%d")

    def add_d(days):
        return (today_dt + timedelta(days=days)).strftime("%Y-%m-%d")

    colors = ['#3E7BE0', '#1FA095', '#D99211', '#D04F73', '#7C62D9', '#4C9A2A']
    
    subjects = [
        {
            "id": "phy",
            "name": "Physics",
            "color": colors[0],
            "topics": [
                {"id": secrets.token_hex(4), "name": "Rotational motion", "stage": 2, "next": add_d(0)},
                {"id": secrets.token_hex(4), "name": "Electrostatics", "stage": 3, "next": add_d(4)},
                {"id": secrets.token_hex(4), "name": "Thermodynamics", "stage": 1, "next": add_d(-1)},
                {"id": secrets.token_hex(4), "name": "Ray optics", "stage": 0, "next": add_d(0)}
            ]
        },
        {
            "id": "che",
            "name": "Organic Chemistry",
            "color": colors[1],
            "topics": [
                {"id": secrets.token_hex(4), "name": "Reaction mechanisms", "stage": 2, "next": add_d(2)},
                {"id": secrets.token_hex(4), "name": "Stereochemistry", "stage": 1, "next": add_d(0)},
                {"id": secrets.token_hex(4), "name": "Named reactions", "stage": 4, "next": add_d(9)}
            ]
        },
        {
            "id": "mat",
            "name": "Calculus",
            "color": colors[2],
            "topics": [
                {"id": secrets.token_hex(4), "name": "Limits and continuity", "stage": 4, "next": add_d(12)},
                {"id": secrets.token_hex(4), "name": "Integration by parts", "stage": 2, "next": add_d(1)},
                {"id": secrets.token_hex(4), "name": "Differential equations", "stage": 0, "next": add_d(0)}
            ]
        },
        {
            "id": "bio",
            "name": "Biology",
            "color": colors[3],
            "topics": [
                {"id": secrets.token_hex(4), "name": "Cell cycle", "stage": 3, "next": add_d(5)},
                {"id": secrets.token_hex(4), "name": "Genetics", "stage": 1, "next": add_d(-2)},
                {"id": secrets.token_hex(4), "name": "Human physiology", "stage": 2, "next": add_d(3)}
            ]
        }
    ]

    tasks = [
        {"id": secrets.token_hex(4), "title": "Solve 20 problems on rotational dynamics", "subjectId": "phy", "date": add_d(0), "mins": 60, "prio": "high", "done": False},
        {"id": secrets.token_hex(4), "title": "Revise SN1 and SN2 mechanisms", "subjectId": "che", "date": add_d(0), "mins": 45, "prio": "med", "done": False},
        {"id": secrets.token_hex(4), "title": "Past paper: limits and continuity", "subjectId": "mat", "date": add_d(0), "mins": 90, "prio": "high", "done": True},
        {"id": secrets.token_hex(4), "title": "Cell cycle flashcards", "subjectId": "bio", "date": add_d(0), "mins": 30, "prio": "low", "done": False},
        {"id": secrets.token_hex(4), "title": "Electrostatics numericals", "subjectId": "phy", "date": add_d(1), "mins": 60, "prio": "med", "done": False},
        {"id": secrets.token_hex(4), "title": "Integration by parts drills", "subjectId": "mat", "date": add_d(1), "mins": 60, "prio": "high", "done": False},
        {"id": secrets.token_hex(4), "title": "Stereochemistry with the model kit", "subjectId": "che", "date": add_d(2), "mins": 45, "prio": "med", "done": False},
        {"id": secrets.token_hex(4), "title": "Genetics cross diagrams", "subjectId": "bio", "date": add_d(2), "mins": 40, "prio": "med", "done": False},
        {"id": secrets.token_hex(4), "title": "Full-length mock test", "subjectId": "mat", "date": add_d(3), "mins": 180, "prio": "high", "done": False},
        {"id": secrets.token_hex(4), "title": "Ray optics diagrams", "subjectId": "phy", "date": add_d(5), "mins": 40, "prio": "low", "done": False},
        {"id": secrets.token_hex(4), "title": "Thermodynamics summary notes", "subjectId": "phy", "date": add_d(-1), "mins": 50, "prio": "med", "done": True},
        {"id": secrets.token_hex(4), "title": "Mock test: biology section", "subjectId": "bio", "date": add_d(-1), "mins": 60, "prio": "med", "done": True}
    ]

    sessions = []
    day_mins = [0, 120, 95, 150, 140, 165, 50]
    for i, m in enumerate(day_mins):
        if not m:
            continue
        off = i - 6
        d_str = add_d(off)
        a = subjects[(i + 6) % 4]
        b = subjects[(i + 7) % 4]
        m1 = round(m * 0.6 / 5) * 5
        m2 = m - m1
        dt_base = int((today_dt + timedelta(days=off)).timestamp() * 1000)
        sessions.append({
            "id": secrets.token_hex(4),
            "date": d_str,
            "mins": m1,
            "subjectId": a["id"],
            "at": dt_base + 9 * 3600000
        })
        if m2 > 0:
            sessions.append({
                "id": secrets.token_hex(4),
                "date": d_str,
                "mins": m2,
                "subjectId": b["id"],
                "at": dt_base + 12 * 3600000
            })

    return {
        "v": 1,
        "subjects": subjects,
        "tasks": tasks,
        "sessions": sessions,
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
