from routers.common import *
from schemas import *


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

