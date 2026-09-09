"""
Telling the client that a stream broke (review §1.3).

A `StreamingResponse` has already sent `200 text/plain` by the time the first token is
generated, so a later failure cannot change the status code. Every streaming router
handled that by appending `f"\\n\\n[Error: {e}]"` to the body — which means the client
cannot tell "the model said this" from "the server broke", the text is saved to history as
if the model wrote it, and the raw exception string is rendered into the author's UI.

The fix that does not require rebuilding the transport: a record separator. U+001E exists
for exactly this and is not something a language model emits, so the client can split it
off, render it as an error, and refuse to persist it. The real exception is logged
server-side; the author gets a sentence rather than a traceback.

This is deliberately the small version. Typed SSE events (review §2.1) are the right
answer and would replace it, but that is twelve endpoints and thirteen consumers — a
piece of work of its own, not a bug fix.
"""

import json
import logging

#: U+001E RECORD SEPARATOR. Everything after it is a JSON control frame, not prose.
STREAM_ERROR_SENTINEL = "\x1e"

logger = logging.getLogger(__name__)


def stream_error(exc: BaseException, *, where: str) -> str:
    """Log the real failure, and return a frame the client can recognise."""
    logger.exception("Streaming failure in %s", where, exc_info=exc)
    message = "The model could not be reached." if isinstance(exc, OSError) else "Something went wrong."
    return STREAM_ERROR_SENTINEL + json.dumps({"error": message, "where": where})
