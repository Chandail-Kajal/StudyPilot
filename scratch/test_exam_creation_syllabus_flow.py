import requests
import json
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://127.0.0.1:8000"

def test_unified_exam_and_syllabus():
    print("=== Step 1: Login ===")
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Logged in successfully. User: {login_res.json()['user']['name']}")

    print("\n=== Step 2: Create Examination WITHOUT Syllabus (Optional Flow) ===")
    form_data_no_file = {
        "exam_name": "GATE Computer Science 2027",
        "exam_date": "2027-02-10",
        "exam_category": "competitive",
        "education_level": "postgraduate"
    }
    res_no_file = requests.post(
        f"{BASE_URL}/api/exams/create-with-syllabus",
        data=form_data_no_file,
        headers=headers
    )
    assert res_no_file.status_code == 200, f"Exam creation failed: {res_no_file.text}"
    data_no_file = res_no_file.json()
    assert data_no_file["success"] is True
    assert data_no_file["preview"] is None
    exam1 = data_no_file["exam"]
    print(f"PASS: Created Exam '{exam1['exam_name']}' (ID: {exam1['id']}) without syllabus.")

    print("\n=== Step 3: Create Examination WITH Syllabus Upload in One Step ===")
    csv_content = """Subject,Unit,Chapter,Topic,Estimated_Minutes,Difficulty,Importance
Data Structures,Unit 1: Linear Structures,Arrays and Linked Lists,Singly and Doubly Linked Lists,45,easy,high
Data Structures,Unit 1: Linear Structures,Stacks and Queues,Circular Queue and Deque Implementation,45,medium,high
Data Structures,Unit 2: Non-Linear,Trees,Binary Search Trees and AVL Rotations,60,hard,high
Algorithms,Unit 3: Design Paradigms,Dynamic Programming,0/1 Knapsack Problem and Memoization,60,hard,high
Algorithms,Unit 3: Design Paradigms,Greedy Techniques,Huffman Coding & Kruskal Algorithm,45,medium,high
"""
    file_bytes = csv_content.encode("utf-8")
    files = {
        "file": ("cs_curriculum_2027.csv", io.BytesIO(file_bytes), "text/csv")
    }
    form_data_with_file = {
        "exam_name": "UGC NET CS - 2027 Batch",
        "exam_date": "2027-06-20",
        "exam_category": "competitive",
        "education_level": "postgraduate"
    }

    res_with_file = requests.post(
        f"{BASE_URL}/api/exams/create-with-syllabus",
        data=form_data_with_file,
        files=files,
        headers=headers
    )
    assert res_with_file.status_code == 200, f"Unified creation failed: {res_with_file.text}"
    data_with_file = res_with_file.json()
    assert data_with_file["success"] is True
    exam2 = data_with_file["exam"]
    preview = data_with_file["preview"]
    assert preview is not None, "Preview must be populated when file is uploaded"
    rows = preview.get("rows", [])
    print(f"PASS: Created Exam '{exam2['exam_name']}' (ID: {exam2['id']}) WITH syllabus file '{data_with_file['file_name']}'")
    print(f"PASS: AI extracted {len(rows)} syllabus rows across {len(preview.get('summary', {}).get('subjects', []))} subjects.")

    for r in rows[:3]:
        print(f"  - Subject: {r.get('subject_name')} | Chapter: {r.get('chapter_name')} | Topic: {r.get('topic_name')} ({r.get('difficulty')}, {r.get('estimated_minutes')} mins)")

    print("\n=== Step 4: Confirm Syllabus Import & Auto-Generate Study Plan ===")
    confirm_payload = {
        "exam_id": exam2["id"],
        "file_name": data_with_file["file_name"],
        "file_format": data_with_file["file_format"],
        "rows": rows
    }
    res_confirm = requests.post(
        f"{BASE_URL}/api/syllabus/confirm-import",
        json=confirm_payload,
        headers=headers
    )
    assert res_confirm.status_code == 200, f"Confirm import failed: {res_confirm.text}"
    confirm_data = res_confirm.json()
    print(f"PASS: Syllabus confirmed! Message: {confirm_data.get('message')}")

    # Verify study plan tasks generated
    plan_res = requests.get(f"{BASE_URL}/api/study-plans/{exam2['id']}", headers=headers)
    assert plan_res.status_code == 200
    plan_tasks = plan_res.json().get("tasks", [])
    print(f"PASS: Verified study plan created with {len(plan_tasks)} scheduled sessions!")
    if plan_tasks:
        t0 = plan_tasks[0]
        print(f"  - Sample Session: '{t0.get('title')}' on {t0.get('scheduled_date')} ({t0.get('start_time')} - {t0.get('end_time')})")

    print("\n>>> ALL EXAMINATION CREATION & SYLLABUS UPLOAD TESTS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    test_unified_exam_and_syllabus()

