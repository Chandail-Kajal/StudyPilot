import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
auth_headers = {"Authorization": "Bearer token_usr_demo_aarav_demo"}

def test_api_suite():
    print("Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, res.text
    print("  OK:", res.json())

    print("\nTesting /api/exams...")
    res = client.get("/api/exams", headers=auth_headers)
    assert res.status_code == 200, res.text
    exams = res.json().get("exams", [])
    print(f"  OK: Found {len(exams)} exams for Aarav:")
    for e in exams:
        print(f"    - {e['exam_name']} ({e['exam_category']}): {e['topics_count']} topics, readiness {e['readiness_percent']}%")

    print("\nTesting /api/syllabus/hierarchy/exam_ugc_net...")
    res = client.get("/api/syllabus/hierarchy/exam_ugc_net", headers=auth_headers)
    assert res.status_code == 200, res.text
    tree = res.json()
    print(f"  OK: Exam '{tree['exam']['exam_name']}' has {len(tree['subjects'])} subjects:")
    for s in tree["subjects"]:
        unit_count = len(s.get("units", []))
        top_count = sum(len(c.get("topics", [])) for u in s.get("units", []) for c in u.get("chapters", []))
        print(f"    - {s['subject_name']}: {unit_count} units, {top_count} topics")

    print("\nTesting /api/progress/exam_ugc_net...")
    res = client.get("/api/progress/exam_ugc_net", headers=auth_headers)
    assert res.status_code == 200, res.text
    prog = res.json().get("progress", [])
    print(f"  OK: Found {len(prog)} topic progress records.")

    print("\nTesting /api/revision/due/exam_ugc_net...")
    res = client.get("/api/revision/due/exam_ugc_net", headers=auth_headers)
    assert res.status_code == 200, res.text
    due = res.json().get("due_topics", [])
    print(f"  OK: {len(due)} topics due for spaced revision.")

    print("\nTesting /api/tests/available/exam_ugc_net...")
    res = client.get("/api/tests/available/exam_ugc_net", headers=auth_headers)
    assert res.status_code == 200, res.text
    tests = res.json().get("tests", [])
    print(f"  OK: {len(tests)} mock tests configured.")

    print("\nTesting /api/analytics/exam_ugc_net...")
    res = client.get("/api/analytics/exam_ugc_net", headers=auth_headers)
    assert res.status_code == 200, res.text
    ana = res.json()
    print(f"  OK: Readiness: {ana['readiness_percent']}%, {ana['total_topics']} total topics.")

    print("\nTesting /api/syllabus/upload-preview with CSV...")
    csv_sample = b"Subject,Unit,Chapter,Topic Name,Difficulty,Estimated Minutes\nMachine Learning,Supervised,Regression,Linear & Polynomial Regression,Medium,60\nMachine Learning,Supervised,Classification,Logistic Regression & Decision Trees,Hard,75\n"
    res = client.post(
        "/api/syllabus/upload-preview",
        files={"file": ("ml_syllabus.csv", csv_sample, "text/csv")},
        data={"exam_id": "exam_ugc_net", "scope": "complete"},
        headers=auth_headers
    )
    assert res.status_code == 200, res.text
    preview = res.json()
    assert preview["success"] is True
    print(f"  OK: Extracted {preview['summary']['total_rows']} rows, {preview['summary']['valid_rows']} valid.")

    print("\nALL BACKEND API TESTS PASSED!")

if __name__ == "__main__":
    test_api_suite()
