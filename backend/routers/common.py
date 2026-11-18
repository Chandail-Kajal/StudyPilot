import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any, List, Dict
from fastapi import Depends, File, Form, Header, HTTPException, UploadFile, status

from database import (
    hash_password,
    verify_password,
    generate_default_plan
)
from repositories.legacy_sql_repository import get_db
import ai_service
import syllabus_parser
from seed_data import seed_database

import video_generator
from ai_provider import ai_manager
from services.auth_service import AuthService, InvalidSessionError
from repositories.auth_repository import AuthRepository
from shared.database import SessionLocal


__all__ = [
    "Any",
    "AuthRepository",
    "AuthService",
    "Depends",
    "Dict",
    "File",
    "Form",
    "HTTPException",
    "Header",
    "InvalidSessionError",
    "List",
    "Optional",
    "SessionLocal",
    "UploadFile",
    "ai_manager",
    "ai_service",
    "datetime",
    "extract_unstructured_syllabus_text",
    "generate_default_plan",
    "get_current_user",
    "get_db",
    "get_optional_user",
    "hash_password",
    "hashlib",
    "json",
    "os",
    "resolve_api_key",
    "secrets",
    "seed_database",
    "status",
    "syllabus_parser",
    "timedelta",
    "verify_password",
    "video_generator",
]


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in."
        )
    token = authorization.split(" ")[1].strip()
    try:
        with SessionLocal() as session:
            return AuthService(AuthRepository(session)).get_current_user(token)
    except InvalidSessionError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error)
        )


def resolve_api_key(explicit_key: Optional[str] = None, user: Optional[dict] = None) -> Optional[str]:
    """Resolves API key from explicit param, user profile in DB, or environment variables."""
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    if user and user.get("ai_api_key") and str(user.get("ai_api_key")).strip():
        return str(user.get("ai_api_key")).strip()
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )


def extract_unstructured_syllabus_text(content: bytes, extension: str) -> str:
    if extension == "pdf":
        return syllabus_parser.extract_text_from_pdf(content)
    if extension in {"doc", "docx"}:
        return syllabus_parser.extract_text_from_docx(content)
    if extension in {"png", "jpg", "jpeg", "webp"}:
        return syllabus_parser.extract_text_from_image(content)
    return content.decode("utf-8", errors="ignore")
