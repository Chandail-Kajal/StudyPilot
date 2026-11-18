from typing import Any

from sqlalchemy.orm import Session

from models import get_models


class BaseRepository:
    def __init__(self, session: Session):
        self.session = session
        self.models = get_models()

    def model(self, table_name: str):
        try:
            return getattr(self.models, table_name)
        except AttributeError as error:
            raise ValueError(f"Unknown database table: {table_name}") from error

    def get(self, table_name: str, primary_key: Any):
        return self.session.get(self.model(table_name), primary_key)

    def list(self, table_name: str, **filters: Any) -> list[Any]:
        model = self.model(table_name)
        return self.session.query(model).filter_by(**filters).all()

    def add(self, table_name: str, **values: Any):
        record = self.model(table_name)(**values)
        self.session.add(record)
        self.session.flush()
        return record

    def update(self, record: Any, **values: Any):
        columns = {column.name for column in record.__table__.columns}
        unknown = set(values) - columns
        if unknown:
            raise ValueError(f"Unknown {record.__tablename__} fields: {sorted(unknown)}")
        for name, value in values.items():
            setattr(record, name, value)
        self.session.flush()
        return record

    def delete(self, record: Any) -> None:
        self.session.delete(record)
        self.session.flush()
