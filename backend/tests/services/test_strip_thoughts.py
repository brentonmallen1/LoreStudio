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
