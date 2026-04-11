from pydantic import BaseModel


class RenamePreviewItem(BaseModel):
    node_id: str
    node_title: str
    occurrences: int
    excerpt: str


class RenamePreviewResponse(BaseModel):
    entity_type: str
    old_name: str
    new_name: str
    affected_scenes: list[RenamePreviewItem]
    total_occurrences: int


class ApplyRenameRequest(BaseModel):
    old_name: str
    new_name: str
    node_ids: list[str]  # Empty = all affected scenes


class PronounRewriteProposal(BaseModel):
    id: str
    node_id: str
    node_title: str
    original: str
    rewritten: str
    explanation: str


class PronounRefactorPreviewResponse(BaseModel):
    character_id: str
    character_name: str
    old_pronouns: str
    new_pronouns: str
    proposals: list[PronounRewriteProposal]
    scenes_scanned: int


class ApplyPronounRewriteItem(BaseModel):
    node_id: str
    original: str
    rewritten: str


class ApplyPronounRefactorRequest(BaseModel):
    new_pronouns: str
    rewrites: list[ApplyPronounRewriteItem]
