from datetime import datetime

from repositories.auth_repository import AuthRepository


class InvalidSessionError(Exception):
    pass


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def get_current_user(self, token: str) -> dict:
        result = self.repository.find_user_by_token(token)
        if result is None:
            raise InvalidSessionError(
                "Session expired or invalid. Please sign in again."
            )

        token_record, user_record = result
        if datetime.now() > datetime.fromisoformat(token_record.expires_at):
            self.repository.delete_token(token)
            raise InvalidSessionError(
                "Session has expired. Please sign in again."
            )

        user_data = {
            column.name: getattr(user_record, column.name)
            for column in user_record.__table__.columns
        }
        user_data["user_id"] = token_record.user_id
        user_data["expires_at"] = token_record.expires_at
        return user_data
