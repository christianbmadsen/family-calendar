import json
import os
import sqlite3
import threading
from datetime import datetime
from typing import Optional

_local = threading.local()
_TABLES_CREATED: set[str] = set()
_TABLE_LOCK = threading.Lock()


def _encode(obj):
    if isinstance(obj, datetime):
        return {"__dt__": obj.isoformat()}
    raise TypeError(f"Not serializable: {type(obj)}")


def _decode(obj):
    if "__dt__" in obj:
        return datetime.fromisoformat(obj["__dt__"])
    return obj


def _dumps(data: dict) -> str:
    return json.dumps(data, default=_encode)


def _loads(text: str) -> dict:
    return json.loads(text, object_hook=_decode)


def _conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn"):
        db_path = os.environ.get("DB_PATH", "./family_calendar.db")
        _local.conn = sqlite3.connect(db_path)
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.commit()
    return _local.conn


def _ensure_table(name: str) -> None:
    if name in _TABLES_CREATED:
        return
    with _TABLE_LOCK:
        if name not in _TABLES_CREATED:
            _conn().execute(
                f'CREATE TABLE IF NOT EXISTS "{name}" '
                f'(id TEXT PRIMARY KEY, data TEXT NOT NULL)'
            )
            _conn().commit()
            _TABLES_CREATED.add(name)


def _get_doc(collection: str, doc_id: str) -> Optional[dict]:
    _ensure_table(collection)
    row = _conn().execute(
        f'SELECT data FROM "{collection}" WHERE id = ?', (doc_id,)
    ).fetchone()
    return _loads(row[0]) if row else None


def _all_docs(collection: str) -> list[dict]:
    _ensure_table(collection)
    rows = _conn().execute(f'SELECT data FROM "{collection}"').fetchall()
    return [_loads(r[0]) for r in rows]


class DocumentSnapshot:
    def __init__(self, collection: str, doc_id: str, data: Optional[dict]):
        self._collection = collection
        self.id = doc_id
        self._data = data
        self.exists: bool = data is not None
        self.reference = DocumentReference(collection, doc_id)

    def to_dict(self) -> dict:
        return dict(self._data) if self._data else {}


class DocumentReference:
    def __init__(self, collection: str, doc_id: str):
        self._collection = collection
        self._id = doc_id

    def get(self) -> DocumentSnapshot:
        data = _get_doc(self._collection, self._id)
        return DocumentSnapshot(self._collection, self._id, data)

    def set(self, data: dict) -> None:
        _ensure_table(self._collection)
        _conn().execute(
            f'INSERT OR REPLACE INTO "{self._collection}" (id, data) VALUES (?, ?)',
            (self._id, _dumps(data)),
        )
        _conn().commit()

    def update(self, data: dict) -> None:
        existing = _get_doc(self._collection, self._id)
        if existing is None:
            return
        existing.update(data)
        _ensure_table(self._collection)
        _conn().execute(
            f'UPDATE "{self._collection}" SET data = ? WHERE id = ?',
            (_dumps(existing), self._id),
        )
        _conn().commit()

    def delete(self) -> None:
        _ensure_table(self._collection)
        _conn().execute(
            f'DELETE FROM "{self._collection}" WHERE id = ?', (self._id,)
        )
        _conn().commit()


_OPS = {
    "==": lambda a, b: a == b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "<":  lambda a, b: a < b,
    ">":  lambda a, b: a > b,
}


class Query:
    def __init__(
        self,
        collection: str,
        filters: Optional[list] = None,
        limit_n: Optional[int] = None,
        order_field: Optional[str] = None,
    ):
        self._collection = collection
        self._filters: list[tuple] = filters or []
        self._limit_n = limit_n
        self._order_field = order_field

    def where(self, field: str, op: str, value) -> "Query":
        return Query(
            self._collection,
            self._filters + [(field, op, value)],
            self._limit_n,
            self._order_field,
        )

    def limit(self, n: int) -> "Query":
        return Query(self._collection, self._filters, n, self._order_field)

    def order_by(self, field: str) -> "Query":
        return Query(self._collection, self._filters, self._limit_n, field)

    def get(self) -> list[DocumentSnapshot]:
        results = [
            DocumentSnapshot(self._collection, d["id"], d)
            for d in _all_docs(self._collection)
            if self._matches(d)
        ]
        if self._order_field:
            f = self._order_field
            results.sort(key=lambda s: (s.to_dict().get(f) is None, s.to_dict().get(f)))
        if self._limit_n:
            results = results[: self._limit_n]
        return results

    def _matches(self, data: dict) -> bool:
        for field, op, value in self._filters:
            actual = data.get(field)
            fn = _OPS.get(op)
            if fn is None or actual is None:
                return False
            try:
                if not fn(actual, value):
                    return False
            except TypeError:
                return False
        return True


class CollectionReference(Query):
    def __init__(self, name: str):
        super().__init__(name)

    def document(self, doc_id: str) -> DocumentReference:
        return DocumentReference(self._collection, doc_id)

    def get(self) -> list[DocumentSnapshot]:
        return [
            DocumentSnapshot(self._collection, d["id"], d)
            for d in _all_docs(self._collection)
        ]


class WriteBatch:
    def __init__(self):
        self._ops: list[tuple] = []

    def update(self, ref: DocumentReference, data: dict) -> None:
        self._ops.append(("update", ref, data))

    def commit(self) -> None:
        for op, ref, data in self._ops:
            if op == "update":
                ref.update(data)


class _Client:
    def collection(self, name: str) -> CollectionReference:
        return CollectionReference(name)

    def batch(self) -> WriteBatch:
        return WriteBatch()


db = _Client()
