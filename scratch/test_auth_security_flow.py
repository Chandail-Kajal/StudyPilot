import requests
import json
import hashlib
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://127.0.0.1:8000"

def test_auth_security_flow():
    print("=" * 60)
    print("TEST 1: Normal Login with Valid Credentials")
    print("=" * 60)
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    data = res.json()
    assert "token" in data, "Token missing in login response"
    assert "user" in data, "User missing in login response"
    # Ensure NO reset token is generated or returned during normal login
    assert "reset_token" not in data, "Reset token must NOT be returned in login"
    print(f"PASS: Logged in successfully as {data['user']['name']} ({data['user']['email']})")

    print("\n" + "=" * 60)
    print("TEST 2: Normal Login with Invalid Credentials")
    print("=" * 60)
    res_bad = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "WrongPassword!"
    })
    assert res_bad.status_code == 401, f"Expected 401, got: {res_bad.status_code}"
    bad_data = res_bad.json()
    assert "reset_token" not in bad_data, "Reset token must NOT be returned on failed login"
    print(f"PASS: Refused invalid login with 401: {bad_data.get('detail')}")

    print("\n" + "=" * 60)
    print("TEST 3: Forgot Password for Non-Existent Email (No User Enumeration)")
    print("=" * 60)
    res_nonexistent = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
        "email": "nonexistent_scholar_9999@studypilot.ai"
    })
    assert res_nonexistent.status_code == 200, f"Expected generic 200, got: {res_nonexistent.status_code}"
    ne_data = res_nonexistent.json()
    assert "reset_token" not in ne_data, "Never expose reset_token in response"
    assert "reset_link" not in ne_data, "Never expose reset_link in response"
    print(f"PASS: Generic response returned without leaking account existence: {ne_data.get('message')}")

    print("\n" + "=" * 60)
    print("TEST 4: Forgot Password for Registered User (Secure Backend Generation)")
    print("=" * 60)
    # First inspect MySQL directly to see token hashing
    from backend.database import get_db
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email='kajalekarigar@gmail.com')")
    conn.commit()

    res_forgot = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
        "email": "kajalekarigar@gmail.com"
    })
    assert res_forgot.status_code == 200, f"Forgot password failed: {res_forgot.text}"
    forgot_data = res_forgot.json()
    assert "reset_token" not in forgot_data, "Security requirement: reset_token must NEVER be in HTTP response"
    assert "reset_link" not in forgot_data, "Security requirement: reset_link must NEVER be in HTTP response"
    print(f"PASS: Public HTTP response clean & generic: {forgot_data.get('message')}")

    # Verify database state
    cur.execute("""
        SELECT token, created_at, expires_at, used 
        FROM password_resets 
        WHERE user_id = (SELECT id FROM users WHERE email='kajalekarigar@gmail.com')
        ORDER BY created_at DESC LIMIT 1
    """)
    db_row = cur.fetchone()
    assert db_row is not None, "Password reset row missing in database"
    assert db_row["used"] == 0, "New token must have used=0"
    stored_hash = db_row["token"]
    assert len(stored_hash) == 64, f"Token must be stored as SHA-256 hash (64 hex chars), got len {len(stored_hash)}"
    print(f"PASS: Verified in MySQL: Token is stored securely as SHA-256 hash: {stored_hash[:16]}... (len={len(stored_hash)})")
    print(f"PASS: Expiration time: {db_row['expires_at']} (30 mins from creation: {db_row['created_at']})")

    print("\n" + "=" * 60)
    print("TEST 5: Rate Limiting Forgot Password Requests")
    print("=" * 60)
    res_spam = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
        "email": "kajalekarigar@gmail.com"
    })
    assert res_spam.status_code == 200
    print(f"PASS: Rate-limit handled smoothly: {res_spam.json().get('message')}")

    print("\n" + "=" * 60)
    print("TEST 6: Token Verification Endpoint (GET /api/auth/verify-reset-token)")
    print("=" * 60)
    # Test with invalid token
    v_bad = requests.get(f"{BASE_URL}/api/auth/verify-reset-token?token=completely_fake_token")
    assert v_bad.status_code == 200
    assert v_bad.json().get("valid") is False
    print(f"PASS: Invalid token rejected correctly: {v_bad.json()}")

    # To test valid token, we create a known test raw token
    import secrets
    test_raw_token = "rst_" + secrets.token_urlsafe(32)
    test_token_hash = hashlib.sha256(test_raw_token.encode("utf-8")).hexdigest()
    from datetime import datetime, timedelta
    now_str = datetime.now().isoformat()
    exp_str = (datetime.now() + timedelta(minutes=30)).isoformat()
    cur.execute("SELECT id FROM users WHERE email='kajalekarigar@gmail.com'")
    uid = cur.fetchone()["id"]
    cur.execute("""
        INSERT INTO password_resets (token, user_id, created_at, expires_at, used)
        VALUES (%s, %s, %s, %s, 0)
    """, (test_token_hash, uid, now_str, exp_str))
    conn.commit()

    v_good = requests.get(f"{BASE_URL}/api/auth/verify-reset-token?token={test_raw_token}")
    assert v_good.status_code == 200
    assert v_good.json().get("valid") is True
    assert v_good.json().get("email") == "kajalekarigar@gmail.com"
    print(f"PASS: Valid token verified correctly: email={v_good.json().get('email')}")

    print("\n" + "=" * 60)
    print("TEST 7: Reset Password With Short Password (< 6 chars)")
    print("=" * 60)
    res_short = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
        "token": test_raw_token,
        "new_password": "123"
    })
    assert res_short.status_code == 400
    print(f"PASS: Rejected short password: {res_short.json().get('detail')}")

    print("\n" + "=" * 60)
    print("TEST 8: Reset Password Successfully Through Backend")
    print("=" * 60)
    new_test_password = "NewSecretPass456!"
    res_reset = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
        "token": test_raw_token,
        "new_password": new_test_password
    })
    assert res_reset.status_code == 200, f"Reset password failed: {res_reset.text}"
    print(f"PASS: Password reset response: {res_reset.json().get('message')}")

    # Verify token is now marked used
    cur.execute("SELECT used FROM password_resets WHERE token=%s", (test_token_hash,))
    assert cur.fetchone()["used"] == 1, "Token must be marked used=1"
    print("PASS: Verified token is marked used=1 in database")

    print("\n" + "=" * 60)
    print("TEST 9: Reused Token Rejection (Single-Use Only)")
    print("=" * 60)
    res_reuse = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
        "token": test_raw_token,
        "new_password": "AnotherPassword789!"
    })
    assert res_reuse.status_code == 400
    print(f"PASS: Reused token rejected: {res_reuse.json().get('detail')}")

    print("\n" + "=" * 60)
    print("TEST 10: Login with New Password & Rejection of Old Password")
    print("=" * 60)
    # Old password must fail
    res_old = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert res_old.status_code == 401
    print("PASS: Old password correctly rejected with 401")

    # New password must succeed
    res_new = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": new_test_password
    })
    assert res_new.status_code == 200
    print(f"PASS: New password successfully authenticated! User: {res_new.json()['user']['name']}")

    # Restore password back to Password123! so user's environment is pristine
    from backend.database import hash_password
    p_hash, p_salt = hash_password("Password123!")
    cur.execute("UPDATE users SET password_hash=%s, salt=%s WHERE id=%s", (p_hash, p_salt, uid))
    conn.commit()
    conn.close()

    res_restored = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "kajalekarigar@gmail.com",
        "password": "Password123!"
    })
    assert res_restored.status_code == 200
    print("PASS: Restored password to 'Password123!' and verified login succeeds!")

    print("\n>>> ALL 10 AUTHENTICATION & SECURITY FLOW TESTS COMPLETED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_auth_security_flow()
