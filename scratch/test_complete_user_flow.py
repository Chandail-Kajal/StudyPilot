import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_e2e_test():
    print("=== Step 1: Student Authentication ===")
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    user = login_res.json()["user"]
    print(f"Authenticated as: {user['name']} ({user['email']})")
    headers = {"Authorization": f"Bearer {token}"}

    print("\n=== Step 2: Student Onboarding / Examination Creation ===")
    exam_payload = {
        "exam_name": "UGC NET Computer Science & Applications",
        "exam_category": "competitive",
        "education_level": "postgraduate",
        "exam_date": "2026-12-15",
        "daily_study_mins": 240,
        "sitting_capacity_mins": 45,
        "preparation_level": "intermediate",
        "initial_subjects": ["Discrete Mathematics", "Computer Networks", "Database Management Systems"]
    }
    create_exam_res = requests.post(f"{BASE_URL}/api/exams", json=exam_payload, headers=headers)
    assert create_exam_res.status_code == 200, f"Exam creation failed: {create_exam_res.text}"
    exam_id = create_exam_res.json()["exam"]["id"]
    print(f"Created Exam target: {exam_id} - '{exam_payload['exam_name']}'")

    print("\n=== Step 3: Syllabus Hierarchy Verification ===")
    hierarchy_res = requests.get(f"{BASE_URL}/api/syllabus/hierarchy/{exam_id}", headers=headers)
    assert hierarchy_res.status_code == 200, f"Hierarchy fetch failed: {hierarchy_res.text}"
    subjects = hierarchy_res.json().get("subjects", [])
    print(f"Verified {len(subjects)} subjects created:")
    first_topic_id = None
    for s in subjects:
        print(f" - Subject: {s['subject_name']} (ID: {s['id']})")
        # Add a sample topic to test AI class and practice drill
        topic_payload = {
            "exam_id": exam_id,
            "subject_id": s["id"],
            "topic_name": f"Foundations of {s['subject_name']}",
            "unit_name": "Unit 1: Fundamentals",
            "estimated_minutes": 45,
            "difficulty": "medium",
            "importance": "high"
        }
        topic_res = requests.post(f"{BASE_URL}/api/syllabus/topics", json=topic_payload, headers=headers)
        if topic_res.status_code == 200 and not first_topic_id:
            first_topic_id = topic_res.json().get("topic_id")

    print(f"Created sample topics. First Topic ID: {first_topic_id}")

    print("\n=== Step 4: AI Adaptive Study Planner & Timetable Generation ===")
    plan_payload = {
        "exam_id": exam_id,
        "exam_date": "2026-12-15",
        "daily_study_hours": 4,
        "learning_pace": "moderate",
        "buffer_days": 5
    }
    plan_res = requests.post(f"{BASE_URL}/api/planner/adaptive-create", json=plan_payload, headers=headers)
    assert plan_res.status_code == 200, f"Planner creation failed: {plan_res.text}"
    print(f"Generated study plan: {plan_res.json().get('message')}")

    print("\n=== Step 5: Timetable Retrieval & Slot Verification ===")
    plan_data_res = requests.get(f"{BASE_URL}/api/study-plans/{exam_id}", headers=headers)
    assert plan_data_res.status_code == 200, f"Failed to get study plan: {plan_data_res.text}"
    plan_data = plan_data_res.json()
    tasks = plan_data.get("tasks", [])
    print(f"Retrieved {len(tasks)} scheduled sessions.")
    assert len(tasks) > 0, "No tasks were scheduled in study plan!"
    sample_task = tasks[0]
    print(f"Sample Timetable Session:")
    print(f" - ID: {sample_task.get('id')}")
    print(f" - Title: {sample_task.get('title')}")
    print(f" - Scheduled Date: {sample_task.get('scheduled_date')}")
    print(f" - Time Slot: {sample_task.get('start_time')} - {sample_task.get('end_time')}")
    print(f" - Activity Type: {sample_task.get('activity_type')}")

    print("\n=== Step 6: Timetable Rescheduling Test ===")
    task_id = sample_task["id"]
    patch_res = requests.patch(f"{BASE_URL}/api/study-plans/tasks/{task_id}", json={
        "start_time": "11:00",
        "end_time": "11:45",
        "title": f"Rescheduled: {sample_task.get('title')}"
    }, headers=headers)
    assert patch_res.status_code == 200, f"Patch task failed: {patch_res.text}"
    print(f"Successfully rescheduled task {task_id}: {patch_res.json().get('message')}")

    print("\n=== Step 7: Custom Session Creation Test ===")
    custom_res = requests.post(f"{BASE_URL}/api/study-plans/custom-task", json={
        "exam_id": exam_id,
        "title": "Evening Formula Revision & Flashcards",
        "scheduled_date": "2026-11-01",
        "start_time": "20:00",
        "end_time": "20:30",
        "estimated_minutes": 30,
        "activity_type": "revision"
    }, headers=headers)
    assert custom_res.status_code == 200, f"Custom session creation failed: {custom_res.text}"
    custom_task_id = custom_res.json().get("task_id")
    print(f"Added custom session: {custom_task_id}")

    print("\n=== Step 8: Topic Practice Drill & Evaluation ===")
    if first_topic_id:
        practice_res = requests.get(f"{BASE_URL}/api/learning/topic/{first_topic_id}/practice", headers=headers)
        assert practice_res.status_code == 200, f"Practice drill fetch failed: {practice_res.text}"
        questions = practice_res.json().get("questions", [])
        print(f"Fetched {len(questions)} diagnostic practice questions.")
        if questions:
            q0 = questions[0]
            ans_payload = {
                "question_id": q0.get("id", "q_0"),
                "question_text": q0.get("question_text"),
                "user_answer": q0.get("options", ["A"])[0] if q0.get("options") else "Sample answer",
                "correct_answer": q0.get("correct_answer", "Sample answer"),
                "difficulty": "medium",
                "explanation": q0.get("explanation", "")
            }
            eval_res = requests.post(f"{BASE_URL}/api/learning/topic/{first_topic_id}/practice/submit", json=ans_payload, headers=headers)
            assert eval_res.status_code == 200, f"Practice submission failed: {eval_res.text}"
            ev = eval_res.json().get("evaluation", {})
            print(f"Evaluated answer: is_correct={ev.get('is_correct')}, explanation='{ev.get('explanation', '')[:60]}...'")

    print("\n=== Step 9: CBT Mock Test Generation ===")
    mock_payload = {
        "exam_id": exam_id,
        "test_name": "Full Syllabus Diagnostic CBT 1",
        "test_type": "full_syllabus",
        "duration_minutes": 60,
        "total_questions": 10,
        "negative_marking": True
    }
    mock_res = requests.post(f"{BASE_URL}/api/tests/configure", json=mock_payload, headers=headers)
    assert mock_res.status_code == 200, f"Mock configuration failed: {mock_res.text}"
    test_id = mock_res.json().get("test_id")
    print(f"Configured CBT Mock Test: {test_id} ('{mock_payload['test_name']}')")

    print("\n=== Step 10: AI Study Assistant Interaction ===")
    chat_res = requests.post(f"{BASE_URL}/api/ai/chat", json={
        "message": "Give me 3 high-yield strategies for UGC NET Computer Science preparation.",
        "exam_id": exam_id
    }, headers=headers)
    assert chat_res.status_code == 200, f"AI Assistant chat failed: {chat_res.text}"
    reply = chat_res.json().get("reply", "")
    print(f"AI Assistant replied ({len(reply)} chars): {reply[:120]}...")

    print("\n>>> ALL 10 USER JOURNEY & WORKFLOW TESTS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    run_e2e_test()
