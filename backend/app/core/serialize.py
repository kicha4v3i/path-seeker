"""Helpers for consistent API document serialization."""

from typing import Any


def serialize_doc(doc: Any) -> dict:
    """Serialize a Beanie document with stable string id fields."""
    data = doc.model_dump(mode="json")
    doc_id = str(doc.id)
    data["id"] = doc_id
    data["_id"] = doc_id
    return data


def serialize_docs(docs: list[Any]) -> list[dict]:
    return [serialize_doc(d) for d in docs]
