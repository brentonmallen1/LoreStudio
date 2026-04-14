"""
Mock AI gateway fixtures for testing.

Mock at the AIGateway level (not the OllamaProvider level) so tests cover prompt
composition, parameter merging, and activity logging without real network calls.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app.schemas.ai_responses import StructuredResult


# ---------------------------------------------------------------------------
# Sample response payloads (use in tests to avoid hardcoding dicts everywhere)
# ---------------------------------------------------------------------------

SAMPLE_DIALOGUE_ATTRIBUTION = {
    "suggestions": [
        {
            "quote_text": "Hello there",
            "suggested_speaker": "Maya",
            "confidence": 0.9,
            "reasoning": "Previous paragraph names Maya as speaking",
        }
    ]
}

SAMPLE_ECONOMY_ANALYSIS = {
    "thread_balance": {"summary": "Balanced", "details": []},
    "scene_economy": {"summary": "Efficient", "details": []},
    "try_fail_cycles": {"summary": "Present", "details": []},
    "recommendations": ["Consider adding more try/fail cycles"],
}

SAMPLE_ESSENTIAL_QUESTIONS = {
    "protagonist": {"question": "Who is this about?", "status": "clear", "evidence": "...", "recommendation": ""},
    "want": {"question": "What do they want?", "status": "clear", "evidence": "...", "recommendation": ""},
    "why": {"question": "Why do they want it?", "status": "partial", "evidence": "...", "recommendation": "Expand motivation"},
    "obstacle": {"question": "What stops them?", "status": "clear", "evidence": "...", "recommendation": ""},
    "stakes": {"question": "What if they fail?", "status": "clear", "evidence": "...", "recommendation": ""},
    "change": {"question": "How do they change?", "status": "unclear", "evidence": "", "recommendation": "Define the arc"},
    "overall_clarity": "fair",
    "summary": "Story has most core questions answered.",
}

SAMPLE_SHOW_DONT_TELL = {
    "instances": [
        {
            "passage": "She was very angry.",
            "severity": "moderate",
            "issue_type": "emotion",
            "explanation": "Tells the emotion directly",
            "suggestion": "Describe physical signs of anger instead",
        }
    ],
    "summary": "A few telling passages found.",
    "overall_rating": "fair",
    "strengths": [],
}

SAMPLE_STREAM_TEXT = "I understand your question. Let me think about that carefully."


# ---------------------------------------------------------------------------
# MockAIGateway
# ---------------------------------------------------------------------------

@dataclass
class MockAIResponse:
    """Configure what the mock gateway returns."""
    stream_text: str = SAMPLE_STREAM_TEXT
    structured_data: dict | None = None
    should_fail: bool = False
    error_message: str = "Mock AI error"


class MockAIGateway:
    """
    Drop-in replacement for AIGateway in tests.

    Records calls so tests can assert on what was passed to the gateway.
    """

    def __init__(self, response: MockAIResponse):
        self.response = response
        self.stream_calls: list[dict[str, Any]] = []
        self.structured_calls: list[dict[str, Any]] = []

    async def stream(
        self,
        messages: list[dict],
        feature_prompt: str,
        context: Any,
        db: Any,
        user: Any,
        *,
        llm_params: Any = None,
        include_core_prompt: bool = True,
        on_complete: Any = None,
    ) -> AsyncIterator[str]:
        self.stream_calls.append({
            "messages": messages,
            "feature_prompt": feature_prompt,
            "context": context,
        })

        if self.response.should_fail:
            raise RuntimeError(self.response.error_message)

        full_tokens: list[str] = []
        for char in self.response.stream_text:
            full_tokens.append(char)
            yield char

        if on_complete:
            from app.services.llm.gateway import AICallResult
            result = AICallResult(
                content="".join(full_tokens),
                tokens_in=10,
                tokens_out=len(full_tokens),
                latency_ms=50,
                model="mock-model",
            )
            await on_complete(result)

    async def generate_structured(
        self,
        response_model: type,
        messages: list[dict],
        feature_prompt: str,
        context: Any,
        db: Any,
        user: Any,
        *,
        llm_params: Any = None,
        include_core_prompt: bool = True,
    ) -> StructuredResult:
        self.structured_calls.append({
            "response_model": response_model,
            "messages": messages,
            "feature_prompt": feature_prompt,
            "context": context,
        })

        if self.response.should_fail:
            return StructuredResult(
                success=False,
                raw_text=self.response.error_message,
            )

        return StructuredResult(
            success=True,
            data=self.response.structured_data,
            tokens_in=10,
            tokens_out=50,
            model="mock-model",
        )


def make_mock_gateway(
    *,
    stream_text: str = SAMPLE_STREAM_TEXT,
    structured_data: dict | None = None,
    should_fail: bool = False,
    error_message: str = "Mock AI error",
) -> MockAIGateway:
    """Factory for creating a MockAIGateway with sensible defaults."""
    return MockAIGateway(
        MockAIResponse(
            stream_text=stream_text,
            structured_data=structured_data,
            should_fail=should_fail,
            error_message=error_message,
        )
    )
