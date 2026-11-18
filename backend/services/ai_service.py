from routers.common import *
from schemas import *


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

