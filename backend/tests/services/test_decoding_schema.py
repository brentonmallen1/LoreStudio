"""The grammar a structured call decodes against must not admit an empty answer."""

import pathlib
import re

import pytest
from pydantic import BaseModel, Field

from app.schemas import ai_responses
from app.services.llm.gateway import decoding_schema


class _Item(BaseModel):
    text: str
    note: str | None = None


class _Report(BaseModel):
    issues: list[_Item] = Field(default_factory=list)
    summary: str = ""


def _objects(node):
    if isinstance(node, dict):
        if node.get("type") == "object" and "properties" in node:
            yield node
        for value in node.values():
            yield from _objects(value)
    elif isinstance(node, list):
        for value in node:
            yield from _objects(value)


def test_every_key_is_required_at_every_depth():
    schema = decoding_schema(_Report)
    assert schema["required"] == ["issues", "summary"]
    assert schema["$defs"]["_Item"]["required"] == ["text", "note"]


def test_the_model_itself_stays_lenient():
    """Defaults are for parsing a sparse answer; only the grammar gets stricter."""
    decoding_schema(_Report)
    assert "required" not in _Report.model_json_schema()
    assert _Report.model_validate({}).issues == []


def _structured_models() -> list[type[BaseModel]]:
    used: set[str] = set()
    for path in pathlib.Path("app").rglob("*.py"):
        text = path.read_text()
        if "generate_structured" in text:
            used |= set(re.findall(r"response_model=([A-Z]\w+)", text))
    return [
        obj
        for name, obj in vars(ai_responses).items()
        if name in used and isinstance(obj, type) and issubclass(obj, BaseModel)
    ]


@pytest.mark.parametrize("model", _structured_models(), ids=lambda m: m.__name__)
def test_no_structured_feature_can_answer_with_an_empty_object(model):
    """
    42 of these once accepted `{}`: gemma4 answered a suggestion pass that way and it was
    recorded as a success. For an analysis, `{}` reads as "found nothing wrong".
    """
    for obj in _objects(decoding_schema(model)):
        assert set(obj.get("required", [])) == set(obj["properties"]), model.__name__
