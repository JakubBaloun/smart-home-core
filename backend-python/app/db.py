"""SQLAlchemy engine/session plumbing.

Services open their own sessions (mirroring `sessionFactory.withTransaction`
in the Quarkus code), so there is no per-request session dependency.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: sessionmaker[Session] | None = None


def init_engine(url: str | None = None) -> None:
    global _engine, _session_factory
    _engine = create_engine(url or get_settings().sqlalchemy_url, pool_pre_ping=True)
    _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)


def get_engine():
    if _engine is None:
        init_engine()
    return _engine


def _factory() -> sessionmaker[Session]:
    if _session_factory is None:
        init_engine()
    assert _session_factory is not None
    return _session_factory


@contextmanager
def read_session() -> Iterator[Session]:
    """Equivalent of `sessionFactory.withSession` — no transaction commit."""
    session = _factory()()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def transaction() -> Iterator[Session]:
    """Equivalent of `sessionFactory.withTransaction` — commit on success."""
    session = _factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
