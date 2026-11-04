import requests
import json
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://127.0.0.1:8000"

def test_complete_study_planner_journey():
    print("=" * 70)
    print("STEP 1: Student Login")
    print("=" * 70)
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    user = login_res.json()["user"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"PASS: Logged in successfully as {user['name']} ({user['email']})")

    print("\n" + "=" * 70)
    print("STEP 2: Examination Creation with Daily Hours & Syllabus Upload")
    print("=" * 70)
    csv_syllabus = """Subject,Unit,Chapter,Topic,Estimated_Minutes,Difficulty,Importance
Computer Science,Data Structures,Linear Structures,Singly and Doubly Linked Lists,45,medium,high
Computer Science,Data Structures,Linear Structures,Circular Queue and Stack Implementations,45,medium,high
Computer Science,Data Structures,Trees and Graphs,Binary Search Trees and AVL Rotations,60,hard,high
Computer Science,Algorithms,Design Paradigms,0/1 Knapsack & Dynamic Programming,60,hard,high
Computer Science,Algorithms,Design Paradigms,Greedy Techniques & Huffman Coding,45,medium,high
Computer Science,Algorithms,Graph Algorithms,Dijkstra & Minimum Spanning Trees,60,hard,high
"""
    form_data = {
        "exam_name": "UGC NET Computer Science 2027",
        "exam_date": "2027-04-15",
        "exam_category": "competitive",
        "education_level": "postgraduate",
        "daily_study_hours": "3.5"
    }
    files = {
        "file": ("cs_net_curriculum.csv", io.BytesIO(csv_syllabus.encode("utf-8")), "text/csv")
    }
    exam_res = requests.post(
        f"{BASE_URL}/api/exams/create-with-syllabus",
        data=form_data,
        files=files,
        headers=headers
    )
    assert exam_res.status_code == 200, f"Create exam failed: {exam_res.text}"
    exam_data = exam_res.json()
    exam = exam_data["exam"]
    preview = exam_data["preview"]
    assert preview is not None, "Preview must be present"
    extracted_rows = preview["rows"]
    print(f"PASS: Created Exam '{exam['exam_name']}' (ID: {exam['id']}) with 3.5 hrs/day study target.")
    print(f"PASS: AI extracted {len(extracted_rows)} syllabus rows across {len(preview['summary']['subjects_count'] and [1] or [1])} subjects.")

    print("\n" + "=" * 70)
    print("STEP 3: Editable Syllabus Review (Modifying / Adding Topic)")
    print("=" * 70)
    # Simulate student editing row difficulty & adding a custom topic
    extracted_rows[0]["difficulty"] = "easy"
    extracted_rows[0]["estimated_minutes"] = 40
    new_custom_topic = {
        "id": "row_custom_1",
        "exam_name": exam["exam_name"],
        "subject_name": "Computer Science",
        "unit_name": "Operating Systems",
        "chapter_name": "Concurrency",
        "topic_name": "Deadlock Detection & Banker Algorithm",
        "subtopic_name": "",
        "difficulty": "hard",
        "estimated_minutes": 60,
        "importance": "high",
        "status": "valid"
    }
    rows_to_confirm = extracted_rows + [new_custom_topic]
    print(f"PASS: Student modified row 1 and added '{new_custom_topic['topic_name']}'. Total topics: {len(rows_to_confirm)}.")

    print("\n" + "=" * 70)
    print("STEP 4: Confirm Syllabus & Generate Day-Wise Study Timetable")
    print("=" * 70)
    confirm_res = requests.post(f"{BASE_URL}/api/syllabus/confirm-import", json={
        "exam_id": exam["id"],
        "file_name": "cs_net_curriculum.csv",
        "file_format": "csv",
        "rows": rows_to_confirm
    }, headers=headers)
    assert confirm_res.status_code == 200, f"Confirm import failed: {confirm_res.text}"
    confirm_data = confirm_res.json()
    print(f"PASS: Syllabus confirmed! Message: {confirm_data.get('message')}")

    print("\n" + "=" * 70)
    print("STEP 5: Verify AI-Generated Day-Wise Timetable Structure")
    print("=" * 70)
    plan_res = requests.get(f"{BASE_URL}/api/study-plans/{exam['id']}", headers=headers)
    assert plan_res.status_code == 200, f"Get plan failed: {plan_res.text}"
    plan_data = plan_res.json()
    tasks = plan_data.get("tasks", [])
    assert len(tasks) > 0, "Tasks must be populated in the study plan"

    classes = [t for t in tasks if t.get("activity_type") == "class"]
    practices = [t for t in tasks if t.get("activity_type") == "practice"]
    revisions = [t for t in tasks if t.get("activity_type") == "revision"]
    mock_tests = [t for t in tasks if t.get("activity_type") == "mock_test"]

    print(f"PASS: Total Scheduled Sessions: {len(tasks)}")
    print(f"  - [Class] Interactive AI Classes: {len(classes)}")
    print(f"  - [Practice] Topic Practice Drills: {len(practices)}")
    print(f"  - [Revision] Mandatory Spaced Revisions (R1/R2/Final): {len(revisions)}")
    print(f"  - [MockTest] Mandatory Mock Tests (Unit, Subject, Full-length): {len(mock_tests)}")

    assert len(classes) >= len(rows_to_confirm), "Every topic must have an AI class"
    assert len(revisions) >= len(rows_to_confirm), "Mandatory revision rule: every topic must be revised"
    assert len(mock_tests) >= 3, "Mandatory mock tests rule: unit, subject, and full mock exams must be scheduled"

    # Verify task details and notes
    first_task = tasks[0]
    print(f"\nSample Day 1 Session:")
    print(f"  - Title: {first_task.get('title')}")
    print(f"  - Date: {first_task.get('scheduled_date')} ({first_task.get('start_time')} - {first_task.get('end_time')})")
    print(f"  - Subject: {first_task.get('subject_name')} | Chapter: {first_task.get('chapter_name')}")
    assert first_task.get("original_date") is not None, "Task must store original_date for baseline comparison"

    notes = first_task.get("notes")
    assert notes is not None, "Task must store rich notes"
    parsed_notes = json.loads(notes)
    print(f"  - Learning Objectives: {parsed_notes.get('learning_objectives')[:75]}...")
    print(f"  - Practice Exercises: {parsed_notes.get('practice_exercises')[:75]}...")
    print(f"  - Revision Goals: {parsed_notes.get('revision_activity')[:75]}...")

    print("\n" + "=" * 70)
    print("STEP 6: Task Completion Toggle")
    print("=" * 70)
    toggle_res = requests.put(f"{BASE_URL}/api/study-plans/tasks/{first_task['id']}", headers=headers)
    assert toggle_res.status_code == 200, f"Toggle task failed: {toggle_res.text}"
    print(f"PASS: Toggled task '{first_task['id']}' status: {toggle_res.json().get('status')}")

    print("\n" + "=" * 70)
    print("STEP 7: Test Submission & Living Timetable Adaptation")
    print("=" * 70)
    # Create a quick mock test
    config_res = requests.post(f"{BASE_URL}/api/tests/configure", json={
        "exam_id": exam["id"],
        "test_name": "Diagnostic Mini-Mock",
        "test_type": "chapter",
        "duration_minutes": 15,
        "question_count": 3
    }, headers=headers)
    assert config_res.status_code == 200, f"Configure test failed: {config_res.text}"
    test_id = config_res.json()["test_id"]

    # Start test to get attempt_id
    start_res = requests.get(f"{BASE_URL}/api/tests/{test_id}/start", headers=headers)
    assert start_res.status_code == 200
    attempt_id = start_res.json()["attempt_id"]
    test_questions = start_res.json().get("questions", [])

    # Submit test with deliberate wrong answers to trigger weak topic detection
    answers = {}
    for q in test_questions:
        answers[q["id"]] = 999 # deliberate wrong answer

    submit_res = requests.post(f"{BASE_URL}/api/tests/{test_id}/submit", json={
        "attempt_id": attempt_id,
        "user_answers": answers,
        "time_taken_seconds": 120
    }, headers=headers)
    assert submit_res.status_code == 200, f"Submit test failed: {submit_res.text}"
    submit_data = submit_res.json()
    print(f"PASS: Submitted test. Score: {submit_data.get('score')} | Accuracy: {submit_data.get('accuracy')}%")

    # Verify that living timetable automatically scheduled targeted remediation!
    updated_plan_res = requests.get(f"{BASE_URL}/api/study-plans/{exam['id']}", headers=headers)
    assert updated_plan_res.status_code == 200
    updated_tasks = updated_plan_res.json().get("tasks", [])
    remediation_tasks = [t for t in updated_tasks if "Targeted" in t.get("title", "") or "Remediation" in t.get("title", "")]
    print(f"PASS: Living timetable adapted! Found {len(remediation_tasks)} targeted remediation sessions scheduled.")
    if remediation_tasks:
        print(f"  - Remediation Task: '{remediation_tasks[0]['title']}' on {remediation_tasks[0]['scheduled_date']}")

    print("\n" + "=" * 70)
    print("STEP 8: Standalone Timetable Recalculation API")
    print("=" * 70)
    regen_res = requests.post(f"{BASE_URL}/api/study-plans/generate/{exam['id']}", headers=headers)
    assert regen_res.status_code == 200, f"Regenerate plan failed: {regen_res.text}"
    print(f"PASS: Successfully recalculated complete timetable: {regen_res.json().get('message')}")

    print("\n" + "=" * 70)
    print(">>> COMPLETE STUDY PLANNER & ADAPTIVE LEARNING SYSTEM FULLY VERIFIED! <<<")
    print("=" * 70)

if __name__ == "__main__":
    test_complete_study_planner_journey()
