"""Tests for Gemma 4 thought-stripping utilities."""

from app.services.llm.ollama import strip_thoughts, strip_thoughts_from_messages


def test_strips_thought_block():
    content = "<|channel>thought\nI should reason carefully here.\n<channel|>Here is my answer."
    assert strip_thoughts(content) == "Here is my answer."


def test_no_thought_block_unchanged():
    content = "Here is my answer."
    assert strip_thoughts(content) == "Here is my answer."


def test_strips_multiline_thought():
    content = "<|channel>thought\nLine one.\nLine two.\nLine three.\n<channel|>Final answer."
    assert strip_thoughts(content) == "Final answer."


def test_empty_string():
    assert strip_thoughts("") == ""


def test_strip_thoughts_from_messages_assistant_only():
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "<|channel>thought\nThinking...\n<channel|>Hi there!"},
        {"role": "user", "content": "What next?"},
    ]
    result = strip_thoughts_from_messages(messages)
    assert result[0]["content"] == "Hello"
    assert result[1]["content"] == "Hi there!"
    assert result[2]["content"] == "What next?"


def test_strip_thoughts_from_messages_preserves_user_content():
    messages = [
        {"role": "user", "content": "<|channel>thought\nThis is user text that looks like a thought.\n<channel|>"},
    ]
    result = strip_thoughts_from_messages(messages)
    # User messages are not touched
    assert result[0]["content"] == messages[0]["content"]


def test_strip_thoughts_from_messages_no_mutation():
    original = {"role": "assistant", "content": "<|channel>thought\nThinking...\n<channel|>Answer."}
    messages = [original]
    result = strip_thoughts_from_messages(messages)
    # Original dict should not be mutated
    assert original["content"] == "<|channel>thought\nThinking...\n<channel|>Answer."
    assert result[0]["content"] == "Answer."


def test_a_thinking_field_never_reaches_the_model():
    """Gemma 4's multi-turn rule: earlier turns carry their answers only. Ollama renders an
    assistant turn's `thinking` field back into the prompt, so it is dropped with any other
    field the model does not need."""
    messages = [
        {"role": "user", "content": "Who knocked?", "id": "m1"},
        {"role": "assistant", "content": "A stranger.", "thinking": "Eleanor fears the Visitor.", "ts": 1},
        {"role": "user", "content": "Look.", "images": ["b64"]},
    ]
    assert strip_thoughts_from_messages(messages) == [
        {"role": "user", "content": "Who knocked?"},
        {"role": "assistant", "content": "A stranger."},
        {"role": "user", "content": "Look.", "images": ["b64"]},
    ]
