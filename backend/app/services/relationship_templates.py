from app.schemas.character import RelationshipTemplate, StrengthDimensions

RELATIONSHIP_TEMPLATES: list[RelationshipTemplate] = [
    RelationshipTemplate(
        id="mentor",
        name="Mentor",
        relationship_type="mentor",
        default_strength=StrengthDimensions(trust=8, power=3, affection=7),
        default_narrative_purpose=["growth-catalyst", "wisdom-source"],
        default_visibility="public",
        description_hint="Guides and teaches the target character; imparts knowledge or skills.",
    ),
    RelationshipTemplate(
        id="rival",
        name="Rival",
        relationship_type="rival",
        default_strength=StrengthDimensions(trust=3, power=5, affection=3),
        default_narrative_purpose=["conflict-driver", "foil"],
        default_visibility="public",
        description_hint="Competes with the target character; challenges their abilities or goals.",
    ),
    RelationshipTemplate(
        id="hidden_enemy",
        name="Hidden Enemy",
        relationship_type="enemy",
        default_strength=StrengthDimensions(trust=1, power=5, affection=1),
        default_narrative_purpose=["twist-setup", "conflict-driver"],
        default_visibility="hidden",
        description_hint="Appears friendly but works against the target character in secret.",
    ),
    RelationshipTemplate(
        id="confidant",
        name="Confidant",
        relationship_type="confidant",
        default_strength=StrengthDimensions(trust=9, power=5, affection=8),
        default_narrative_purpose=["ally", "emotional-anchor"],
        default_visibility="public",
        description_hint="Trusted ally who receives the character's secrets and fears.",
    ),
    RelationshipTemplate(
        id="protector",
        name="Protector",
        relationship_type="protector",
        default_strength=StrengthDimensions(trust=7, power=8, affection=6),
        default_narrative_purpose=["ally", "growth-catalyst"],
        default_visibility="public",
        description_hint="Shields the target character from harm; may impose unwanted limits.",
    ),
    RelationshipTemplate(
        id="love_interest",
        name="Love Interest",
        relationship_type="romantic",
        default_strength=StrengthDimensions(trust=6, power=5, affection=9),
        default_narrative_purpose=["emotional-anchor", "growth-catalyst"],
        default_visibility="public",
        description_hint="Romantic tension or attachment; shapes the character's emotional journey.",
    ),
    RelationshipTemplate(
        id="authority_figure",
        name="Authority Figure",
        relationship_type="authority",
        default_strength=StrengthDimensions(trust=4, power=8, affection=3),
        default_narrative_purpose=["obstacle", "structure-provider"],
        default_visibility="public",
        description_hint="Holds power over the target character; enforces rules or expectations.",
    ),
    RelationshipTemplate(
        id="foil",
        name="Foil",
        relationship_type="foil",
        default_strength=StrengthDimensions(trust=5, power=5, affection=4),
        default_narrative_purpose=["foil", "mirror"],
        default_visibility="public",
        description_hint="Contrasts with the target character to highlight their distinct traits.",
    ),
    RelationshipTemplate(
        id="family",
        name="Family",
        relationship_type="family",
        default_strength=StrengthDimensions(trust=6, power=5, affection=7),
        default_narrative_purpose=["emotional-anchor"],
        default_visibility="public",
        description_hint="Bound by blood or adoption; complex history shapes their dynamic.",
    ),
    RelationshipTemplate(
        id="former_friend",
        name="Former Friend",
        relationship_type="former ally",
        default_strength=StrengthDimensions(trust=2, power=5, affection=3),
        default_narrative_purpose=["conflict-driver", "past-connection"],
        default_visibility="public",
        description_hint="Once close, now estranged; unresolved history fuels tension.",
    ),
]

TEMPLATES_BY_ID = {t.id: t for t in RELATIONSHIP_TEMPLATES}


def get_all_templates() -> list[RelationshipTemplate]:
    return RELATIONSHIP_TEMPLATES


def get_template(template_id: str) -> RelationshipTemplate | None:
    return TEMPLATES_BY_ID.get(template_id)
