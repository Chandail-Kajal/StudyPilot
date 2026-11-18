from routers.common import *
from schemas import *


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
            # Unpack full 15-element pedagogical package if stored
            if c_dict.get("pedagogical_content"):
                try:
                    pkg = json.loads(c_dict["pedagogical_content"])
                    if isinstance(pkg, dict):
                        for pk, pv in pkg.items():
                            studio_content[pk] = pv
                except Exception:
                    pass
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
        
        # Package full pedagogical elements for persistence
        pedagogical_pkg = {}
        for p_key in [
            "topic_introduction", "learning_objectives", "simple_explanation",
            "detailed_explanation", "how_it_works", "important_definitions", "step_by_step_examples",
            "real_world_applications", "important_formulas", "diagrams_and_visuals",
            "common_mistakes_and_traps", "advantages_and_limitations", "comparison_table",
            "exam_perspective", "points_to_remember", "topic_summary", "practice_questions", "faqs"
        ]:
            if p_key in studio_content:
                pedagogical_pkg[p_key] = studio_content[p_key]

        try:
            cursor.execute("""
                INSERT INTO topic_learning_content (
                    id, topic_id, education_level, summary, prerequisites,
                    sections, interactive_elements, key_takeaways,
                    comprehension_checks, pedagogical_content, quality_score, version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, 1, ?, ?)
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
                json.dumps(pedagogical_pkg),
                now_str,
                now_str
            ))
        except Exception:
            # Fallback for tables without pedagogical_content column
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
        if not video_data.get("audio_url"):
            v_url = video_data.get("video_url") or ""
            if v_url.endswith((".wav", ".mp3", ".ogg")) or "/static/audio/" in v_url:
                video_data["audio_url"] = v_url

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
        new_video_secs = max(int(existing.get("video_watched_seconds") or 0), int(req.video_watched_seconds or 0))
        new_audio_secs = max(int(existing.get("audio_listened_seconds") or 0), int(req.audio_listened_seconds or 0))
        new_incorrect = int(existing.get("incorrect_answers_count") or 0) + int(req.incorrect_answers_count or 0)
        new_repeated = int(existing.get("repeated_explanations_count") or 0) + int(req.repeated_explanations_count or 0)
        cursor.execute("""
            UPDATE topic_interactions SET
                has_studied = 1,
                has_mastered = ?,
                comprehension_score = ?,
                sections_completed = ?,
                flashcards_reviewed = ?,
                quiz_attempts = ?,
                video_watched_seconds = ?,
                audio_listened_seconds = ?,
                incorrect_answers_count = ?,
                repeated_explanations_count = ?,
                last_interacted_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            final_mastered,
            new_score,
            json.dumps(req.sections_completed),
            req.flashcards_reviewed,
            req.quiz_attempts,
            new_video_secs,
            new_audio_secs,
            new_incorrect,
            new_repeated,
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
                quiz_attempts, video_watched_seconds, audio_listened_seconds,
                incorrect_answers_count, repeated_explanations_count,
                last_interacted_at, updated_at
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int_id,
            user["id"],
            topic_id,
            has_mastered,
            req.comprehension_score,
            json.dumps(req.sections_completed),
            req.flashcards_reviewed,
            req.quiz_attempts,
            req.video_watched_seconds or 0,
            req.audio_listened_seconds or 0,
            req.incorrect_answers_count or 0,
            req.repeated_explanations_count or 0,
            now_str,
            now_str
        ))

    # Synchronize completion with active Study Plan daily task
    try:
        cursor.execute("""
            UPDATE study_plan_tasks
            SET status = 'completed', completed_at = ?
            WHERE topic_id = ? AND status != 'completed' AND study_plan_id IN (
                SELECT id FROM study_plans WHERE user_id = ?
            )
        """, (now_str, topic_id, user["id"]))
    except Exception as e:
        print(f"[Study Plan Task Sync Notice]: {e}")

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
    if not r_dict.get("audio_url"):
        v_url = r_dict.get("video_url") or ""
        if v_url.endswith((".wav", ".mp3", ".ogg")) or "/static/audio/" in v_url:
            r_dict["audio_url"] = v_url
    return {"has_video": True, "video": r_dict}


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


def get_topic_lessons_endpoint(topic_id: str, user: dict):
    try:
        from services.lesson_decomposition_service import get_or_create_topic_lessons
    except ImportError:
        from backend.services.lesson_decomposition_service import get_or_create_topic_lessons
    api_key = get_active_ai_key(user)
    lessons = get_or_create_topic_lessons(topic_id, api_key=api_key)
    return {"topic_id": topic_id, "lessons": lessons, "total_lessons": len(lessons)}


def decompose_topic_lessons_endpoint(topic_id: str, user: dict):
    try:
        from services.lesson_decomposition_service import get_or_create_topic_lessons
    except ImportError:
        from backend.services.lesson_decomposition_service import get_or_create_topic_lessons
    api_key = get_active_ai_key(user)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM topic_lessons WHERE topic_id = ?", (topic_id,))
    conn.commit()
    conn.close()
    lessons = get_or_create_topic_lessons(topic_id, api_key=api_key)
    return {"topic_id": topic_id, "lessons": lessons, "recreated": True}


def update_lesson_status_endpoint(lesson_id: str, req: dict, user: dict):
    try:
        from services.lesson_decomposition_service import update_lesson_status
    except ImportError:
        from backend.services.lesson_decomposition_service import update_lesson_status
    status = req.get("status", "completed")
    updated = update_lesson_status(lesson_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"success": True, "lesson": updated}


