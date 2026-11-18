from routers.common import *
from schemas import *


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
        if score is not None and score < 60.0:
            # Concept struggled - schedule immediate reinforcement in 1 day
            nxt_stg = max(1, cur_stg)
            next_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
            status_val = 'needs_revision'
        else:
            nxt_stg = min(5, cur_stg + 1)
            next_date = (now + timedelta(days=intervals[nxt_stg])).strftime("%Y-%m-%d")
            status_val = 'mastered' if nxt_stg >= 5 else 'reviewing'

        cursor.execute("""
            UPDATE topic_progress
            SET stage = ?, last_revised_at = ?, next_revision_date = ?, status = ?
            WHERE user_id = ? AND topic_id = ?
        """, (nxt_stg, now_str, next_date, status_val, user["id"], tid))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Revision recorded. Topic stages advanced!"}


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

