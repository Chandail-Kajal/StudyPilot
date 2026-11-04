import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any, List, Dict
from fastapi import FastAPI, Depends, HTTPException, Header, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from database import (
    init_db,
    get_db,
    hash_password,
    verify_password,
    generate_default_plan
)
import ai_service
import syllabus_parser
from seed_data import seed_database

init_db()

from fastapi.staticfiles import StaticFiles
import video_generator
from ai_provider import ai_manager

app = FastAPI(title="StudyPilot API", version="1.0.0")

# Ensure static directories exist and mount static route
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(STATIC_DIR, "videos"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "audio"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Models -----------------

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

# Relational System Models
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

# ----------------- Auth Helper -----------------

def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in."
        )
    token = authorization.split(" ")[1].strip()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.user_id, t.expires_at, u.* 
        FROM tokens t
        JOIN users u ON t.user_id = u.id
        WHERE t.token = ?
    """, (token,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again."
        )

    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.now() > expires_at:
        # Delete expired token
        conn = get_db()
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again."
        )

    return dict(row)

def resolve_api_key(explicit_key: Optional[str] = None, user: Optional[dict] = None) -> Optional[str]:
    """Resolves API key from explicit param, user profile in DB, or environment variables."""
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    if user and user.get("ai_api_key") and str(user.get("ai_api_key")).strip():
        return str(user.get("ai_api_key")).strip()
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )

# ----------------- Routes -----------------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "StudyPilot API", "timestamp": datetime.now().isoformat()}

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your name.")

    conn = get_db()
    cursor = conn.cursor()

    # Check existing user
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in instead.")

    user_id = "usr_" + secrets.token_hex(8)
    pwd_hash, salt = hash_password(req.password)
    now_str = datetime.now().isoformat()

    exam_name = req.exam_name.strip() if req.exam_name else "Mid-term exams"
    exam_date = req.exam_date if req.exam_date else (datetime.now() + timedelta(days=23)).strftime("%Y-%m-%d")
    user_role = req.role if req.role in ["student", "competitive_exam", "professional"] else "competitive_exam"
    goal_mins = req.goal_mins if req.goal_mins is not None else 180
    cursor.execute("""
        INSERT INTO users (id, email, password_hash, salt, name, role, exam_name, exam_date, goal_mins, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, email, pwd_hash, salt, req.name.strip(), user_role, exam_name, exam_date, goal_mins, now_str, now_str))

    # Initial plan
    if req.prototype_data and isinstance(req.prototype_data, dict) and "tasks" in req.prototype_data:
        plan = req.prototype_data
        # Update exam info if specified
        if "exam" in plan and isinstance(plan["exam"], dict):
            plan["exam"]["name"] = exam_name
            plan["exam"]["date"] = exam_date
        plan["goalMins"] = goal_mins
        plan["role"] = user_role
    else:
        plan = generate_default_plan(exam_name=exam_name, exam_date=exam_date, goal_mins=goal_mins, role=user_role, include_sample=False)

    cursor.execute("""
        INSERT INTO user_plans (user_id, plan_json, updated_at, version)
        VALUES (?, ?, ?, 1)
    """, (user_id, json.dumps(plan), now_str))

    # Create session token
    token = "sptk_" + secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(days=30)).isoformat()
    cursor.execute("""
        INSERT INTO tokens (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    """, (token, user_id, now_str, expires_at))

    conn.commit()
    conn.close()

    user_data = {
        "id": user_id,
        "email": email,
        "name": req.name.strip(),
        "role": user_role,
        "exam_name": exam_name,
        "exam_date": exam_date,
        "goal_mins": goal_mins,
        "settings": {
            "focus": 25,
            "short": 5,
            "long": 15
        },
        "created_at": now_str
    }

    return {
        "success": True,
        "message": "Account created successfully!",
        "token": token,
        "user": user_data,
        "plan": plan
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Please provide both email and password.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user or not verify_password(req.password, user["salt"], user["password_hash"]):
        conn.close()
        # Per SOW Deliverable 1: "an invalid sign-in is refused with a clear message"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials and try again."
        )

    user_id = user["id"]
    token = "sptk_" + secrets.token_urlsafe(32)
    now_str = datetime.now().isoformat()
    expires_at = (datetime.now() + timedelta(days=30)).isoformat()

    cursor.execute("""
        INSERT INTO tokens (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    """, (token, user_id, now_str, expires_at))

    # Retrieve current plan
    cursor.execute("SELECT plan_json, updated_at FROM user_plans WHERE user_id = ?", (user_id,))
    plan_row = cursor.fetchone()
    if not plan_row or not plan_row.get("plan_json"):
        plan_data = generate_default_plan()
        cursor.execute("""
            REPLACE INTO user_plans (user_id, plan_json, updated_at, version)
            VALUES (?, ?, ?, 1)
        """, (user_id, json.dumps(plan_data), now_str))
    else:
        try:
            plan_data = json.loads(plan_row["plan_json"])
        except Exception:
            plan_data = generate_default_plan()

    conn.commit()
    conn.close()

    user_data = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"] if "role" in user.keys() and user["role"] else "competitive_exam",
        "exam_name": user["exam_name"],
        "exam_date": user["exam_date"],
        "goal_mins": user["goal_mins"],
        "settings": {
            "focus": user["settings_focus"],
            "short": user["settings_short"],
            "long": user["settings_long"]
        },
        "created_at": user["created_at"]
    }

    return {
        "success": True,
        "message": f"Welcome back, {user['name']}!",
        "token": token,
        "user": user_data,
        "plan": plan_data
    }

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        conn = get_db()
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"success": True, "message": "Signed out successfully."}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Please provide a valid email address.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    # Per security best practice: do not leak whether an account exists in public responses
    generic_msg = "If your email is registered with StudyPilot AI, a password reset link has been dispatched to your inbox. Please check your inbox or spam folder."

    if not user:
        conn.close()
        return {
            "success": True,
            "message": generic_msg
        }

    user_id = user["id"]
    user_name = user["name"]

    # Rate limiting: prevent spamming reset requests (minimum 60 seconds interval)
    cursor.execute("""
        SELECT created_at FROM password_resets 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT 1
    """, (user_id,))
    recent = cursor.fetchone()
    if recent:
        try:
            last_dt = datetime.fromisoformat(recent["created_at"])
            if (datetime.now() - last_dt).total_seconds() < 60:
                conn.close()
                return {
                    "success": True,
                    "message": "A password reset link was recently sent. Please check your inbox or wait a moment before requesting another."
                }
        except Exception:
            pass

    # Invalidate any existing unused reset tokens for this user
    cursor.execute("UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0", (user_id,))

    # Secure token generation: 32-byte cryptographically random token
    raw_token = "rst_" + secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    now_str = datetime.now().isoformat()
    # 30-minute expiration as required
    expires_at = (datetime.now() + timedelta(minutes=30)).isoformat()

    cursor.execute("""
        INSERT INTO password_resets (token, user_id, created_at, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
    """, (token_hash, user_id, now_str, expires_at))
    conn.commit()
    conn.close()

    import email_service
    # Send email containing the secure raw token link
    email_service.send_password_reset_email(
        to_email=email,
        user_name=user_name,
        reset_token=raw_token
    )

    # Note: reset_token and reset_link are NEVER returned in the client HTTP response
    return {
        "success": True,
        "message": generic_msg
    }

@app.get("/api/auth/verify-reset-token")
def verify_reset_token(token: str):
    """Validate a password reset token before rendering the reset form."""
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Reset token is required.")

    raw_token = token.strip()
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pr.*, u.email, u.name 
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = ? OR pr.token = ?
    """, (token_hash, raw_token))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "valid": False,
            "reason": "not_found",
            "message": "Invalid password reset link. Please request a new one."
        }

    if row["used"] == 1:
        return {
            "valid": False,
            "reason": "already_used",
            "message": "This password reset link has already been used. Please request a new one."
        }

    try:
        exp_dt = datetime.fromisoformat(row["expires_at"])
        if datetime.now() > exp_dt:
            return {
                "valid": False,
                "reason": "expired",
                "message": "This password reset link has expired (links are valid for 30 minutes). Please request a new link."
            }
    except Exception:
        return {
            "valid": False,
            "reason": "expired",
            "message": "This password reset link is invalid or expired."
        }

    return {
        "valid": True,
        "email": row["email"],
        "name": row["name"]
    }

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    new_pwd = req.new_password.strip()
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    raw_token = req.token.strip()
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM password_resets 
        WHERE (token = ? OR token = ?) AND used = 0
    """, (token_hash, raw_token))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or already used password reset link. Please request a new reset link."
        )

    try:
        exp_dt = datetime.fromisoformat(row["expires_at"])
        if datetime.now() > exp_dt:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="This reset link has expired (links are valid for 30 minutes). Please request a new link."
            )
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="This reset link is expired.")

    user_id = row["user_id"]
    new_hash, new_salt = hash_password(new_pwd)

    cursor.execute("""
        UPDATE users SET password_hash = ?, salt = ? WHERE id = ?
    """, (new_hash, new_salt, user_id))

    # Invalidate all reset tokens for this user
    cursor.execute("UPDATE password_resets SET used = 1 WHERE user_id = ?", (user_id,))
    # Invalidate old sessions/tokens so user logs in with new password
    cursor.execute("DELETE FROM tokens WHERE user_id = ?", (user_id,))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Password reset successfully. You can now log in with your new password."
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT plan_json, updated_at FROM user_plans WHERE user_id = ?", (user_id,))
    plan_row = cursor.fetchone()

    if not plan_row or not plan_row.get("plan_json"):
        plan = generate_default_plan()
        now_str = datetime.now().isoformat()
        cursor.execute("""
            REPLACE INTO user_plans (user_id, plan_json, updated_at, version)
            VALUES (?, ?, ?, 1)
        """, (user_id, json.dumps(plan), now_str))
        conn.commit()
    else:
        try:
            plan = json.loads(plan_row["plan_json"])
        except Exception:
            plan = generate_default_plan()
    conn.close()

    # Calculate statistics summary
    sessions = plan.get("sessions", [])
    tasks = plan.get("tasks", [])
    subjects = plan.get("subjects", [])

    total_study_mins = sum(s.get("mins", 0) for s in sessions)
    completed_tasks = sum(1 for t in tasks if t.get("done"))
    total_tasks = len(tasks)

    # Topics breakdown
    total_topics = 0
    mastered_topics = 0
    stage_sum = 0
    for s in subjects:
        for tp in s.get("topics", []):
            total_topics += 1
            stg = tp.get("stage", 0) if isinstance(tp, dict) else (tp[1] if isinstance(tp, (list, tuple)) and len(tp) > 1 else 0)
            stage_sum += stg
            if stg >= 5:
                mastered_topics += 1

    readiness = round((stage_sum / (total_topics * 5) * 100)) if total_topics > 0 else 0

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"] if "role" in user.keys() and user["role"] else "competitive_exam",
            "exam_name": user["exam_name"],
            "exam_date": user["exam_date"],
            "goal_mins": user["goal_mins"],
            "settings": {
                "focus": user["settings_focus"],
                "short": user["settings_short"],
                "long": user["settings_long"]
            },
            "created_at": user["created_at"]
        },
        "stats": {
            "total_study_mins": total_study_mins,
            "total_study_hours": round(total_study_mins / 60, 1),
            "completed_tasks": completed_tasks,
            "total_tasks": total_tasks,
            "total_topics": total_topics,
            "mastered_topics": mastered_topics,
            "readiness_percent": readiness,
            "last_synced": plan_row["updated_at"] if plan_row else None
        },
        "plan": plan
    }

@app.get("/api/plans/current")
def get_current_plan(user: dict = Depends(get_current_user)):
    """Retrieve current living study plan for the signed-in student."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT plan_json, updated_at FROM user_plans WHERE user_id = ?", (user["id"],))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return generate_default_plan()
    return json.loads(row["plan_json"])

@app.put("/api/auth/profile")
def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()

    name = req.name.strip() if req.name is not None and req.name.strip() else user["name"]
    user_role = req.role if req.role in ["student", "competitive_exam", "professional"] else (user["role"] if "role" in user.keys() and user["role"] else "competitive_exam")
    exam_name = req.exam_name.strip() if req.exam_name is not None and req.exam_name.strip() else user["exam_name"]
    exam_date = req.exam_date if req.exam_date is not None else user["exam_date"]
    goal_mins = req.goal_mins if req.goal_mins is not None else user["goal_mins"]
    settings_focus = req.settings_focus if req.settings_focus is not None else user["settings_focus"]
    settings_short = req.settings_short if req.settings_short is not None else user["settings_short"]
    settings_long = req.settings_long if req.settings_long is not None else user["settings_long"]

    if req.ai_api_key is not None:
        cursor.execute("UPDATE users SET ai_api_key = ? WHERE id = ?", (req.ai_api_key.strip() if req.ai_api_key else None, user_id))

    cursor.execute("""
        UPDATE users 
        SET name = ?, role = ?, exam_name = ?, exam_date = ?, goal_mins = ?,
            settings_focus = ?, settings_short = ?, settings_long = ?
        WHERE id = ?
    """, (name, user_role, exam_name, exam_date, goal_mins, settings_focus, settings_short, settings_long, user_id))

    # Also update the plan's settings and exam
    cursor.execute("SELECT plan_json FROM user_plans WHERE user_id = ?", (user_id,))
    prow = cursor.fetchone()
    if prow:
        plan = json.loads(prow["plan_json"])
        plan["exam"] = {"name": exam_name, "date": exam_date}
        plan["goalMins"] = goal_mins
        plan["role"] = user_role
        plan["settings"] = {
            "focus": settings_focus,
            "short": settings_short,
            "long": settings_long
        }
        cursor.execute("UPDATE user_plans SET plan_json = ?, updated_at = ? WHERE user_id = ?",
                       (json.dumps(plan), datetime.now().isoformat(), user_id))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": name,
            "role": user_role,
            "exam_name": exam_name,
            "exam_date": exam_date,
            "goal_mins": goal_mins,
            "settings": {
                "focus": settings_focus,
                "short": settings_short,
                "long": settings_long
            }
        }
    }

@app.get("/api/settings/ai-key")
def get_ai_key_status(user: dict = Depends(get_current_user)):
    user_key = user.get("ai_api_key")
    env_gemini = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    env_openai = os.environ.get("OPENAI_API_KEY")

    active_key = user_key or env_gemini or env_openai or ""
    is_active = bool(active_key)
    provider = "OpenAI" if active_key.startswith("sk-") else ("Gemini" if active_key else "Default Heuristic")

    masked = ""
    if active_key:
        if len(active_key) > 8:
            masked = active_key[:4] + "..." + active_key[-4:]
        else:
            masked = "***"

    return {
        "is_configured": is_active,
        "provider": provider,
        "masked_key": masked,
        "source": "user_profile" if user_key else ("environment" if (env_gemini or env_openai) else "none")
    }

@app.post("/api/settings/ai-key")
def save_ai_key(req: AIKeyUpdateRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    new_key = req.api_key.strip() if req.api_key and req.api_key.strip() else None
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET ai_api_key = ? WHERE id = ?", (new_key, user_id))
    conn.commit()
    conn.close()

    provider = "OpenAI" if (new_key and new_key.startswith("sk-")) else ("Gemini" if new_key else "Default Heuristics")
    return {
        "success": True,
        "message": f"AI API key updated successfully (Provider: {provider}).",
        "provider": provider,
        "is_configured": bool(new_key)
    }

@app.put("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    if not verify_password(req.current_password, user["salt"], user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password does not match.")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    new_hash, new_salt = hash_password(req.new_password)
    conn = get_db()
    conn.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (new_hash, new_salt, user_id))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Password changed successfully."}

# ----------------- Cloud Sync & SOW Deliverables -----------------

@app.get("/api/sync")
def get_sync_plan(user: dict = Depends(get_current_user)):
    """
    SOW Deliverable #2: Cloud storage and sync
    Plan, subjects, topics and sessions saved to a server and loaded on any signed-in device.
    """
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT plan_json, updated_at, version FROM user_plans WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        plan = generate_default_plan(user["exam_name"], user["exam_date"], user["goal_mins"])
        return {"plan": plan, "updated_at": datetime.now().isoformat(), "version": 1}

    return {
        "plan": json.loads(row["plan_json"]),
        "updated_at": row["updated_at"],
        "version": row["version"]
    }

@app.post("/api/sync")
def save_sync_plan(req: SyncPlanRequest, user: dict = Depends(get_current_user)):
    """
    SOW Deliverable #2: Saves the latest plan from device to server cloud storage.
    """
    user_id = user["id"]
    now_str = datetime.now().isoformat()
    plan_json = json.dumps(req.plan)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_plans (user_id, plan_json, updated_at, version)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            plan_json = excluded.plan_json,
            updated_at = excluded.updated_at,
            version = user_plans.version + 1
    """, (user_id, plan_json, now_str))
    conn.commit()
    conn.close()

    return {"success": True, "updated_at": now_str}

@app.post("/api/import")
def import_prototype_data(req: ImportPlanRequest, user: dict = Depends(get_current_user)):
    """
    SOW Deliverable #3: Import of prototype data
    A one-time step to bring an existing browser plan into an account.
    """
    user_id = user["id"]
    plan = req.plan
    if not isinstance(plan, dict) or "subjects" not in plan or "tasks" not in plan:
        raise HTTPException(status_code=400, detail="Invalid prototype data structure.")

    now_str = datetime.now().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_plans (user_id, plan_json, updated_at, version)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            plan_json = excluded.plan_json,
            updated_at = excluded.updated_at,
            version = user_plans.version + 1
    """, (user_id, json.dumps(plan), now_str))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Successfully imported prototype data with {len(plan.get('subjects', []))} subjects and {len(plan.get('tasks', []))} tasks.",
        "plan": plan,
        "updated_at": now_str
    }

@app.get("/api/export")
def export_data(user: dict = Depends(get_current_user)):
    """
    SOW Deliverable #6: Data export
    Download of a student's own plan and study log.
    A downloaded file contains the student's full plan and study log.
    """
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT plan_json, updated_at FROM user_plans WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    plan = json.loads(row["plan_json"]) if row else generate_default_plan()

    export_payload = {
        "application": "StudyPilot",
        "export_date": datetime.now().isoformat(),
        "student": {
            "name": user["name"],
            "email": user["email"],
            "exam_name": user["exam_name"],
            "exam_date": user["exam_date"],
            "daily_goal_mins": user["goal_mins"]
        },
        "study_plan": plan
    }

    return export_payload

# ----------------- Syllabus File Parsing & Plan Generator -----------------

def extract_unstructured_syllabus_text(content: bytes, extension: str) -> str:
    if extension == "pdf":
        return syllabus_parser.extract_text_from_pdf(content)
    if extension in {"doc", "docx"}:
        return syllabus_parser.extract_text_from_docx(content)
    if extension in {"png", "jpg", "jpeg", "webp"}:
        return syllabus_parser.extract_text_from_image(content)
    return content.decode("utf-8", errors="ignore")


@app.post("/api/syllabus/parse-and-plan")
async def parse_and_plan_syllabus(
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form("Mid-term exams"),
    exam_date: Optional[str] = Form(None),
    sitting_capacity_mins: Optional[int] = Form(45),
    daily_goal_mins: Optional[int] = Form(180),
    api_key: Optional[str] = Form(None),
    user: Optional[dict] = Depends(get_optional_user)
):
    """
    Upload and parse PDF or Excel (.xlsx, .xls, .csv) syllabus file.
    Extracts subjects and topics, and generates a personalized study plan accordingly.
    """
    filename = file.filename or "syllabus"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    content_bytes = await file.read()
    
    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    exam_nm = exam_name or (user.get("exam_name") if user else "Mid-term exams")
    exam_dt = exam_date or (user.get("exam_date") if user else None)
    sitting_cap = sitting_capacity_mins or 45
    goal_m = daily_goal_mins or (user.get("goal_mins") if user else 180)

    try:
        supported_extensions = {"pdf", "xlsx", "xls", "csv", "txt", "docx", "png", "jpg", "jpeg", "webp"}
        if ext not in supported_extensions:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload PDF, Excel, CSV, DOCX, TXT, or a supported image."
            )

        analysis_source = "structured_file"
        if ext in {"xlsx", "xls", "csv"}:
            preview = syllabus_parser.parse_and_preview_syllabus(
                file_bytes=content_bytes,
                filename=filename,
                exam_name=exam_nm
            )
        else:
            raw_text = extract_unstructured_syllabus_text(content_bytes, ext)
            if not raw_text.strip():
                raise HTTPException(status_code=400, detail="No readable syllabus text was found in the uploaded file.")
            rows, analysis_source = await syllabus_parser.analyze_unstructured_rows(
                raw_text,
                exam_name=exam_nm,
                api_key=resolve_api_key(api_key, user)
            )
            preview = syllabus_parser.parse_and_preview_syllabus(
                file_bytes=content_bytes,
                filename=filename,
                exam_name=exam_nm,
                preparsed_rows=rows,
                analysis_source=analysis_source
            )

        subjects_by_name: Dict[str, Dict[str, Any]] = {}
        for row in preview["rows"]:
            subject = subjects_by_name.setdefault(
                row["subject_name"],
                {
                    "id": f"subject_{len(subjects_by_name) + 1}",
                    "name": row["subject_name"],
                    "topics": []
                }
            )
            subject["topics"].append({
                "name": row["topic_name"],
                "difficulty": row["difficulty"],
                "estimated_minutes": row["estimated_minutes"],
                "importance": row["importance"]
            })
        subjects = list(subjects_by_name.values())
        if not subjects:
            raise HTTPException(
                status_code=400,
                detail="Could not extract syllabus topics. Check the file contents and try again."
            )

        plan = syllabus_parser.build_complete_study_plan(
            subjects=subjects,
            exam_name=exam_nm,
            exam_date=exam_dt,
            sitting_capacity_mins=sitting_cap,
            daily_goal_mins=goal_m
        )

        total_topics = sum(len(s.get("topics", [])) for s in plan.get("subjects", []))
        summary = f"Analyzed '{filename}': Extracted {len(plan['subjects'])} subjects ({', '.join([s['name'] for s in plan['subjects'][:3]])}) and {total_topics} topics. Generated strategic study schedule with {len(plan['tasks'])} daily tasks."

        return {
            "success": True,
            "filename": filename,
            "analysis_source": analysis_source,
            "plan": plan,
            "summary": summary,
            "subjects_count": len(plan["subjects"]),
            "topics_count": total_topics,
            "tasks_count": len(plan["tasks"])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process syllabus file: {str(e)}")

# ----------------- AI Syllabus Scheduling & Mock Testing -----------------

@app.post("/api/ai/plan-schedule")
async def ai_plan_schedule(req: AIPlanScheduleRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    AI API for generating or planning study schedules according to syllabus,
    exam timeline, and student's maximum sitting capacity.
    """
    syllabus = req.syllabus
    exam_name = req.exam_name or "Mid-term exams"
    exam_date = req.exam_date
    daily_goal = req.daily_goal_mins or 180

    if user:
        if not exam_date:
            exam_date = user.get("exam_date")
        if not req.exam_name:
            exam_name = user.get("exam_name", exam_name)
        if not req.daily_goal_mins:
            daily_goal = user.get("goal_mins", daily_goal)

    active_key = resolve_api_key(req.api_key, user)
    result = await ai_service.plan_schedule_with_ai(
        syllabus=syllabus,
        exam_name=exam_name,
        exam_date=exam_date or (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        sitting_capacity_mins=req.sitting_capacity_mins or 45,
        daily_goal_mins=daily_goal,
        yesterday_topics=req.yesterday_topics,
        api_key=active_key
    )

    # If logged in, update sitting capacity in user profile
    if user and req.sitting_capacity_mins:
        conn = get_db()
        conn.execute("UPDATE users SET sitting_capacity_mins = ? WHERE id = ?", (req.sitting_capacity_mins, user["id"]))
        conn.commit()
        conn.close()

    return result

@app.post("/api/ai/mock-test")
async def ai_create_mock_test(req: AIMockTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Generates a mock test according to specific syllabus topics (e.g. yesterday's covered topics,
    or a chosen subject).
    """
    active_key = resolve_api_key(req.api_key, user)
    test_data = await ai_service.generate_mock_test(
        topics=req.topics,
        subject_name=req.subject_name or "Syllabus Review",
        num_questions=req.num_questions or 5,
        difficulty=req.difficulty or "medium",
        importance_filter=req.importance_filter,
        extract_maximum=req.extract_maximum or False,
        api_key=active_key
    )
    return test_data

@app.post("/api/ai/full-syllabus-test")
async def ai_create_full_syllabus_test(req: AIFullSyllabusTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Generates a comprehensive examination paper:
    - Subject-wise separate papers (e.g. Physics, Chemistry, Math) OR Full Combined Paper
    - Tailored to user role ('student', 'competitive_exam', 'professional')
    - 60-Minute Rapid Tests and 3-Hour (180-Minute) Grand Exams
    - Difficulties: easy, moderate, difficult
    """
    user_role = req.role or (user.get("role") if user else "competitive_exam")
    subject_target = req.subject_name or req.subject_id
    active_key = resolve_api_key(req.api_key, user)

    test_data = await ai_service.generate_full_syllabus_test(
        syllabus=req.syllabus,
        duration_mins=req.duration_mins or 60,
        difficulty=req.difficulty or "moderate",
        test_number=req.test_number or 1,
        num_questions=req.num_questions,
        subject_filter=subject_target,
        role=user_role,
        api_key=active_key
    )

    if "error" in test_data:
        raise HTTPException(status_code=400, detail=test_data.get("message", "No syllabus found. Please upload your syllabus file."))

    return test_data

@app.post("/api/ai/extract-important-topics")
async def ai_extract_important_topics(req: AIExtractImportanceRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Extracts and ranks important and very important topics based on exam weightage and high-frequency patterns.
    """
    exam_name = req.exam_name or (user.get("exam_name") if user else "Mid-term exams")
    exam_date = req.exam_date or (user.get("exam_date") if user else None)
    active_key = resolve_api_key(req.api_key, user)
    result = await ai_service.extract_topic_importance(
        syllabus=req.syllabus,
        exam_name=exam_name,
        exam_date=exam_date,
        api_key=active_key
    )
    return result

@app.post("/api/ai/submit-test")
def ai_submit_test(req: AISubmitTestRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Evaluates student's answers, calculates score & diagnostic breakdown,
    records test in database, and generates adaptive syllabus adjustments.
    """
    questions = req.questions
    user_answers = req.user_answers
    correct_count = 0
    breakdown = []

    for i, q in enumerate(questions):
        q_idx_str = str(i)
        user_choice = user_answers.get(q_idx_str)
        is_correct = (user_choice is not None and int(user_choice) == int(q.get("correct_answer", 0)))
        if is_correct:
            correct_count += 1
            
        breakdown.append({
            "question_index": i,
            "topic": q.get("topic", "General"),
            "question": q.get("question"),
            "user_choice": user_choice,
            "correct_answer": q.get("correct_answer"),
            "is_correct": is_correct,
            "explanation": q.get("explanation", "")
        })

    total = len(questions)
    pct = round((correct_count / total * 100)) if total > 0 else 0
    passed = pct >= 70
    now_str = datetime.now().isoformat()

    # Topic adjustments recommendations for spaced repetition
    topic_names = [t.get("name") if isinstance(t, dict) else str(t) for t in req.topics]
    adjustments = {
        "passed": passed,
        "score": correct_count,
        "total": total,
        "percentage": pct,
        "topic_names": topic_names,
        "action": "advance_stage" if passed else "reinforce_drill",
        "recommended_message": (
            f"Great recall! You scored {correct_count}/{total} ({pct}%). The covered topics have advanced on your spaced retention ladder."
            if passed else
            f"You scored {correct_count}/{total} ({pct}%). A 30-min targeted reinforcement task has been recommended for tomorrow."
        )
    }

    # Persist test in database
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO mock_tests (
            id, user_id, title, subject, topics_json, questions_json,
            score, total_questions, answers_json, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.test_id or ("test_" + secrets.token_hex(6)),
        user["id"] if user else None,
        req.title,
        req.subject,
        json.dumps(req.topics),
        json.dumps(questions),
        correct_count,
        total,
        json.dumps(user_answers),
        now_str,
        now_str
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "test_id": req.test_id,
        "score": correct_count,
        "total": total,
        "percentage": pct,
        "passed": passed,
        "breakdown": breakdown,
        "adjustments": adjustments
    }

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Conversational AI Study Agent that asks students about sitting capacity,
    assesses syllabus readiness, and advises on exam planning.
    """
    cap = req.current_sitting_capacity or 45
    if user and user.get("sitting_capacity_mins"):
        cap = user.get("sitting_capacity_mins")

    res = await ai_service.chat_with_study_agent(
        user_message=req.message,
        conversation_history=req.history,
        syllabus=req.syllabus,
        exam_name=req.exam_name or "Mid-term exams",
        exam_date=req.exam_date or (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        yesterday_topics=req.yesterday_topics,
        current_sitting_capacity=cap,
        api_key=req.api_key
    )
    return res

@app.get("/api/ai/tests-history")
def get_mock_tests_history(user: dict = Depends(get_current_user)):
    """Retrieve history of taken mock tests."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, subject, topics_json, score, total_questions, created_at, completed_at
        FROM mock_tests
        WHERE user_id = ?
        ORDER BY completed_at DESC
        LIMIT 20
    """, (user["id"],))
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "title": r["title"],
            "subject": r["subject"],
            "topics": json.loads(r["topics_json"]) if r["topics_json"] else [],
            "score": r["score"],
            "total_questions": r["total_questions"],
            "percentage": round(r["score"] / r["total_questions"] * 100) if r["total_questions"] else 0,
            "completed_at": r["completed_at"]
        })
    return {"tests": results}

# ----------------- Relational Core APIs: Exams & Hierarchy -----------------

@app.get("/api/exams")
def get_user_exams(user: dict = Depends(get_current_user)):
    """Retrieve all exams belonging to the authenticated user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT e.*,
            (SELECT COUNT(*) FROM subjects s WHERE s.exam_id = e.id) as subjects_count,
            (SELECT COUNT(*) FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.exam_id = e.id) as topics_count,
            (SELECT COUNT(*) FROM topic_progress tp JOIN topics t ON tp.topic_id = t.id JOIN subjects s ON t.subject_id = s.id WHERE s.exam_id = e.id AND tp.user_id = ? AND tp.stage >= 5) as mastered_count,
            (SELECT COUNT(*) FROM topic_progress tp JOIN topics t ON tp.topic_id = t.id JOIN subjects s ON t.subject_id = s.id WHERE s.exam_id = e.id AND tp.user_id = ? AND tp.status != 'not_started') as in_progress_count
        FROM exams e
        WHERE e.user_id = ?
        ORDER BY e.created_at DESC
    """, (user["id"], user["id"], user["id"]))
    rows = cursor.fetchall()
    conn.close()

    exams = []
    for row in rows:
        r = dict(row)
        top_cnt = r["topics_count"] or 0
        mast_cnt = r["mastered_count"] or 0
        readiness = round((mast_cnt / top_cnt * 100)) if top_cnt > 0 else 0
        learning_prefs = {}
        if r.get("learning_preferences") and isinstance(r["learning_preferences"], str):
            try:
                learning_prefs = json.loads(r["learning_preferences"])
            except Exception:
                learning_prefs = {}

        exams.append({
            "id": r["id"],
            "exam_name": r["exam_name"],
            "exam_category": r["exam_category"],
            "education_level": r.get("education_level") or "competitive",
            "exam_date": r["exam_date"],
            "target_score": r["target_score"],
            "learning_preferences": learning_prefs,
            "status": r["status"],
            "subjects_count": r["subjects_count"] or 0,
            "topics_count": top_cnt,
            "mastered_count": mast_cnt,
            "in_progress_count": r["in_progress_count"] or 0,
            "readiness_percent": readiness,
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        })
    return {"exams": exams}

@app.post("/api/exams")
def create_user_exam(req: ExamCreateRequest, user: dict = Depends(get_current_user)):
    """Create a new examination target for the current user."""
    name = req.exam_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Exam name is required.")
    
    exam_id = "exam_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()
    edu_level = req.education_level or "competitive"
    prefs = req.learning_preferences or {}
    if req.preparation_level:
        prefs["preparation_level"] = req.preparation_level
    if req.daily_study_mins:
        prefs["daily_study_mins"] = req.daily_study_mins
    if req.sitting_capacity_mins:
        prefs["sitting_capacity_mins"] = req.sitting_capacity_mins

    learning_prefs_str = json.dumps(prefs)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exams (id, user_id, exam_name, exam_category, education_level, exam_date, target_score, learning_preferences, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """, (exam_id, user["id"], name, req.exam_category or "competitive", edu_level, req.exam_date, req.target_score, learning_prefs_str, now_str, now_str))

    # Update user goals & sitting capacity if provided
    if req.daily_study_mins or req.sitting_capacity_mins or req.exam_date:
        cursor.execute("""
            UPDATE users
            SET goal_mins = COALESCE(?, goal_mins),
                sitting_capacity_mins = COALESCE(?, sitting_capacity_mins),
                exam_name = COALESCE(?, exam_name),
                exam_date = COALESCE(?, exam_date)
            WHERE id = ?
        """, (req.daily_study_mins, req.sitting_capacity_mins, name, req.exam_date, user["id"]))

    # Insert initial subjects if provided
    if req.initial_subjects:
        colors = ['#3E7BE0', '#1FA095', '#D99211', '#D04F73', '#7C62D9', '#4C9A2A']
        for idx, sname in enumerate(req.initial_subjects):
            clean_sname = sname.strip()
            if not clean_sname:
                continue
            sid = "subj_" + secrets.token_hex(6)
            color = colors[idx % len(colors)]
            cursor.execute("""
                INSERT INTO subjects (id, exam_id, subject_name, color, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (sid, exam_id, clean_sname, color, idx + 1, now_str))

    conn.commit()
    conn.close()
    return {
        "success": True,
        "message": f"Exam '{name}' created successfully.",
        "exam": {
            "id": exam_id,
            "exam_name": name,
            "exam_category": req.exam_category or "competitive",
            "education_level": edu_level,
            "exam_date": req.exam_date,
            "target_score": req.target_score,
            "learning_preferences": prefs,
            "status": "active"
        }
    }

@app.post("/api/exams/create-with-syllabus")
async def create_exam_with_syllabus(
    exam_name: str = Form(...),
    exam_date: Optional[str] = Form(None),
    exam_category: Optional[str] = Form("competitive"),
    education_level: Optional[str] = Form("competitive"),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    """
    Creates a new examination and optionally parses and previews an uploaded syllabus file in a single step.
    Supports PDF, Excel (.xlsx, .xls), and CSV.
    """
    name = exam_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Examination name is required.")

    exam_id = "exam_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()
    edu_level = education_level or "competitive"
    prefs = {"explanation_depth": "balanced"}
    learning_prefs_str = json.dumps(prefs)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exams (id, user_id, exam_name, exam_category, education_level, exam_date, target_score, learning_preferences, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """, (exam_id, user["id"], name, exam_category or "competitive", edu_level, exam_date, None, learning_prefs_str, now_str, now_str))

    if exam_date:
        cursor.execute("UPDATE users SET exam_name = ?, exam_date = ? WHERE id = ?", (name, exam_date, user["id"]))
    else:
        cursor.execute("UPDATE users SET exam_name = ? WHERE id = ?", (name, user["id"]))

    conn.commit()
    conn.close()

    exam_obj = {
        "id": exam_id,
        "exam_name": name,
        "exam_category": exam_category or "competitive",
        "education_level": edu_level,
        "exam_date": exam_date,
        "status": "active"
    }

    preview_res = None
    file_name = None
    file_format = None

    if file and file.filename:
        file_name = file.filename
        file_format = file_name.lower().split(".")[-1] if "." in file_name else "pdf"
        allowed_exts = ["pdf", "xlsx", "xls", "csv", "txt", "docx", "doc", "png", "jpg", "jpeg", "webp"]
        if file_format in allowed_exts:
            content_bytes = await file.read()
            if content_bytes and len(content_bytes) > 0:
                preview_res = syllabus_parser.parse_and_preview_syllabus(
                    file_bytes=content_bytes,
                    filename=file_name,
                    exam_name=name,
                    scope="complete"
                )

    return {
        "success": True,
        "message": f"Exam '{name}' created successfully.",
        "exam": exam_obj,
        "preview": preview_res,
        "file_name": file_name,
        "file_format": file_format
    }

@app.get("/api/exams/{exam_id}")
def get_single_exam_details(exam_id: str, user: dict = Depends(get_current_user)):
    """Retrieve full details, statistics, and uploads for a specific exam."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found or access denied.")

    exam_dict = dict(exam)
    if exam_dict.get("learning_preferences") and isinstance(exam_dict["learning_preferences"], str):
        try:
            exam_dict["learning_preferences"] = json.loads(exam_dict["learning_preferences"])
        except Exception:
            exam_dict["learning_preferences"] = {}

    cursor.execute("""
        SELECT s.*,
            (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) as topic_count,
            (SELECT COUNT(*) FROM topic_progress tp JOIN topics t ON tp.topic_id = t.id WHERE t.subject_id = s.id AND tp.user_id = ? AND tp.stage >= 5) as mastered_count
        FROM subjects s
        WHERE s.exam_id = ?
        ORDER BY s.display_order ASC
    """, (user["id"], exam_id))
    subjects = [dict(s) for s in cursor.fetchall()]

    cursor.execute("""
        SELECT * FROM syllabus_uploads
        WHERE exam_id = ? AND user_id = ?
        ORDER BY uploaded_at DESC
    """, (exam_id, user["id"]))
    uploads = [dict(u) for u in cursor.fetchall()]

    cursor.execute("""
        SELECT COUNT(t.id) as total_topics,
            COUNT(CASE WHEN tp.stage >= 5 THEN 1 END) as mastered_topics,
            COUNT(CASE WHEN tp.status != 'not_started' THEN 1 END) as studied_topics
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ?
    """, (user["id"], exam_id))
    stats_row = cursor.fetchone()
    conn.close()

    total_topics = stats_row["total_topics"] or 0
    mastered = stats_row["mastered_topics"] or 0
    readiness = round((mastered / total_topics * 100)) if total_topics > 0 else 0

    return {
        "exam": exam_dict,
        "subjects": subjects,
        "uploads": uploads,
        "stats": {
            "total_subjects": len(subjects),
            "total_topics": total_topics,
            "mastered_topics": mastered,
            "studied_topics": stats_row["studied_topics"] or 0,
            "readiness_percent": readiness
        }
    }

@app.put("/api/exams/{exam_id}")
def update_user_exam(exam_id: str, req: ExamUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    updates = []
    params = []
    if req.exam_name is not None:
        updates.append("exam_name = ?")
        params.append(req.exam_name.strip())
    if req.exam_category is not None:
        updates.append("exam_category = ?")
        params.append(req.exam_category.strip())
    if req.education_level is not None:
        updates.append("education_level = ?")
        params.append(req.education_level.strip())
    if req.exam_date is not None:
        updates.append("exam_date = ?")
        params.append(req.exam_date)
    if req.target_score is not None:
        updates.append("target_score = ?")
        params.append(req.target_score)
    if req.learning_preferences is not None:
        updates.append("learning_preferences = ?")
        params.append(json.dumps(req.learning_preferences))
    if req.status is not None:
        updates.append("status = ?")
        params.append(req.status)

    updates.append("updated_at = ?")
    params.append(datetime.now().isoformat())
    params.append(exam_id)

    cursor.execute(f"UPDATE exams SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return {"success": True, "message": "Exam updated successfully."}

@app.delete("/api/exams/{exam_id}")
def delete_user_exam(exam_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    cursor.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Exam deleted successfully."}

# ----------------- Multi-Format Syllabus Upload & Preview -----------------

@app.post("/api/syllabus/upload-preview")
async def syllabus_upload_preview(
    file: UploadFile = File(...),
    exam_id: Optional[str] = Form(None),
    exam_name: Optional[str] = Form(None),
    scope: Optional[str] = Form("complete"), # "complete" or "subject"
    subject_name: Optional[str] = Form(None),
    column_mapping: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    """
    Step 1 of Syllabus Import:
    Parses PDF, Excel (.xlsx, .xls), or CSV, runs duplicate detection and normalization,
    and returns an editable preview table with summary validation flags before committing to database.
    """
    filename = file.filename or "syllabus"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    allowed_exts = ["pdf", "xlsx", "xls", "csv", "txt", "docx", "doc", "png", "jpg", "jpeg", "webp"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Unsupported format. Please upload PDF (.pdf), Word (.docx), Excel (.xlsx/.xls), CSV (.csv), or Image (.png/.jpg).")

    content_bytes = await file.read()
    if not content_bytes or len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content_bytes) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 30MB limit.")

    # Find existing topics for this exam to detect duplicates
    existing_topics = []
    active_exam_name = exam_name or "My Target Exam"
    if exam_id:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT exam_name FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
        erow = cursor.fetchone()
        if erow:
            active_exam_name = erow["exam_name"]
            cursor.execute("""
                SELECT t.topic_name FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.exam_id = ?
            """, (exam_id,))
            existing_topics = [r["topic_name"] for r in cursor.fetchall()]
        conn.close()

    custom_map = None
    if column_mapping:
        try:
            custom_map = json.loads(column_mapping)
        except Exception:
            pass

    unstructured_exts = {"pdf", "txt", "docx", "doc", "png", "jpg", "jpeg", "webp"}
    analysis_source = "structured_file"
    preparsed_rows = None
    if ext in unstructured_exts:
        if ext == "doc":
            raise HTTPException(status_code=400, detail="Legacy .doc files are not supported. Save the syllabus as .docx and upload it again.")
        raw_text = extract_unstructured_syllabus_text(content_bytes, ext)
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="No readable syllabus text was found in the uploaded file.")
        preparsed_rows, analysis_source = await syllabus_parser.analyze_unstructured_rows(
            raw_text,
            exam_name=active_exam_name,
            fallback_subject=subject_name,
            api_key=resolve_api_key(None, user)
        )

    preview_res = syllabus_parser.parse_and_preview_syllabus(
        file_bytes=content_bytes,
        filename=filename,
        exam_name=active_exam_name,
        default_subject=subject_name,
        scope=scope or "complete",
        custom_mapping=custom_map,
        existing_topics=existing_topics,
        preparsed_rows=preparsed_rows,
        analysis_source=analysis_source
    )
    if not preview_res.get("rows"):
        raise HTTPException(status_code=400, detail="Could not extract syllabus topics. Check the file contents and try again.")

    return preview_res

@app.post("/api/syllabus/paste-preview")
async def syllabus_paste_preview(req: PasteSyllabusRequest, user: dict = Depends(get_current_user)):
    """Parses pasted plain text syllabus lines into a structured, hierarchical preview table."""
    raw_text = req.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Please enter or paste your syllabus content.")

    existing_topics = []
    active_exam_name = req.exam_name or "My Target Exam"
    if req.exam_id:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT exam_name FROM exams WHERE id = ? AND user_id = ?", (req.exam_id, user["id"]))
        erow = cursor.fetchone()
        if erow:
            active_exam_name = erow["exam_name"]
            cursor.execute("""
                SELECT t.topic_name FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.exam_id = ?
            """, (req.exam_id,))
            existing_topics = [r["topic_name"] for r in cursor.fetchall()]
        conn.close()

    rows, analysis_source = await syllabus_parser.analyze_unstructured_rows(
        raw_text,
        exam_name=active_exam_name,
        fallback_subject=req.subject_name,
        api_key=resolve_api_key(None, user)
    )
    preview_res = syllabus_parser.parse_and_preview_syllabus(
        file_bytes=raw_text.encode("utf-8"),
        filename="manual_syllabus.txt",
        exam_name=active_exam_name,
        default_subject=req.subject_name,
        scope=req.scope or "complete",
        existing_topics=existing_topics,
        preparsed_rows=rows,
        analysis_source=analysis_source
    )
    if not preview_res.get("rows"):
        raise HTTPException(status_code=400, detail="Could not extract syllabus topics. Check the text and try again.")
    return preview_res

@app.post("/api/syllabus/confirm-import")
def syllabus_confirm_import(req: ConfirmImportRequest, user: dict = Depends(get_current_user)):
    """
    Step 2 of Syllabus Import:
    Commits confirmed rows into the database inside a transaction.
    Normalizes into Exam -> Subject -> Unit -> Chapter -> Topic -> Subtopic.
    Preserves existing subjects and topics; initializes spaced repetition progress.
    """
    if not req.rows:
        raise HTTPException(status_code=400, detail="No syllabus rows provided to import.")

    conn = get_db()
    cursor = conn.cursor()

    # Validate exam ownership
    cursor.execute("SELECT id, exam_name, exam_date FROM exams WHERE id = ? AND user_id = ?", (req.exam_id, user["id"]))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found or unauthorized.")

    now_str = datetime.now().isoformat()
    upload_id = "upl_" + secrets.token_hex(6)

    try:
        # 1. Log upload record
        cursor.execute("""
            INSERT INTO syllabus_uploads (
                id, exam_id, user_id, file_name, file_format, file_path,
                upload_status, processing_status, uploaded_at, processed_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 'confirmed', ?, ?)
        """, (
            upload_id, req.exam_id, user["id"], req.file_name,
            req.file_format or "file", f"uploads/{req.file_name}", now_str, now_str
        ))

        # Caches to avoid redundant queries/inserts
        subject_cache = {} # name.lower() -> id
        unit_cache = {}    # (subject_id, unit_name.lower()) -> id
        chapter_cache = {} # (unit_id, chapter_name.lower()) -> id

        # Load existing subjects for this exam
        cursor.execute("SELECT id, subject_name FROM subjects WHERE exam_id = ?", (req.exam_id,))
        for r in cursor.fetchall():
            subject_cache[r["subject_name"].strip().lower()] = r["id"]

        imported_topics = []
        subjects_created = 0
        units_created = 0
        chapters_created = 0
        topics_created = 0

        color_palette = syllabus_parser.SUBJECT_COLORS

        for row in req.rows:
            topic_name = (row.get("topic_name") or "").strip()
            if not topic_name or len(topic_name) < 2:
                continue

            subj_name = (row.get("subject_name") or "General").strip()
            unit_name = (row.get("unit_name") or "Core Curriculum").strip()
            chap_name = (row.get("chapter_name") or "General Section").strip()
            subtopic = (row.get("subtopic_name") or "").strip() or None
            diff = row.get("difficulty") or "medium"
            est_mins = row.get("estimated_minutes") or 45
            importance = row.get("importance") or "medium"

            # 1. Subject
            subj_key = subj_name.lower()
            if subj_key not in subject_cache:
                s_id = "subj_" + secrets.token_hex(4)
                color = color_palette[len(subject_cache) % len(color_palette)]
                cursor.execute("""
                    INSERT INTO subjects (id, exam_id, subject_name, color, display_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (s_id, req.exam_id, subj_name, color, len(subject_cache), now_str))
                subject_cache[subj_key] = s_id
                subjects_created += 1
            subject_id = subject_cache[subj_key]

            # 2. Unit
            unit_key = (subject_id, unit_name.lower())
            if unit_key not in unit_cache:
                cursor.execute("SELECT id FROM syllabus_units WHERE subject_id = ? AND LOWER(unit_name) = ?", (subject_id, unit_name.lower()))
                urow = cursor.fetchone()
                if urow:
                    u_id = urow["id"]
                else:
                    u_id = "unit_" + secrets.token_hex(4)
                    cursor.execute("""
                        INSERT INTO syllabus_units (id, subject_id, unit_name, display_order)
                        VALUES (?, ?, ?, ?)
                    """, (u_id, subject_id, unit_name, len(unit_cache)))
                    units_created += 1
                unit_cache[unit_key] = u_id
            unit_id = unit_cache[unit_key]

            # 3. Chapter
            chap_key = (unit_id, chap_name.lower())
            if chap_key not in chapter_cache:
                cursor.execute("SELECT id FROM chapters WHERE unit_id = ? AND LOWER(chapter_name) = ?", (unit_id, chap_name.lower()))
                crow = cursor.fetchone()
                if crow:
                    c_id = crow["id"]
                else:
                    c_id = "chap_" + secrets.token_hex(4)
                    cursor.execute("""
                        INSERT INTO chapters (id, unit_id, chapter_name, display_order)
                        VALUES (?, ?, ?, ?)
                    """, (c_id, unit_id, chap_name, len(chapter_cache)))
                    chapters_created += 1
                chapter_cache[chap_key] = c_id
            chapter_id = chapter_cache[chap_key]

            # 4. Topic
            # Check duplicate topic within same subject
            cursor.execute("SELECT id FROM topics WHERE subject_id = ? AND LOWER(topic_name) = ?", (subject_id, topic_name.lower()))
            existing_t = cursor.fetchone()
            if existing_t:
                topic_id = existing_t["id"]
            else:
                topic_id = "top_" + secrets.token_hex(5)
                cursor.execute("""
                    INSERT INTO topics (
                        id, subject_id, unit_id, chapter_id, topic_name, subtopic_name,
                        difficulty, estimated_minutes, importance, display_order, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    topic_id, subject_id, unit_id, chapter_id, topic_name, subtopic,
                    diff, est_mins, importance, topics_created, now_str, now_str
                ))
                topics_created += 1

                # 5. Topic Progress initialization
                cursor.execute("""
                    INSERT OR IGNORE INTO topic_progress (
                        id, user_id, topic_id, status, completion_percentage, stage,
                        next_revision_date, updated_at
                    ) VALUES (?, ?, ?, 'not_started', 0, 0, ?, ?)
                """, (f"prog_{user['id']}_{topic_id}", user["id"], topic_id, (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), now_str))

                imported_topics.append({
                    "id": topic_id,
                    "name": topic_name,
                    "subject_id": subject_id,
                    "estimated_minutes": est_mins,
                    "importance": importance
                })

        # 6. Ensure study plan exists and add scheduled tasks for new topics
        cursor.execute(
            "SELECT id FROM study_plans WHERE user_id = ? AND exam_id = ? ORDER BY created_at DESC LIMIT 1",
            (user["id"], req.exam_id)
        )
        sp_row = cursor.fetchone()
        plan_id = sp_row["id"] if sp_row else None

        today = datetime.now().date()
        try:
            target_date = datetime.strptime(str(exam["exam_date"])[:10], "%Y-%m-%d").date()
        except (TypeError, ValueError):
            target_date = today + timedelta(days=30)
        if target_date <= today:
            target_date = today + timedelta(days=7)
        days_available = max(1, (target_date - today).days)

        if not plan_id:
            plan_id = "plan_" + secrets.token_hex(6)
            cursor.execute("""
                INSERT INTO study_plans (
                    id, user_id, exam_id, plan_name, start_date, end_date, daily_study_minutes, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """, (
                plan_id, user["id"], req.exam_id, f"Plan for {exam['exam_name']}",
                today.strftime("%Y-%m-%d"), target_date.strftime("%Y-%m-%d"),
                user.get("goal_mins", 180), now_str
            ))

        # Schedule a lesson and a practice session for each newly imported topic.
        for i, topic in enumerate(imported_topics):
            day_offset = min(days_available, 1 + (i * days_available // len(imported_topics)))
            scheduled_date = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            lesson_minutes = max(25, min(60, int(topic["estimated_minutes"] or 45)))
            practice_minutes = max(20, min(40, round(lesson_minutes * 2 / 3)))
            priority = "high" if str(topic["importance"]).lower() in {"high", "very_high"} else "medium"
            lesson_start = datetime.strptime("09:00", "%H:%M")
            lesson_end = lesson_start + timedelta(minutes=lesson_minutes)
            practice_start = lesson_end + timedelta(minutes=15)
            practice_end = practice_start + timedelta(minutes=practice_minutes)
            cursor.executemany("""
                INSERT INTO study_plan_tasks (
                    id, study_plan_id, topic_id, scheduled_date, estimated_minutes, priority, status,
                    activity_type, original_date, notes, start_time, end_time, title
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            """, [
                (
                    f"spt_{plan_id}_{secrets.token_hex(3)}", plan_id, topic["id"], scheduled_date,
                    lesson_minutes, priority, "class", scheduled_date,
                    f"Interactive lesson for {topic['name']}. Open the topic in AI Learning Studio.",
                    lesson_start.strftime("%H:%M"), lesson_end.strftime("%H:%M"), f"Lesson: {topic['name']}"
                ),
                (
                    f"spt_{plan_id}_{secrets.token_hex(3)}", plan_id, topic["id"], scheduled_date,
                    practice_minutes, priority, "practice", scheduled_date,
                    f"Practice and comprehension check for {topic['name']}.",
                    practice_start.strftime("%H:%M"), practice_end.strftime("%H:%M"), f"Practice: {topic['name']}"
                )
            ])

        # Build complete user study plan object for Planner & Calendar views
        cursor.execute("SELECT id, subject_name, color FROM subjects WHERE exam_id = ?", (req.exam_id,))
        exam_subjs = cursor.fetchall()
        
        plan_subjects = []
        for s in exam_subjs:
            cursor.execute("""
                SELECT t.id, t.topic_name, tp.stage
                FROM topics t
                LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
                WHERE t.subject_id = ?
            """, (user["id"], s["id"]))
            t_rows = cursor.fetchall()
            topics_list = []
            for tr in t_rows:
                topics_list.append([tr["topic_name"], tr["stage"] or 0, 0])
            plan_subjects.append({
                "id": s["id"],
                "name": s["subject_name"],
                "color": s["color"] or "#3E7BE0",
                "topics": topics_list
            })

        # Load all tasks for this study plan
        cursor.execute("""
            SELECT spt.id, spt.scheduled_date, spt.estimated_minutes, spt.priority, spt.status,
                   spt.activity_type, spt.title,
                   t.topic_name, t.subject_id
            FROM study_plan_tasks spt
            JOIN topics t ON spt.topic_id = t.id
            WHERE spt.study_plan_id = ?
            ORDER BY spt.scheduled_date ASC
        """, (plan_id,))
        plan_tasks = []
        for tr in cursor.fetchall():
            plan_tasks.append({
                "id": tr["id"],
                "title": tr["title"] or f"Study {tr['topic_name']}",
                "activity_type": tr["activity_type"],
                "subjectId": tr["subject_id"],
                "date": tr["scheduled_date"],
                "mins": tr["estimated_minutes"] or 45,
                "prio": "high" if tr["priority"] == "high" else "med",
                "done": tr["status"] == "completed"
            })

        user_plan_obj = {
            "v": 1,
            "role": user.get("role", "competitive_exam"),
            "subjects": plan_subjects,
            "tasks": plan_tasks,
            "sessions": [],
            "exam": {
                "name": exam["exam_name"],
                "date": exam["exam_date"] or (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            },
            "goalMins": user.get("goal_mins", 180),
            "settings": {"focus": 25, "short": 5, "long": 15},
            "sittingCapacityMins": 45
        }

        cursor.execute("""
            REPLACE INTO user_plans (user_id, plan_json, updated_at, version)
            VALUES (?, ?, ?, 1)
        """, (user["id"], json.dumps(user_plan_obj), now_str))

        conn.commit()
        conn.close()

        return {
            "success": True,
            "message": f"Syllabus import complete: {topics_created} new topics and {len(imported_topics) * 2} study sessions scheduled.",
            "plan": user_plan_obj,
            "summary": {
                "subjects_created": subjects_created,
                "units_created": units_created,
                "chapters_created": chapters_created,
                "topics_created": topics_created,
                "total_rows_processed": len(req.rows)
            }
        }
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database transaction failed during import: {str(e)}")

@app.get("/api/syllabus/uploads/{exam_id}")
def get_syllabus_uploads(exam_id: str, user: dict = Depends(get_current_user)):
    """Retrieve history of uploaded syllabus files for this exam."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM syllabus_uploads
        WHERE exam_id = ? AND user_id = ?
        ORDER BY uploaded_at DESC
    """, (exam_id, user["id"]))
    rows = cursor.fetchall()
    conn.close()
    return {"uploads": [dict(r) for r in rows]}

# ----------------- Hierarchy & Topic Management -----------------

@app.get("/api/syllabus/hierarchy/{exam_id}")
def get_syllabus_hierarchy(exam_id: str, user: dict = Depends(get_current_user)):
    """
    Returns full hierarchy:
    Exam -> Subject -> Unit -> Chapter -> Topic -> Subtopic
    with live topic_progress data.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, exam_name, exam_category, exam_date FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    cursor.execute("SELECT * FROM subjects WHERE exam_id = ? ORDER BY display_order ASC", (exam_id,))
    subjects = [dict(s) for s in cursor.fetchall()]

    for s in subjects:
        cursor.execute("SELECT * FROM syllabus_units WHERE subject_id = ? ORDER BY display_order ASC", (s["id"],))
        units = [dict(u) for u in cursor.fetchall()]
        
        for u in units:
            cursor.execute("SELECT * FROM chapters WHERE unit_id = ? ORDER BY display_order ASC", (u["id"],))
            chapters = [dict(c) for c in cursor.fetchall()]

            for c in chapters:
                cursor.execute("""
                    SELECT t.*, tp.status as progress_status, tp.completion_percentage,
                           tp.stage, tp.next_revision_date, tp.last_studied_at
                    FROM topics t
                    LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
                    WHERE t.chapter_id = ?
                    ORDER BY t.display_order ASC
                """, (user["id"], c["id"]))
                c["topics"] = [dict(t) for t in cursor.fetchall()]

            # Also fetch topics belonging to unit directly if chapter_id is null
            cursor.execute("""
                SELECT t.*, tp.status as progress_status, tp.completion_percentage,
                       tp.stage, tp.next_revision_date, tp.last_studied_at
                FROM topics t
                LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
                WHERE t.unit_id = ? AND (t.chapter_id IS NULL OR t.chapter_id = '')
                ORDER BY t.display_order ASC
            """, (user["id"], u["id"]))
            direct_topics = [dict(t) for t in cursor.fetchall()]
            if direct_topics:
                chapters.append({
                    "id": f"chap_direct_{u['id']}",
                    "unit_id": u["id"],
                    "chapter_name": "General Topics",
                    "display_order": 999,
                    "topics": direct_topics
                })

            u["chapters"] = chapters

        # Direct topics under subject without unit
        cursor.execute("""
            SELECT t.*, tp.status as progress_status, tp.completion_percentage,
                   tp.stage, tp.next_revision_date, tp.last_studied_at
            FROM topics t
            LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
            WHERE t.subject_id = ? AND (t.unit_id IS NULL OR t.unit_id = '')
            ORDER BY t.display_order ASC
        """, (user["id"], s["id"]))
        subj_direct = [dict(t) for t in cursor.fetchall()]
        if subj_direct:
            units.append({
                "id": f"unit_direct_{s['id']}",
                "subject_id": s["id"],
                "unit_name": "Core Topics",
                "display_order": 999,
                "chapters": [{
                    "id": f"chap_gen_{s['id']}",
                    "chapter_name": "Overview",
                    "display_order": 0,
                    "topics": subj_direct
                }]
            })

        s["units"] = units

    conn.close()
    return {
        "exam": dict(exam),
        "subjects": subjects
    }

@app.post("/api/syllabus/subjects")
def create_subject(req: SubjectCreateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM exams WHERE id = ? AND user_id = ?", (req.exam_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    subj_id = "subj_" + secrets.token_hex(4)
    cursor.execute("""
        INSERT INTO subjects (id, exam_id, subject_name, description, color, display_order, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    """, (subj_id, req.exam_id, req.subject_name.strip(), req.description, req.color or "#3E7BE0", datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {"success": True, "subject_id": subj_id}

@app.delete("/api/syllabus/subjects/{subject_id}")
def delete_subject(subject_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.id FROM subjects s
        JOIN exams e ON s.exam_id = e.id
        WHERE s.id = ? AND e.user_id = ?
    """, (subject_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Subject not found or access denied.")

    cursor.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Subject deleted."}

@app.post("/api/syllabus/topics")
def create_topic(req: TopicCreateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.id FROM subjects s
        JOIN exams e ON s.exam_id = e.id
        WHERE s.id = ? AND e.user_id = ?
    """, (req.subject_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Subject not found or access denied.")

    topic_id = "top_" + secrets.token_hex(5)
    now_str = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO topics (
            id, subject_id, unit_id, chapter_id, topic_name, subtopic_name,
            difficulty, estimated_minutes, importance, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        topic_id, req.subject_id, req.unit_id, req.chapter_id, req.topic_name.strip(),
        req.subtopic_name, req.difficulty or "medium", req.estimated_minutes or 45,
        req.importance or "medium", now_str, now_str
    ))

    # Initialize progress
    cursor.execute("""
        INSERT INTO topic_progress (
            id, user_id, topic_id, status, completion_percentage, stage, next_revision_date, updated_at
        ) VALUES (?, ?, ?, 'not_started', 0, 0, ?, ?)
    """, (f"prog_{user['id']}_{topic_id}", user["id"], topic_id, (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), now_str))

    conn.commit()
    conn.close()
    return {"success": True, "topic_id": topic_id}

@app.delete("/api/syllabus/topics/{topic_id}")
def delete_topic(topic_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.id FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN exams e ON s.exam_id = e.id
        WHERE t.id = ? AND e.user_id = ?
    """, (topic_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found or access denied.")

    cursor.execute("DELETE FROM topics WHERE id = ?", (topic_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Topic deleted."}

# ----------------- Topic Progress Tracking -----------------

@app.get("/api/progress/{exam_id}")
def get_topic_progress_list(exam_id: str, user: dict = Depends(get_current_user)):
    """Retrieve completion and spaced repetition progress for all topics in exam."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.id as topic_id, t.topic_name, t.subtopic_name, t.difficulty, t.importance,
               s.id as subject_id, s.subject_name, s.color as subject_color,
               u.unit_name, c.chapter_name,
               COALESCE(tp.status, 'not_started') as status,
               COALESCE(tp.completion_percentage, 0) as completion_percentage,
               COALESCE(tp.stage, 0) as stage,
               tp.next_revision_date, tp.last_studied_at, tp.last_revised_at
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN syllabus_units u ON t.unit_id = u.id
        LEFT JOIN chapters c ON t.chapter_id = c.id
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ?
        ORDER BY s.display_order ASC, t.display_order ASC
    """, (user["id"], exam_id))
    rows = cursor.fetchall()
    conn.close()

    return {"progress": [dict(r) for r in rows]}

@app.put("/api/progress/{topic_id}")
def update_topic_progress(topic_id: str, req: TopicProgressUpdateRequest, user: dict = Depends(get_current_user)):
    """Update topic mastery stage, completion %, and recalculate next spaced revision date."""
    intervals = [0, 2, 4, 7, 14, 30]
    now = datetime.now()
    now_str = now.isoformat()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT tp.*, t.topic_name FROM topics t
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE t.id = ?
    """, (user["id"], topic_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    current_stage = row["stage"] if row["stage"] is not None else 0
    new_stage = req.stage if req.stage is not None else current_stage
    new_stage = max(0, min(5, new_stage))

    current_pct = row["completion_percentage"] if row["completion_percentage"] is not None else 0
    new_pct = req.completion_percentage if req.completion_percentage is not None else current_pct

    new_status = req.status or ("mastered" if new_stage >= 5 else ("reviewing" if new_stage >= 2 else ("learning" if new_stage >= 1 else "not_started")))
    next_rev = (now + timedelta(days=intervals[new_stage])).strftime("%Y-%m-%d")

    cursor.execute("""
        INSERT INTO topic_progress (
            id, user_id, topic_id, status, completion_percentage, stage,
            next_revision_date, last_studied_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, topic_id) DO UPDATE SET
            status = excluded.status,
            completion_percentage = excluded.completion_percentage,
            stage = excluded.stage,
            next_revision_date = excluded.next_revision_date,
            last_studied_at = excluded.last_studied_at,
            updated_at = excluded.updated_at
    """, (
        f"prog_{user['id']}_{topic_id}", user["id"], topic_id, new_status,
        new_pct, new_stage, next_rev, now_str, now_str
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "topic_id": topic_id,
        "stage": new_stage,
        "status": new_status,
        "next_revision_date": next_rev
    }

# ----------------- Study Planner & Tasks -----------------

@app.get("/api/study-plans/{exam_id}")
def get_study_plan(exam_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM study_plans WHERE user_id = ? AND exam_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        (user["id"], exam_id)
    )
    plan = cursor.fetchone()

    # If no study_plan exists yet, automatically create one for this exam
    if not plan:
        cursor.execute("SELECT * FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
        exam = cursor.fetchone()
        if exam:
            plan_id = "plan_" + secrets.token_hex(6)
            now_str = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO study_plans (id, user_id, exam_id, plan_name, start_date, end_date, daily_study_minutes, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """, (plan_id, user["id"], exam_id, f"Plan for {exam['exam_name']}", datetime.now().strftime("%Y-%m-%d"), exam["exam_date"], user.get("goal_mins", 180), now_str))

            cursor.execute("""
                SELECT t.id, t.topic_name, s.id as subject_id, s.subject_name, s.color as subject_color
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.exam_id = ?
            """, (exam_id,))
            available_topics = cursor.fetchall()
            for idx, top in enumerate(available_topics):
                day_offset = (idx % 14) + 1
                t_date = (datetime.now() + timedelta(days=day_offset)).strftime("%Y-%m-%d")
                cursor.execute("""
                    INSERT INTO study_plan_tasks (id, study_plan_id, topic_id, scheduled_date, estimated_minutes, priority, status)
                    VALUES (?, ?, ?, ?, 45, 'medium', 'pending')
                """, (f"spt_{plan_id}_{secrets.token_hex(3)}", plan_id, top["id"], t_date))
            conn.commit()

            cursor.execute("SELECT * FROM study_plans WHERE id = ?", (plan_id,))
            plan = cursor.fetchone()

    tasks = []
    today_str = datetime.now().strftime("%Y-%m-%d")
    missed_count = 0
    if plan:
        # Detect and flag missed sessions safely
        try:
            cursor.execute("""
                UPDATE study_plan_tasks
                SET missed = 1
                WHERE study_plan_id = ? AND scheduled_date < ? AND status = 'pending' AND (missed = 0 OR missed IS NULL)
            """, (plan["id"], today_str))
            conn.commit()
        except Exception as e:
            print(f"[Study Plan Notice] Non-critical missed task flag sync: {e}")

        cursor.execute("""
            SELECT spt.*, t.topic_name, s.subject_name, s.color as subject_color, u.unit_name
            FROM study_plan_tasks spt
            LEFT JOIN topics t ON spt.topic_id = t.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN syllabus_units u ON t.unit_id = u.id
            WHERE spt.study_plan_id = ?
            ORDER BY spt.scheduled_date ASC, COALESCE(spt.start_time, '09:00') ASC, spt.priority DESC
        """, (plan["id"],))
        raw_tasks = [dict(t) for t in cursor.fetchall()]
        
        # Ensure clean defaults for timetable display
        for idx, t in enumerate(raw_tasks):
            if not t.get("start_time"):
                t["start_time"] = "09:00" if idx % 2 == 0 else "14:00"
            if not t.get("end_time"):
                t["end_time"] = "09:45" if idx % 2 == 0 else "14:30"
            if not t.get("title"):
                topic_title = t.get("topic_name") or "Concept Study"
                act = t.get("activity_type") or "learn_concept"
                if act in ("class", "learn_concept", "ai_class"):
                    t["title"] = f"AI Class: {topic_title}"
                elif act in ("practice", "practice_questions"):
                    t["title"] = f"Practice Drill: {topic_title}"
                elif act == "revision":
                    t["title"] = f"Spaced Revision: {topic_title}"
                elif act == "mock_test":
                    t["title"] = f"Mock Exam: {topic_title}"
                else:
                    t["title"] = topic_title
            if t.get("missed") == 1:
                missed_count += 1
            tasks.append(t)

    conn.close()
    return {
        "plan": dict(plan) if plan else None,
        "tasks": tasks,
        "missed_count": missed_count
    }

@app.put("/api/study-plans/tasks/{task_id}")
def toggle_study_task(task_id: str, user: dict = Depends(get_current_user)):
    """Toggle a task between pending and completed."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT spt.*, sp.user_id FROM study_plan_tasks spt
        JOIN study_plans sp ON spt.study_plan_id = sp.id
        WHERE spt.id = ? AND sp.user_id = ?
    """, (task_id, user["id"]))
    task = cursor.fetchone()
    if not task:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")

    new_status = "completed" if task["status"] == "pending" else "pending"
    now_str = datetime.now().isoformat() if new_status == "completed" else None

    cursor.execute("UPDATE study_plan_tasks SET status = ?, completed_at = ?, missed = 0 WHERE id = ?", (new_status, now_str, task_id))
    conn.commit()
    conn.close()

    return {"success": True, "task_id": task_id, "status": new_status}

class UpdateTaskDetailsRequest(BaseModel):
    scheduled_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = None
    activity_type: Optional[str] = None

@app.patch("/api/study-plans/tasks/{task_id}")
def update_task_details(task_id: str, req: UpdateTaskDetailsRequest, user: dict = Depends(get_current_user)):
    """Update scheduled date, timeslot, or details of a timetable session."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT spt.id FROM study_plan_tasks spt
        JOIN study_plans sp ON spt.study_plan_id = sp.id
        WHERE spt.id = ? AND sp.user_id = ?
    """, (task_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")

    updates = []
    params = []
    if req.scheduled_date is not None:
        updates.append("scheduled_date = ?")
        params.append(req.scheduled_date)
        updates.append("missed = 0")
    if req.start_time is not None:
        updates.append("start_time = ?")
        params.append(req.start_time)
    if req.end_time is not None:
        updates.append("end_time = ?")
        params.append(req.end_time)
    if req.title is not None:
        updates.append("title = ?")
        params.append(req.title)
    if req.notes is not None:
        updates.append("notes = ?")
        params.append(req.notes)
    if req.priority is not None:
        updates.append("priority = ?")
        params.append(req.priority)
    if req.estimated_minutes is not None:
        updates.append("estimated_minutes = ?")
        params.append(req.estimated_minutes)
    if req.activity_type is not None:
        updates.append("activity_type = ?")
        params.append(req.activity_type)

    if updates:
        params.append(task_id)
        cursor.execute(f"UPDATE study_plan_tasks SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    conn.close()
    return {"success": True, "message": "Session updated successfully"}

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

@app.post("/api/study-plans/custom-task")
def add_custom_study_task(req: AddCustomTaskRequest, user: dict = Depends(get_current_user)):
    """Add a custom learning session or class to the student's timetable."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM study_plans WHERE user_id = ? AND exam_id = ?", (user["id"], req.exam_id))
    plan = cursor.fetchone()
    if not plan:
        conn.close()
        raise HTTPException(status_code=400, detail="No active study plan found for this exam. Please generate a study plan first.")

    plan_id = plan["id"]
    task_id = "spt_cust_" + secrets.token_hex(5)
    
    # If topic_id is not given, find any topic from the exam or create a fallback
    topic_id = req.topic_id
    if not topic_id:
        cursor.execute("""
            SELECT t.id FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.exam_id = ?
            LIMIT 1
        """, (req.exam_id,))
        top_row = cursor.fetchone()
        topic_id = top_row["id"] if top_row else "general"

    cursor.execute("""
        INSERT INTO study_plan_tasks (
            id, study_plan_id, topic_id, scheduled_date, estimated_minutes,
            priority, status, activity_type, missed, original_date, notes,
            start_time, end_time, title
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, ?, ?)
    """, (
        task_id, plan_id, topic_id, req.scheduled_date, req.estimated_minutes or 45,
        req.priority or "medium", req.activity_type or "class", req.scheduled_date,
        req.notes or "", req.start_time or "09:00", req.end_time or "09:45", req.title
    ))
    conn.commit()
    conn.close()

    return {"success": True, "task_id": task_id, "message": "Session added to timetable"}

@app.delete("/api/study-plans/tasks/{task_id}")
def delete_study_task(task_id: str, user: dict = Depends(get_current_user)):
    """Delete a custom or optional session from the study plan."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE spt FROM study_plan_tasks spt
        JOIN study_plans sp ON spt.study_plan_id = sp.id
        WHERE spt.id = ? AND sp.user_id = ?
    """, (task_id, user["id"]))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Session deleted"}

# ----------------- Smart Revision Engine -----------------

@app.get("/api/revision/due/{exam_id}")
def get_due_revisions(exam_id: str, user: dict = Depends(get_current_user)):
    """Retrieve topics due for spaced repetition review or marked weak in mock tests."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.id as topic_id, t.topic_name, t.difficulty, t.importance,
               s.subject_name, s.color as subject_color,
               tp.stage, tp.status, tp.next_revision_date, tp.last_studied_at
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ? AND (
            tp.next_revision_date <= ? OR
            tp.stage < 2 OR
            tp.status = 'learning'
        )
        ORDER BY tp.next_revision_date ASC, t.importance DESC
        LIMIT 25
    """, (user["id"], exam_id, today_str))
    rows = cursor.fetchall()
    conn.close()

    return {"due_topics": [dict(r) for r in rows]}

@app.post("/api/revision/sessions")
def start_revision_session(req: StartRevisionRequest, user: dict = Depends(get_current_user)):
    """Launch a targeted smart revision session."""
    session_id = "rev_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO revision_sessions (id, user_id, exam_id, trigger_topic_id, started_at, status)
        VALUES (?, ?, ?, ?, ?, 'in_progress')
    """, (session_id, user["id"], req.exam_id, req.topic_id, now_str))

    tids = req.topic_ids or ([req.topic_id] if req.topic_id else [])
    for tid in tids:
        cursor.execute("""
            INSERT INTO revision_session_topics (id, revision_session_id, topic_id)
            VALUES (?, ?, ?)
        """, (f"rst_{session_id}_{tid}", session_id, tid))

    conn.commit()
    conn.close()
    return {"success": True, "session_id": session_id}

@app.put("/api/revision/sessions/{session_id}/complete")
def complete_revision_session(session_id: str, score: Optional[float] = 100.0, user: dict = Depends(get_current_user)):
    """Mark revision session completed and advance topic stages."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM revision_sessions WHERE id = ? AND user_id = ?", (session_id, user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Revision session not found.")

    now = datetime.now()
    now_str = now.isoformat()
    intervals = [0, 2, 4, 7, 14, 30]

    cursor.execute("UPDATE revision_sessions SET status = 'completed', completed_at = ?, score = ? WHERE id = ?",
                   (now_str, score, session_id))

    # Advance linked topics
    cursor.execute("SELECT topic_id FROM revision_session_topics WHERE revision_session_id = ?", (session_id,))
    topics = cursor.fetchall()
    for t in topics:
        tid = t["topic_id"]
        cursor.execute("SELECT stage FROM topic_progress WHERE user_id = ? AND topic_id = ?", (user["id"], tid))
        p_row = cursor.fetchone()
        cur_stg = p_row["stage"] if p_row else 0
        nxt_stg = min(5, cur_stg + 1)
        next_date = (now + timedelta(days=intervals[nxt_stg])).strftime("%Y-%m-%d")

        cursor.execute("""
            UPDATE topic_progress
            SET stage = ?, last_revised_at = ?, next_revision_date = ?, status = ?
            WHERE user_id = ? AND topic_id = ?
        """, (nxt_stg, now_str, next_date, 'mastered' if nxt_stg >= 5 else 'reviewing', user["id"], tid))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Revision recorded. Topic stages advanced!"}

# ----------------- Mock Tests & CBT Exam Engine -----------------

@app.get("/api/tests/available/{exam_id}")
def get_available_tests(exam_id: str, user: dict = Depends(get_current_user)):
    """Retrieve all configured mock tests and question count breakdown for an exam."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT mt.*, s.subject_name,
            (SELECT COUNT(*) FROM test_attempts ta WHERE ta.mock_test_id = mt.id AND ta.user_id = ?) as attempts_count,
            (SELECT MAX(score) FROM test_attempts ta WHERE ta.mock_test_id = mt.id AND ta.user_id = ?) as best_score
        FROM mock_tests mt
        LEFT JOIN subjects s ON mt.subject_id = s.id
        WHERE mt.exam_id = ?
        ORDER BY mt.created_at DESC
    """, (user["id"], user["id"], exam_id))
    tests = [dict(t) for t in cursor.fetchall()]

    # Question bank stats
    cursor.execute("""
        SELECT s.subject_name, COUNT(qb.id) as question_count
        FROM subjects s
        LEFT JOIN question_bank qb ON s.id = qb.subject_id
        WHERE s.exam_id = ?
        GROUP BY s.id
    """, (exam_id,))
    qb_stats = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "tests": tests,
        "question_bank_summary": qb_stats
    }

@app.post("/api/tests/configure")
def configure_mock_test(req: TestConfigureRequest, user: dict = Depends(get_current_user)):
    """
    Creates a new custom or standardized CBT mock test:
    - full_syllabus, subject_wise, unit_wise, topic_wise, or monthly
    """
    test_id = "test_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()
    duration = req.duration_minutes or 60
    q_count = req.num_questions or 10

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO mock_tests (
            id, user_id, exam_id, test_name, test_type, subject_id,
            duration_minutes, total_questions, total_marks, negative_marking_enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        test_id, user["id"], req.exam_id, req.test_name.strip(), req.test_type,
        req.subject_id, duration, q_count, float(q_count * 2),
        1 if req.negative_marking_enabled else 0, now_str
    ))

    # Link topics
    if req.topic_ids:
        for tid in req.topic_ids:
            cursor.execute("""
                INSERT INTO mock_test_topics (id, mock_test_id, topic_id)
                VALUES (?, ?, ?)
            """, (f"mtt_{test_id}_{tid}", test_id, tid))

    conn.commit()
    conn.close()
    return {"success": True, "test_id": test_id, "message": "Test configured successfully."}

@app.get("/api/tests/{test_id}/start")
def start_test_attempt(test_id: str, user: dict = Depends(get_current_user)):
    """
    Initializes a live CBT test attempt and fetches questions for the candidate.
    Explanations and correct answers are withheld until submission.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mock_tests WHERE id = ? AND (user_id = ? OR user_id = 'demo' OR user_id = 'ugc_student')", (test_id, user["id"]))
    test = cursor.fetchone()
    if not test:
        cursor.execute("SELECT * FROM mock_tests WHERE id = ?", (test_id,))
        test = cursor.fetchone()
    if not test:
        conn.close()
        raise HTTPException(status_code=404, detail="Mock test not found.")

    attempt_id = "att_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO test_attempts (
            id, user_id, mock_test_id, started_at, status
        ) VALUES (?, ?, ?, ?, 'in_progress')
    """, (attempt_id, user["id"], test_id, now_str))

    # Fetch questions matching exam and subjects/topics
    cursor.execute("""
        SELECT qb.id, qb.question_text, qb.options, qb.difficulty, qb.marks, qb.negative_marks,
               t.topic_name, s.subject_name
        FROM question_bank qb
        LEFT JOIN topics t ON qb.topic_id = t.id
        LEFT JOIN subjects s ON qb.subject_id = s.id
        WHERE qb.exam_id = ?
        ORDER BY RAND()
        LIMIT ?
    """, (test["exam_id"], test["total_questions"]))
    rows = cursor.fetchall()

    questions = []
    for r in rows:
        opts = json.loads(r["options"]) if r["options"] else []
        questions.append({
            "id": r["id"],
            "question": r["question_text"],
            "options": opts,
            "topic": r["topic_name"] or "General",
            "subject": r["subject_name"] or "General",
            "difficulty": r["difficulty"],
            "marks": r["marks"],
            "negative_marks": r["negative_marks"]
        })

    # Fallback if question_bank has fewer rows than requested
    if len(questions) < 3:
        cursor.execute("SELECT id, topic_name, subject_id FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE exam_id = ?) LIMIT 5", (test["exam_id"],))
        sample_topics = cursor.fetchall()
        for idx, st in enumerate(sample_topics):
            q_id = f"qb_{test_id}_{st['id'][:8]}_{idx+1}"
            opts = [
                f"Optimal asymptotic complexity under standard boundary constraints",
                f"Linear transformation preserving relational integrity",
                f"Heuristic decomposition with deterministic backtracking",
                f"Invariant state transition in discrete phases"
            ]
            cursor.execute("""
                INSERT IGNORE INTO question_bank (
                    id, exam_id, subject_id, topic_id, question_text, question_type,
                    options, correct_answer, explanation, difficulty, marks, negative_marks, verified_status, created_at
                ) VALUES (?, ?, ?, ?, ?, 'mcq', ?, '0', ?, 'medium', 2.0, 0.5, 'verified', ?)
            """, (
                q_id, test["exam_id"], st["subject_id"], st["id"],
                f"Which core principle forms the theoretical foundation for {st['topic_name']}?",
                json.dumps(opts),
                f"Theoretical principles for {st['topic_name']} establish foundational state transitions and boundary optimality.",
                now_str
            ))
            questions.append({
                "id": q_id,
                "question": f"Which core principle forms the theoretical foundation for {st['topic_name']}?",
                "options": opts,
                "topic": st["topic_name"],
                "subject": "Core Curriculum",
                "difficulty": "medium",
                "marks": 2.0,
                "negative_marks": 0.5
            })

    conn.commit()
    conn.close()

    return {
        "success": True,
        "attempt_id": attempt_id,
        "test": {
            "id": test["id"],
            "test_name": test["test_name"],
            "duration_minutes": test["duration_minutes"],
            "total_questions": len(questions),
            "negative_marking_enabled": bool(test["negative_marking_enabled"])
        },
        "questions": questions
    }

@app.post("/api/tests/{test_id}/submit")
def submit_test_attempt(test_id: str, req: SubmitAttemptRequest, user: dict = Depends(get_current_user)):
    """
    Submits, grades, records attempt answers, adjusts topic progress,
    and returns comprehensive CBT scorecard and diagnostics.
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM mock_tests WHERE id = ?", (test_id,))
    test = cursor.fetchone()
    if not test:
        conn.close()
        raise HTTPException(status_code=404, detail="Test not found.")

    now_str = datetime.now().isoformat()
    user_answers = req.user_answers
    time_taken = req.time_taken_seconds or 0

    # Retrieve answer keys from question_bank
    q_ids = list(user_answers.keys())
    placeholders = ",".join(["?"] * len(q_ids)) if q_ids else "''"
    
    qb_map = {}
    if q_ids:
        cursor.execute(f"SELECT * FROM question_bank WHERE id IN ({placeholders})", q_ids)
        for r in cursor.fetchall():
            qb_map[r["id"]] = dict(r)

    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0
    total_score = 0.0
    breakdown = []
    topic_failures = {}

    for qid, user_ans in user_answers.items():
        if qid not in qb_map:
            cursor.execute("""
                INSERT IGNORE INTO question_bank (
                    id, exam_id, question_text, question_type, options, correct_answer, explanation, difficulty, marks, negative_marks, verified_status, created_at
                ) VALUES (?, ?, 'Diagnostic Assessment Item', 'mcq', '[]', '0', 'Standard benchmark item.', 'medium', 2.0, 0.5, 'verified', ?)
            """, (qid, test["exam_id"], now_str))

        q_data = qb_map.get(qid)
        correct_ans = q_data["correct_answer"] if q_data else "0"
        marks = float(q_data["marks"]) if (q_data and q_data.get("marks") is not None) else 2.0
        neg = float(q_data["negative_marks"]) if (q_data and q_data.get("negative_marks") is not None) else 0.5
        top_name = q_data.get("topic_name", "General") if q_data else "General"
        top_id = q_data.get("topic_id") if q_data else None

        if user_ans is None or user_ans == -1:
            unanswered_count += 1
            awarded = 0.0
            is_ok = None
        elif str(user_ans).strip() == str(correct_ans).strip():
            correct_count += 1
            total_score += marks
            awarded = marks
            is_ok = True
        else:
            incorrect_count += 1
            total_score -= (neg if test["negative_marking_enabled"] else 0.0)
            awarded = -(neg if test["negative_marking_enabled"] else 0.0)
            is_ok = False
            if top_id:
                topic_failures[top_id] = topic_failures.get(top_id, 0) + 1

        cursor.execute("""
            INSERT INTO test_attempt_answers (
                id, attempt_id, question_id, selected_answer, is_correct, marks_awarded, time_taken_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f"ans_{req.attempt_id}_{qid}", req.attempt_id, qid,
            str(user_ans) if user_ans is not None else None,
            (1 if is_ok else 0) if is_ok is not None else None,
            awarded, 30
        ))

        breakdown.append({
            "question_id": qid,
            "question": q_data["question_text"] if q_data else "Exam Question",
            "options": json.loads(q_data["options"]) if (q_data and q_data.get("options")) else [],
            "user_answer": user_ans,
            "correct_answer": correct_ans,
            "is_correct": is_ok,
            "marks_awarded": awarded,
            "explanation": q_data.get("explanation") if q_data else "Explanatory review verified by curriculum panel."
        })

    total_score = max(0.0, round(total_score, 2))
    total_q = max(1, len(user_answers))
    accuracy = round((correct_count / total_q) * 100)

    # Update attempt status
    cursor.execute("""
        UPDATE test_attempts
        SET submitted_at = ?, score = ?, correct_count = ?, incorrect_count = ?,
            unanswered_count = ?, time_taken_seconds = ?, status = 'completed'
        WHERE id = ?
    """, (now_str, total_score, correct_count, incorrect_count, unanswered_count, time_taken, req.attempt_id))

    # Automatic Spaced Repetition Trigger: weak topics get targeted revision
    for fail_tid in topic_failures.keys():
        cursor.execute("""
            UPDATE topic_progress
            SET next_revision_date = ?, status = 'reviewing'
            WHERE user_id = ? AND topic_id = ?
        """, ((datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), user["id"], fail_tid))

    # Living Timetable: Every student test action informs the next study recommendation!
    # Automatically schedule targeted revision & practice tasks in user_plans for weak topics
    if topic_failures:
        try:
            cursor.execute("SELECT plan_json FROM user_plans WHERE user_id = ?", (user["id"],))
            prow = cursor.fetchone()
            if prow and prow["plan_json"]:
                pdata = json.loads(prow["plan_json"])
                tasks = pdata.get("tasks", [])
                tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

                for ftid in list(topic_failures.keys())[:3]:
                    cursor.execute("SELECT t.topic_name, s.id as subject_id, s.subject_name FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE t.id = ?", (ftid,))
                    tinfo = cursor.fetchone()
                    if tinfo:
                        task_id = f"rev_{req.attempt_id}_{ftid[:6]}"
                        if not any(t.get("id") == task_id for t in tasks):
                            tasks.insert(0, {
                                "id": task_id,
                                "title": f"Targeted Drill: {tinfo['topic_name']} (Weak Concept from Test)",
                                "subjectId": tinfo["subject_id"],
                                "date": tomorrow_str,
                                "mins": 45,
                                "prio": "high",
                                "done": False
                            })
                pdata["tasks"] = tasks
                cursor.execute("UPDATE user_plans SET plan_json = ?, updated_at = ? WHERE user_id = ?", (json.dumps(pdata), now_str, user["id"]))
        except Exception as plan_err:
            print(f"[Smart Replanner] Notice: {plan_err}")

    conn.commit()
    conn.close()

    return {
        "success": True,
        "attempt_id": req.attempt_id,
        "score": total_score,
        "total_marks": test["total_marks"],
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unanswered_count": unanswered_count,
        "accuracy_percent": accuracy,
        "passed": accuracy >= 60,
        "time_taken_seconds": time_taken,
        "breakdown": breakdown,
        "weak_topics_count": len(topic_failures)
    }

@app.get("/api/tests/attempts/{attempt_id}")
def get_attempt_review(attempt_id: str, user: dict = Depends(get_current_user)):
    """Retrieve full scorecard and question-by-question review of a past attempt."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ta.*, mt.test_name, mt.duration_minutes, mt.total_marks as test_total_marks, mt.exam_id
        FROM test_attempts ta
        JOIN mock_tests mt ON ta.mock_test_id = mt.id
        WHERE ta.id = ? AND ta.user_id = ?
    """, (attempt_id, user["id"]))
    attempt = cursor.fetchone()
    if not attempt:
        conn.close()
        raise HTTPException(status_code=404, detail="Attempt not found.")

    cursor.execute("""
        SELECT taa.*, qb.question_text, qb.options, qb.correct_answer, qb.explanation, qb.marks,
               t.topic_name, s.subject_name
        FROM test_attempt_answers taa
        JOIN question_bank qb ON taa.question_id = qb.id
        LEFT JOIN topics t ON qb.topic_id = t.id
        LEFT JOIN subjects s ON qb.subject_id = s.id
        WHERE taa.attempt_id = ?
    """, (attempt_id,))
    answers = []
    for r in cursor.fetchall():
        answers.append({
            "question_id": r["question_id"],
            "question_text": r["question_text"],
            "options": json.loads(r["options"]) if r["options"] else [],
            "selected_answer": r["selected_answer"],
            "correct_answer": r["correct_answer"],
            "is_correct": bool(r["is_correct"]),
            "marks_awarded": r["marks_awarded"],
            "explanation": r["explanation"],
            "topic_name": r["topic_name"] or "General",
            "subject_name": r["subject_name"] or "General"
        })

    conn.close()
    return {
        "attempt": dict(attempt),
        "answers": answers
    }

@app.get("/api/tests/history/{exam_id}")
def get_exam_tests_history(exam_id: str, user: dict = Depends(get_current_user)):
    """List all previous CBT test attempts for this exam."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ta.*, mt.test_name, mt.test_type, mt.duration_minutes, mt.total_questions, mt.total_marks as max_marks
        FROM test_attempts ta
        JOIN mock_tests mt ON ta.mock_test_id = mt.id
        WHERE mt.exam_id = ? AND ta.user_id = ?
        ORDER BY ta.started_at DESC
    """, (exam_id, user["id"]))
    rows = cursor.fetchall()
    conn.close()

    return {"attempts": [dict(r) for r in rows]}

# ----------------- Performance Analytics Engine -----------------

@app.get("/api/analytics/{exam_id}")
def get_exam_analytics(exam_id: str, user: dict = Depends(get_current_user)):
    """
    Comprehensive performance analytics:
    - Overall readiness index
    - Subject-wise accuracy and proficiency
    - Mastery stage distribution (0 to 5)
    - CBT test trajectory
    - Spaced repetition compliance
    - Weakest areas needing revision
    """
    conn = get_db()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT id, exam_name, exam_date FROM exams WHERE id = ? AND user_id = ?", (exam_id, user["id"]))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    # 1. Topic Mastery Distribution
    cursor.execute("""
        SELECT
            COUNT(t.id) as total_topics,
            COUNT(CASE WHEN COALESCE(tp.stage, 0) >= 5 THEN 1 END) as mastered_count,
            COUNT(CASE WHEN COALESCE(tp.stage, 0) BETWEEN 2 AND 4 THEN 1 END) as reviewing_count,
            COUNT(CASE WHEN COALESCE(tp.stage, 0) = 1 THEN 1 END) as learning_count,
            COUNT(CASE WHEN COALESCE(tp.stage, 0) = 0 THEN 1 END) as not_started_count
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ?
    """, (user["id"], exam_id))
    dist = cursor.fetchone()
    total_topics = dist["total_topics"] or 0
    mastered = dist["mastered_count"] or 0
    readiness = round((mastered / total_topics * 100)) if total_topics > 0 else 0

    # 2. Subject Proficiency
    cursor.execute("""
        SELECT s.id, s.subject_name, s.color,
            COUNT(t.id) as topic_count,
            COUNT(CASE WHEN tp.stage >= 5 THEN 1 END) as mastered_topics,
            AVG(COALESCE(tp.completion_percentage, 0)) as avg_completion
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ?
        GROUP BY s.id
    """, (user["id"], exam_id))
    subjects_analytics = []
    for r in cursor.fetchall():
        sub_top = r["topic_count"] or 0
        sub_mast = r["mastered_topics"] or 0
        prof = round((sub_mast / sub_top * 100)) if sub_top > 0 else 0
        subjects_analytics.append({
            "subject_id": r["id"],
            "subject_name": r["subject_name"],
            "color": r["color"],
            "topic_count": sub_top,
            "mastered_topics": sub_mast,
            "proficiency_percent": prof,
            "avg_completion": round(r["avg_completion"] or 0, 1)
        })

    # 3. Test Score Trajectory
    cursor.execute("""
        SELECT ta.id, ta.score, ta.started_at, mt.test_name, mt.total_marks
        FROM test_attempts ta
        JOIN mock_tests mt ON ta.mock_test_id = mt.id
        WHERE mt.exam_id = ? AND ta.user_id = ? AND ta.status = 'completed'
        ORDER BY ta.started_at ASC
        LIMIT 10
    """, (exam_id, user["id"]))
    test_trajectory = [dict(r) for r in cursor.fetchall()]

    # 4. Identified Weak Spots
    cursor.execute("""
        SELECT t.id, t.topic_name, t.difficulty, t.importance, s.subject_name,
               COALESCE(tp.stage, 0) as stage,
               COALESCE(tp.completion_percentage, 0) as completion_percentage
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topic_progress tp ON t.id = tp.topic_id AND tp.user_id = ?
        WHERE s.exam_id = ? AND (tp.stage < 2 OR tp.completion_percentage < 50)
        ORDER BY t.importance DESC, tp.stage ASC
        LIMIT 6
    """, (user["id"], exam_id))
    weak_topics = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "exam_id": exam_id,
        "exam_name": exam["exam_name"],
        "exam_date": exam["exam_date"],
        "readiness_percent": readiness,
        "total_topics": total_topics,
        "distribution": {
            "mastered": mastered,
            "reviewing": dist["reviewing_count"] or 0,
            "learning": dist["learning_count"] or 0,
            "not_started": dist["not_started_count"] or 0
        },
        "subjects": subjects_analytics,
        "trajectory": test_trajectory,
        "weak_topics": weak_topics
    }

# ----------------- Database Seeder Trigger -----------------

@app.post("/api/admin/seed")
def trigger_database_seed():
    """
    Triggers repeatable dummy data seeder.
    Populates 3 demo users, 3 exams, subjects, units, chapters, topics,
    question bank, tests, attempts, and revision records.
    """
    try:
        seed_database()
        return {
            "success": True,
            "message": "Database seeded successfully!",
            "demo_accounts": [
                {"name": "Aarav Sharma", "email": "ugc.student@studypilot.ai", "exam": "UGC NET Computer Science & SSC CGL"},
                {"name": "Priya Patel", "email": "cgl.aspirant@studypilot.ai", "exam": "SSC CGL Tier 1"},
                {"name": "Rohan Verma", "email": "board.student@studypilot.ai", "exam": "Class 12 Boards"}
            ],
            "default_password": "Password123!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {str(e)}")

# =====================================================================
# PHASE 1 - 4: NEW AI-POWERED PLATFORM ENDPOINTS
# =====================================================================

# ----------------- Additional Models -----------------

class TopicInteractionUpdateRequest(BaseModel):
    sections_completed: Optional[list] = []
    flashcards_reviewed: Optional[int] = 0
    quiz_attempts: Optional[int] = 0
    comprehension_score: Optional[float] = 0.0
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

# ----------------- 1. Interactive AI Topic Learning Studio -----------------

@app.get("/api/learning/topic/{topic_id}")
async def get_interactive_topic_studio(topic_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.*, s.subject_name, s.exam_id, e.exam_name, e.education_level, e.learning_preferences, u.unit_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN exams e ON s.exam_id = e.id
        LEFT JOIN syllabus_units u ON t.unit_id = u.id
        WHERE t.id = ?
    """, (topic_id,))
    topic_row = cursor.fetchone()

    if not topic_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    topic_dict = dict(topic_row)
    edu_level = topic_dict.get("education_level") or "competitive"
    learning_prefs = {}
    if topic_dict.get("learning_preferences") and isinstance(topic_dict["learning_preferences"], str):
        try:
            learning_prefs = json.loads(topic_dict["learning_preferences"])
        except Exception:
            learning_prefs = {}

    cursor.execute("""
        SELECT * FROM topic_learning_content
        WHERE topic_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (topic_id,))
    content_row = cursor.fetchone()

    studio_content = None
    if content_row:
        c_dict = dict(content_row)
        try:
            studio_content = {
                "id": c_dict["id"],
                "topic_id": topic_id,
                "education_level": c_dict["education_level"],
                "summary": c_dict.get("summary", ""),
                "prerequisites": json.loads(c_dict.get("prerequisites") or "[]"),
                "sections": json.loads(c_dict["sections"]),
                "interactive_elements": json.loads(c_dict["interactive_elements"]),
                "key_takeaways": json.loads(c_dict.get("key_takeaways") or "[]"),
                "comprehension_checks": json.loads(c_dict.get("comprehension_checks") or "[]"),
                "created_at": c_dict["created_at"]
            }
        except Exception:
            studio_content = None

    if not studio_content:
        # Generate new interactive learning content tailored to level
        active_key = resolve_api_key(None, user)
        studio_content = await ai_service.generate_interactive_topic_content(
            topic_name=topic_dict["topic_name"],
            subject_name=topic_dict.get("subject_name", "General"),
            unit_name=topic_dict.get("unit_name", ""),
            education_level=edu_level,
            learning_preferences=learning_prefs,
            api_key=active_key
        )
        content_id = "tlc_" + secrets.token_hex(6)
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO topic_learning_content (
                id, topic_id, education_level, summary, prerequisites,
                sections, interactive_elements, key_takeaways,
                comprehension_checks, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """, (
            content_id,
            topic_id,
            edu_level,
            studio_content.get("summary", ""),
            json.dumps(studio_content.get("prerequisites", [])),
            json.dumps(studio_content.get("sections", [])),
            json.dumps(studio_content.get("interactive_elements", {})),
            json.dumps(studio_content.get("key_takeaways", [])),
            json.dumps(studio_content.get("comprehension_checks", [])),
            now_str,
            now_str
        ))
        conn.commit()
        studio_content["id"] = content_id

    # Fetch or initialize user topic interaction
    cursor.execute("""
        SELECT * FROM topic_interactions
        WHERE user_id = ? AND topic_id = ?
    """, (user["id"], topic_id))
    interaction_row = cursor.fetchone()

    now_str = datetime.now().isoformat()
    if not interaction_row:
        interaction_id = "ti_" + secrets.token_hex(6)
        cursor.execute("""
            INSERT INTO topic_interactions (
                id, user_id, topic_id, has_studied, has_mastered,
                comprehension_score, sections_completed, flashcards_reviewed,
                quiz_attempts, last_interacted_at, updated_at
            ) VALUES (?, ?, ?, 1, 0, 0.0, '[]', 0, 0, ?, ?)
        """, (interaction_id, user["id"], topic_id, now_str, now_str))
        conn.commit()
        interaction_data = {
            "has_studied": True,
            "has_mastered": False,
            "comprehension_score": 0.0,
            "sections_completed": [],
            "flashcards_reviewed": 0,
            "quiz_attempts": 0,
            "last_interacted_at": now_str
        }
    else:
        int_dict = dict(interaction_row)
        if not int_dict.get("has_studied"):
            cursor.execute("UPDATE topic_interactions SET has_studied = 1, last_interacted_at = ?, updated_at = ? WHERE id = ?", (now_str, now_str, int_dict["id"]))
            conn.commit()
        interaction_data = {
            "has_studied": True,
            "has_mastered": bool(int_dict.get("has_mastered")),
            "comprehension_score": float(int_dict.get("comprehension_score") or 0.0),
            "sections_completed": json.loads(int_dict.get("sections_completed") or "[]"),
            "flashcards_reviewed": int(int_dict.get("flashcards_reviewed") or 0),
            "quiz_attempts": int(int_dict.get("quiz_attempts") or 0),
            "last_interacted_at": int_dict.get("last_interacted_at")
        }

    # Fetch educational video if already generated
    cursor.execute("""
        SELECT * FROM educational_videos
        WHERE topic_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
    """, (topic_id, user["id"]))
    v_row = cursor.fetchone()
    video_data = None
    if v_row:
        video_data = dict(v_row)
        for j_key in ["script_json", "scenes_json", "subtitles_json"]:
            if video_data.get(j_key) and isinstance(video_data[j_key], str):
                try:
                    video_data[j_key] = json.loads(video_data[j_key])
                except Exception:
                    pass

    # Ensure studio_content has all 13 sections populated
    if studio_content:
        fb_content = ai_service.generate_heuristic_topic_learning_studio(
            topic_dict["topic_name"],
            topic_dict.get("subject_name", "General"),
            topic_dict.get("exam_name", "Target Examination"),
            edu_level
        )
        for k13 in [
            "topic_introduction", "learning_objectives", "simple_explanation",
            "detailed_explanation", "important_definitions", "step_by_step_examples",
            "real_world_applications", "important_formulas", "diagrams_and_visuals",
            "points_to_remember", "topic_summary", "practice_questions", "faqs"
        ]:
            if k13 not in studio_content or not studio_content[k13]:
                studio_content[k13] = fb_content.get(k13)

    level_profile = ai_service.LEVEL_PROFILES.get(edu_level, ai_service.LEVEL_PROFILES["competitive"])
    conn.close()

    return {
        "topic": topic_dict,
        "education_level": edu_level,
        "level_profile": level_profile,
        "studio_content": studio_content,
        "interaction": interaction_data,
        "video": video_data
    }

@app.post("/api/learning/topic/{topic_id}/interaction")
def update_topic_interaction(topic_id: str, req: TopicInteractionUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM topics WHERE id = ?", (topic_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    now_str = datetime.now().isoformat()
    cursor.execute("SELECT * FROM topic_interactions WHERE user_id = ? AND topic_id = ?", (user["id"], topic_id))
    existing = cursor.fetchone()

    has_mastered = 1 if (req.mark_mastered or req.comprehension_score >= 75.0) else 0

    if existing:
        current_mastered = existing["has_mastered"]
        final_mastered = 1 if (current_mastered or has_mastered) else 0
        new_score = max(float(existing["comprehension_score"] or 0.0), float(req.comprehension_score or 0.0))
        cursor.execute("""
            UPDATE topic_interactions SET
                has_studied = 1,
                has_mastered = ?,
                comprehension_score = ?,
                sections_completed = ?,
                flashcards_reviewed = ?,
                quiz_attempts = ?,
                last_interacted_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            final_mastered,
            new_score,
            json.dumps(req.sections_completed),
            req.flashcards_reviewed,
            req.quiz_attempts,
            now_str,
            now_str,
            existing["id"]
        ))
    else:
        int_id = "ti_" + secrets.token_hex(6)
        cursor.execute("""
            INSERT INTO topic_interactions (
                id, user_id, topic_id, has_studied, has_mastered,
                comprehension_score, sections_completed, flashcards_reviewed,
                quiz_attempts, last_interacted_at, updated_at
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int_id,
            user["id"],
            topic_id,
            has_mastered,
            req.comprehension_score,
            json.dumps(req.sections_completed),
            req.flashcards_reviewed,
            req.quiz_attempts,
            now_str,
            now_str
        ))

    # Synchronize with topic_progress
    cursor.execute("SELECT * FROM topic_progress WHERE user_id = ? AND topic_id = ?", (user["id"], topic_id))
    tp = cursor.fetchone()
    if tp:
        new_stage = 5 if has_mastered else max(tp["stage"], 2)
        new_status = "mastered" if has_mastered else "learning"
        new_pct = 100 if has_mastered else max(tp["completion_percentage"], 60)
        cursor.execute("""
            UPDATE topic_progress SET
                stage = ?,
                status = ?,
                completion_percentage = ?,
                last_studied_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (new_stage, new_status, new_pct, now_str, now_str, tp["id"]))
    else:
        tp_id = "tp_" + secrets.token_hex(6)
        new_stage = 5 if has_mastered else 2
        new_status = "mastered" if has_mastered else "learning"
        new_pct = 100 if has_mastered else 60
        cursor.execute("""
            INSERT INTO topic_progress (id, user_id, topic_id, stage, completion_percentage, status, last_studied_at, next_revision_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (tp_id, user["id"], topic_id, new_stage, new_pct, new_status, now_str, (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), now_str))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "has_studied": True,
        "has_mastered": bool(has_mastered),
        "comprehension_score": req.comprehension_score
    }

@app.post("/api/learning/topic/{topic_id}/chat")
async def chat_with_in_topic_tutor(topic_id: str, req: TopicChatRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.topic_name, s.subject_name, e.education_level
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN exams e ON s.exam_id = e.id
        WHERE t.id = ?
    """, (topic_id,))
    t_row = cursor.fetchone()

    if not t_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    topic_name = t_row["topic_name"]
    subject_name = t_row["subject_name"]
    edu_level = t_row["education_level"] or "competitive"

    active_key = resolve_api_key(None, user)
    reply = await ai_service.chat_with_topic_tutor(
        topic_name=topic_name,
        subject_name=subject_name,
        education_level=edu_level,
        history=req.history,
        user_query=req.message,
        api_key=active_key
    )

    # Save to topic_chats
    chat_id = "tc_" + secrets.token_hex(6)
    cursor.execute("""
        INSERT INTO topic_chats (id, user_id, topic_id, role, message, created_at)
        VALUES (?, ?, ?, 'user', ?, ?)
    """, (chat_id, user["id"], topic_id, req.message, datetime.now().isoformat()))

    reply_id = "tc_" + secrets.token_hex(6)
    cursor.execute("""
        INSERT INTO topic_chats (id, user_id, topic_id, role, message, created_at)
        VALUES (?, ?, ?, 'assistant', ?, ?)
    """, (reply_id, user["id"], topic_id, reply, datetime.now().isoformat()))

    conn.commit()
    conn.close()

    return {"reply": reply}

class GenerateVideoRequest(BaseModel):
    engine: Optional[str] = "remotion"  # 'remotion', 'manim', 'hybrid'

@app.post("/api/learning/topic/{topic_id}/video/generate")
@app.post("/api/topics/{topic_id}/video/generate")
async def generate_topic_video_endpoint(topic_id: str, req: GenerateVideoRequest = GenerateVideoRequest(), user: dict = Depends(get_current_user)):
    """Generates an animated educational video with narration, scenes, and subtitles."""
    try:
        result = await video_generator.create_or_regenerate_video(
            topic_id=topic_id,
            user_id=user["id"],
            engine=req.engine or "remotion"
        )
        return {"success": True, "video": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/topic/{topic_id}/video")
@app.get("/api/topics/{topic_id}/video")
async def get_topic_video_endpoint(topic_id: str, user: dict = Depends(get_current_user)):
    """Retrieves existing educational video and animation scenes for this topic."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM educational_videos
        WHERE topic_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
    """, (topic_id, user["id"]))
    row = cur.fetchone()
    conn.close()
    if not row:
        return {"has_video": False, "video": None}
    r_dict = dict(row)
    for j_field in ["script_json", "scenes_json", "subtitles_json"]:
        if r_dict.get(j_field) and isinstance(r_dict[j_field], str):
            try:
                r_dict[j_field] = json.loads(r_dict[j_field])
            except Exception:
                pass
    return {"has_video": True, "video": r_dict}

@app.post("/api/learning/topic/{topic_id}/video/regenerate")
@app.post("/api/topics/{topic_id}/video/regenerate")
async def regenerate_topic_video_endpoint(topic_id: str, req: GenerateVideoRequest = GenerateVideoRequest(), user: dict = Depends(get_current_user)):
    """Regenerates the animated video for this topic without affecting the rest of the lesson."""
    try:
        result = await video_generator.create_or_regenerate_video(
            topic_id=topic_id,
            user_id=user["id"],
            engine=req.engine or "remotion"
        )
        return {"success": True, "message": "Video regenerated successfully", "video": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/providers")
async def get_ai_providers_endpoint(user: dict = Depends(get_current_user)):
    """Health & availability of AI providers (Gemini, Groq, Ollama, Heuristics)."""
    user_key = user.get("ai_api_key")
    active = await ai_manager.get_active_providers(user_key)
    return {
        "providers": active,
        "primary": "Gemini API (free tier eligible: gemini-2.0-flash / gemini-1.5-flash)",
        "secondary": "Groq API (developer free tier: llama-3.3-70b-versatile / llama-3.1-8b-instant)",
        "local": "Ollama (local offline: llama3 / mistral)",
        "fallback": "Deterministic Educational Knowledge Base",
        "metrics": ai_manager.request_counts
    }

@app.get("/api/learning/topic/{topic_id}/chat-history")
def get_topic_chat_history(topic_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT role, message, created_at
        FROM topic_chats
        WHERE user_id = ? AND topic_id = ?
        ORDER BY created_at ASC
        LIMIT 30
    """, (user["id"], topic_id))
    rows = cursor.fetchall()
    conn.close()
    return {"history": [dict(r) for r in rows]}

# ----------------- 2. Topic-Wise Question Practice -----------------

@app.get("/api/learning/topic/{topic_id}/practice")
async def get_topic_practice_questions(topic_id: str, difficulty: Optional[str] = "intermediate", user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.topic_name, s.subject_name, e.education_level
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN exams e ON s.exam_id = e.id
        WHERE t.id = ?
    """, (topic_id,))
    t_row = cursor.fetchone()

    if not t_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    topic_name = t_row["topic_name"]
    subject_name = t_row["subject_name"]
    edu_level = t_row["education_level"] or "competitive"

    cursor.execute("""
        SELECT COUNT(*) as total_attempts,
               SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts
        FROM topic_practice_attempts
        WHERE user_id = ? AND topic_id = ?
    """, (user["id"], topic_id))
    stats = cursor.fetchone()
    conn.close()

    active_key = resolve_api_key(None, user)
    questions = await ai_service.generate_topic_practice_questions(
        topic_name=topic_name,
        subject_name=subject_name,
        education_level=edu_level,
        difficulty=difficulty,
        num_questions=5,
        api_key=active_key
    )

    return {
        "topic_id": topic_id,
        "topic_name": topic_name,
        "subject_name": subject_name,
        "education_level": edu_level,
        "difficulty": difficulty,
        "questions": questions,
        "history": {
            "total_attempts": stats["total_attempts"] if stats else 0,
            "correct_attempts": stats["correct_attempts"] if stats else 0
        }
    }

@app.post("/api/learning/topic/{topic_id}/practice/submit")
def submit_topic_practice_question(topic_id: str, req: TopicPracticeSubmitRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.topic_name, t.subject_id, s.subject_name, s.exam_id, e.education_level
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN exams e ON s.exam_id = e.id
        WHERE t.id = ?
    """, (topic_id,))
    t_row = cursor.fetchone()

    if not t_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    topic_name = t_row["topic_name"]
    edu_level = t_row["education_level"] or "competitive"

    eval_result = ai_service.evaluate_topic_practice_answer(
        question_text=req.question_text,
        correct_answer=req.correct_answer,
        user_answer=req.user_answer,
        topic_title=topic_name,
        difficulty=req.difficulty,
        education_level=edu_level
    )

    is_correct_val = 1 if eval_result.get("is_correct") else 0
    attempt_id = "tpa_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()

    # Ensure question exists in question_bank to satisfy foreign key constraint
    cursor.execute("SELECT id FROM question_bank WHERE id = ?", (req.question_id,))
    if not cursor.fetchone():
        cursor.execute("""
            INSERT OR IGNORE INTO question_bank (
                id, exam_id, subject_id, topic_id, question_text,
                question_type, options, correct_answer, explanation,
                difficulty, marks, negative_marks, source_type, verified_status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'single_choice', '[]', ?, ?, ?, 1.0, 0.25, 'ai_practice', 'verified', ?)
        """, (
            req.question_id,
            t_row["exam_id"],
            t_row["subject_id"],
            topic_id,
            req.question_text,
            req.correct_answer,
            eval_result.get("explanation", ""),
            req.difficulty,
            now_str
        ))

    cursor.execute("""
        INSERT INTO topic_practice_attempts (
            id, user_id, topic_id, question_id, user_answer,
            is_correct, difficulty, hint_used, feedback, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        attempt_id,
        user["id"],
        topic_id,
        req.question_id,
        req.user_answer,
        is_correct_val,
        req.difficulty,
        1 if req.used_hint else 0,
        eval_result.get("explanation", ""),
        now_str
    ))

    cursor.execute("""
        SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM topic_practice_attempts
        WHERE user_id = ? AND topic_id = ?
    """, (user["id"], topic_id))
    score_stats = cursor.fetchone()
    total_att = score_stats["total"] or 0
    correct_att = score_stats["correct"] or 0
    accuracy = round((correct_att / total_att * 100), 1) if total_att > 0 else 0.0

    can_master = total_att >= 3 and accuracy >= 80.0
    if can_master:
        cursor.execute("UPDATE topic_interactions SET has_mastered = 1, updated_at = ? WHERE user_id = ? AND topic_id = ?", (now_str, user["id"], topic_id))
        cursor.execute("""
            UPDATE topic_progress SET stage = 5, status = 'mastered', completion_percentage = 100, last_studied_at = ?, updated_at = ?
            WHERE user_id = ? AND topic_id = ?
        """, (now_str, now_str, user["id"], topic_id))

    conn.commit()
    conn.close()

    eval_result["cumulative_accuracy"] = accuracy
    eval_result["total_attempts"] = total_att
    eval_result["mastered_achieved"] = can_master

    return {"evaluation": eval_result}

# ----------------- 3. Adaptive Study Planner -----------------

@app.post("/api/planner/adaptive-create")
def create_adaptive_study_plan(req: AdaptivePlanCreateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM exams WHERE id = ? AND user_id = ?", (req.exam_id, user["id"]))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    exam_dict = dict(exam)
    target_date_str = req.exam_date or exam_dict.get("exam_date")
    if not target_date_str:
        target_date_str = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")

    target_date = datetime.strptime(target_date_str[:10], "%Y-%m-%d").date()
    today = datetime.now().date()
    days_until_exam = (target_date - today).days

    if days_until_exam <= 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Exam date must be at least 2 days in the future.")

    cursor.execute("""
        SELECT t.id as topic_id, t.topic_name, t.difficulty, t.importance,
               s.id as subject_id, s.subject_name, u.id as unit_id, u.unit_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN syllabus_units u ON t.unit_id = u.id
        WHERE s.exam_id = ?
        ORDER BY s.display_order ASC, t.display_order ASC
    """, (req.exam_id,))
    topics = [dict(r) for r in cursor.fetchall()]

    if not topics:
        conn.close()
        raise HTTPException(status_code=400, detail="No topics found for this exam. Please upload or confirm syllabus first.")

    weekday_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
    allowed_days = set(d.lower()[:3] for d in (req.available_days or ["mon", "tue", "wed", "thu", "fri", "sat"]))
    
    study_dates = []
    curr = today + timedelta(days=1)
    buffer_days = max(1, req.buffer_days or 3)
    study_cutoff = target_date - timedelta(days=buffer_days)

    while curr <= study_cutoff:
        if weekday_map[curr.weekday()] in allowed_days:
            study_dates.append(curr.strftime("%Y-%m-%d"))
        curr += timedelta(days=1)

    if not study_dates:
        curr = today + timedelta(days=1)
        while curr <= target_date:
            study_dates.append(curr.strftime("%Y-%m-%d"))
            curr += timedelta(days=1)

    daily_hours = max(1.0, req.daily_study_hours or 3.0)
    daily_mins = int(daily_hours * 60)

    plan_id = "plan_" + secrets.token_hex(6)
    plan_name = f"{exam_dict['exam_name']} Comprehensive Master Plan"
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO study_plans (
            id, user_id, exam_id, plan_name, start_date, end_date,
            daily_study_minutes, status, created_at, available_days,
            sitting_times, buffer_days, learning_pace
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
    """, (
        plan_id,
        user["id"],
        req.exam_id,
        plan_name,
        (today + timedelta(days=1)).strftime("%Y-%m-%d"),
        target_date_str,
        daily_mins,
        now_str,
        json.dumps(req.available_days or ["mon", "tue", "wed", "thu", "fri", "sat"]),
        json.dumps(req.sitting_times or ["morning", "evening"]),
        buffer_days,
        req.learning_pace or "normal"
    ))

    cursor.execute("SELECT id FROM study_plans WHERE exam_id = ? AND user_id = ?", (req.exam_id, user["id"]))
    existing_plans = [r["id"] for r in cursor.fetchall()]
    for p_id in existing_plans:
        cursor.execute("DELETE FROM study_plan_tasks WHERE study_plan_id = ?", (p_id,))

    task_records = []
    date_idx = 0
    num_dates = len(study_dates)

    for i, t in enumerate(topics):
        sched_date = study_dates[date_idx % num_dates]
        
        # Session 1: Interactive AI Class
        task_learn_id = "spt_" + secrets.token_hex(6)
        task_records.append((
            task_learn_id, plan_id, t["topic_id"], sched_date,
            45, t.get("importance") or "high", "pending", None,
            "class", 0, sched_date,
            f"Subject: {t['subject_name']}. Interactive class & concept studio for {t['topic_name']}.",
            "09:00", "09:45", f"AI Class: {t['topic_name']}"
        ))

        # Session 2: Topic Practice Drill
        task_prac_id = "spt_" + secrets.token_hex(6)
        task_records.append((
            task_prac_id, plan_id, t["topic_id"], sched_date,
            30, t.get("importance") or "medium", "pending", None,
            "practice", 0, sched_date,
            f"Topic-wise practice questions & comprehension check for {t['topic_name']}.",
            "10:00", "10:30", f"Practice Drill: {t['topic_name']}"
        ))

        if (i + 1) % 2 == 0:
            date_idx += 1

    # Buffer days revision tasks
    buffer_curr = study_cutoff + timedelta(days=1)
    rev_count = 1
    while buffer_curr < target_date:
        b_date_str = buffer_curr.strftime("%Y-%m-%d")
        
        task_rev_id = "spt_" + secrets.token_hex(6)
        task_records.append((
            task_rev_id, plan_id, topics[0]["topic_id"], b_date_str,
            60, "high", "pending", None,
            "revision", 0, b_date_str,
            f"Comprehensive Spaced Revision Session #{rev_count}.",
            "17:00", "18:00", f"Spaced Revision #{rev_count}"
        ))

        task_test_id = "spt_" + secrets.token_hex(6)
        task_records.append((
            task_test_id, plan_id, topics[-1]["topic_id"], b_date_str,
            90, "high", "pending", None,
            "mock_test", 0, b_date_str,
            f"Full-Syllabus Mock Test & PYP Practice #{rev_count}.",
            "18:30", "20:00", f"Full Mock Exam #{rev_count}"
        ))

        rev_count += 1
        buffer_curr += timedelta(days=1)

    cursor.executemany("""
        INSERT INTO study_plan_tasks (
            id, study_plan_id, topic_id, scheduled_date, estimated_minutes,
            priority, status, completed_at, activity_type, missed,
            original_date, notes, start_time, end_time, title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, task_records)

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Personalized study plan created with {len(task_records)} tasks.",
        "plan_id": plan_id,
        "total_tasks": len(task_records),
        "days_available": len(study_dates),
        "buffer_days": buffer_days,
        "exam_date": target_date_str
    }

@app.get("/api/planner/adaptive-plan/{exam_id}")
def get_adaptive_study_plan(exam_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM study_plans
        WHERE exam_id = ? AND user_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
    """, (exam_id, user["id"]))
    plan = cursor.fetchone()

    if not plan:
        conn.close()
        return {"plan": None, "tasks": [], "stats": {"total_tasks": 0, "completed": 0, "missed": 0}}

    plan_dict = dict(plan)
    try:
        plan_dict["available_days"] = json.loads(plan_dict.get("available_days") or "[]")
        plan_dict["sitting_times"] = json.loads(plan_dict.get("sitting_times") or "[]")
    except Exception:
        pass

    cursor.execute("""
        SELECT spt.*, t.topic_name, s.subject_name
        FROM study_plan_tasks spt
        LEFT JOIN topics t ON spt.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE spt.study_plan_id = ?
        ORDER BY spt.scheduled_date ASC, spt.estimated_minutes DESC
    """, (plan["id"],))
    tasks = [dict(t) for t in cursor.fetchall()]

    today_str = datetime.now().strftime("%Y-%m-%d")
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t["status"] == "completed")
    missed_tasks = sum(1 for t in tasks if t["status"] != "completed" and t["scheduled_date"] < today_str)

    conn.close()

    return {
        "plan": plan_dict,
        "tasks": tasks,
        "stats": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "missed_tasks": missed_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0
        }
    }

# ----------------- 4. Smart Recovery Planner -----------------

@app.get("/api/planner/recovery/analyze/{exam_id}")
def analyze_smart_recovery(exam_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM study_plans
        WHERE exam_id = ? AND user_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
    """, (exam_id, user["id"]))
    plan = cursor.fetchone()

    if not plan:
        conn.close()
        raise HTTPException(status_code=404, detail="No active study plan found for this exam.")

    plan_dict = dict(plan)
    today_str = datetime.now().strftime("%Y-%m-%d")

    cursor.execute("""
        SELECT spt.*, t.topic_name, s.subject_name
        FROM study_plan_tasks spt
        LEFT JOIN topics t ON spt.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE spt.study_plan_id = ? AND spt.scheduled_date < ? AND spt.status != 'completed'
        ORDER BY spt.scheduled_date ASC
    """, (plan["id"], today_str))
    missed_tasks = [dict(t) for t in cursor.fetchall()]

    cursor.execute("""
        SELECT spt.*, t.topic_name, s.subject_name
        FROM study_plan_tasks spt
        LEFT JOIN topics t ON spt.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE spt.study_plan_id = ? AND spt.scheduled_date >= ? AND spt.status != 'completed'
        ORDER BY spt.scheduled_date ASC
    """, (plan["id"], today_str))
    future_tasks = [dict(t) for t in cursor.fetchall()]

    cursor.execute("SELECT exam_date FROM exams WHERE id = ?", (exam_id,))
    exam_row = cursor.fetchone()
    exam_date_str = (exam_row["exam_date"] if exam_row else None) or plan_dict["end_date"]

    avail_days = ["mon", "tue", "wed", "thu", "fri", "sat"]
    try:
        avail_days = json.loads(plan_dict.get("available_days") or '["mon", "tue", "wed", "thu", "fri", "sat"]')
    except Exception:
        pass

    daily_hours = float((plan_dict.get("daily_study_minutes") or 180) / 60)
    recovery_proposal = ai_service.calculate_smart_recovery_plan(
        missed_tasks=missed_tasks,
        remaining_topics=future_tasks,
        exam_date=exam_date_str,
        daily_hours=daily_hours,
        available_days=avail_days
    )

    recovery_id = "rec_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()
    missed_ids = [t["id"] for t in missed_tasks]

    cursor.execute("""
        INSERT INTO recovery_plans (
            id, user_id, exam_id, study_plan_id, missed_days_count,
            missed_task_ids, rescheduled_tasks, feasibility_analysis,
            status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (
        recovery_id,
        user["id"],
        exam_id,
        plan["id"],
        recovery_proposal["missed_days_count"],
        json.dumps(missed_ids),
        json.dumps(recovery_proposal["rescheduled_tasks"]),
        recovery_proposal["analysis_summary"],
        now_str
    ))

    conn.commit()
    conn.close()

    recovery_proposal["recovery_id"] = recovery_id
    recovery_proposal["plan_id"] = plan["id"]

    return {
        "success": True,
        "missed_tasks_count": len(missed_tasks),
        "proposal": recovery_proposal
    }

@app.post("/api/planner/recovery/apply/{recovery_id}")
def apply_smart_recovery_plan(recovery_id: str, req: RecoveryApplyRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM recovery_plans WHERE id = ? AND user_id = ?", (recovery_id, user["id"]))
    rec = cursor.fetchone()
    if not rec:
        conn.close()
        raise HTTPException(status_code=404, detail="Recovery proposal not found.")

    rescheduled = json.loads(rec["rescheduled_tasks"])
    now_str = datetime.now().isoformat()

    for t in rescheduled:
        task_id = t.get("task_id")
        new_date = t.get("new_date")
        if task_id and new_date:
            cursor.execute("SELECT notes FROM study_plan_tasks WHERE id = ?", (task_id,))
            t_row = cursor.fetchone()
            curr_notes = (t_row["notes"] or "") if t_row else ""
            tag = " [Rescheduled via Smart Recovery Planner]"
            new_notes = curr_notes if tag in curr_notes else f"{curr_notes}{tag}"
            cursor.execute("""
                UPDATE study_plan_tasks SET
                    original_date = COALESCE(original_date, scheduled_date),
                    scheduled_date = ?,
                    missed = 0,
                    notes = ?
                WHERE id = ?
            """, (new_date, new_notes, task_id))

    cursor.execute("UPDATE recovery_plans SET status = 'applied', applied_at = ? WHERE id = ?", (now_str, recovery_id))
    cursor.execute("UPDATE study_plans SET last_replan_at = ?, missed_tasks_count = 0 WHERE id = ?", (now_str, rec["study_plan_id"]))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Smart Recovery plan applied! {len(rescheduled)} tasks redistributed smoothly across future sessions."
    }

# ----------------- 5. Previous-Year Papers (PYP) Library -----------------

@app.get("/api/pyp/papers/{exam_id}")
def get_previous_year_papers(
    exam_id: str,
    year: Optional[int] = None,
    subject: Optional[str] = None,
    paper_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM previous_year_papers WHERE exam_id = ?"
    params = [exam_id]

    if year:
        query += " AND year = ?"
        params.append(year)
    if subject and subject != "all":
        query += " AND subject_name = ?"
        params.append(subject)
    if paper_type and paper_type != "all":
        query += " AND paper_type = ?"
        params.append(paper_type)
    if verification_status and verification_status != "all":
        query += " AND verification_status = ?"
        params.append(verification_status)

    query += " ORDER BY year DESC, paper_name ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    papers = []
    for r in rows:
        d = dict(r)
        cursor.execute("SELECT COUNT(*) as q_cnt FROM pyp_questions WHERE paper_id = ?", (d["id"],))
        q_row = cursor.fetchone()
        d["question_count"] = q_row["q_cnt"] if q_row else d["total_questions"]
        d["title"] = d["paper_name"]
        papers.append(d)

    conn.close()
    return {"papers": papers}

@app.post("/api/pyp/papers")
def create_previous_year_paper(req: PYPCreateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT exam_name FROM exams WHERE id = ?", (req.exam_id,))
    exam = cursor.fetchone()
    exam_name = exam["exam_name"] if exam else "Target Examination"

    paper_id = "pyp_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO previous_year_papers (
            id, exam_id, exam_name, year, paper_name, paper_type,
            subject_name, duration_minutes, total_questions, total_marks,
            source, verification_status, file_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        paper_id,
        req.exam_id,
        exam_name,
        req.year,
        req.title,
        req.paper_type or "official",
        req.subject or "All Subjects",
        req.duration_minutes or 120,
        len(req.questions) if req.questions else req.total_questions,
        req.total_marks or 100.0,
        req.source or "Official Examination Board",
        req.verification_status or "verified",
        None,
        now_str
    ))

    if req.questions:
        q_records = []
        for idx, q in enumerate(req.questions, 1):
            q_id = "pypq_" + secrets.token_hex(6)
            q_records.append((
                q_id,
                paper_id,
                q.get("subject_id"),
                q.get("unit_id"),
                q.get("topic_id"),
                idx,
                q.get("question_text", "Sample Question"),
                q.get("question_type", "single_choice"),
                json.dumps(q.get("options", ["A", "B", "C", "D"])),
                q.get("correct_answer", "A"),
                q.get("explanation", ""),
                q.get("difficulty", "medium"),
                float(q.get("marks", 2.0)),
                float(q.get("negative_marks", 0.5)),
                q.get("topic_name", "General"),
                q.get("subject_name", req.subject or "All Subjects")
            ))
        cursor.executemany("""
            INSERT INTO pyp_questions (
                id, paper_id, subject_id, unit_id, topic_id, question_number,
                question_text, question_type, options, correct_answer,
                explanation, difficulty, marks, negative_marks, topic_name, subject_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, q_records)

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Paper '{req.title}' created successfully.",
        "paper_id": paper_id
    }

@app.get("/api/pyp/papers/detail/{paper_id}")
def get_pyp_paper_detail(paper_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM previous_year_papers WHERE id = ?", (paper_id,))
    paper = cursor.fetchone()
    if not paper:
        conn.close()
        raise HTTPException(status_code=404, detail="Paper not found.")

    paper_dict = dict(paper)
    paper_dict["title"] = paper_dict["paper_name"]

    cursor.execute("SELECT * FROM pyp_questions WHERE paper_id = ? ORDER BY question_number ASC", (paper_id,))
    q_rows = cursor.fetchall()
    conn.close()

    questions = []
    for q in q_rows:
        qd = dict(q)
        try:
            qd["options"] = json.loads(qd["options"])
        except Exception:
            qd["options"] = []
        questions.append(qd)

    paper_dict["questions"] = questions
    return {"paper": paper_dict}

# ----------------- 6. AI Exam Trend Analyzer & Important Topics -----------------

@app.get("/api/pyp/trends/{exam_id}")
def get_pyp_trend_analysis(exam_id: str, refresh: Optional[bool] = False, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM exams WHERE id = ?", (exam_id,))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    cursor.execute("""
        SELECT * FROM topic_trend_analysis
        WHERE exam_id = ?
        ORDER BY frequency_count DESC, weightage_percent DESC
    """, (exam_id,))
    existing_trends = cursor.fetchall()

    if existing_trends and not refresh:
        results = []
        for r in existing_trends:
            rd = dict(r)
            try:
                rd["years_appeared"] = json.loads(rd["years_appeared"])
            except Exception:
                rd["years_appeared"] = []
            rd["importance_category"] = rd["frequency_category"]
            rd["weightage_percentage"] = rd["weightage_percent"]
            results.append(rd)

        cursor.execute("SELECT COUNT(DISTINCT id) as p_cnt, MIN(year) as min_yr, MAX(year) as max_yr FROM previous_year_papers WHERE exam_id = ?", (exam_id,))
        p_stats = cursor.fetchone()
        conn.close()

        papers_count = p_stats["p_cnt"] if p_stats else 0
        min_y = p_stats["min_yr"] or 2020
        max_y = p_stats["max_yr"] or 2024

        return {
            "exam_id": exam_id,
            "papers_analyzed": papers_count,
            "years_covered": f"{min_y}–{max_y}" if papers_count > 0 else "None",
            "topics_count": len(results),
            "trends": results
        }

    cursor.execute("""
        SELECT pq.*, t.topic_name
        FROM pyp_questions pq
        JOIN previous_year_papers p ON pq.paper_id = p.id
        LEFT JOIN topics t ON pq.topic_id = t.id
        WHERE p.exam_id = ?
    """, (exam_id,))
    pyp_questions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT t.id, t.topic_name, t.importance, t.difficulty, s.id as subject_id, s.subject_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE s.exam_id = ?
    """, (exam_id,))
    syllabus_topics = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT topic_id FROM topic_progress
        WHERE user_id = ? AND stage < 3
    """, (user["id"],))
    weak_topic_ids = [r["topic_id"] for r in cursor.fetchall()]

    trend_analysis = ai_service.compute_pyp_trend_analysis(
        pyp_questions=pyp_questions,
        syllabus_topics=syllabus_topics,
        user_weak_topics=weak_topic_ids
    )

    cursor.execute("DELETE FROM topic_trend_analysis WHERE exam_id = ?", (exam_id,))
    now_str = datetime.now().isoformat()
    trend_records = []
    for t in trend_analysis:
        tta_id = "tta_" + secrets.token_hex(6)
        trend_records.append((
            tta_id,
            exam_id,
            t["topic_id"],
            t.get("subject_name", "General"),
            t["topic_name"],
            t.get("frequency_count", 0),
            t.get("importance_category", "moderate"),
            json.dumps(t.get("years_appeared", [])),
            t.get("weightage_percentage", 0.0),
            t.get("evidence_notes", ""),
            "Prioritize deep concept review and PYP practice" if t.get("importance_category") == "high_historical_frequency" else "Regular practice and revision",
            now_str
        ))

    if trend_records:
        cursor.executemany("""
            INSERT INTO topic_trend_analysis (
                id, exam_id, topic_id, subject_name, topic_name,
                frequency_count, frequency_category, years_appeared,
                weightage_percent, evidence_notes, recommended_action, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, trend_records)

    conn.commit()

    cursor.execute("""
        SELECT * FROM topic_trend_analysis
        WHERE exam_id = ?
        ORDER BY frequency_count DESC, weightage_percent DESC
    """, (exam_id,))
    fresh_trends = [dict(r) for r in cursor.fetchall()]
    for r in fresh_trends:
        try:
            r["years_appeared"] = json.loads(r["years_appeared"])
        except Exception:
            r["years_appeared"] = []
        r["importance_category"] = r["frequency_category"]
        r["weightage_percentage"] = r["weightage_percent"]

    cursor.execute("SELECT COUNT(DISTINCT id) as p_cnt, MIN(year) as min_yr, MAX(year) as max_yr FROM previous_year_papers WHERE exam_id = ?", (exam_id,))
    p_stats = cursor.fetchone()
    conn.close()

    papers_count = p_stats["p_cnt"] if p_stats else 0
    min_y = p_stats["min_yr"] or 2020
    max_y = p_stats["max_yr"] or 2024

    return {
        "exam_id": exam_id,
        "papers_analyzed": papers_count,
        "years_covered": f"{min_y}–{max_y}" if papers_count > 0 else "None",
        "topics_count": len(fresh_trends),
        "trends": fresh_trends
    }

# ----------------- 7. AI Predicted Practice Paper -----------------

@app.post("/api/predicted-paper/generate")
async def generate_ai_predicted_paper(req: PredictedPaperGenerateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM exams WHERE id = ?", (req.exam_id,))
    exam = cursor.fetchone()
    if not exam:
        conn.close()
        raise HTTPException(status_code=404, detail="Exam not found.")

    exam_dict = dict(exam)
    edu_level = exam_dict.get("education_level") or "competitive"

    cursor.execute("""
        SELECT t.id, t.topic_name, t.difficulty, t.importance, s.subject_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE s.exam_id = ?
    """, (req.exam_id,))
    topics = [dict(r) for r in cursor.fetchall()]

    if not topics:
        conn.close()
        raise HTTPException(status_code=400, detail="No syllabus topics found for this exam.")

    cursor.execute("SELECT topic_id, frequency_count, frequency_category as importance_category FROM topic_trend_analysis WHERE exam_id = ?", (req.exam_id,))
    trend_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT t.topic_name
        FROM topic_progress tp
        JOIN topics t ON tp.topic_id = t.id
        WHERE tp.user_id = ? AND tp.stage < 3
    """, (user["id"],))
    weak_topics = [r["topic_name"] for r in cursor.fetchall()]

    num_q = min(50, max(5, req.num_questions or 20))
    active_key = resolve_api_key(None, user)
    generated_paper = await ai_service.generate_predicted_practice_paper_content(
        exam_name=exam_dict["exam_name"],
        education_level=edu_level,
        subject_name=req.subject_name or "All Subjects",
        generation_mode=req.generation_mode or "exam_pattern",
        topics=topics,
        trend_data=trend_rows,
        weak_topics=weak_topics,
        num_questions=num_q,
        duration_mins=req.time_limit_mins or 60,
        api_key=active_key
    )

    paper_id = "pred_" + secrets.token_hex(6)
    now_str = datetime.now().isoformat()
    mandatory_disclaimer = "AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam."

    cursor.execute("""
        INSERT INTO predicted_papers (
            id, user_id, exam_id, title, generation_mode, target_date,
            duration_minutes, total_questions, total_marks, negative_marking_enabled,
            questions_json, disclaimer, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    """, (
        paper_id,
        user["id"],
        req.exam_id,
        generated_paper.get("title", f"AI Predicted Practice Paper — {exam_dict['exam_name']}"),
        req.generation_mode or "exam_pattern",
        req.target_date or exam_dict.get("exam_date"),
        req.time_limit_mins or 60,
        len(generated_paper.get("questions", [])),
        len(generated_paper.get("questions", [])) * 2.0,
        json.dumps(generated_paper.get("questions", [])),
        mandatory_disclaimer,
        now_str
    ))

    conn.commit()
    conn.close()

    generated_paper["id"] = paper_id
    generated_paper["disclaimer"] = mandatory_disclaimer
    return {"paper": generated_paper}

@app.get("/api/predicted-paper/{paper_id}")
def get_predicted_paper_detail(paper_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM predicted_papers WHERE id = ? AND user_id = ?", (paper_id, user["id"]))
    paper = cursor.fetchone()
    if not paper:
        conn.close()
        raise HTTPException(status_code=404, detail="Predicted paper not found.")

    paper_dict = dict(paper)
    try:
        paper_dict["questions"] = json.loads(paper_dict["questions_json"])
    except Exception:
        paper_dict["questions"] = []

    conn.close()
    return {"paper": paper_dict}

@app.get("/api/predicted-paper/list/{exam_id}")
def list_predicted_papers(exam_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, exam_id, title, generation_mode, target_date,
               duration_minutes, total_questions, total_marks, disclaimer, created_at
        FROM predicted_papers
        WHERE exam_id = ? AND user_id = ?
        ORDER BY created_at DESC
    """, (exam_id, user["id"]))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {"papers": rows}
