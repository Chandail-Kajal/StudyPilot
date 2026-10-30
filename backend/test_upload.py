import urllib.request, json, os

def test_file_upload(file_path):
    filename = os.path.basename(file_path)
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8") + file_bytes + (
        f"\r\n--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"exam_name\"\r\n\r\n"
        f"Grand Examination\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/syllabus/parse-and-plan",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode("utf-8"))
    print(f"PARSED {filename}:")
    print(f"  Subjects: {data['subjects_count']} -> {[s['name'] for s in data['plan']['subjects']]}")
    print(f"  Topics: {data['topics_count']} | Tasks created: {data['tasks_count']}")

test_file_upload("c:/Users/Windows/Desktop/StudyPilot/sample_syllabi/jee_competitive_syllabus.csv")
test_file_upload("c:/Users/Windows/Desktop/StudyPilot/sample_syllabi/board_exam_syllabus.xlsx")
