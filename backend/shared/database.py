import os
import warnings

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker


BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))


def _sqlite_engine() -> Engine:
    database_path = os.path.join(BACKEND_DIR, "studypilot.db")
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def _create_engine() -> Engine:
    if os.environ.get("DB_TYPE", "mysql").lower() == "mysql":
        from sqlalchemy.engine import URL

        url = URL.create(
            "mysql+pymysql",
            username=os.environ.get("MYSQL_USER", "root"),
            password=os.environ.get("MYSQL_PASSWORD", "root"),
            host=os.environ.get("MYSQL_HOST", "localhost"),
            port=int(os.environ.get("MYSQL_PORT", "3306")),
            database=os.environ.get("MYSQL_DB", "studypilot_db"),
        )
        engine = create_engine(url, pool_pre_ping=True)
        try:
            with engine.connect():
                return engine
        except SQLAlchemyError:
            engine.dispose()
            warnings.warn(
                "SQLAlchemy could not connect to MySQL; using the existing SQLite fallback.",
                RuntimeWarning,
                stacklevel=2,
            )
            return _sqlite_engine()

    return _sqlite_engine()


engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session():
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
