"""
Stop a stream that carries on without its reader (doc 21 R7).

A summary or a reply whose result is kept runs to the end on the server even if the window
closes (services/llm/sse.carry_on). Closing the window and pressing Stop look the same to the
server, so Stop says so here.
"""

from fastapi import APIRouter, Depends

from ..auth.dependencies import get_current_user
from ..models.user import User
from ..services.llm.sse import CARRYING

router = APIRouter()


@router.post("/streams/{stream_id}/stop")
def stop_stream(stream_id: str, user: User = Depends(get_current_user)):
    """Cancel the call: the connection to the model closes and the call is logged as stopped."""
    entry = CARRYING.get(stream_id)
    if entry is None or entry[1] != user.id:
        return {"stopped": False}
    task, _owner = entry
    task.get_loop().call_soon_threadsafe(task.cancel)
    return {"stopped": True}
