"""The typed stream envelope, and the splitter that separates reasoning from prose."""

import pytest

from app.services.llm.sse import (
    ThoughtSplitter,
    UsageProbe,
    format_event,
    sse_events,
    sse_text,
)
from tests.fixtures.sse import decode_sse


def _drain(splitter: ThoughtSplitter, chunks: list[str]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for chunk in chunks:
        out += splitter.feed(chunk)
    return out + splitter.flush()


def _joined(pairs: list[tuple[str, str]], kind: str) -> str:
    return "".join(text for k, text in pairs if k == kind)


def test_prose_with_no_reasoning_passes_through_untouched():
    assert _drain(ThoughtSplitter(), ["The keeper ", "climbs the ", "stair."]) == [
        ("token", "The keeper "),
        ("token", "climbs the "),
        ("token", "stair."),
    ]


def test_a_thought_block_is_separated_from_the_prose_around_it():
    pairs = _drain(ThoughtSplitter(), ["Before<|channel>thought\nweighing it<channel|>After"])
    assert _joined(pairs, "token") == "BeforeAfter"
    assert _joined(pairs, "thinking") == "weighing it"


@pytest.mark.parametrize("size", [1, 2, 3, 5, 7, 11, 13])
def test_a_sentinel_split_across_chunks_is_still_recognised(size: int):
    """
    The whole reason this is a state machine. Chunk boundaries fall wherever the network
    puts them, and a regex over a partial buffer renders half a sentinel as prose.
    """
    raw = "Wind off the water.<|channel>thought\nthe lamp is the point<channel|>The lamp was lit."
    chunks = [raw[i : i + size] for i in range(0, len(raw), size)]
    pairs = _drain(ThoughtSplitter(), chunks)
    assert _joined(pairs, "token") == "Wind off the water.The lamp was lit."
    assert _joined(pairs, "thinking") == "the lamp is the point"


def test_a_partial_sentinel_is_never_emitted_as_prose():
    splitter = ThoughtSplitter()
    assert splitter.feed("Lit.<|chan") == [("token", "Lit.")]
    assert splitter.feed("nel>thought\nwhy<channel|>Done.") == [
        ("thinking", "why"),
        ("token", "Done."),
    ]


def test_text_that_merely_resembles_a_sentinel_is_released():
    splitter = ThoughtSplitter()
    assert splitter.feed("a <|ch") == [("token", "a ")]
    assert splitter.feed("air") == [("token", "<|chair")]


def test_an_unclosed_thought_block_never_becomes_prose():
    """The model stopped mid-reasoning. Show it as reasoning, do not promote it to an answer."""
    pairs = _drain(ThoughtSplitter(), ["<|channel>thought\nhalf a thou"])
    assert _joined(pairs, "token") == ""
    assert _joined(pairs, "thinking") == "half a thou"


def test_a_held_back_tail_is_flushed_when_the_stream_ends_on_it():
    splitter = ThoughtSplitter()
    assert splitter.feed("done <|ch") == [("token", "done ")]
    assert splitter.flush() == [("token", "<|ch")]


def test_several_thought_blocks_in_one_response():
    pairs = _drain(ThoughtSplitter(), ["<|channel>thought\none<channel|>A<|channel>thought\ntwo<channel|>B"])
    assert _joined(pairs, "thinking") == "onetwo"
    assert _joined(pairs, "token") == "AB"


def test_an_event_payload_cannot_break_out_of_its_data_line():
    frame = format_event("token", {"delta": "line one\nline two"})
    assert frame.count("\n\n") == 1
    assert len(frame.rstrip("\n").split("\n")) == 2


def _parse(frames: list[str]) -> list[tuple[str, dict]]:
    return decode_sse("".join(frames))


async def _tokens(*chunks: str):
    for chunk in chunks:
        yield chunk


@pytest.mark.asyncio
async def test_the_envelope_separates_reasoning_from_answer_and_ends_with_done():
    frames = [f async for f in sse_events(_tokens("<|channel>thought\nhm<channel|>Yes."), where="test")]
    assert _parse(frames) == [
        ("thinking", {"delta": "hm"}),
        ("token", {"delta": "Yes."}),
        ("done", {}),
    ]


@pytest.mark.asyncio
async def test_a_failure_arrives_as_an_error_event_not_as_prose():
    async def boom():
        yield "Partial"
        raise OSError("connection refused")

    events = _parse([f async for f in sse_events(boom(), where="scene-chat")])
    kinds = [k for k, _ in events]
    assert kinds == ["token", "error", "done"]
    message = events[1][1]
    assert message["where"] == "scene-chat"
    # The author is told the model is unreachable; the exception text stays in the log.
    assert "could not be reached" in message["message"]
    assert "connection refused" not in message["message"]


@pytest.mark.asyncio
async def test_what_is_persisted_is_the_prose_without_the_reasoning():
    saved: list[str] = []
    async for _ in sse_events(
        _tokens("Keep.<|channel>thought\ndrop me<channel|> Keep too."),
        where="test",
        on_text=saved.append,
    ):
        pass
    assert saved == ["Keep. Keep too."]


@pytest.mark.asyncio
async def test_a_half_finished_answer_is_still_persisted():
    async def boom():
        yield "As far as this"
        raise RuntimeError("model died")

    saved: list[str] = []
    async for _ in sse_events(boom(), where="test", on_text=saved.append):
        pass
    assert saved == ["As far as this"]


@pytest.mark.asyncio
async def test_usage_is_reported_before_done_when_the_call_recorded_it():
    class Result:
        tokens_in, tokens_out, model = 1204, 380, "gemma4"

    probe = UsageProbe()
    probe(Result())
    events = _parse([f async for f in sse_events(_tokens("Hi"), where="test", usage=probe)])
    assert [k for k, _ in events] == ["token", "usage", "done"]
    assert events[1][1] == {"prompt_tokens": 1204, "eval_tokens": 380, "model": "gemma4"}


@pytest.mark.asyncio
async def test_a_call_that_never_reached_the_model_reports_no_usage():
    events = _parse([f async for f in sse_events(_tokens("Hi"), where="test", usage=UsageProbe())])
    assert [k for k, _ in events] == ["token", "done"]


@pytest.mark.asyncio
async def test_a_canned_answer_uses_the_same_envelope():
    assert _parse([f async for f in sse_text("Nothing to recap yet.")]) == [
        ("token", {"delta": "Nothing to recap yet."}),
        ("done", {}),
    ]
