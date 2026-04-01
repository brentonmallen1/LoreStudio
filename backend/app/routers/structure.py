from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.structure import StructureNodeUpdate, StructureNodeOut
from ..auth.dependencies import get_current_user

router = APIRouter()


def _verify_node_access(node_id: str, db: Session, user: User) -> StructureNode:
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    story = db.query(Story).filter(Story.id == node.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/{node_id}", response_model=StructureNodeOut)
def get_node(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_node_access(node_id, db, current_user)


@router.patch("/{node_id}", response_model=StructureNodeOut)
def update_node(
    node_id: str,
    body: StructureNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = _verify_node_access(node_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "metadata_" in data:
        data["metadata_"] = data.pop("metadata_")
    for key, value in data.items():
        setattr(node, key, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    node = _verify_node_access(node_id, db, current_user)
    db.delete(node)
    db.commit()
