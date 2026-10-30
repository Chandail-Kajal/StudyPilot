import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    res = requests.get(f"{BASE_URL}/api/health")
    print(f"Health: {res.status_code}, {res.json()}")

def test_login():
    payload = {
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    }
    res = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
    print(f"Login status: {res.status_code}")
    try:
        data = res.json()
        print("Login response keys:", list(data.keys()))
        token = data.get("token")
        return token
    except Exception as e:
        print("Login response text:", res.text)
        return None

def test_exam_and_planner(token):
    headers = {"Authorization": f"Bearer {token}"}
    exams_res = requests.get(f"{BASE_URL}/api/exams", headers=headers)
    print(f"Exams status: {exams_res.status_code}")
    exams = exams_res.json()
    print(f"Found {len(exams)} exams.")
    if exams:
        exam_id = exams[0]["id"]
        print(f"Testing study plan for exam_id: {exam_id} ({exams[0].get('name')})")
        plan_res = requests.get(f"{BASE_URL}/api/study-plans/{exam_id}", headers=headers)
        print(f"Plan status: {plan_res.status_code}")
        if plan_res.status_code == 200:
            plan = plan_res.json()
            tasks = plan.get("tasks", [])
            print(f"Total plan tasks: {len(tasks)}")
            if tasks:
                first = tasks[0]
                print(f"Sample task: id={first.get('id')}, date={first.get('scheduled_date')}, title='{first.get('title')}', time={first.get('start_time')}-{first.get('end_time')}")

if __name__ == "__main__":
    test_health()
    tok = test_login()
    if tok:
        test_exam_and_planner(tok)
