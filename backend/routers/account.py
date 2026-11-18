from fastapi import APIRouter

from routers.common import *
from schemas import *
from services import account_service


router = APIRouter()


@router.post("/api/auth/register")
def register(req: RegisterRequest):
    return account_service.register(req)


@router.post("/api/auth/login")
def login(req: LoginRequest):
    return account_service.login(req)


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    return account_service.logout(authorization)


@router.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    return account_service.forgot_password(req)


@router.get("/api/auth/verify-reset-token")
def verify_reset_token(token: str):
    return account_service.verify_reset_token(token)


@router.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    return account_service.reset_password(req)


@router.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return account_service.get_me(user)


@router.get("/api/plans/current")
def get_current_plan(user: dict = Depends(get_current_user)):
    return account_service.get_current_plan(user)


@router.put("/api/auth/profile")
def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    return account_service.update_profile(req, user)


@router.get("/api/settings/ai-key")
def get_ai_key_status(user: dict = Depends(get_current_user)):
    return account_service.get_ai_key_status(user)


@router.post("/api/settings/ai-key")
def save_ai_key(req: AIKeyUpdateRequest, user: dict = Depends(get_current_user)):
    return account_service.save_ai_key(req, user)


@router.put("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    return account_service.change_password(req, user)


@router.get("/api/sync")
def get_sync_plan(user: dict = Depends(get_current_user)):
    return account_service.get_sync_plan(user)


@router.post("/api/sync")
def save_sync_plan(req: SyncPlanRequest, user: dict = Depends(get_current_user)):
    return account_service.save_sync_plan(req, user)


@router.post("/api/import")
def import_prototype_data(req: ImportPlanRequest, user: dict = Depends(get_current_user)):
    return account_service.import_prototype_data(req, user)


@router.get("/api/export")
def export_data(user: dict = Depends(get_current_user)):
    return account_service.export_data(user)

