from database import get_db as get_legacy_connection


class LegacySqlRepository:
    """Compatibility boundary for features not yet moved to ORM queries."""

    def connect(self):
        return get_legacy_connection()


def get_db():
    return LegacySqlRepository().connect()
