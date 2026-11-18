from sqlalchemy.orm import Session

from repositories.base_repository import BaseRepository


class AuthRepository(BaseRepository):
    def __init__(self, session: Session):
        super().__init__(session)

    def find_user_by_token(self, token: str):
        token_model = self.model("tokens")
        user_model = self.model("users")
        return (
            self.session.query(token_model, user_model)
            .join(user_model, token_model.user_id == user_model.id)
            .filter(token_model.token == token)
            .first()
        )

    def delete_token(self, token: str) -> None:
        token_model = self.models.tokens
        token_record = self.session.get(token_model, token)
        if token_record is not None:
            self.session.delete(token_record)
            self.session.commit()
