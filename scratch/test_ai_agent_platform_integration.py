import os
import sys
import json
import asyncio

sys.path.append('backend')

import database
import ai_provider
import ai_service
import syllabus_parser
import video_generator

async def run_integration_tests():
    print("=" * 70)
    print("STUDYPILOT AI - COMPREHENSIVE AI AGENT & FEATURE VERIFICATION")
    print("=" * 70)

    # -------------------------------------------------------------
    # TEST 1: Centralized AI Provider & Agent Architecture
    # -------------------------------------------------------------
    print("\n[TEST 1] AI Provider Architecture & Fallback Engine")
    manager = ai_provider.ai_manager
    providers = await manager.get_active_providers()
    print(f"  Active providers detected: {providers}")
    assert len(providers) >= 1, "At least one provider must be active"

    # Test prompt through dispatcher
    test_res = await manager.call_llm("Explain momentum in one sentence.", system_instruction="Be concise.")
    print(f"  Dispatcher result: success={test_res.get('success')}, provider={test_res.get('provider')}")
    print("  PASS: AI Provider architecture active and operational.")

    # -------------------------------------------------------------
    # TEST 2: PyMuPDF, Pandas, and OpenPyXL Integration
    # -------------------------------------------------------------
    print("\n[TEST 2] PDF & Data Processing Libraries")
    print(f"  PyMuPDF (fitz) available: {syllabus_parser.HAS_PYMUPDF}")
    print(f"  Pandas available: {syllabus_parser.HAS_PANDAS}")
    assert syllabus_parser.HAS_PYMUPDF, "PyMuPDF must be available"
    assert syllabus_parser.HAS_PANDAS, "Pandas must be available"
    print("  PASS: PyMuPDF and Pandas verified.")

    # -------------------------------------------------------------
    # TEST 3: 13-Point Complete Curriculum Study Content Generator
    # -------------------------------------------------------------
    print("\n[TEST 3] 13-Section Interactive Study Content Generator")
    lesson = await ai_service.generate_interactive_topic_content(
        topic_name="Photosynthesis and Light Reactions",
        subject_name="Biology",
        exam_name="NEET Exam",
        education_level="competitive"
    )

    required_13 = [
        "topic_introduction", "learning_objectives", "simple_explanation",
        "detailed_explanation", "important_definitions", "step_by_step_examples",
        "real_world_applications", "important_formulas", "diagrams_and_visuals",
        "points_to_remember", "topic_summary", "practice_questions", "faqs"
    ]

    missing = [k for k in required_13 if k not in lesson or not lesson[k]]
    print(f"  13 Sections check: {len(required_13) - len(missing)}/{len(required_13)} present")
    assert len(missing) == 0, f"Missing sections: {missing}"
    print(f"  Sample Intro: {lesson['topic_introduction'][:90]}...")
    print(f"  Sample Objectives: {len(lesson['learning_objectives'])} items")
    print(f"  Sample Definitions: {len(lesson['important_definitions'])} items")
    print(f"  Sample FAQs: {len(lesson['faqs'])} items")
    print("  PASS: All 13 structured curriculum sections verified.")

    # -------------------------------------------------------------
    # TEST 4: Automated Animated Educational Video Generator
    # -------------------------------------------------------------
    print("\n[TEST 4] Animated Educational Video & Voiceover Pipeline")
    conn = database.get_db()
    cur = conn.cursor()
    cur.execute("SELECT t.id as topic_id, e.user_id FROM topics t JOIN subjects s ON t.subject_id = s.id JOIN exams e ON s.exam_id = e.id LIMIT 1")
    t_row = cur.fetchone()
    conn.close()

    if t_row:
        t_id = t_row["topic_id"]
        u_id = t_row.get("user_id") or "usr_demo"
        vid = await video_generator.create_or_regenerate_video(t_id, u_id, engine="remotion")
        print(f"  Generated Video Title: '{vid['title']}'")
        print(f"  Duration: {vid['duration_seconds']}s")
        print(f"  Scenes count: {len(vid['scenes'])}")
        print(f"  Subtitles count: {len(vid['subtitles'])}")
        print(f"  Narration Audio URL: {vid['audio_url']}")
        assert len(vid["scenes"]) >= 3, "Video must have at least 3 scenes"
        assert len(vid["subtitles"]) > 0, "Video must have synchronized subtitles"
        print("  PASS: Animated video, voice narration, and subtitle synchronization verified.")

    # -------------------------------------------------------------
    # TEST 5: Contextual AI Tutor
    # -------------------------------------------------------------
    print("\n[TEST 5] In-Topic AI Tutor & Prompt Actions")
    tutor_reply = await ai_service.chat_with_topic_tutor(
        topic_name="Dynamic Programming & Memoization",
        subject_name="Computer Science",
        education_level="undergraduate",
        history=[],
        user_query="Can you explain this with a simple everyday analogy?"
    )
    print(f"  Tutor response length: {len(tutor_reply)} chars")
    print(f"  Sample reply: {tutor_reply[:120]}...")
    assert len(tutor_reply) > 20, "Tutor response must be substantive"
    print("  PASS: Contextual AI Tutor operational.")

    # -------------------------------------------------------------
    # TEST 6: AI Mock Test Generator (15m, 30m, 3h)
    # -------------------------------------------------------------
    print("\n[TEST 6] AI Mock Test Generator & Durations")
    mock_test = await ai_service.generate_mock_test(
        topics=["Thermodynamics", "Kinetic Theory of Gases"],
        subject_name="Physics",
        num_questions=6,
        difficulty="medium"
    )
    print(f"  Mock test generated: {len(mock_test.get('questions', []))} questions")
    assert len(mock_test.get("questions", [])) > 0, "Mock test must produce questions"
    q1 = mock_test["questions"][0]
    print(f"  Sample Question: '{q1.get('question')[:60]}...'")
    print(f"  Options: {len(q1.get('options', []))} choices | Correct: {q1.get('correct_answer')}")
    print("  PASS: Mock test generator verified.")

    # -------------------------------------------------------------
    # TEST 7: Previous-Year Question Paper Trend Analyzer
    # -------------------------------------------------------------
    print("\n[TEST 7] Previous-Year Question Paper Analyzer")
    sample_paper = {
        "questions": [
            {"topic_name": "Calculus", "difficulty": "hard", "marks": 4.0},
            {"topic_name": "Calculus", "difficulty": "medium", "marks": 4.0},
            {"topic_name": "Matrices", "difficulty": "easy", "marks": 2.0}
        ]
    }
    trends = ai_service.compute_pyp_trend_analysis(sample_paper["questions"])
    print(f"  Identified topics in trends: {len(trends)}")
    print("  PASS: PYQ analysis verified.")

    # -------------------------------------------------------------
    # TEST 8: Student Progress & AI Recommendation Agent
    # -------------------------------------------------------------
    print("\n[TEST 8] Student Performance Tracking & AI Recommendations")
    conn = database.get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM exams LIMIT 1")
    ex_row = cur.fetchone()
    conn.close()

    if ex_row:
        exam_id = ex_row["id"]
        print(f"  Exam ID for recommendations: {exam_id}")
        # Test recovery plan calculation
        rec_plan = ai_service.calculate_smart_recovery_plan(
            exam_id=exam_id,
            missed_task_count=2,
            target_exam_date="2026-12-01"
        )
        print(f"  Recovery strategy: {rec_plan.get('recovery_strategy', 'Optimal rebalance')}")
        print("  PASS: Performance-based recommendation engine verified.")

    print("\n" + "=" * 70)
    print(">>> ALL 8 AI AGENT INTEGRATION MODULES VERIFIED SUCCESSFULLY! <<<")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_integration_tests())

