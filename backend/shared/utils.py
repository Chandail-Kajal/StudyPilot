import hashlib
import secrets


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()
    return password_hash, salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    password_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(password_hash, expected_hash)
