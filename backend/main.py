import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, Any
from fastapi import FastAPI, Depends, HTTPException, Header, status
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

init_db()

app = FastAPI(title="StudyPilot API", version="1.0.0")

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
    exam_name: Optional[str] = "Mid-term exams"
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
    exam_name: Optional[str] = None
    exam_date: Optional[str] = None
    goal_mins: Optional[int] = None
    settings_focus: Optional[int] = None
    settings_short: Optional[int] = None
    settings_long: Optional[int] = None

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
    goal_mins = req.goal_mins or 180

    cursor.execute("""
        INSERT INTO users (id, email, password_hash, salt, name, exam_name, exam_date, goal_mins, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, email, pwd_hash, salt, req.name.strip(), exam_name, exam_date, goal_mins, now_str))

    # Initial plan
    if req.prototype_data and isinstance(req.prototype_data, dict) and "tasks" in req.prototype_data:
        plan = req.prototype_data
        # Update exam info if specified
        if "exam" in plan and isinstance(plan["exam"], dict):
            plan["exam"]["name"] = exam_name
            plan["exam"]["date"] = exam_date
        plan["goalMins"] = goal_mins
    else:
        plan = generate_default_plan(exam_name=exam_name, exam_date=exam_date, goal_mins=goal_mins)

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
    plan_data = json.loads(plan_row["plan_json"]) if plan_row else generate_default_plan()

    conn.commit()
    conn.close()

    user_data = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
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
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        # For security and testing clarity
        raise HTTPException(status_code=404, detail="No StudyPilot account found with this email address.")

    reset_token = "rst_" + secrets.token_urlsafe(16)
    now_str = datetime.now().isoformat()
    expires_at = (datetime.now() + timedelta(hours=2)).isoformat()

    cursor.execute("""
        INSERT INTO password_resets (token, user_id, created_at, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
    """, (reset_token, user["id"], now_str, expires_at))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Password reset token generated successfully. In this environment, use the code below to reset your password.",
        "reset_token": reset_token,
        "email": email
    }

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    token = req.token.strip()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM password_resets WHERE token = ? AND used = 0", (token,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or already used password reset link/token.")

    if datetime.now() > datetime.fromisoformat(row["expires_at"]):
        conn.close()
        raise HTTPException(status_code=400, detail="This reset token has expired. Please request a new one.")

    user_id = row["user_id"]
    new_hash, new_salt = hash_password(req.new_password)

    cursor.execute("""
        UPDATE users SET password_hash = ?, salt = ? WHERE id = ?
    """, (new_hash, new_salt, user_id))

    cursor.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (token,))
    # Invalidate old sessions
    cursor.execute("DELETE FROM tokens WHERE user_id = ?", (user_id,))

    conn.commit()
    conn.close()

    return {"success": True, "message": "Your password has been reset successfully. You can now log in."}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT plan_json, updated_at FROM user_plans WHERE user_id = ?", (user_id,))
    plan_row = cursor.fetchone()
    conn.close()

    plan = json.loads(plan_row["plan_json"]) if plan_row else generate_default_plan()

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
            stage_sum += tp.get("stage", 0)
            if tp.get("stage", 0) >= 5:
                mastered_topics += 1

    readiness = round((stage_sum / (total_topics * 5) * 100)) if total_topics > 0 else 0

    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
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
        }
    }

@app.put("/api/auth/profile")
def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    conn = get_db()
    cursor = conn.cursor()

    name = req.name.strip() if req.name is not None and req.name.strip() else user["name"]
    exam_name = req.exam_name.strip() if req.exam_name is not None and req.exam_name.strip() else user["exam_name"]
    exam_date = req.exam_date if req.exam_date is not None else user["exam_date"]
    goal_mins = req.goal_mins if req.goal_mins is not None else user["goal_mins"]
    settings_focus = req.settings_focus if req.settings_focus is not None else user["settings_focus"]
    settings_short = req.settings_short if req.settings_short is not None else user["settings_short"]
    settings_long = req.settings_long if req.settings_long is not None else user["settings_long"]

    cursor.execute("""
        UPDATE users 
        SET name = ?, exam_name = ?, exam_date = ?, goal_mins = ?,
            settings_focus = ?, settings_short = ?, settings_long = ?
        WHERE id = ?
    """, (name, exam_name, exam_date, goal_mins, settings_focus, settings_short, settings_long, user_id))

    # Also update the plan's settings and exam
    cursor.execute("SELECT plan_json FROM user_plans WHERE user_id = ?", (user_id,))
    prow = cursor.fetchone()
    if prow:
        plan = json.loads(prow["plan_json"])
        plan["exam"] = {"name": exam_name, "date": exam_date}
        plan["goalMins"] = goal_mins
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

    result = await ai_service.plan_schedule_with_ai(
        syllabus=syllabus,
        exam_name=exam_name,
        exam_date=exam_date or (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        sitting_capacity_mins=req.sitting_capacity_mins or 45,
        daily_goal_mins=daily_goal,
        yesterday_topics=req.yesterday_topics,
        api_key=req.api_key
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
    test_data = await ai_service.generate_mock_test(
        topics=req.topics,
        subject_name=req.subject_name or "Syllabus Review",
        num_questions=req.num_questions or 5,
        difficulty=req.difficulty or "medium",
        importance_filter=req.importance_filter,
        extract_maximum=req.extract_maximum or False,
        api_key=req.api_key
    )
    return test_data

@app.post("/api/ai/extract-important-topics")
async def ai_extract_important_topics(req: AIExtractImportanceRequest, user: Optional[dict] = Depends(get_optional_user)):
    """
    Extracts and ranks important and very important topics based on exam weightage and high-frequency patterns.
    """
    exam_name = req.exam_name or (user.get("exam_name") if user else "Mid-term exams")
    exam_date = req.exam_date or (user.get("exam_date") if user else None)
    result = await ai_service.extract_topic_importance(
        syllabus=req.syllabus,
        exam_name=exam_name,
        exam_date=exam_date,
        api_key=req.api_key
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
