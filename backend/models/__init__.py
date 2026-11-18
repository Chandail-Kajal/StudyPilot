from functools import lru_cache

from sqlalchemy.ext.automap import automap_base

from shared.database import engine


@lru_cache(maxsize=1)
def get_models():
    """Reflect the initialized relational schema into SQLAlchemy ORM classes."""
    base = automap_base()
    base.prepare(autoload_with=engine)
    return base.classes
