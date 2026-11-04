import json
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

def generate_learning_objectives(topic_name: str, subject_name: str, difficulty: str = "medium") -> str:
    diff_label = difficulty.capitalize() if difficulty else "Medium"
    return (
        f"1. Understand foundational definitions, theories, and core principles of {topic_name}.\n"
        f"2. Learn key mathematical formulas, diagrams, and structural relationships.\n"
        f"3. Master standard examination patterns and step-by-step problem-solving methods.\n"
        f"4. Resolve common misconceptions ({diff_label} complexity level)."
    )

def generate_practice_exercises(topic_name: str, difficulty: str = "medium") -> str:
    return (
        f"• 5 Quick Recall MCQs on definitions and theorems.\n"
        f"• 5 Application Problems ({difficulty} difficulty).\n"
        f"• 2 Previous Year Examination scenario questions.\n"
        f"• Self-assessment score target: 80%+ accuracy."
    )

def generate_revision_activity(topic_name: str, revision_stage: str = "R1") -> str:
    if revision_stage == "R1":
        return f"Active recall drill: recite core rules of {topic_name} without notes, then solve 3 timed review questions."
    elif revision_stage == "R2":
        return f"Deep spaced repetition: mixed problem drills combining {topic_name} with related syllabus chapters."
    else:
        return f"High-yield speed review: formula sheet verification, shortcut techniques, and error log audit."

def generate_full_study_timetable(
    exam_id: str,
    exam_name: str,
    exam_date: str,
    topics: List[Dict[str, Any]],
    daily_study_hours: float = 3.0,
    education_level: str = "competitive",
    start_date: Optional[str] = None,
    plan_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates a production-grade, date-wise study timetable that covers:
    1. Complete syllabus distribution across available preparation days.
    2. Daily session slotting respecting the student's daily study hours (1-12 hrs).
    3. Mandatory Spaced Revision (R1, R2, and Final Revision block).
    4. Mandatory Mock Tests (Unit tests, Subject tests, PYP practice, Full mock exams).
    5. Detailed day-wise task notes with Learning Objectives, Practice Exercises, and Revision Goals.
    6. Preserves original_date for comparing original vs updated schedules.
    """
    if not plan_id:
        plan_id = "plan_" + secrets.token_hex(6)

    today = datetime.now().date()
    if start_date:
        try:
            start_dt = datetime.strptime(start_date[:10], "%Y-%m-%d").date()
        except Exception:
            start_dt = today + timedelta(days=1)
    else:
        start_dt = today + timedelta(days=1)

    if not exam_date:
        target_dt = start_dt + timedelta(days=30)
    else:
        try:
            target_dt = datetime.strptime(exam_date[:10], "%Y-%m-%d").date()
        except Exception:
            target_dt = start_dt + timedelta(days=30)

    total_days = (target_dt - start_dt).days
    if total_days < 3:
        total_days = 3
        target_dt = start_dt + timedelta(days=3)

    daily_study_hours = max(1.0, min(12.0, float(daily_study_hours or 3.0)))
    daily_minutes = int(daily_study_hours * 60)

    # Standard sitting chunk: 45-60 mins
    chunk_minutes = 45 if daily_study_hours <= 4.0 else 50
    sessions_per_day = max(1, min(8, round(daily_minutes / chunk_minutes)))

    # Standard time slots for daily pacing
    standard_slots = [
        ("09:00", "09:45"),
        ("10:00", "10:45"),
        ("11:15", "12:00"),
        ("14:30", "15:15"),
        ("15:30", "16:15"),
        ("17:00", "17:45"),
        ("19:00", "19:45"),
        ("20:15", "21:00"),
    ]

    # Divide timeline:
    # Final 15-20% reserved strictly for Final Revision & Full Mock Exams (no new topics!)
    final_buffer_days = max(2, min(14, int(total_days * 0.18)))
    learning_days_count = max(1, total_days - final_buffer_days)

    learning_dates = [start_dt + timedelta(days=i) for i in range(learning_days_count)]
    final_revision_dates = [start_dt + timedelta(days=i) for i in range(learning_days_count, total_days)]

    task_records = []
    # Map to track which tasks are scheduled per date to manage slots
    date_slot_usage: Dict[str, int] = {}

    def get_next_slot(date_str: str) -> tuple:
        used = date_slot_usage.get(date_str, 0)
        slot_idx = used % len(standard_slots)
        date_slot_usage[date_str] = used + 1
        return standard_slots[slot_idx]

    # Organize topics by subject and unit for natural progression
    grouped_by_subject: Dict[str, List[Dict[str, Any]]] = {}
    for t in topics:
        s_name = t.get("subject_name") or "Core Subject"
        if s_name not in grouped_by_subject:
            grouped_by_subject[s_name] = []
        grouped_by_subject[s_name].append(t)

    # Track completion of units for unit mock tests
    unit_topics_map: Dict[str, List[str]] = {}
    unit_last_date: Dict[str, str] = {}

    total_topics = max(1, len(topics))
    # Distribute topics across the learning dates
    for idx, t in enumerate(topics):
        t_id = t.get("topic_id") or t.get("id") or f"top_{idx}"
        t_name = (t.get("topic_name") or f"Topic {idx+1}").strip()
        s_id = t.get("subject_id") or "subj_gen"
        s_name = t.get("subject_name") or "General"
        u_name = t.get("unit_name") or "Unit 1"
        c_name = t.get("chapter_name") or "Core Section"
        diff = (t.get("difficulty") or "medium").lower()
        imp = (t.get("importance") or "medium").lower()
        est_mins = t.get("estimated_minutes") or chunk_minutes

        # Track for unit assessment
        u_key = f"{s_name} - {u_name}"
        if u_key not in unit_topics_map:
            unit_topics_map[u_key] = []
        unit_topics_map[u_key].append(t_name)

        # Primary learning date
        d_idx = int((idx / total_topics) * len(learning_dates))
        learn_date = learning_dates[min(d_idx, len(learning_dates) - 1)]
        learn_date_str = learn_date.strftime("%Y-%m-%d")
        unit_last_date[u_key] = learn_date_str

        # 1. Primary AI Class Session
        start_t, end_t = get_next_slot(learn_date_str)
        learn_notes = json.dumps({
            "learning_objectives": generate_learning_objectives(t_name, s_name, diff),
            "practice_exercises": generate_practice_exercises(t_name, diff),
            "revision_activity": generate_revision_activity(t_name, "R1"),
            "chapter": c_name,
            "unit": u_name,
            "subject": s_name
        })

        task_records.append({
            "id": f"spt_{secrets.token_hex(6)}",
            "study_plan_id": plan_id,
            "topic_id": t_id,
            "topic_name": t_name,
            "subject_id": s_id,
            "subject_name": s_name,
            "unit_name": u_name,
            "chapter_name": c_name,
            "scheduled_date": learn_date_str,
            "original_date": learn_date_str,
            "start_time": start_t,
            "end_time": end_t,
            "estimated_minutes": est_mins,
            "priority": "high" if imp in ("high", "very_high") else "medium",
            "activity_type": "class",
            "title": f"AI Class: {t_name}",
            "notes": learn_notes,
            "status": "pending",
            "missed": 0
        })

        # 2. Topic Practice Drill (Same day or +1 day)
        prac_date = learn_date if (date_slot_usage.get(learn_date_str, 0) < sessions_per_day) else (learn_date + timedelta(days=1))
        if prac_date > target_dt:
            prac_date = target_dt - timedelta(days=1)
        prac_date_str = prac_date.strftime("%Y-%m-%d")
        p_start_t, p_end_t = get_next_slot(prac_date_str)

        task_records.append({
            "id": f"spt_{secrets.token_hex(6)}",
            "study_plan_id": plan_id,
            "topic_id": t_id,
            "topic_name": t_name,
            "subject_id": s_id,
            "subject_name": s_name,
            "unit_name": u_name,
            "chapter_name": c_name,
            "scheduled_date": prac_date_str,
            "original_date": prac_date_str,
            "start_time": p_start_t,
            "end_time": p_end_t,
            "estimated_minutes": 30,
            "priority": "medium",
            "activity_type": "practice",
            "title": f"Practice Drill: {t_name}",
            "notes": json.dumps({
                "learning_objectives": f"Apply concepts of {t_name} to solve exam-style practice questions.",
                "practice_exercises": generate_practice_exercises(t_name, diff),
                "revision_activity": "Immediate review of incorrect options and explanations."
            }),
            "status": "pending",
            "missed": 0
        })

        # 3. Mandatory Spaced Revision 1 (R1: 2-3 days after first learning)
        r1_date = learn_date + timedelta(days=2 if total_days < 14 else 3)
        if r1_date < target_dt - timedelta(days=final_buffer_days):
            r1_date_str = r1_date.strftime("%Y-%m-%d")
            r1_start_t, r1_end_t = get_next_slot(r1_date_str)
            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": t_id,
                "topic_name": t_name,
                "subject_id": s_id,
                "subject_name": s_name,
                "unit_name": u_name,
                "chapter_name": c_name,
                "scheduled_date": r1_date_str,
                "original_date": r1_date_str,
                "start_time": r1_start_t,
                "end_time": r1_end_t,
                "estimated_minutes": 30,
                "priority": "medium",
                "activity_type": "revision",
                "title": f"Spaced Revision (R1): {t_name}",
                "notes": json.dumps({
                    "learning_objectives": f"First spaced repetition recall drill for {t_name}.",
                    "practice_exercises": "Solve 5 quick recall questions without looking at reference notes.",
                    "revision_activity": generate_revision_activity(t_name, "R1")
                }),
                "status": "pending",
                "missed": 0
            })

        # 4. Mandatory Spaced Revision 2 (R2: 7-10 days after, for medium/hard/high importance)
        if total_days >= 14 and (diff in ("hard", "medium") or imp in ("high", "very_high") or idx % 2 == 0):
            r2_date = learn_date + timedelta(days=7 if total_days < 30 else 10)
            if r2_date < target_dt - timedelta(days=final_buffer_days):
                r2_date_str = r2_date.strftime("%Y-%m-%d")
                r2_start_t, r2_end_t = get_next_slot(r2_date_str)
                task_records.append({
                    "id": f"spt_{secrets.token_hex(6)}",
                    "study_plan_id": plan_id,
                    "topic_id": t_id,
                    "topic_name": t_name,
                    "subject_id": s_id,
                    "subject_name": s_name,
                    "unit_name": u_name,
                    "chapter_name": c_name,
                    "scheduled_date": r2_date_str,
                    "original_date": r2_date_str,
                    "start_time": r2_start_t,
                    "end_time": r2_end_t,
                    "estimated_minutes": 30,
                    "priority": "medium",
                    "activity_type": "revision",
                    "title": f"Deep Revision (R2): {t_name}",
                    "notes": json.dumps({
                        "learning_objectives": f"Deep spaced repetition and cross-topic mastery: {t_name}.",
                        "practice_exercises": "Mixed problem set with previous units to build synoptic retention.",
                        "revision_activity": generate_revision_activity(t_name, "R2")
                    }),
                    "status": "pending",
                    "missed": 0
                })

    # 5. Mandatory Unit & Chapter Assessments
    for u_key, t_names in unit_topics_map.items():
        u_date_str = unit_last_date.get(u_key)
        if u_date_str:
            try:
                test_dt = datetime.strptime(u_date_str, "%Y-%m-%d").date() + timedelta(days=1)
                if test_dt >= target_dt - timedelta(days=final_buffer_days):
                    test_dt = target_dt - timedelta(days=final_buffer_days + 1)
                test_date_str = test_dt.strftime("%Y-%m-%d")
                t_start, t_end = get_next_slot(test_date_str)

                task_records.append({
                    "id": f"spt_{secrets.token_hex(6)}",
                    "study_plan_id": plan_id,
                    "topic_id": topics[0].get("topic_id") or topics[0].get("id"),
                    "topic_name": u_key,
                    "subject_id": topics[0].get("subject_id") or "subj_gen",
                    "subject_name": u_key.split(" - ")[0],
                    "unit_name": u_key.split(" - ")[-1],
                    "chapter_name": "Unit Mastery",
                    "scheduled_date": test_date_str,
                    "original_date": test_date_str,
                    "start_time": t_start,
                    "end_time": t_end,
                    "estimated_minutes": 45,
                    "priority": "high",
                    "activity_type": "mock_test",
                    "title": f"Unit Assessment: {u_key}",
                    "notes": json.dumps({
                        "learning_objectives": f"Comprehensive unit mastery test covering {len(t_names)} topics.",
                        "practice_exercises": "20-25 timed diagnostic questions with automatic scorecard.",
                        "revision_activity": "Detailed mistake analysis: bookmark weak areas for targeted recovery."
                    }),
                    "status": "pending",
                    "missed": 0
                })
            except Exception:
                pass

    # 6. Subject-Wise Assessments
    for s_name, s_topics in grouped_by_subject.items():
        if len(learning_dates) > 3:
            s_test_date = learning_dates[len(learning_dates) // 2]
            s_test_date_str = s_test_date.strftime("%Y-%m-%d")
            s_start, s_end = get_next_slot(s_test_date_str)

            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": s_topics[0].get("topic_id") or s_topics[0].get("id"),
                "topic_name": f"{s_name} Comprehensive Assessment",
                "subject_id": s_topics[0].get("subject_id") or "subj_gen",
                "subject_name": s_name,
                "unit_name": "Full Subject",
                "chapter_name": "Subject Benchmark",
                "scheduled_date": s_test_date_str,
                "original_date": s_test_date_str,
                "start_time": s_start,
                "end_time": s_end,
                "estimated_minutes": 60,
                "priority": "high",
                "activity_type": "mock_test",
                "title": f"Subject Assessment: {s_name}",
                "notes": json.dumps({
                    "learning_objectives": f"Full subject retention and speed benchmarking for {s_name}.",
                    "practice_exercises": "30 questions, timed CBT environment.",
                    "revision_activity": "Time management analysis and question attempt strategy check."
                }),
                "status": "pending",
                "missed": 0
            })

    # 7. Phase 3: Final Intensive Revision Block & Full-Length Mock Exams
    # Dedicated final days before the actual exam
    for i, rev_dt in enumerate(final_revision_dates):
        rev_date_str = rev_dt.strftime("%Y-%m-%d")
        days_left = (target_dt - rev_dt).days

        if days_left == 1:
            # Day before exam: Light review, formula sheets, relaxation
            t_start, t_end = ("10:00", "11:30")
            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": topics[0].get("topic_id") or topics[0].get("id"),
                "topic_name": "Final Formula & Cheat Sheet Review",
                "subject_id": topics[0].get("subject_id") or "subj_gen",
                "subject_name": "All Subjects",
                "unit_name": "Final Sprint",
                "chapter_name": "Score Booster",
                "scheduled_date": rev_date_str,
                "original_date": rev_date_str,
                "start_time": t_start,
                "end_time": t_end,
                "estimated_minutes": 90,
                "priority": "high",
                "activity_type": "revision",
                "title": f"Final High-Yield Formula & Cheat Sheet Audit",
                "notes": json.dumps({
                    "learning_objectives": "Confidence building, formula sheets, and exam hall strategy review.",
                    "practice_exercises": "Light revision only. Rest early for peak cognitive focus.",
                    "revision_activity": "Mental walkthrough of exam sections and time allocation per question."
                }),
                "status": "pending",
                "missed": 0
            })
        elif days_left in (2, 3):
            # Grand 3-Hour Full-Length Mock Examination
            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": topics[0].get("topic_id") or topics[0].get("id"),
                "topic_name": f"🏆 3-Hour Grand Full Mock Exam ({exam_name})",
                "subject_id": topics[0].get("subject_id") or "subj_gen",
                "subject_name": "Full Syllabus",
                "unit_name": "All Units",
                "chapter_name": "Official Simulation",
                "scheduled_date": rev_date_str,
                "original_date": rev_date_str,
                "start_time": "14:00",
                "end_time": "17:00",
                "estimated_minutes": 180,
                "priority": "high",
                "activity_type": "mock_test",
                "title": f"🏆 3-Hour Grand Full Mock Exam ({exam_name})",
                "notes": json.dumps({
                    "learning_objectives": "Complete full-syllabus exam simulator with negative marking and strict timer.",
                    "practice_exercises": "Full paper standard (100-150 questions across all subjects).",
                    "revision_activity": "Complete analysis of accuracy, unforced errors, and time pressure behavior."
                }),
                "status": "pending",
                "missed": 0
            })
        elif days_left in (4, 5):
            # PYP Practice & 60-Minute Rapid Simulation
            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": topics[0].get("topic_id") or topics[0].get("id"),
                "topic_name": f"🎯 60-Minute Rapid Full Syllabus Mock Test",
                "subject_id": topics[0].get("subject_id") or "subj_gen",
                "subject_name": "Full Syllabus",
                "unit_name": "All Units",
                "chapter_name": "PYP Benchmark",
                "scheduled_date": rev_date_str,
                "original_date": rev_date_str,
                "start_time": "10:00",
                "end_time": "11:00",
                "estimated_minutes": 60,
                "priority": "high",
                "activity_type": "mock_test",
                "title": f"🎯 60-Minute Rapid Full Syllabus Mock Test",
                "notes": json.dumps({
                    "learning_objectives": "Speed and accuracy drill across all subjects under timed conditions.",
                    "practice_exercises": "50 high-yield past questions from UGC NET/GATE/Board patterns.",
                    "revision_activity": "Immediate review of questions that took > 90 seconds."
                }),
                "status": "pending",
                "missed": 0
            })
        else:
            # Intensive subject revision sprint
            s_keys = list(grouped_by_subject.keys())
            target_subj = s_keys[i % len(s_keys)] if s_keys else "Core Subject"
            task_records.append({
                "id": f"spt_{secrets.token_hex(6)}",
                "study_plan_id": plan_id,
                "topic_id": topics[0].get("topic_id") or topics[0].get("id"),
                "topic_name": f"Comprehensive Mastery Revision: {target_subj}",
                "subject_id": topics[0].get("subject_id") or "subj_gen",
                "subject_name": target_subj,
                "unit_name": "All Units",
                "chapter_name": "Final Sprint",
                "scheduled_date": rev_date_str,
                "original_date": rev_date_str,
                "start_time": "09:30",
                "end_time": "11:00",
                "estimated_minutes": 90,
                "priority": "high",
                "activity_type": "revision",
                "title": f"Comprehensive Mastery Revision: {target_subj}",
                "notes": json.dumps({
                    "learning_objectives": f"Consolidate all units, formulas, and exception cases for {target_subj}.",
                    "practice_exercises": "Rapid solve 15 high-weightage questions.",
                    "revision_activity": "Identify remaining doubts and consult AI tutor in AI Learning Studio."
                }),
                "status": "pending",
                "missed": 0
            })

    # Sort all task records chronologically by scheduled_date and start_time
    task_records.sort(key=lambda x: (x["scheduled_date"], x.get("start_time", "09:00")))

    # Summary statistics
    total_class_sessions = sum(1 for t in task_records if t["activity_type"] == "class")
    total_practice_sessions = sum(1 for t in task_records if t["activity_type"] == "practice")
    total_revision_sessions = sum(1 for t in task_records if t["activity_type"] == "revision")
    total_mock_tests = sum(1 for t in task_records if t["activity_type"] == "mock_test")

    return {
        "success": True,
        "plan_id": plan_id,
        "exam_name": exam_name,
        "exam_date": target_dt.strftime("%Y-%m-%d"),
        "total_days": total_days,
        "learning_days": learning_days_count,
        "buffer_revision_days": final_buffer_days,
        "daily_study_hours": daily_study_hours,
        "daily_minutes": daily_minutes,
        "sessions_per_day": sessions_per_day,
        "total_tasks": len(task_records),
        "breakdown": {
            "ai_classes": total_class_sessions,
            "practice_drills": total_practice_sessions,
            "spaced_revisions": total_revision_sessions,
            "mock_tests": total_mock_tests
        },
        "tasks": task_records
    }

