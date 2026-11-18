from routers.common import *
from schemas import *


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


def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        conn = get_db()
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"success": True, "message": "Signed out successfully."}


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

