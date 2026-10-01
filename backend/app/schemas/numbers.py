"""The story in numbers (doc 13 P3): what Story Health measured, on its own page."""

from datetime import datetime

from pydantic import BaseModel


class WordTarget(BaseModel):
    min: int | None
    max: int
    soft_warning_at: int | None
    current: int
    pct: float
    warning_level: str


class NumbersWords(BaseModel):
    total: int
    by_status: dict[str, int]
    scenes: int
    written_scenes: int
    mean_per_scene: int
    median_per_scene: int
    form: str
    target: WordTarget | None
    # The form the current length belongs to, when it is no longer the one the author set.
    reads_as: str | None


class SpeakerShare(BaseModel):
    speaker_name: str
    character_id: str | None
    line_count: int
    word_count: int


class SpeakerPair(BaseModel):
    a_id: str
    a_name: str
    b_id: str
    b_name: str
    scene_count: int


class MonologueScene(BaseModel):
    scene_id: str
    scene_title: str
    speaker: str
    pct: int


class NumbersDialogue(BaseModel):
    total_lines: int
    unattributed: int
    # 0 to 100: how evenly the talking is shared (1 - Gini over words spoken). None under two speakers.
    balance: int | None
    speakers: list[SpeakerShare]
    pairs: list[SpeakerPair]
    monologue_scenes: list[MonologueScene]


class SentenceBucket(BaseModel):
    label: str
    count: int


class ProseScene(BaseModel):
    scene_id: str
    passive_pct: float
    adverb_pct: float
    mean_sentence: float


class NumbersProse(BaseModel):
    run_at: datetime
    scenes: int
    passive_pct: float
    adverb_pct: float
    mean_sentence: float
    sentence_lengths: list[SentenceBucket]
    by_scene: list[ProseScene]


class NumbersSummaries(BaseModel):
    fresh: int
    stale: int
    missing: int


class NumbersOut(BaseModel):
    words: NumbersWords
    dialogue: NumbersDialogue
    prose: NumbersProse | None
    summaries: NumbersSummaries
