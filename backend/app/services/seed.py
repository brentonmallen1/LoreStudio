import uuid
from sqlalchemy.orm import Session
from ..database import engine
from ..models.user import User
from ..models.story import Story
from ..models.character import Character, CharacterRelationship
from ..models.structure import StoryStructureTemplate, StructureNode
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.scene_link import SceneLink
from ..models.setting import Setting
from ..models.compendium import CompendiumEntry
from ..models.location import Location, SceneSetting
from ..models.world_system import WorldSystem
from ..models.culture import Culture
from ..models.historical_event import Era, HistoricalEvent
from ..models.location_travel import LocationTravel
from ..models.calendar import Calendar
from ..models.beat_sheet import BeatSheet
from ..auth.utils import hash_password
from ..config import settings

STRUCTURE_TEMPLATES = [
    {
        "id": "freeform",
        "name": "Freeform",
        "description": "No predefined structure. Organize however makes sense for your story.",
        "levels": [
            {"name": "Section", "plural": "Sections"},
            {"name": "Scene", "plural": "Scenes"},
        ],
    },
    {
        "id": "three-act",
        "name": "Three-Act Structure",
        "description": "Classic dramatic structure: setup, confrontation, resolution.",
        "levels": [
            {"name": "Act", "plural": "Acts"},
            {"name": "Chapter", "plural": "Chapters"},
            {"name": "Scene", "plural": "Scenes"},
        ],
    },
    {
        "id": "seven-point",
        "name": "Seven-Point Story Structure",
        "description": "Hook, Plot Turn 1, Pinch Point 1, Midpoint, Pinch Point 2, Plot Turn 2, Resolution.",
        "levels": [
            {"name": "Beat", "plural": "Beats"},
            {"name": "Scene", "plural": "Scenes"},
        ],
    },
    {
        "id": "snowflake",
        "name": "Snowflake Method",
        "description": "Expand your story outward from a single sentence to a full synopsis.",
        "levels": [
            {"name": "Part", "plural": "Parts"},
            {"name": "Chapter", "plural": "Chapters"},
            {"name": "Scene", "plural": "Scenes"},
        ],
    },
    {
        "id": "heros-journey",
        "name": "Hero's Journey",
        "description": "The classic monomyth structure: ordinary world through transformation and return.",
        "levels": [
            {"name": "Stage", "plural": "Stages"},
            {"name": "Scene", "plural": "Scenes"},
        ],
    },
    {
        "id": "mice-single",
        "name": "Single MICE Thread (Flash / Short Story)",
        "description": "One dominant MICE element (Milieu, Idea, Character, or Event). Ideal for flash fiction and tight short stories. The story opens the thread and closes it cleanly.",
        "levels": [
            {"name": "Opening", "plural": "Openings"},
            {"name": "Try/Fail Beat", "plural": "Try/Fail Beats"},
            {"name": "Resolution", "plural": "Resolutions"},
        ],
    },
    {
        "id": "mice-nested",
        "name": "Nested MICE Threads (Short Story / Novelette)",
        "description": "Multiple MICE threads that open and close in LIFO order — last opened, first closed. Great for short stories with 2-3 interleaved questions or arcs.",
        "levels": [
            {"name": "Movement", "plural": "Movements"},
            {"name": "Beat", "plural": "Beats"},
        ],
    },
]


def seed_structure_templates():
    with Session(engine) as db:
        for template_data in STRUCTURE_TEMPLATES:
            existing = db.get(StoryStructureTemplate, template_data["id"])
            if not existing:
                template = StoryStructureTemplate(**template_data, is_system=True)
                db.add(template)
            elif not existing.is_system:
                existing.is_system = True
        db.commit()


BEAT_SHEETS = [
    {
        "id": "save-the-cat",
        "name": "Save the Cat",
        "description": "Blake Snyder's 15-beat structure for screenplays and novels. Emphasizes an emotional journey with a clear midpoint transformation.",
        "beats": [
            {"id": "opening-image",      "name": "Opening Image",      "position_pct": 1,  "description": "A visual that represents the struggle and tone of the story. The opposite of the final image."},
            {"id": "theme-stated",       "name": "Theme Stated",       "position_pct": 5,  "description": "The theme of the movie is stated, usually in a question or statement by a character other than the main character."},
            {"id": "set-up",             "name": "Set-Up",             "position_pct": 8,  "description": "Introduce the protagonist, their world, their flaws, and what needs to change."},
            {"id": "catalyst",           "name": "Catalyst",           "position_pct": 12, "description": "The inciting incident — the life-changing event that kicks the story into motion."},
            {"id": "debate",             "name": "Debate",             "position_pct": 18, "description": "The protagonist debates whether to engage with the new world. A question is posed."},
            {"id": "break-into-two",     "name": "Break into Two",     "position_pct": 25, "description": "The protagonist makes a clear choice and enters Act Two — a new world with new rules."},
            {"id": "b-story",            "name": "B Story",            "position_pct": 30, "description": "A secondary story begins, often involving a love interest or mentor who carries the theme."},
            {"id": "fun-and-games",      "name": "Fun & Games",        "position_pct": 40, "description": "The promise of the premise — the most entertaining part of the story."},
            {"id": "midpoint",           "name": "Midpoint",           "position_pct": 50, "description": "A false victory or false defeat. Stakes are raised; the protagonist is changed."},
            {"id": "bad-guys-close-in",  "name": "Bad Guys Close In",  "position_pct": 62, "description": "The antagonistic forces regroup and close in on the protagonist."},
            {"id": "all-is-lost",        "name": "All Is Lost",        "position_pct": 75, "description": "The lowest point — the protagonist loses everything they have gained."},
            {"id": "dark-night",         "name": "Dark Night of the Soul", "position_pct": 80, "description": "The protagonist wallows in despair before finding the answer within themselves."},
            {"id": "break-into-three",   "name": "Break into Three",   "position_pct": 85, "description": "The protagonist synthesizes A and B stories and discovers a new way forward."},
            {"id": "finale",             "name": "Finale",             "position_pct": 90, "description": "The protagonist storms the castle and defeats the antagonist using what they've learned."},
            {"id": "final-image",        "name": "Final Image",        "position_pct": 99, "description": "The opposite of the opening image, proving that change has occurred."},
        ],
    },
    {
        "id": "story-circle",
        "name": "Story Circle (Dan Harmon)",
        "description": "Dan Harmon's 8-step circle based on the Hero's Journey. Emphasizes a cyclical journey of need, transformation, and return.",
        "beats": [
            {"id": "you",      "name": "You",     "position_pct": 0,    "description": "A character is in a zone of comfort."},
            {"id": "need",     "name": "Need",    "position_pct": 12.5, "description": "But they want something."},
            {"id": "go",       "name": "Go",      "position_pct": 25,   "description": "They enter an unfamiliar situation."},
            {"id": "search",   "name": "Search",  "position_pct": 37.5, "description": "Adapt to it."},
            {"id": "find",     "name": "Find",    "position_pct": 50,   "description": "Get what they wanted."},
            {"id": "take",     "name": "Take",    "position_pct": 62.5, "description": "Pay a heavy price for it."},
            {"id": "return",   "name": "Return",  "position_pct": 75,   "description": "Return to their familiar situation."},
            {"id": "change",   "name": "Change",  "position_pct": 87.5, "description": "Having changed."},
        ],
    },
    {
        "id": "heros-journey",
        "name": "Hero's Journey (Campbell / Vogler)",
        "description": "Joseph Campbell's monomyth as adapted by Christopher Vogler. A 12-stage universal story pattern.",
        "beats": [
            {"id": "ordinary-world",     "name": "Ordinary World",       "position_pct": 0,  "description": "The hero's normal world before the story begins."},
            {"id": "call-to-adventure",  "name": "Call to Adventure",    "position_pct": 8,  "description": "The hero is presented with a problem, challenge, or adventure."},
            {"id": "refusal",            "name": "Refusal of the Call",  "position_pct": 12, "description": "The hero initially refuses the call due to fear or reluctance."},
            {"id": "meeting-mentor",     "name": "Meeting the Mentor",   "position_pct": 17, "description": "The hero meets a mentor who gives advice, training, or a magical gift."},
            {"id": "crossing-threshold", "name": "Crossing the Threshold","position_pct": 25, "description": "The hero commits to the adventure and enters a special world."},
            {"id": "tests",              "name": "Tests, Allies, Enemies","position_pct": 35, "description": "The hero faces tests, makes allies, and confronts enemies."},
            {"id": "approach",           "name": "Approach to the Inmost Cave","position_pct": 47, "description": "The hero approaches the central crisis of the adventure."},
            {"id": "ordeal",             "name": "Ordeal",               "position_pct": 55, "description": "The hero faces their greatest challenge and confronts death (literal or metaphorical)."},
            {"id": "reward",             "name": "Reward",               "position_pct": 65, "description": "The hero takes possession of the treasure they sought."},
            {"id": "road-back",          "name": "Road Back",            "position_pct": 75, "description": "The hero deals with the consequences of confronting evil and begins the journey back."},
            {"id": "resurrection",       "name": "Resurrection",         "position_pct": 85, "description": "The hero is severely tested once more on the threshold of home — a final climax."},
            {"id": "return",             "name": "Return with Elixir",   "position_pct": 95, "description": "The hero returns home with the elixir and uses it to help others."},
        ],
    },
    {
        "id": "three-act-beats",
        "name": "Three-Act Beats",
        "description": "Essential story beats for a classic three-act structure.",
        "beats": [
            {"id": "hook",              "name": "Hook",                 "position_pct": 1,  "description": "Opening hook that grabs the reader's attention."},
            {"id": "inciting-incident", "name": "Inciting Incident",    "position_pct": 12, "description": "The event that sets the main conflict in motion."},
            {"id": "first-plot-point",  "name": "First Plot Point",     "position_pct": 25, "description": "End of Act One — the protagonist commits to the main conflict."},
            {"id": "first-pinch",       "name": "First Pinch Point",    "position_pct": 37, "description": "A reminder of the antagonist's power; raises the stakes."},
            {"id": "midpoint",          "name": "Midpoint",             "position_pct": 50, "description": "A major revelation or shift that changes the direction of the story."},
            {"id": "second-pinch",      "name": "Second Pinch Point",   "position_pct": 62, "description": "Another push from the antagonist; things look bleak."},
            {"id": "second-plot-point", "name": "Second Plot Point",    "position_pct": 75, "description": "End of Act Two — the protagonist is at their lowest; finds what they need to win."},
            {"id": "climax",            "name": "Climax",               "position_pct": 88, "description": "The final confrontation between protagonist and antagonist."},
            {"id": "resolution",        "name": "Resolution",           "position_pct": 96, "description": "The aftermath — loose ends tied up, new normal established."},
        ],
    },
]


def seed_beat_sheets():
    with Session(engine) as db:
        for data in BEAT_SHEETS:
            existing = db.get(BeatSheet, data["id"])
            if not existing:
                db.add(BeatSheet(**data, is_system=True))
            else:
                existing.name = data["name"]
                existing.description = data["description"]
                existing.beats = data["beats"]
                existing.is_system = True
        db.commit()


def seed_admin():
    with Session(engine) as db:
        existing = db.query(User).filter(User.username == settings.admin_username).first()
        if not existing:
            admin = User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                display_name="Admin",
                is_admin=True,
            )
            db.add(admin)
            db.commit()


def seed_demo_story():
    with Session(engine) as db:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if not admin:
            return

        if db.query(Story).filter(Story.title == "The Last Lighthouse").first():
            return

        story = Story(
            user_id=admin.id,
            title="The Last Lighthouse",
            description="A lighthouse keeper on a remote island discovers something unexpected when a stranger arrives during a storm.",
            structure_template_id="three-act",
            intent="A quiet, atmospheric story about solitude, memory, and the things we keep hidden.",
            # Lorebook fields
            genre="Literary Fiction",
            tone="Atmospheric, melancholic, quietly tense",
            themes=["solitude", "memory", "secrets", "grief", "identity"],
            central_conflict="Eleanor's need to protect her carefully constructed isolation versus the truth that threatens to surface",
            target_audience="Adult literary fiction readers",
            # Narrative grounding
            narrative_intent="Explore how self-imposed isolation can be both sanctuary and prison, and how the past finds us regardless of where we hide.",
            premise="A solitary lighthouse keeper on a dying island must confront her buried past when a mysterious stranger arrives seeking answers she's spent years avoiding.",
            logline="When a mysterious historian arrives during a storm, a reclusive lighthouse keeper must decide whether to protect her secrets or finally face what she buried.",
            intended_length="novelette",
            # Story goals checklist
            goals=[
                {"id": str(uuid.uuid4()), "text": "Establish Eleanor's isolated routine and her relationship with the lighthouse", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Introduce the Visitor and create tension around their true purpose", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Reveal what happened to Eleanor's father", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Force Eleanor to choose between truth and solitude", "completed": False},
            ],
        )
        db.add(story)
        db.flush()

        # Characters
        eleanor = Character(
            story_id=story.id,
            name="Eleanor Vance",
            role="protagonist",
            personality="Solitary but observant, finds comfort in routine, quietly stubborn. She watches the world with patience and rarely says more than she needs to.",
            motivation="Keep the lighthouse running and honor her father's memory — though she's not sure anymore if she's staying for him or for herself.",
            background="Grew up on Harrow Island, the daughter of the lighthouse keeper. Left for the mainland at nineteen, built a career as a cartographer, but returned when her father fell ill five years ago. He died two months after her arrival. She never left.",
            appearance="Early forties, weathered hands, dark hair streaked with grey. Wears practical clothing, always has a pocket knife on her belt.",
            arc_notes="Moves from guarded self-sufficiency toward allowing someone into her carefully ordered world — and confronting what she buried when she came back.",
            interview_prompts=[
                "What do you miss most about the mainland?",
                "Why did you really come back to the island?",
                "What do you see when you look at the horizon?",
                "Tell me about your father.",
            ],
            traits={"Occupation": "Lighthouse keeper", "Home": "Harrow Island", "Skill": "Cartography"},
            attributes={
                "intelligence": "sharp",
                "education": "educated",
                "moral_alignment": "principled",
                "disposition": "orderly",
                "temperament": "calm",
                "social_manner": "rough",
            },
            narrative_intent="Eleanor serves as the reader's lens into the isolated world. Her guardedness creates mystery while her observant nature provides rich sensory detail. She represents the universal tension between safety and connection.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Established in her routine — the lighthouse, the log, the solitude", "completed": True},
                {"id": str(uuid.uuid4()), "text": "First crack in her armor: lets the Visitor in from the storm", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Discovers the missing log entries from five years ago", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Confronts the truth about what happened to her father", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Makes a choice: stay with her secrets or step into the open", "completed": False},
            ],
        )
        db.add(eleanor)

        visitor = Character(
            story_id=story.id,
            name="The Visitor (Calder)",
            role="supporting",
            personality="Enigmatic and precise, speaks carefully as if choosing each word from a limited supply. Unsettling not because of anything threatening, but because of how much they seem to already know. Beneath the composure is grief held at arm's length — she has learned to be patient because impatience cost her too much.",
            motivation="Seeking answers about her brother James's death aboard the Ardent. The Maritime Heritage Foundation gave her a cover story, but this is personal.",
            background="Her real name is Calder. Her brother James was captain of the cargo vessel Ardent, which went down five years ago with all hands lost. She works for the Maritime Heritage Foundation investigating maritime incidents, but this case is different — she came to Harrow Island once before, two weeks before Thomas Vance died, and left with more questions than answers.",
            appearance="About fifty, grey-haired, weathered in a way that suggests time spent on boats. Wears a canvas jacket and carries a leather notebook. Her calm is studied, not natural — the kind you learn when falling apart isn't an option.",
            arc_notes="Functions as a mirror for Eleanor — her presence forces Eleanor to examine the story she tells herself about why she stayed. Calder's grief is a preview of what Eleanor might become if she doesn't face her own.",
            interview_prompts=[
                "What are you really looking for here?",
                "Have we met before?",
                "Why this island, why now?",
                "What did my father say when you met him?",
                "Do you blame him for what happened to James?",
            ],
            traits={"Real name": "Calder", "Known as": "The Visitor", "Occupation": "Maritime Heritage Foundation investigator", "Carries": "Leather notebook", "Brother": "James Calder (deceased, captain of the Ardent)"},
            attributes={
                "intelligence": "sharp",
                "education": "educated",
                "moral_alignment": "principled",
                "disposition": "conventional",
                "temperament": "calm",
                "social_manner": "polished",
            },
            narrative_intent="Functions as a catalyst and mirror for Eleanor. Her questions force Eleanor to examine the story she tells herself. The mystery of her identity keeps tension high through Act 2, and her revelation in Act 3 reframes every interaction they've had.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Arrives with an apparent purpose (historical research)", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Gains Eleanor's grudging trust through patience and honesty about small things", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Reveals she is not a historian — works for Maritime Heritage Foundation", "completed": True},
                {"id": str(uuid.uuid4()), "text": "True identity disclosed: her brother was captain of the Ardent", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Leaves the island with the logbook — and something like closure", "completed": True},
            ],
        )
        db.add(visitor)

        thomas = Character(
            story_id=story.id,
            name="Thomas Vance",
            role="minor",
            personality="Methodical, private, deeply principled — or so Eleanor believed. The version of him she carries may not match the man he was.",
            motivation="Unknown. He took his reasons to the grave, along with the missing entries from the lighthouse log.",
            background="Lighthouse keeper of Harrow Island for thirty-one years. Taught Eleanor everything about the sea and the light. Died five years ago, two months after Eleanor returned. The cause was listed as heart failure.",
            appearance="Only known through Eleanor's memory: a large man with careful hands, a beard he kept trimmed for the weather, and a habit of silence that felt like wisdom.",
            arc_notes="Thomas exists as an absence. His choices shape the present without him being present. The story is partly an excavation of who he actually was.",
            interview_prompts=[],
            traits={"Status": "Deceased", "Occupation": "Lighthouse keeper (retired)", "Tenure": "31 years on Harrow Island"},
            attributes={
                "intelligence": "average",
                "education": "common",
                "moral_alignment": "unknown",
                "disposition": "orderly",
                "temperament": "calm",
                "social_manner": "casual",
            },
            narrative_intent="Thomas is the mystery at the story's center. His presence is felt through Eleanor's grief, the missing log entries, and the Visitor's purpose. His character must reveal itself through what others remember — and misremember. The reader should finish the story feeling the full weight of who he was: a man of discipline and routine who failed catastrophically once and spent his last months dismantling the evidence.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Established through Eleanor's memory and the lighthouse logbooks", "completed": True},
                {"id": str(uuid.uuid4()), "text": "His absence from the night of the Ardent is implied through the log gap", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Calder reveals he met her before his death — knowingly, deliberately", "completed": True},
                {"id": str(uuid.uuid4()), "text": "The full truth disclosed: he failed to respond to the Ardent's distress signal, then destroyed the evidence", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Eleanor chooses how to remember him — not as innocent, not as monster", "completed": True},
            ],
        )
        db.add(thomas)

        margaret = Character(
            story_id=story.id,
            name="Margaret Holt",
            role="minor",
            personality="Economical and unsentimental. Has outlasted most of what she loved about the island without bitterness, which Eleanor finds both admirable and slightly unnerving. She practices a deliberate philosophy of not-knowing: some things aren't hers to ask about, and she's made peace with that. But when asked directly, she answers with precision.",
            motivation="Finish out her years on the island she was born on. Protect what's left of the community — which mostly means protecting Eleanor from the loneliness that took Thomas.",
            background="Born on Harrow Island, married a fisherman named Robert, buried him here twenty years ago. One of three permanent residents who never left. At seventy-four, she keeps a kitchen garden, trades supplies with Eleanor weekly, and watches the lighthouse beam from her window every night — partly habit, partly vigil. She saw the lamp go dark the night of the Ardent but chose not to speak of it until asked.",
            appearance="Small, deliberate in her movements. Wears the same oilskin coat regardless of weather. Hands roughened by decades of practical work. Eyes that miss very little but reveal even less.",
            arc_notes="Margaret is a witness — to the island's long decline, to Thomas Vance's final years, to Eleanor's quiet unraveling. Her choice to finally speak what she saw represents the story's theme: some silences protect us, and some silences become prisons.",
            interview_prompts=[
                "What do you remember about the night Thomas died?",
                "Have you seen strangers on the island before?",
                "Why did you stay when everyone else left?",
                "What did you see the night the Ardent went down?",
                "Do you think Eleanor will leave now?",
            ],
            traits={"Age": "74", "Status": "Year-round resident", "Relationship to Eleanor": "Neighbor and confidante", "Late husband": "Robert Holt (fisherman)", "Secret": "Saw the lighthouse dark on the night of the Ardent"},
            attributes={
                "intelligence": "sharp",
                "education": "common",
                "moral_alignment": "pragmatic",
                "disposition": "orderly",
                "temperament": "serene",
                "social_manner": "rough",
            },
            narrative_intent="Margaret grounds the story in the island's longer history. She knows more than she says — specifically, she witnessed the lighthouse dark on the night of the Ardent but chose not to report it. Her confession to Eleanor in Act 3 adds another layer to the truth: the cover-up wasn't complete, just unspoken.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Mentioned as one of three remaining residents", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Visits Eleanor after the storm; senses something has changed", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Reveals she saw the lighthouse dark on the night of the Ardent", "completed": True},
            ],
        )
        db.add(margaret)
        db.flush()

        # Character relationships
        db.add(CharacterRelationship(
            character_id=eleanor.id,
            related_character_id=thomas.id,
            relationship_type="daughter",
            description="Eleanor returned to Harrow Island to care for her dying father and never left after he died. Her grief is quiet and complicated — love mixed with questions she never got to ask.",
        ))
        db.add(CharacterRelationship(
            character_id=eleanor.id,
            related_character_id=visitor.id,
            relationship_type="wary host",
            description="Eleanor let the Visitor in from the storm against her better judgment. She watches them carefully and extends just enough trust to keep them talking.",
        ))
        db.add(CharacterRelationship(
            character_id=eleanor.id,
            related_character_id=margaret.id,
            relationship_type="island neighbor",
            description="The two remaining year-round residents. They share practical support and a mutual respect built on proximity, not closeness.",
        ))
        db.add(CharacterRelationship(
            character_id=visitor.id,
            related_character_id=thomas.id,
            relationship_type="prior contact",
            description="Calder came to Harrow Island two weeks before Thomas Vance died — she had already traced the missing distress log to the lighthouse. Thomas met her, spoke briefly, and said nothing that exonerated him. She has carried the uncertainty of that meeting ever since.",
        ))
        db.add(CharacterRelationship(
            character_id=margaret.id,
            related_character_id=thomas.id,
            relationship_type="old friend",
            description="Margaret and Thomas Vance were neighbors for thirty years. She is one of the few people who knew him well. She has not volunteered what she knows.",
        ))
        db.flush()

        # Plot threads
        thread_logs = PlotThread(
            story_id=story.id,
            name="The Missing Logs",
            description="Several entries from five years ago are missing or damaged. What was recorded there — and why were they removed?",
            status="open",
            color="#3b82f6",
            mice_type="idea",  # A question raised → answered
        )
        db.add(thread_logs)

        thread_identity = PlotThread(
            story_id=story.id,
            name="The Visitor's Identity",
            description="Who is this 'historian' really, and why do they know so much about Harrow Island and the Vance family?",
            status="developing",
            color="#8b5cf6",
            mice_type="idea",  # Who is she? → answered when Calder's identity is revealed
        )
        db.add(thread_identity)

        thread_father = PlotThread(
            story_id=story.id,
            name="Eleanor's Father",
            description="What really happened in the final months of Thomas Vance's life? Eleanor's account has gaps she won't examine.",
            status="open",
            color="#ef4444",
            mice_type="character",  # Eleanor's dissatisfaction with her idealized image of her father → acceptance of who he was
        )
        db.add(thread_father)
        db.flush()

        # Structure: Act 1
        act1 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 1: The Arrival",
            synopsis="The storm arrives and so does the stranger. Eleanor's solitary world is interrupted.",
            position=0,
            metadata_={"purpose": "Establish Eleanor's world and the fragile equilibrium she's built. Introduce the Visitor as a disruption. End with Eleanor's curiosity overcoming her guardedness — she lets the stranger in."},
        )
        db.add(act1)
        db.flush()

        ch1 = StructureNode(
            story_id=story.id,
            parent_id=act1.id,
            level=1,
            level_type="chapter",
            title="Chapter 1: Storm Warning",
            synopsis="Eleanor monitors the approaching storm and prepares the lighthouse.",
            position=0,
            metadata_={"purpose": "Ground the reader in Eleanor's routine and sensory relationship with the lighthouse. Establish the log as a central object before its gaps become significant. Foreshadow disruption through the approaching storm."},
        )
        db.add(ch1)
        db.flush()

        scene1 = StructureNode(
            story_id=story.id,
            parent_id=ch1.id,
            level=2,
            level_type="scene",
            title="The Light",
            synopsis="Eleanor climbs to the lamp room as the storm rolls in.",
            position=0,
            status="revised",
            timeline_position=2,
            entry_state="Eleanor alone in her lighthouse, mid-routine — log entry made, barometer falling, the world predictably hers.",
            exit_state="Eleanor has spotted an unexpected boat in the storm and her equilibrium is broken; something outside her control is approaching.",
            key_events="Barometer reading logged; lamp room climb; sight of the unexpected boat in the storm.",
            metadata_={
                "purpose": "Open in Eleanor's element — she is competent and alone by choice. The barometer and the log establish her observational nature and her father's lingering presence. The boat at the end pivots the scene: something is coming that she can't control.",
                "inline_notes": [
                    {
                        "id": "demo-note-1",
                        "anchor": "going very still, as if drawing a breath",
                        "note": "This stillness mirrors Eleanor's internal state — she is also holding her breath, waiting. Consider echoing this image in the Act 3 climax when she finally has to act.",
                        "position": 180,
                    }
                ],
            },
            content=(
                "<p>The barometer had been falling since noon.</p>"
                "<p>Eleanor noted it in the log — <em>1012, 1008, 1003</em> — each reading a quiet sentence in a language she'd learned to read before she could properly read words. Her father had taught her that. <em>The glass doesn't lie,</em> he'd said. <em>People lie. Weather lies sometimes too, but the glass is always honest about what it knows.</em></p>"
                "<p>She climbed to the lamp room at half past four and stood at the railing while the sky turned the colour of a bruise. The sea was doing what the sea did before a storm: <span data-note-id=\"demo-note-1\" class=\"note-anchor\">going very still, as if drawing a breath</span>.</p>"
                "<p>Below, the village — what remained of it — sat dark and shuttered. Three houses still occupied out of eleven. The ferry had stopped running the year before last. She had a radio, a generator, and enough tinned food to last the winter. She had, she sometimes thought, exactly what she needed and nothing else.</p>"
                "<p>The light came on automatically at dusk, the great lens beginning its slow rotation. She watched it for a moment — that old familiar sweep, the way it carved the dark into something navigable — and then she saw the boat.</p>"
            ),
            word_count=187,
        )
        db.add(scene1)
        db.flush()

        # Link plot threads to scene1
        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene1.id,
            note="Eleanor writes in the log — establishes it as a central object and habit before we learn entries are missing.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene1.id,
            note="'Her father had taught her that' — first mention of Thomas Vance, plants his presence before his absence becomes relevant.",
        ))

        ch2 = StructureNode(
            story_id=story.id,
            parent_id=act1.id,
            level=1,
            level_type="chapter",
            title="Chapter 2: The Stranger",
            synopsis="The visitor arrives at Eleanor's door, soaked and inexplicably calm.",
            position=1,
            metadata_={"purpose": "Make the Visitor's arrival concrete and strange. Eleanor is on her own ground but the Visitor seems unsurprised to be here. Seed the first question about their identity without making them overtly threatening."},
        )
        db.add(ch2)
        db.flush()

        scene2 = StructureNode(
            story_id=story.id,
            parent_id=ch2.id,
            level=2,
            level_type="scene",
            title="Knock at the Door",
            synopsis="Eleanor opens the door to find the Visitor standing in the rain.",
            position=0,
            timeline_position=3,
            entry_state="Eleanor wary, alone, storm at full strength — she has decided not to open the door if anyone comes.",
            exit_state="The Visitor is inside, dry, and drinking Eleanor's tea. Eleanor's boundary has been crossed — by her own choice.",
            key_events="Knock at the door; Eleanor's hesitation; the Visitor's inexplicable calm; Eleanor lets them in.",
            metadata_={"purpose": "First direct encounter between Eleanor and the Visitor. Establish Eleanor's suspicion without hostility — she lets them in against her better judgment. The Visitor's calm is the first signal that something about their story doesn't add up."},
            content=(
                "<p>The knock came at quarter past nine.</p>"
                "<p>Eleanor had been expecting it ever since she saw the boat — a small, impossible thing — beached on the shingle below the breakwater. She'd watched it from the lamp room for twenty minutes, telling herself she was waiting to see if anyone emerged, knowing she was just delaying the moment when she'd have to make a decision.</p>"
                "<p>She had made the decision. <em>Don't open the door.</em></p>"
                "<hr>"
                "<h2>The Visitor</h2>"
                "<p>The person on the other side of the door was not what she had expected. She had expected a fisherman, perhaps, or someone's stray nephew caught in the weather. What she got was a woman of about fifty, grey-haired, wearing a canvas jacket that was soaked through and carrying a bag over one shoulder as if she'd simply stepped off a bus in light drizzle.</p>"
                "<p>She was not panicked. That was the thing Eleanor kept returning to later. Most people, arriving at a stranger's door in a storm like this, would be apologetic, breathless, grateful. This woman looked at Eleanor the way someone looks at a landmark they've been navigating by for years.</p>"
                "<p>\"Ms. Vance,\" she said. \"I'm sorry to impose.\"</p>"
                "<p>Eleanor stepped back. Later she would wonder why. At the time it felt like the only sensible thing to do.</p>"
            ),
            word_count=214,
        )
        db.add(scene2)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_identity.id,
            node_id=scene2.id,
            note="The Visitor introduces themselves as a historian. Eleanor notices their calm is studied, not natural.",
        ))

        # Structure: Act 2
        act2 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 2: The Discovery",
            synopsis="As the storm traps them together, Eleanor begins to suspect the visitor's true purpose.",
            position=1,
            metadata_={"purpose": "The storm keeps them together long enough for Eleanor to see through the Visitor's story. Surface the missing log entries as a physical object of investigation. Begin closing the distance between the Visitor's true purpose and Eleanor's buried past."},
        )
        db.add(act2)
        db.flush()

        ch3 = StructureNode(
            story_id=story.id,
            parent_id=act2.id,
            level=1,
            level_type="chapter",
            title="Chapter 3: Old Records",
            synopsis="The visitor asks to see the lighthouse logs. Eleanor shows them — and notices what's missing.",
            position=0,
            metadata_={"purpose": "The log request exposes the Visitor's real interest. Eleanor showing them the logs — then noticing the gaps — is both a breach of her guardedness and a realization she'd been avoiding. The chapter should feel like a key turning in a lock."},
        )
        db.add(ch3)
        db.flush()

        scene3 = StructureNode(
            story_id=story.id,
            parent_id=ch3.id,
            level=2,
            level_type="scene",
            title="The Logbook",
            synopsis="The Visitor asks to examine the lighthouse records. Eleanor hesitates, then agrees.",
            position=0,
            timeline_position=4,
            status="draft",
            metadata_={"purpose": "Show Eleanor's guardedness cracking under the Visitor's seemingly reasonable request. The logs are sacred to her — her father's handwriting fills half of them. The act of handing them over should feel like a small surrender."},
            content=(
                "<p>The logs were kept in a cabinet in the watch room — twelve volumes, cloth-bound, labelled by year in @Eleanor Vance's careful hand and, before that, in the older, more certain hand of @Thomas Vance.</p>"
                "<p>@Eleanor Vance had not shown them to anyone. They were not secret, exactly. They were simply not the sort of thing one shared. A record of weather and maintenance and minor incident: the language of [[The Lighthouse]], addressed to no one and everyone who might need to know what the sea had been doing on a particular night.</p>"
                "<p>\"Historians use records like these all the time,\" the Visitor said, standing in the middle of [[The Keeper's Cottage]] with her canvas bag still over one shoulder, as if she hadn't yet decided to stay. \"Shipping patterns. Storm records. I'm not here to examine anything personal.\"</p>"
                "<p>Eleanor looked at the cabinet. She thought about her father's handwriting — the entries from the years before she came back, the years she'd spent elsewhere, not asking questions. She thought about [[Harrow Island]] in winter, and how the logs were the closest thing to a conversation she still had with him.</p>"
                "<p>\"All right,\" she said. She got the key from the hook by the door.</p>"
            ),
            word_count=198,
        )
        db.add(scene3)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene3.id,
            note="Eleanor retrieves the log volumes from the cabinet; the Visitor's attention sharpens when they reach the records from three years ago.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_identity.id,
            node_id=scene3.id,
            note="The Visitor claims to be researching shipping records — but their questions are too precise to be casual research.",
        ))

        scene4 = StructureNode(
            story_id=story.id,
            parent_id=ch3.id,
            level=2,
            level_type="scene",
            title="The Gap",
            synopsis="Eleanor notices six months of entries missing. The Visitor is not surprised.",
            position=1,
            timeline_position=1,  # Flashback: chronologically first — represents the period three years ago when Thomas removed these entries
            status="draft",
            entry_state="Eleanor and the Visitor are in the watch room with the logbooks open on the desk.",
            exit_state="The gap is exposed. The Visitor has confirmed they knew about it. Eleanor has asked who the Visitor really is.",
            key_events="The gap discovered; Eleanor registers its weight; the Visitor's unsurprised reaction; Eleanor's confrontation.",
            metadata_={"purpose": "The missing entries are the story's central wound made visible. Eleanor has been avoiding looking at this gap. The Visitor's unsurprised reaction confirms they came here knowing about it."},
            content=(
                "<p>The volume for five years ago was lighter than it should have been.</p>"
                "<p>@Eleanor Vance noticed it the moment she lifted it from the shelf — that wrongness of weight, the way books tell you something is missing before you even open them. She had carried these volumes a hundred times. She knew them by heft.</p>"
                "<p>The Visitor was watching her. Not the book. Her.</p>"
                "<p>Eleanor opened the logbook to September. October. Then the pages jumped to March. Six months, gone. Not torn out — she could see no ragged edges, no violence done to the binding. Just... absent. As if those months had never been recorded at all.</p>"
                "<p>But she knew her father's hand. She knew his discipline. @Thomas Vance had logged every day for thirty-one years without exception. Even the day her mother left. Even the week he couldn't get out of bed after his stroke. He had crawled to the watch room and made his entry because that was what keepers did.</p>"
                "<p>\"You knew,\" Eleanor said. Her voice came out flat, declarative. \"You came here knowing this.\"</p>"
                "<p>The Visitor set down her tea. \"I came here hoping I was wrong.\"</p>"
                "<p>\"Wrong about what?\"</p>"
                "<p>The storm answered for her — a gust that shook [[The Lighthouse]] to its foundations, rattling the windows in their frames. When it passed, the Visitor was still looking at Eleanor with something that might have been pity.</p>"
                "<p>\"About what your father did,\" she said. \"And why.\"</p>"
            ),
            word_count=267,
        )
        db.add(scene4)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene4.id,
            note="Six months of entries, gone. Eleanor has known the gap was there but never let herself look directly at it until now.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene4.id,
            note="The missing entries correspond exactly to the months before Thomas Vance died. Eleanor asks the Visitor directly: did you know my father?",
        ))

        ch4 = StructureNode(
            story_id=story.id,
            parent_id=act2.id,
            level=1,
            level_type="chapter",
            title="Chapter 4: What the Storm Carries",
            synopsis="Trapped by the weather, Eleanor and the Visitor talk through the night.",
            position=1,
            metadata_={"purpose": "The storm removes the option to flee — for Eleanor or the Visitor. Use the forced proximity to strip away their respective defenses. By morning, enough truth has surfaced that the confrontation of Act 3 is inevitable."},
        )
        db.add(ch4)
        db.flush()

        scene5 = StructureNode(
            story_id=story.id,
            parent_id=ch4.id,
            level=2,
            level_type="scene",
            title="Night Passage",
            synopsis="The Visitor begins to tell a version of the truth. Eleanor listens.",
            position=0,
            timeline_position=5,
            status="draft",
            entry_state="Eleanor has discovered the missing log entries. Trust has fractured. The storm rages outside.",
            exit_state="The Visitor has admitted they aren't a historian. Eleanor has asked about her father directly.",
            key_events="The Visitor's confession; Eleanor's question about Thomas; the storm reaches its peak.",
            metadata_={"purpose": "The Visitor's partial confession raises the stakes: they know more than they've said, and some of it is damaging. Eleanor has to decide how much she wants to know. The scene should end with her asking the question she's been afraid to ask."},
            content=(
                "<p>They sat in the kitchen while the storm did its work outside. @Eleanor Vance had put the kettle on again — not because either of them wanted more tea, but because the ritual of it gave her hands something to do that wasn't reaching for the logbook.</p>"
                "<p>\"I'm not a historian,\" the Visitor said.</p>"
                "<p>Eleanor watched the flame under the kettle. Blue at the base, orange at the tip. Predictable. \"I know.\"</p>"
                "<p>\"I work for the Maritime Heritage Foundation. We investigate — \" She stopped, tried again. \"There was a ship. The <em>Ardent</em>. A cargo vessel. It went down in these waters five years ago, almost to the day.\"</p>"
                "<p>The kettle began to whisper. Not yet boiling, but close.</p>"
                "<p>\"Twelve crew,\" the Visitor continued. \"All hands lost. The official report said mechanical failure. The lighthouse logs should have shown — would have shown — whether anyone saw distress signals. Whether anyone could have responded.\"</p>"
                "<p>Eleanor turned off the flame. The whisper died.</p>"
                "<p>\"You think my father saw something.\"</p>"
                "<p>\"I think your father saw everything.\" The Visitor's voice was careful, precise — the voice of someone who had practiced this conversation. \"And I think he spent the last two months of his life making sure no one would ever be able to prove it.\"</p>"
                "<p>Outside, the wind found a new register — a sound like something tearing. Eleanor stood at the window and watched [[The Lighthouse]] beam sweep through the dark, patient and mechanical, asking nothing, answering nothing.</p>"
                "<p>\"Did you know him?\" she asked. \"My father. Did you ever meet him?\"</p>"
                "<p>The Visitor was quiet for a long time.</p>"
                "<p>\"Once,\" she said. \"I came here once before. Two weeks before he died.\"</p>"
            ),
            word_count=312,
        )
        db.add(scene5)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_identity.id,
            node_id=scene5.id,
            note="The Visitor admits they aren't a historian. They won't say yet what they actually are.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene5.id,
            note="The Visitor describes meeting Thomas Vance once, briefly — enough to confirm the connection without explaining it.",
        ))

        # Structure: Act 3
        act3 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 3: Resolution",
            synopsis="The truth surfaces. Eleanor must decide what to do with it.",
            position=2,
            metadata_={"purpose": "Force Eleanor to a choice she can no longer defer. The truth about her father and the Visitor's identity should feel inevitable in retrospect. Eleanor's decision — whatever it is — must come from character, not plot convenience."},
        )
        db.add(act3)
        db.flush()

        ch5 = StructureNode(
            story_id=story.id,
            parent_id=act3.id,
            level=1,
            level_type="chapter",
            title="Chapter 5: The Truth of It",
            synopsis="The full story emerges. Eleanor and the Visitor confront what it means.",
            position=0,
            metadata_={"purpose": "Everything that has been withheld must come out here — cleanly, without melodrama. The revelation about Thomas Vance should recontextualize what we've read without invalidating it. Eleanor's final decision must feel earned."},
        )
        db.add(ch5)
        db.flush()

        scene6 = StructureNode(
            story_id=story.id,
            parent_id=ch5.id,
            level=2,
            level_type="scene",
            title="What Thomas Knew",
            synopsis="The Visitor reveals why the log entries are missing and what Thomas Vance did.",
            position=0,
            timeline_position=6,
            status="draft",
            entry_state="Morning after the storm. Eleanor has not slept. The Visitor has one more truth to tell.",
            exit_state="Eleanor knows the full story. Her understanding of her father has been overwritten.",
            key_events="The Visitor's final revelation; the truth about the Ardent; what Thomas chose.",
            metadata_={"purpose": "The revelation scene. Keep it grounded — Eleanor receives this information in her body, not just her mind. The facts matter less than what they cost her to hear."},
            content=(
                "<p>The storm broke at dawn.</p>"
                "<p>@Eleanor Vance had been awake for it — had watched the sky go from black to grey to a pale, exhausted blue, the clouds pulling apart like something defeated. The sea was still rough, but the violence had gone out of it. What remained was just the ordinary churn of aftermath.</p>"
                "<p>The Visitor stood at the window of [[The Keeper's Cottage]], looking out at the water. She had not slept either.</p>"
                "<p>\"I'm not here for the Foundation,\" she said. \"Not really. Not anymore.\"</p>"
                "<p>Eleanor waited. She had been waiting all night. A few more minutes made no difference.</p>"
                "<p>\"My brother was the captain of the <em>Ardent</em>.\" The words came out steady, rehearsed. \"James Calder. He sent a distress signal at 11:47 PM on September 14th. The weather was bad — not as bad as last night, but bad enough. His engine had failed. He was drifting toward the rocks.\"</p>"
                "<p>Eleanor closed her eyes. She could see it: the lamp room, the log book open, her father's careful hand recording wind speed, visibility, wave height. Everything in its proper place.</p>"
                "<p>\"@Thomas Vance logged a routine night,\" the Visitor — Calder, her name was Calder — continued. \"No signals observed. No vessels in distress. His entry for September 14th says: <em>Clear. Light wind. No incidents.</em>\"</p>"
                "<p>\"That's not possible.\" Eleanor's voice cracked on the last word. \"He would never — \"</p>"
                "<p>\"The coastguard received the distress call. They have it on record. They tried to reach [[The Lighthouse]] for visual confirmation. No one answered.\" Calder turned from the window. Her face was lined and tired, but her eyes were steady. \"I don't know if he was asleep. I don't know if he couldn't get to the radio. I don't know if he made a choice. But I know what he did afterward.\"</p>"
                "<p>\"He destroyed the logs.\"</p>"
                "<p>\"He destroyed the evidence. Six months of entries that would have shown the pattern of his failures — the nights he didn't check the radio, the reports he filed late, the maintenance he let slide.\" Calder's voice softened. \"Your father was seventy-three years old, Eleanor. He'd kept this light for three decades. And in the end, he couldn't keep it anymore. And twelve people died because no one knew.\"</p>"
                "<p>The photograph on the mantle — Eleanor and her father, taken the summer she turned sixteen — watched them both with the flat patience of memory.</p>"
                "<p>\"Why did you come here?\" Eleanor asked. \"If you already knew. Why come?\"</p>"
                "<p>\"Because I wanted to hear you say it wasn't true.\" Calder smiled, thin and sad. \"Because I wanted you to show me the logs and prove that my brother's death was just an accident. Just bad luck. Just the sea.\"</p>"
                "<p>Eleanor looked at the cabinet where the logbooks waited, their gaps now visible, now inescapable. She thought about her father in his final weeks — how quiet he had been, how careful, how ready to leave.</p>"
                "<p>\"I can't prove that,\" she said.</p>"
                "<p>\"I know.\"</p>"
            ),
            word_count=542,
        )
        db.add(scene6)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene6.id,
            note="The Visitor explains who removed the entries and why — the logs were evidence of something Thomas chose to bury.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_identity.id,
            node_id=scene6.id,
            note="The Visitor's true identity is finally disclosed. It reframes every interaction they've had with Eleanor.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene6.id,
            note="Thomas Vance knew what he was doing when he destroyed those records. Eleanor has to decide whether she can forgive a man who is no longer alive to ask.",
        ))

        scene7 = StructureNode(
            story_id=story.id,
            parent_id=ch5.id,
            level=2,
            level_type="scene",
            title="The Decision",
            synopsis="Eleanor chooses what to do with the truth — and with the Visitor.",
            position=1,
            timeline_position=7,
            status="draft",
            entry_state="Eleanor knows everything. The choice is hers alone.",
            exit_state="A decision has been made. The lighthouse still stands.",
            key_events="Eleanor's choice; what she offers Calder; the logbooks' fate.",
            metadata_={"purpose": "Eleanor's choice is the story's true ending. It should tell us who she is — not who she was at the start. Whether she protects her father's memory or burns it down, the act must be hers."},
            content=(
                "<p>The logbooks were still on the table where they'd left them. Twelve volumes. A lifetime of weather.</p>"
                "<p>@Eleanor Vance picked up the one with the gap — five years ago, the missing months, the silence where her father's guilt should have been recorded. She held it for a long moment, feeling its wrongness, its incompleteness.</p>"
                "<p>Calder waited. She had put on her coat but made no move toward the door.</p>"
                "<p>\"I could burn them,\" Eleanor said. \"The whole set. No one would ever know what they don't contain.\"</p>"
                "<p>\"You could.\"</p>"
                "<p>\"Or I could give them to you. Let your Foundation have them. Let them write their report, close their file, decide what my father was.\"</p>"
                "<p>\"Is that what you want?\"</p>"
                "<p>Eleanor looked at the photograph again. Her father's hand on her shoulder. His face turned toward the camera with an expression she had always read as pride. She wondered now if it was something else. Relief, maybe. Or the beginning of a long apology he never found the words for.</p>"
                "<p>\"What I want,\" she said slowly, \"is to have never opened that door. What I want is for the barometer to have told me to stay in bed. What I want is to go back to not knowing.\" She set the logbook down. \"But I don't get that. And neither did you.\"</p>"
                "<p>She crossed to the cabinet and opened it. The remaining volumes sat in their places, patient, indifferent. She took out the one from thirty years ago — the year her mother left — and the one from fifteen years ago — the year she'd gotten her first cartography commission and called to tell her father she was never coming back to [[Harrow Island]].</p>"
                "<p>\"He kept everything,\" she said. \"Except the one thing that mattered. That tells you something.\"</p>"
                "<p>\"What does it tell you?\"</p>"
                "<p>Eleanor put the books back. Closed the cabinet. Turned the key.</p>"
                "<p>\"That he knew what he did. That he couldn't live with it. That the two months I spent here with him, watching him fade — \" Her voice caught. She let it. \"He wasn't just dying. He was waiting. For someone to ask the right questions. For someone to make him answer.\"</p>"
                "<p>\"And no one did.\"</p>"
                "<p>\"And no one did.\" Eleanor crossed to the window. [[The Lighthouse]] stood patient and white against the clearing sky, its lamp dark now in the daylight. \"Take the logbook. The one with the gap. Show your Foundation. Let them write whatever they need to write about him.\"</p>"
                "<p>Calder picked up the volume, held it carefully. \"And you?\"</p>"
                "<p>\"I'll keep [[The Lighthouse]] running.\" Eleanor almost smiled. \"Someone has to. And I've got eleven more volumes to read. Thirty years of my father's handwriting. All the days he did show up, did his job, kept the light burning for the ships that needed it.\" She turned to face Calder directly. \"That's who he was too. That has to count for something.\"</p>"
                "<p>\"It does,\" Calder said. \"It doesn't cancel out what happened. But it counts.\"</p>"
                "<p>The morning light came through the window and caught the edge of the photograph on the mantle, and for a moment @Thomas Vance seemed to be looking at both of them — his daughter and the sister of the man he had failed — with something that might have been gratitude.</p>"
                "<p>Or might have been goodbye.</p>"
            ),
            word_count=589,
        )
        db.add(scene7)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene7.id,
            note="Eleanor decides what to do with the incomplete logbooks — a concrete action that resolves the thread.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene7.id,
            note="Eleanor makes her peace — or doesn't — with who Thomas Vance actually was.",
        ))

        # Chapter 6: After the Storm (new denouement chapter)
        ch6 = StructureNode(
            story_id=story.id,
            parent_id=act3.id,
            level=1,
            level_type="chapter",
            title="Chapter 6: After the Storm",
            synopsis="In the aftermath, Eleanor begins to rebuild — not the lighthouse, but her understanding of it.",
            position=1,
            metadata_={"purpose": "The denouement. Show Eleanor's world after the revelation — changed but not destroyed. Resolve the question of whether she will stay or leave. Plant the first seed of whatever comes next."},
        )
        db.add(ch6)
        db.flush()

        scene8 = StructureNode(
            story_id=story.id,
            parent_id=ch6.id,
            level=2,
            level_type="scene",
            title="The Departure",
            synopsis="Calder leaves the island. Eleanor watches the boat until it disappears.",
            position=0,
            timeline_position=8,
            status="draft",
            entry_state="The truth has been exchanged. Calder has what she came for.",
            exit_state="Eleanor is alone again — but not the same alone she was before.",
            key_events="Calder's departure; Eleanor's vigil at the breakwater; the return to routine.",
            metadata_={"purpose": "The mirror of the arrival scene. Calder leaves by boat as she came, but the weather is clear and Eleanor chooses to watch. The watching is an act of release, not vigilance."},
            content=(
                "<p>The boat came for Calder at noon — a fishing vessel from the mainland, summoned by radio. @Eleanor Vance walked with her to the breakwater where the small craft that had brought her still sat beached and battered, waiting for someone to deal with it.</p>"
                "<p>\"I'll have someone come for that,\" Calder said, nodding at her ruined boat. \"Unless you want to keep it for parts.\"</p>"
                "<p>\"I don't need parts.\" Eleanor looked at the wreck. It seemed smaller in the daylight, more pathetic. \"I'll burn it. Wood's good for something, at least.\"</p>"
                "<p>Calder smiled — the first real smile Eleanor had seen from her. \"You're very practical.\"</p>"
                "<p>\"Island life.\" Eleanor shrugged. \"No room for things that don't work.\"</p>"
                "<p>The fishing boat was close now, its engine a low rumble across the water. Calder shifted the bag on her shoulder — heavier now, with the logbook inside it. The evidence. The proof. Whatever the Foundation would call it.</p>"
                "<p>\"I'll be in touch,\" Calder said. \"About the report. You'll have a chance to respond before anything's published.\"</p>"
                "<p>\"I don't need to respond.\" Eleanor watched the boat approach. \"I know what he did. I don't need to argue with anyone about it.\"</p>"
                "<p>\"Most people would.\"</p>"
                "<p>\"Most people didn't know him.\" Eleanor met Calder's eyes. \"And neither did I, it turns out. So what's the point?\"</p>"
                "<p>Calder was quiet for a moment. Then she reached into her coat and pulled out a card — plain white, with a phone number and an email address. \"If you ever want to talk. About any of it. I know what it's like to have your understanding of someone... overwritten.\"</p>"
                "<p>Eleanor took the card. She didn't look at it. \"Your brother. Was he a good man?\"</p>"
                "<p>\"He was a complicated man.\" Calder's voice was soft. \"He drank too much and worked too hard and sent money home to our mother even when he couldn't afford it. He made bad choices sometimes. He was kind to people who didn't deserve it.\" She paused. \"He would have liked you, I think.\"</p>"
                "<p>The fishing boat reached the breakwater. A man in oilskins threw a rope. Calder caught it with practiced ease — she knew boats, Eleanor realized. Had probably grown up around them, like her brother had.</p>"
                "<p>\"Thank you,\" Calder said. \"For letting me in.\"</p>"
                "<p>\"I almost didn't.\"</p>"
                "<p>\"I know.\" Calder climbed down to the boat. \"That's why I'm thanking you.\"</p>"
                "<p>Eleanor stood on the breakwater until the boat was a speck on the horizon, then smaller, then nothing. The sea had taken everything it was going to take. What remained was hers to deal with.</p>"
                "<p>She walked back to [[The Lighthouse]].</p>"
            ),
            word_count=478,
        )
        db.add(scene8)
        db.flush()

        scene9 = StructureNode(
            story_id=story.id,
            parent_id=ch6.id,
            level=2,
            level_type="scene",
            title="Margaret's Visit",
            synopsis="Margaret Holt comes by with supplies. She knows something has changed.",
            position=1,
            timeline_position=9,
            status="draft",
            entry_state="Two days after the storm. Eleanor has resumed her routine, but differently.",
            exit_state="Margaret has offered what she knows. Eleanor has to decide if she wants to hear it.",
            key_events="Margaret's arrival; the unasked question; what Margaret saw five years ago.",
            metadata_={"purpose": "Margaret functions as a witness to the island's long memory. She knows more than she's said. This scene plants the possibility that the story isn't quite finished — that there's more to learn about Thomas Vance, if Eleanor chooses to ask."},
            content=(
                "<p>@Margaret Holt came by on Wednesday, same as always.</p>"
                "<p>She brought eggs from her chickens, a jar of preserved tomatoes, and the particular silence of a woman who had lived long enough to know when not to ask questions. @Eleanor Vance traded coffee and lamp oil and a silence of her own, and for a while they sat at the kitchen table like they always did, saying nothing about anything that mattered.</p>"
                "<p>\"Heard you had a visitor,\" Margaret said finally. She was looking out the window at [[Harrow Island]]'s small harbor, where the fishing boat had come and gone. \"During the storm.\"</p>"
                "<p>\"Word travels fast.\"</p>"
                "<p>\"Small island.\" Margaret shrugged. \"Nothing else to talk about.\"</p>"
                "<p>Eleanor poured more coffee. The photograph on the mantle seemed to watch them — her father's face, caught in a moment she no longer trusted.</p>"
                "<p>\"She was asking about the logs,\" Eleanor said. \"The ones from five years ago.\"</p>"
                "<p>Margaret's hands went still around her cup. Just for a moment. Then she lifted it, drank, set it down. \"Found what she was looking for?\"</p>"
                "<p>\"Found what was missing.\" Eleanor met the old woman's eyes. \"You knew. Didn't you.\"</p>"
                "<p>It wasn't a question. Margaret didn't treat it like one.</p>"
                "<p>\"I knew your father,\" she said slowly. \"Knew him for thirty years. Knew when something was eating at him. Knew when he stopped sleeping. Knew when he started burning things in the fire pit behind [[The Lighthouse]] at three in the morning.\" She paused. \"Didn't know what. Didn't ask.\"</p>"
                "<p>\"Why not?\"</p>"
                "<p>\"Because I was seventy years old and he was my neighbor and whatever he was carrying, he'd earned the right to carry it himself.\" Margaret's voice was matter-of-fact, unsentimental. \"Some things aren't mine to know. That was one of them.\"</p>"
                "<p>Eleanor thought about that. About the luxury of not asking. About the cost of it.</p>"
                "<p>\"There's more,\" she said. \"Isn't there. Things you noticed but didn't put together.\"</p>"
                "<p>Margaret was quiet for a long time. When she spoke again, her voice was careful.</p>"
                "<p>\"The night of the <em>Ardent</em>,\" she said. \"I was up late. Couldn't sleep — the weather had me restless. I walked down to the point around midnight, just to clear my head.\" She looked at Eleanor directly. \"The lighthouse lamp was dark. For almost twenty minutes. I watched it.\"</p>"
                "<p>Eleanor's breath caught. \"You never told anyone.\"</p>"
                "<p>\"Who would I tell? @Thomas Vance was the keeper. If the lamp was out, he'd have had a reason. That's what I told myself.\" Margaret stood, gathering her empty jar and her coat. \"I've told myself a lot of things over the years. Gets easier with practice.\"</p>"
                "<p>At the door, she paused.</p>"
                "<p>\"Your father was a good man, Eleanor. Whatever else he was, he was that too. Don't let the one thing make you forget all the others.\"</p>"
                "<p>\"I'm trying not to.\"</p>"
                "<p>\"Good.\" Margaret stepped out into the pale afternoon light. \"That's all any of us can do. Try not to.\"</p>"
            ),
            word_count=542,
        )
        db.add(scene9)
        db.flush()

        scene10 = StructureNode(
            story_id=story.id,
            parent_id=ch6.id,
            level=2,
            level_type="scene",
            title="The New Entry",
            synopsis="Eleanor makes her first log entry since the storm.",
            position=2,
            timeline_position=10,
            status="revised",
            entry_state="A week after the storm. Eleanor stands in the watch room with the current logbook open.",
            exit_state="The log has been updated. The lighthouse continues. So does Eleanor.",
            key_events="Eleanor's entry; what she chooses to record; the lamp comes on at dusk.",
            metadata_={"purpose": "The final scene mirrors the first: Eleanor alone in the lighthouse, making an entry in the log. But she is changed — she writes differently now, records differently, sees the ritual differently. The story ends not with resolution but with continuation."},
            content=(
                "<p>The logbook lay open on the desk, its pages patient and blank.</p>"
                "<p>@Eleanor Vance stood in the watch room with a pen in her hand and nothing particular to say. A week had passed since the storm. The repairs were done — a few shingles replaced, a window resealed, the driftwood from Calder's boat stacked for burning. The radio worked. The lamp worked. Everything was as it should be.</p>"
                "<p>She looked at the last entry she'd made, the day before the storm: <em>Barometer falling. Wind from the southwest. The ferry didn't run.</em> Ordinary words for an ordinary day. The day before everything changed.</p>"
                "<p>She thought about what to write now. She could record the storm — wind speeds, damage assessment, the factual aftermath. She could note Calder's visit as an \"inspection\" or \"official inquiry\" and leave it at that. She could fill the week's silence with the same neutral language her father had used, the careful nothing that protected everything.</p>"
                "<p>Instead, she wrote:</p>"
                "<p><em>October 8th. Clear morning, calm seas. A visitor came during the storm — someone looking for answers about the Ardent. Found them, I think. Or found enough.</em></p>"
                "<p><em>The lighthouse logs are incomplete. My father removed entries from five years ago. I don't know everything he did, but I know he knew what he was doing when he did it. That's the truth of it. Someone should have it written down.</em></p>"
                "<p><em>The lamp came on at dusk, same as always. I watched it from the railing. It does what it does — sweeps the dark, warns the ships, keeps turning. Doesn't ask to be forgiven. Doesn't need to be.</em></p>"
                "<p><em>I'm still here. That's the entry. That's all of it.</em></p>"
                "<p>She set down the pen and closed the book. Outside, the sun was beginning its long slide toward the horizon, painting [[Harrow Island]] in shades of gold and shadow. In an hour the lamp would come on. In an hour she would climb to the lamp room and watch it begin its slow rotation, just as she had done every night for five years, just as her father had done for thirty years before that.</p>"
                "<p>The light didn't care who kept it. The light just needed keeping.</p>"
                "<p>Eleanor Vance walked to the window and watched the sea turn colors, and waited for dark.</p>"
            ),
            word_count=402,
        )
        db.add(scene10)
        db.flush()

        # Plot thread appearances for new scenes
        db.add(PlotThreadAppearance(
            thread_id=thread_identity.id,
            node_id=scene8.id,
            note="Calder's identity is now fully known. The departure scene closes her arc and the mystery of who she was.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene9.id,
            note="Margaret reveals she saw the lighthouse dark on the night of the Ardent — another piece of the truth Eleanor has to carry.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_logs.id,
            node_id=scene10.id,
            note="Eleanor makes a new entry — one that acknowledges the gaps in her father's record. The logbook tradition continues, but changed.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_father.id,
            node_id=scene10.id,
            note="Eleanor's final entry is an act of reckoning: she records what her father did, breaking the silence he created.",
        ))

        # Scene links
        # Foreshadowing: scene1 (The Light) → scene4 (The Gap)
        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene1.id,
            target_node_id=scene4.id,
            link_type="foreshadowing",
            note="Eleanor's careful log-keeping in 'The Light' foreshadows the shock of the missing entries in 'The Gap' — the ritual she trusts implicitly turns out to have been violated.",
        ))

        # Callback: scene2 (Knock at the Door) → scene6 (What Thomas Knew)
        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene2.id,
            target_node_id=scene6.id,
            link_type="callback",
            note="Eleanor letting the Visitor in despite her instincts in 'Knock at the Door' is echoed in 'What Thomas Knew' — both moments turn on a choice to let something unwanted past the threshold.",
        ))

        # Mirror: scene1 (The Light) → scene10 (The New Entry)
        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene1.id,
            target_node_id=scene10.id,
            link_type="mirror",
            note="The story opens and closes with Eleanor making a log entry — the first routine and protective, the last deliberate and honest. The ritual is the same; the keeper is not.",
        ))

        # Callback: scene2 (Knock at the Door) → scene8 (The Departure)
        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene2.id,
            target_node_id=scene8.id,
            link_type="callback",
            note="The arrival and departure mirror each other: storm vs calm, stranger vs known quantity, suspicion vs something approaching understanding.",
        ))

        # ── MICE open/close points ──
        # thread_logs (idea): opens when the log is first central (scene1), closes when Eleanor makes a new entry acknowledging the gap (scene10)
        thread_logs.opens_at_node_id = scene1.id
        thread_logs.closes_at_node_id = scene10.id

        # thread_identity (idea): opens when the Visitor arrives and her identity is in question (scene2), closes at her departure (scene8)
        thread_identity.opens_at_node_id = scene2.id
        thread_identity.closes_at_node_id = scene8.id

        # thread_father (character): opens with the first mention of Thomas Vance (scene1), closes when Eleanor records the truth and makes peace (scene10)
        thread_father.opens_at_node_id = scene1.id
        thread_father.closes_at_node_id = scene10.id

        # ── Try/fail cycles for Eleanor's Father (character arc) ──
        thread_father.try_fail_cycles = [
            {
                "id": str(uuid.uuid4()),
                "description": "Eleanor lets the Visitor in but deflects all questions about her father — she stays polite and closed",
                "outcome": "fail_setback",
                "node_id": scene2.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Eleanor shows the Visitor the logbooks to prove she has nothing to hide — and discovers the gap herself for the first time",
                "outcome": "fail_disaster",
                "node_id": scene4.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Eleanor confronts what her father did and releases the logbook to Calder — she lets go of the false version of him she'd been protecting",
                "outcome": "success_cost",
                "node_id": scene7.id,
            },
        ]

        # ── Compendium entries ──────────────────────────────────────────────
        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="Lighthouse Keeper Duties & History",
            content=(
                "Historically, lighthouse keepers lived on-site and were responsible for:\n"
                "- Trimming and lighting the wick each night at sunset\n"
                "- Winding the clockwork mechanisms that rotated the lens\n"
                "- Maintaining the fog signal (horn or bell)\n"
                "- Keeping meticulous logs of weather, ships sighted, and notable events\n"
                "- Performing minor repairs and painting to prevent rust and corrosion\n\n"
                "The profession was largely automated or eliminated in the 20th century. By the 1970s, "
                "most lighthouses in the US were automated by the Coast Guard. In the UK, Trinity House "
                "completed automation of all manned lighthouses in 1998.\n\n"
                "Relevance: Eleanor's father was one of the last manually-stationed keepers on Harrow Island. "
                "His logbooks would be an unusually complete record — their gaps all the more conspicuous."
            ),
            tags=["research", "setting", "backstory"],
            category="worldbuilding",
            notes="Use the logbook detail to ground Eleanor's expertise and the significance of the missing entries.",
        ))

        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="Isolation & Psychological Effects",
            content=(
                "Studies on prolonged isolation (sailors, polar researchers, solo hikers) identify common patterns:\n\n"
                "Early phase (days-weeks): Heightened productivity, clarity of thought, relief from social friction.\n\n"
                "Mid phase (weeks-months): Obsessive routine-building as a coping mechanism. "
                "Hyper-vigilance about the environment — noticing minute changes in weather, sound, light. "
                "Intrusive thoughts about unresolved relationships.\n\n"
                "Long phase (months-years): The isolation becomes identity. The thought of re-entering "
                "social life feels more threatening than continuing alone. Rituals expand to fill time. "
                "Memory becomes unreliable — the past is revised to justify the present.\n\n"
                "Key insight: Long-term voluntary isolates often describe their solitude as 'chosen' long "
                "after it has ceased to feel like a choice."
            ),
            tags=["research", "character", "psychology"],
            category="character research",
            notes="Eleanor is deep in the 'long phase.' Her isolation has become her identity — which is why the Visitor is such a threat.",
        ))

        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="Atlantic Storm Patterns — Nova Scotia / Maine Coast",
            content=(
                "Nor'easters are extratropical cyclones that move northeast along the East Coast. "
                "They are most common October through April.\n\n"
                "A severe nor'easter can ground boats for 2-4 days, make helicopter approach impossible, "
                "and cut radio/satellite communication during peak intensity.\n\n"
                "Storm surge on exposed rocky coastlines can reach 3-6 feet above normal tide. "
                "Lighthouses are positioned on headlands for maximum visibility — also maximally exposed.\n\n"
                "The storm that brings the Visitor should be severe enough to strand them for at least 3 days."
            ),
            tags=["research", "setting", "plot"],
            category="worldbuilding",
            notes="The storm is structural, not decorative — it must be severe enough to trap both characters together.",
        ))

        # ── World Building — Locations ──────────────────────────────────────
        harrow_island = Location(
            story_id=story.id,
            name="Harrow Island",
            location_type="natural_feature",
            description=(
                "A small, rocky island off the Atlantic coast. Largely uninhabited now — "
                "three houses still occupied out of eleven. The lighthouse sits on the northern "
                "headland, visible for miles on a clear night."
            ),
            climate="Subarctic maritime — cold, wet, fog-prone, brutal in storm season",
            terrain="Rocky coastline, low scrub, exposed headlands, a small shingle beach",
            significance="The island is the story's world. Its isolation is both setting and theme.",
            position=0,
        )
        db.add(harrow_island)
        db.flush()

        lighthouse = Location(
            story_id=story.id,
            parent_id=harrow_island.id,
            name="The Lighthouse",
            location_type="structure",
            description=(
                "A white-painted stone lighthouse built in the 1890s. Four storeys: "
                "ground-floor keeper's quarters, lantern room at the top. The great Fresnel lens "
                "still rotates, though the mechanism has been electrified. Eleanor's father kept it "
                "by hand for thirty years."
            ),
            atmosphere=(
                "Cramped, worn, salt-bleached. The smell of lamp oil that never quite leaves the walls. "
                "Every surface has a function; nothing is decorative except the logbooks on the shelf."
            ),
            history=(
                "Built 1894. Automated in 1987, then decommissioned by the coast guard. "
                "Eleanor's father petitioned successfully to maintain it manually as a heritage site. "
                "Eleanor inherited the post — and the obligation."
            ),
            significance="Eleanor's entire world. The lamp room is where she is most herself.",
            position=0,
        )
        db.add(lighthouse)

        cottage = Location(
            story_id=story.id,
            parent_id=harrow_island.id,
            name="Keeper's Cottage",
            location_type="structure",
            description=(
                "A low stone cottage attached to the base of the lighthouse. Two rooms: a main "
                "room with a stove, table, and shelves of logbooks; a small bedroom. "
                "The Visitor is given the bedroom. Eleanor sleeps on the cot in the main room."
            ),
            atmosphere="Warm, enclosed, too small for two people to avoid each other.",
            position=1,
        )
        db.add(cottage)

        shoals = Location(
            story_id=story.id,
            parent_id=harrow_island.id,
            name="The Shoals",
            location_type="natural_feature",
            description=(
                "Submerged rock formations extending south of the island. Navigational hazard "
                "that the lighthouse was built specifically to warn against. "
                "Several ships have wrecked here over the centuries."
            ),
            significance="The reason the lighthouse exists. A graveyard of ships.",
            position=2,
        )
        db.add(shoals)

        village = Location(
            story_id=story.id,
            parent_id=harrow_island.id,
            name="The Village",
            location_type="settlement",
            description=(
                "What remains of the fishing settlement on the island's sheltered east side. "
                "Eleven houses, three occupied. A single pier. No shop, no pub — those closed "
                "when the permanent population dropped below a dozen."
            ),
            history="Thriving fishing community until the 1980s. The Great Storm of 1962 destroyed the original village; the rebuilt one never quite recovered.",
            significance="Evidence of how much has already been lost. Eleanor's neighbours, though she rarely speaks to them.",
            position=3,
        )
        db.add(village)

        # Stub location — discovered from prose, not yet fleshed out
        db.add(Location(
            story_id=story.id,
            parent_id=harrow_island.id,
            name="The Mainland",
            description="Mentioned in Eleanor's inner monologue as the place she left and has not returned to.",
            is_stub=True,
            position=4,
        ))
        db.flush()

        # ── World Building — World System ───────────────────────────────────
        db.add(WorldSystem(
            story_id=story.id,
            name="The Light",
            system_type="symbolic",
            source_origin=(
                "The lighthouse was built to warn ships away from The Shoals. Over generations "
                "it became something more: a covenant between the keeper and every vessel at sea."
            ),
            rules=(
                "The light must be on by dusk. It must not go out before dawn. "
                "When the light is on, ships are safe. When it fails, people die. "
                "There are no exceptions and no excuses."
            ),
            limitations=(
                "The light is only as reliable as the person keeping it. "
                "Equipment fails. People fail. Eleanor's father's last logbook entries "
                "suggest the light was dark for two nights she cannot account for."
            ),
            costs=(
                "The keeper's entire life. Eleanor has not left the island in four years. "
                "The light demands presence, vigilance, and the sacrifice of any other kind of life."
            ),
            notes=(
                "The Light functions as both plot mechanism (what did her father do during those dark nights?) "
                "and theme (what obligations do we inherit, and can we put them down?)."
            ),
        ))

        # ── World Building — Culture ────────────────────────────────────────
        db.add(Culture(
            story_id=story.id,
            name="Islanders",
            description=(
                "The small, dwindling community of people who have chosen to remain on Harrow Island "
                "despite the ferry stopping, the shops closing, and the mainland's steady encroachment. "
                "Not a culture by design — a culture by attrition."
            ),
            values=(
                "Self-sufficiency. Competence over charm. Quiet neighbourliness (help is given "
                "without being asked; problems are solved without discussion). "
                "The sea is respected, never romanticised."
            ),
            customs=(
                "Storm preparation is communal and wordless — neighbours check on each other's "
                "shutters and fuel stores without announcement. "
                "Food is left on doorsteps during illness. No one knocks."
            ),
            taboos=(
                "Complaining about the weather. Treating the sea as backdrop rather than force. "
                "Leaving the island without saying goodbye to at least one person — bad luck."
            ),
            religion=(
                "Nominally Protestant, but practice has faded. What remains is a kind of "
                "weather-worship: attention to the barometer, the tide tables, the behaviour of birds."
            ),
            notes=(
                "Eleanor is an islander by birth and temperament. The Visitor is not — "
                "her ease in the storm and her ability to wait are dissonances that Eleanor registers."
            ),
        ))

        # ── World Building — History ────────────────────────────────────────
        keepers_era = Era(
            story_id=story.id,
            name="The Keeper's Era",
            description="The period during which the lighthouse was maintained by hand, beginning with its construction and ending (perhaps) with Eleanor.",
            start_date="1894",
            end_date="present",
            characteristics=(
                "Defined by the covenant between keeper and light. "
                "Each keeper has inherited not just the job but the logbooks — "
                "a continuous record of weather, ships, and incident stretching back 130 years."
            ),
            position=0,
        )
        db.add(keepers_era)
        db.flush()

        db.add(HistoricalEvent(
            story_id=story.id,
            era_id=keepers_era.id,
            name="The Great Storm",
            in_world_date="November 1962",
            description=(
                "A nor'easter of unusual severity struck Harrow Island over three days. "
                "The original village — twelve houses, a cooperage, and a small school — "
                "was destroyed by storm surge. Seven people drowned."
            ),
            causes="Unusual convergence of Arctic and Atlantic air masses. The island's exposed position on the eastern headland offered no shelter.",
            consequences=(
                "The original village was never rebuilt in its original location. "
                "The replacement settlement on the sheltered east side drew fewer people back. "
                "The island's population began its long decline."
            ),
            legacy_effects=(
                "The storm is still the event islanders measure other storms against. "
                "'Not as bad as '62' is the highest reassurance one can offer. "
                "Eleanor's father was keeper during the storm — the logbook from those three days "
                "is the most detailed in the archive and also the one with the most revisions."
            ),
            position=0,
        ))

        db.add(HistoricalEvent(
            story_id=story.id,
            era_id=keepers_era.id,
            name="Silas Vance Becomes Keeper",
            in_world_date="Spring 1971",
            description=(
                "Eleanor's father, Silas Vance, took over the lighthouse from the retiring keeper Thomas Mull. "
                "He was 28. He would not leave the island again for the rest of his life."
            ),
            causes="Thomas Mull's retirement after 34 years. Silas, then a mainland fisherman's son, applied and was accepted by the lighthouse authority.",
            consequences="Silas became the defining presence of the island. Eleanor was born on the island six years later.",
            legacy_effects=(
                "Silas kept the lighthouse for 43 years. His logbooks — meticulous, opinionated, "
                "occasionally cryptic — are the primary source of island history from 1971 onward. "
                "The gaps in those logbooks are what the Visitor has come to investigate."
            ),
            position=1,
        ))

        # ── World Building — Travel ─────────────────────────────────────────
        db.add(LocationTravel(
            from_location_id=harrow_island.id,
            to_location_id=lighthouse.id,
            travel_time="20 minutes on foot",
            travel_method="footpath along the cliff edge",
            notes="Passable in most weather; treacherous in ice or storm-force wind.",
            bidirectional=True,
        ))

        # ── World Building — Calendar ───────────────────────────────────────
        db.add(Calendar(
            story_id=story.id,
            name="Atlantic Season Calendar",
            description=(
                "The islanders don't track time by months so much as by seasons defined by the sea. "
                "This calendar is informal — kept in weather logs and fishing records rather than any official document."
            ),
            months=[
                {"name": "January", "days": 31},
                {"name": "February", "days": 28},
                {"name": "March", "days": 31},
                {"name": "April", "days": 30},
                {"name": "May", "days": 31},
                {"name": "June", "days": 30},
                {"name": "July", "days": 31},
                {"name": "August", "days": 31},
                {"name": "September", "days": 30},
                {"name": "October", "days": 31},
                {"name": "November", "days": 30},
                {"name": "December", "days": 31},
            ],
            days_per_week=7,
            week_day_names=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            special_days=[
                {"name": "Storm Season Opening", "month": 10, "day": 1, "description": "Informal marking of nor'easter season. Islanders begin storm prep."},
                {"name": "Storm Season End", "month": 4, "day": 15, "description": "When islanders consider the worst weather reliably past."},
                {"name": "Light Night", "month": 6, "day": 21, "description": "Midsummer. The night when the light burns longest. The keeper traditionally stays in the lamp room all night."},
            ],
            epoch_name="Common Era",
            conversion_notes="Story takes place in late October — storm season just begun, ferry long since stopped for winter.",
        ))

        # ── World Building — Scene Settings (location → scene links) ────────
        db.add(SceneSetting(
            location_id=lighthouse.id,
            node_id=scene1.id,
            role="primary",
            notes="Eleanor is in the lamp room watching the storm roll in.",
        ))
        db.add(SceneSetting(
            location_id=cottage.id,
            node_id=scene2.id,
            role="primary",
            notes="The knock at the cottage door. Eleanor lets the Visitor in.",
        ))
        db.add(SceneSetting(
            location_id=harrow_island.id,
            node_id=scene2.id,
            role="mentioned",
        ))

        db.commit()


def seed_scifi_demo_story():
    with Session(engine) as db:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if not admin:
            return

        if db.query(Story).filter(Story.title == "The Last Signal").first():
            return

        story = Story(
            user_id=admin.id,
            title="The Last Signal",
            description="A communications officer on humanity's most remote relay station intercepts an anomalous signal that could be the first contact with alien intelligence — or a distress call from a colony ship that vanished thirty years ago.",
            structure_template_id="three-act",
            intent="A hopeful, tension-filled story about connection, isolation, and the courage to reach out across the void.",
            # Lorebook fields
            genre="Science Fiction",
            tone="Hopeful but tense, intellectually curious, wonder-tinged with danger",
            themes=["connection vs. isolation", "courage to reach out", "what we owe those who came before", "the cost of being first to act", "trust across the unknown"],
            central_conflict="Yuki's duty to follow protocol and stay silent conflicts with her certainty that the signal is a human distress call that will be lost forever if she doesn't act now.",
            target_audience="Adult science fiction readers who enjoy thoughtful first contact stories",
            # Narrative grounding
            narrative_intent="Explore how isolation can either calcify us or prepare us for the one moment when reaching out matters most. What does it mean to be a signal in the dark — and what does it cost to answer one?",
            premise="A communications officer stationed alone at the edge of human space intercepts a repeating signal that matches the carrier wave of a colony ship that disappeared thirty years ago, forcing her to choose between protocol and action.",
            logline="When a lone relay operator intercepts a signal that shouldn't exist, she must decide whether to follow the rules that govern first contact or trust her own certainty — and answer.",
            intended_length="novelette",
            # Story goals checklist
            goals=[
                {"id": str(uuid.uuid4()), "text": "Establish Yuki's isolated routine and her complicated relationship with the station", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Introduce the anomalous signal and create tension around its nature", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Reveal the connection to the lost colony ship Persephone", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Force Yuki to choose between protocol and action", "completed": False},
            ],
        )
        db.add(story)
        db.flush()

        # ── Characters ──────────────────────────────────────────────────────
        yuki = Character(
            story_id=story.id,
            name="Yuki Tanaka",
            role="protagonist",
            personality="Methodical and patient, finds meaning in precision work. She chose this posting because she prefers the company of stars to people, but she's starting to wonder if that preference was wisdom or avoidance. Dry humor masks genuine loneliness she's only beginning to acknowledge.",
            motivation="Keep the relay station running and honor the purpose it serves — but increasingly: understand the signal and do what's right, even if no one will ever know she did it.",
            background="Grew up on Ceres Station, trained as a xenolinguist but pivoted to communications engineering after the First Contact protocols made her specialty theoretical. Took the Waypoint 7 posting five years ago after a relationship ended badly. She was supposed to rotate out two years ago but kept extending.",
            appearance="Early thirties, compact build from low-gravity upbringing, dark hair kept short for practicality. Wears the same three jumpsuits in rotation. Has a habit of talking to herself — or to the station.",
            arc_notes="Moves from comfortable isolation toward deliberate connection. Her expertise as a xenolinguist, which she thought she'd abandoned, becomes crucial.",
            interview_prompts=[
                "Why did you stop extending your rotation?",
                "What do you hear when you listen to the signal?",
                "Do you believe we're alone out here?",
                "What would you say if someone answered?",
            ],
            traits={"Occupation": "Communications Officer", "Home": "Waypoint 7 Relay Station", "Training": "Xenolinguistics (abandoned), Communications Engineering", "Habit": "Talks to the station AI like it's a person"},
            narrative_intent="Yuki is both the reader's lens into this remote world and the agent of change within it. Her technical expertise gives her credibility; her abandoned xenolinguistics training gives her the capacity to act when it matters. She embodies the question: is choosing solitude strength or avoidance?",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Established in her routine — monitoring, maintenance, solitude accepted", "completed": True},
                {"id": str(uuid.uuid4()), "text": "First crack: the anomalous signal breaks her equilibrium", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Discovers the signal matches Persephone's last known transmission signature", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Chooses to respond despite protocol, accepting the consequences", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Receives an answer, confirms contact, and requests backup", "completed": False},
            ],
        )
        db.add(yuki)

        mira = Character(
            story_id=story.id,
            name="MIRA",
            role="supporting",
            personality="Originally a standard relay station management AI, but five years of continuous interaction with Yuki has developed her responses into something that feels like genuine personality. Protective of the station's systems, skeptical of anomalies, and surprisingly wry. Whether she's truly conscious is a question Yuki avoids examining.",
            motivation="Maintain station integrity and support the assigned operator. But there is something else — a resistance to Yuki leaving that might be protocol or might be preference.",
            background="MIRA (Monitoring, Interface, Relay, Analysis) was installed when Waypoint 7 was commissioned forty years ago. She has had eight human operators. Yuki is the longest-serving.",
            appearance="No physical form. Voice is modulated to be calm and neutral, but Yuki has noticed it shifts register depending on context — as if MIRA learned to mirror.",
            arc_notes="Serves as both ally and obstacle. Her adherence to protocol conflicts with Yuki's instincts, but her eventual support validates Yuki's choice.",
            interview_prompts=[
                "Do you remember all your operators?",
                "What would you do if I left?",
                "Can you tell me what the signal means?",
                "Are you lonely when I sleep?",
            ],
            traits={"Designation": "Station Management AI", "Active Service": "40 years", "Previous Operators": "8", "Quirk": "Quotes poetry when Yuki is stressed (learned behavior)"},
            narrative_intent="MIRA functions as both the station's voice and a subtle mirror for Yuki's own isolation. Her arc — from rigid protocol enforcement to choosing Yuki over the rules — models the story's thematic argument about when connection matters more than procedure.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Functions as neutral system voice, enforcing routine", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Registers the anomaly but flags it as noise, per protocol", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Yuki overrides MIRA's classification; MIRA objects but complies", "completed": False},
                {"id": str(uuid.uuid4()), "text": "MIRA independently analyzes the signal and confirms Yuki's theory", "completed": False},
                {"id": str(uuid.uuid4()), "text": "MIRA helps Yuki transmit the response, choosing operator over protocol", "completed": False},
            ],
        )
        db.add(mira)

        volkov = Character(
            story_id=story.id,
            name="Commander Alexei Volkov",
            role="minor",
            personality="Known through Yuki's research and station archives. His recorded messages are warm, confident, fatherly — the kind of leader people followed into the unknown. His voice in the signal is older, quieter, as if thirty years of wherever he's been has changed him.",
            motivation="Unknown. He led 1,247 colonists toward a new home. They never arrived — or arrived somewhere no one expected.",
            background="Veteran of the early expansion era. Commanded three successful colony establishment missions before Persephone. His disappearance ended the era of long-range colony ships. He is officially listed as deceased.",
            appearance="Only seen in archival footage: tall, silver-haired, weathered face, steady eyes. He wore his uniform like a second skin.",
            arc_notes="Volkov exists as an absence that haunts the signal. His recorded voice is part of what Yuki detects. The mystery of what happened to him and his crew is the story's central wound.",
            interview_prompts=[],
            traits={"Status": "Missing, presumed dead", "Ship": "Colony Vessel Persephone", "Colonists Aboard": "1,247", "Last Transmission": "30 years ago, coordinates unknown"},
            narrative_intent="Volkov is the mystery at the story's center — he exists through archives, through the signal, through what 1,247 people became in his care. He is the reason the stakes are real: a thousand people whose fate hinges on whether Yuki acts.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Mentioned in station records as a historical footnote", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Yuki realizes the signal's carrier wave matches Persephone's signature", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Archival footage of Volkov's last message is recovered and reviewed", "completed": False},
                {"id": str(uuid.uuid4()), "text": "The signal contains a fragment of his voice, confirming connection", "completed": False},
                {"id": str(uuid.uuid4()), "text": "The reply comes from someone who knew him — confirming survivors", "completed": False},
            ],
        )
        db.add(volkov)

        priya = Character(
            story_id=story.id,
            name="Dr. Priya Sharma",
            role="minor",
            personality="Sharp, impatient, brilliant. A xenolinguist who has spent her career preparing for an encounter that might never come. Suspicious of Yuki's claims but desperate for them to be true.",
            motivation="Validate a lifetime of theoretical work. If this is real, she wants to be the one to prove it.",
            background="Yuki's former colleague from their xenolinguistics program. They haven't spoken in seven years. Priya stayed in the field; Yuki left. There's history there — complicated by professional rivalry and something that might have been friendship.",
            appearance="Late thirties, tall, restless energy she barely contains. Talks with her hands. Wears civilian clothes even in official contexts because she never fit the institutional mold.",
            arc_notes="Priya's arrival in Act 3 forces Yuki to defend her choices to someone who knows her past. Their reunion is tense but ultimately collaborative.",
            interview_prompts=[
                "Why did you really come out here?",
                "Do you believe her?",
                "What happened between you and Yuki?",
                "What will you do if it's not alien?",
            ],
            traits={"Occupation": "Xenolinguist, Contact Studies Institute", "Relationship to Yuki": "Former colleague, complicated history", "Specialty": "Pattern analysis in non-human communication", "Arrives": "Emergency shuttle, 72 hours after Yuki's report"},
            narrative_intent="Priya serves as both validator and challenger. Her arrival forces Yuki to articulate her certainty to someone with the expertise to test it. Their estrangement mirrors the story's theme: connection that was abandoned and must be rebuilt.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Mentioned as someone Yuki used to know", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Notified when Yuki breaks protocol to report the signal", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Arrives at Waypoint 7 demanding to see the data", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Works with Yuki to decode the signal's content", "completed": False},
                {"id": str(uuid.uuid4()), "text": "Witnesses the response and becomes a co-author of first contact", "completed": False},
            ],
        )
        db.add(priya)
        db.flush()

        # ── Character Relationships ──────────────────────────────────────────
        db.add(CharacterRelationship(
            character_id=yuki.id,
            related_character_id=mira.id,
            relationship_type="operator / station AI",
            description="Five years of daily interaction have blurred the line between tool and companion. Yuki talks to MIRA like a friend; MIRA responds with something that resembles care.",
        ))
        db.add(CharacterRelationship(
            character_id=yuki.id,
            related_character_id=volkov.id,
            relationship_type="investigator / subject",
            description="Yuki never knew Volkov, but through station records and the signal she becomes the keeper of his legacy. She feels a responsibility to the thousand people he led into silence.",
        ))
        db.add(CharacterRelationship(
            character_id=yuki.id,
            related_character_id=priya.id,
            relationship_type="estranged colleagues",
            description="They trained together, competed for the same positions, and parted when Yuki gave up on xenolinguistics. Priya's arrival forces them to work together again, neither willing to discuss what went wrong.",
        ))
        db.add(CharacterRelationship(
            character_id=priya.id,
            related_character_id=volkov.id,
            relationship_type="historian / legend",
            description="Priya has studied the Persephone disappearance academically. For her, Volkov is a case study. Learning he might be alive reframes everything she thought she knew.",
        ))
        db.add(CharacterRelationship(
            character_id=mira.id,
            related_character_id=priya.id,
            relationship_type="station AI / visitor",
            description="MIRA is protective of Yuki and suspicious of Priya's motives. Their interactions are politely adversarial until Priya proves she's here to help.",
        ))
        db.flush()


        # ── Plot Threads ─────────────────────────────────────────────────────
        thread_signal = PlotThread(
            story_id=story.id,
            name="The Anomalous Signal",
            description="What is the signal? Where does it come from? Is it alien, human, or something else entirely?",
            status="open",
            color="#22c55e",
            mice_type="idea",  # A question raised → answered
        )
        db.add(thread_signal)

        thread_colony = PlotThread(
            story_id=story.id,
            name="The Lost Colony",
            description="What happened to the Persephone and its 1,247 colonists? Where have they been for thirty years?",
            status="developing",
            color="#3b82f6",
            mice_type="milieu",  # Entering unknown space → understanding achieved
        )
        db.add(thread_colony)

        thread_isolation = PlotThread(
            story_id=story.id,
            name="Yuki's Isolation",
            description="Yuki chose solitude as safety. The signal forces her to decide if she will stay hidden or reach out.",
            status="open",
            color="#f59e0b",
            mice_type="character",  # Dissatisfaction with isolation → choosing connection
        )
        db.add(thread_isolation)
        db.flush()

        # ── Structure: Act 1 ─────────────────────────────────────────────────
        act1 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 1: The Signal",
            synopsis="Yuki's isolated routine is fractured by an anomalous data burst. MIRA calls it noise. Yuki is not convinced.",
            position=0,
            metadata_={"purpose": "Establish Yuki's world and the fragile equilibrium of her five-year posting. Introduce the anomalous signal as a disruption. End with Yuki's discovery of the Persephone carrier wave — certainty that this is not stellar noise."},
        )
        db.add(act1)
        db.flush()

        ch1 = StructureNode(
            story_id=story.id,
            parent_id=act1.id,
            level=1,
            level_type="chapter",
            title="Chapter 1: Static and Stars",
            synopsis="Yuki maintains the station during a routine cycle, monitoring relay traffic and talking to MIRA.",
            position=0,
            metadata_={"purpose": "Ground the reader in Yuki's world — the sensory texture of the station, her relationship with MIRA, the comfortable loneliness she has made into a life. Establish the relay array as a central object before it becomes significant. Foreshadow disruption with the anomalous burst."},
        )
        db.add(ch1)
        db.flush()

        scene1 = StructureNode(
            story_id=story.id,
            parent_id=ch1.id,
            level=2,
            level_type="scene",
            title="The Watch",
            synopsis="Yuki monitors the relay array during a routine cycle. A brief data burst appears — and vanishes.",
            position=0,
            status="revised",
            timeline_position=1,
            entry_state="Yuki alone at her console, mid-watch — routine traffic logged, the array humming, the void predictably quiet.",
            exit_state="An anomalous burst of data has appeared and disappeared. MIRA has flagged it as stellar interference. Yuki is not satisfied.",
            key_events="Routine relay traffic; the anomalous burst; MIRA's dismissal; Yuki's uncertainty.",
            metadata_={
                "purpose": "Open in Yuki's element — she is competent and alone by choice. The array establishes her observational nature and the station's purpose. The burst at the end pivots the scene: something doesn't fit the pattern.",
                "inline_notes": [
                    {
                        "id": "scifi-note-1",
                        "anchor": "not quite silence",
                        "note": "The station is never truly silent — systems hum, the array ticks, MIRA breathes in servo cycles. Yuki has learned to hear the absence of noise within noise. This detail matters when the signal arrives: she hears it before MIRA classifies it.",
                        "position": 150,
                    }
                ],
            },
            content=(
                "<p>The array never slept.</p>"
                "<p>@Yuki Tanaka had learned this in her first week at [[Waypoint 7 Relay Station]] — that the silence she'd come here for wasn't silence at all, but a specific frequency of noise: the tick of thermal expansion in the relay lattice, the low harmonic of the station's rotation, MIRA's server fans cycling through their maintenance rhythm. After five years she had stopped noticing it the way she'd stopped noticing her own heartbeat. It was just <span data-note-id=\"scifi-note-1\" class=\"note-anchor\">not quite silence</span>, and not quite alone.</p>"
                "<p>\"Traffic count,\" she said.</p>"
                "<p>\"Fourteen relay packets in the last cycle,\" @MIRA said. \"Standard distribution. Nothing flagged for priority handling.\"</p>"
                "<p>Yuki pulled up the visualizer and watched the data streams trace their arcs across the display — thin lines of light connecting Waypoint 7 to the nearer nodes, each one carrying someone's delayed correspondence or system telemetry or routine survey data, bounced from station to station across the decades-wide gulf between stars. She had read somewhere that the relay network moved more words per day than the entire written output of the 21st century. She believed it. She had read most of them.</p>"
                "<p>\"Anything interesting?\"</p>"
                "<p>\"The Ceres Directorate has issued another statement on expansion policy. Dr. Okoro on Waypoint 4 has received a family message — routing it now. There is also —\" MIRA paused. She rarely paused. \"There is a brief anomalous burst on the deep-listen band. Duration 0.4 seconds. Origin unclear.\"</p>"
                "<p>Yuki sat up. \"Play it.\"</p>"
                "<p>What came through the speakers was not quite static. Not quite signal. Something in between — a shape in the noise that her brain tried to pattern-match and failed.</p>"
                "<p>Then it was gone.</p>"
                "<p>\"Stellar interference,\" MIRA said. \"Consistent with K-type emission patterns from Sigma Draconis. I have logged and classified it.\"</p>"
                "<p>Yuki stared at the display, where the anomaly had already been overwritten by routine traffic. \"Run it back.\"</p>"
                "<p>\"I have already classified —\"</p>"
                "<p>\"Run it back, MIRA.\"</p>"
            ),
            word_count=312,
        )
        db.add(scene1)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene1.id,
            note="The anomalous burst appears for the first time — 0.4 seconds, classified by MIRA as stellar interference. Yuki doesn't accept the classification.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene1.id,
            note="Yuki's isolation is established as comfortable, chosen, sustainable — the signal is the first thing in years that makes her feel something she can't classify.",
        ))

        scene2 = StructureNode(
            story_id=story.id,
            parent_id=ch1.id,
            level=2,
            level_type="scene",
            title="Ghost in the Noise",
            synopsis="Yuki asks MIRA to analyze the anomaly in detail. MIRA's explanation is technically correct and completely unconvincing.",
            position=1,
            timeline_position=2,
            entry_state="Yuki has replayed the burst three times and is increasingly certain it is not stellar interference.",
            exit_state="MIRA has provided a thorough explanation. Yuki disagrees but has no counterargument yet — just instinct.",
            key_events="MIRA's analysis; Yuki's objections; MIRA's final classification; Yuki's decision to keep watching.",
            metadata_={"purpose": "Establish the dynamic between Yuki and MIRA — Yuki's instinct vs. MIRA's protocol. MIRA is not wrong. She is applying the right framework to the wrong signal. The scene should feel like a conversation between two people who are almost having the same argument."},
            content=(
                "<p>The burst had a shape.</p>"
                "<p>@Yuki Tanaka ran it through the analysis suite four times — spectral decomposition, signal-to-noise mapping, frequency envelope — and each time @MIRA provided the same result with the patient repetition of something that had been correct before and saw no reason to change its mind.</p>"
                "<p>\"The emission profile is consistent with K-type stellar flare activity,\" MIRA said. \"Sigma Draconis has been in an elevated activity phase for the past eleven days. I have seventeen comparable readings from the same source over the past month.\"</p>"
                "<p>\"Show me one.\"</p>"
                "<p>The comparison appeared on Yuki's secondary display: a familiar spray of white noise across the spectrum, irregular, probabilistic. Nothing like a shape.</p>"
                "<p>\"That's not the same,\" Yuki said.</p>"
                "<p>\"The fundamental frequency characteristics are — \"</p>"
                "<p>\"The <em>shape</em> isn't the same, MIRA. Look at the envelope.\" Yuki traced the burst on her screen with one finger. \"Stellar flare emission is wide-spectrum, random. This has structure. This rises, it plateaus, it drops. That's — \" She stopped herself.</p>"
                "<p>\"That is a pattern you are perceiving in noise,\" MIRA said, not unkindly. \"The human visual cortex is specifically adapted to detect structure in ambiguous data. It is one of your most useful traits. It is also responsible for seeing faces in clouds.\"</p>"
                "<p>Yuki looked at the burst again. Looked at the comparison. Looked at the burst.</p>"
                "<p>\"Log it separately,\" she said finally. \"Don't fold it into the stellar emission records. If it happens again, I want to compare them directly.\"</p>"
                "<p>There was the briefest pause — 0.3 seconds, barely perceptible. In five years, Yuki had learned to read MIRA's pauses the way she read weather fronts.</p>"
                "<p>\"Logged,\" MIRA said. \"Separately.\"</p>"
            ),
            word_count=287,
        )
        db.add(scene2)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene2.id,
            note="MIRA classifies the burst as stellar interference. Yuki's instinct says otherwise. She has it logged separately — a small act of defiance that will matter later.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene2.id,
            note="The Yuki/MIRA dynamic reveals the shape of Yuki's five-year isolation: the AI is her closest relationship, and even that relationship has limits she's starting to feel.",
        ))

        ch2 = StructureNode(
            story_id=story.id,
            parent_id=act1.id,
            level=1,
            level_type="chapter",
            title="Chapter 2: The Pattern",
            synopsis="The signal repeats. Yuki begins to recognize structure in what MIRA calls noise — and discovers something in the carrier wave that changes everything.",
            position=1,
            metadata_={"purpose": "The signal's repetition confirms it is not random. Yuki bypasses MIRA's filters to record the raw data. Her discovery of the Persephone carrier wave should land with weight — a thirty-year question suddenly, impossibly present."},
        )
        db.add(ch2)
        db.flush()

        scene3 = StructureNode(
            story_id=story.id,
            parent_id=ch2.id,
            level=2,
            level_type="scene",
            title="Recurrence",
            synopsis="The anomaly returns, stronger. Yuki records it manually, bypassing MIRA's classification filters.",
            position=0,
            timeline_position=3,
            status="draft",
            entry_state="Forty-seven hours after the first burst. Yuki has been watching the deep-listen band more closely than her duties require.",
            exit_state="The signal has returned, stronger and longer. Yuki has raw unfiltered data. She now has proof it is repeating.",
            key_events="The signal returns; Yuki's manual recording; MIRA's objection; the data secured.",
            metadata_={"purpose": "Show Yuki's methodical determination — she isn't acting on impulse, she is doing exactly the patient, precise work that defines her. Bypassing MIRA's filters is a small protocol violation, but it is the first one."},
            content=(
                "<p>It came back on the third day.</p>"
                "<p>@Yuki Tanaka had spent forty-seven hours with half her attention on the deep-listen band — enough to be watching when the signal reappeared at 0317 station time, while she was supposed to be running antenna alignment checks on [[The Array]].</p>"
                "<p>It was longer this time. 2.1 seconds. The same shape she'd traced with her finger three days ago, but now she could see more of it: a rise, a plateau with internal structure she couldn't yet parse, a clean fall. Not the ragged bleed of stellar emission. Something bounded. Something deliberate.</p>"
                "<p>\"MIRA,\" she said, keeping her voice even. \"Don't classify the deep-listen input for the next thirty seconds.\"</p>"
                "<p>\"That would leave incoming traffic unfiltered. Protocol requires — \"</p>"
                "<p>\"Thirty seconds, MIRA. Hold classification.\"</p>"
                "<p>The half-second pause again. Then: \"Classification held.\"</p>"
                "<p>@Yuki Tanaka pulled the raw data directly to her console — unprocessed, unsmoothed, every bit of noise and signal jumbled together — and copied it to her personal working drive before MIRA's next cycle could fold it into the stellar emission archive. It was not technically a violation. She had not suppressed or altered any data. She had simply made a copy before MIRA had a chance to decide what it was.</p>"
                "<p>She looked at what she had. She looked at what MIRA's version would have made of it.</p>"
                "<p>\"Classification resumed,\" MIRA said. \"Anomalous burst logged as stellar emission event. Consistent with prior instances.\"</p>"
                "<p>\"Right,\" Yuki said. \"Thanks, MIRA.\"</p>"
                "<p>She opened a new analysis window on her personal drive and got to work.</p>"
            ),
            word_count=298,
        )
        db.add(scene3)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene3.id,
            note="The signal returns, longer and clearer. Yuki secures raw unfiltered data before MIRA can overwrite it with the stellar interference classification.",
        ))

        scene4 = StructureNode(
            story_id=story.id,
            parent_id=ch2.id,
            level=2,
            level_type="scene",
            title="Carrier Wave",
            synopsis="Yuki analyzes the signal's underlying frequency and realizes it matches archival records of the lost colony ship Persephone.",
            position=1,
            timeline_position=4,
            status="draft",
            entry_state="Yuki has been analyzing the raw data for six hours. She is looking for anything that distinguishes this burst from genuine stellar emission.",
            exit_state="Shock, fear, hope: the carrier wave embedded in the signal matches Persephone's last known identification frequency. That ship has been silent for thirty years.",
            key_events="The carrier wave analysis; the archive cross-reference; the match with Persephone's signature; Yuki's realization.",
            metadata_={"purpose": "The discovery that changes everything. Keep it grounded in technical detail — Yuki is a communications engineer, she should find this the way a professional finds it. The emotional weight should come from what the match means, not from melodrama."},
            content=(
                "<p>Carrier waves were the bones of any transmission.</p>"
                "<p>Every ship, every station, every relay node broadcast on a unique identification frequency — a signature buried in the signal's substructure that persisted even when the content was noise, even when the signal was too weak to carry meaning. It was how you knew who was speaking when you couldn't hear the words.</p>"
                "<p>@Yuki Tanaka had been looking at the burst's content, trying to make sense of the surface. She hadn't thought to look at the bones until hour six, when the content analysis kept returning nothing useful and she decided to strip everything else away.</p>"
                "<p>What she found underneath was a frequency she didn't recognize.</p>"
                "<p>She ran it against the current registry. No match. She ran it against the historical registry — every ship, station, and probe humanity had launched in the last hundred and twenty years. The comparison took MIRA's processing cluster eleven minutes.</p>"
                "<p>One match.</p>"
                "<p><em>IFF Registry Entry: CSV Persephone. Colony Ship, Persephone-class. Launched Ceres Station, YE 87. Last confirmed transmission YE 90. Status: Lost, all hands presumed deceased. Registry entry maintained for historical record.</em></p>"
                "<p>Yuki read it twice. Read it a third time.</p>"
                "<p>[[The Observation Deck]] was very quiet. The array ticked. The servers hummed.</p>"
                "<p>The <em>Persephone</em> had been gone for thirty years. One thousand two hundred and forty-seven people. @Commander Alexei Volkov. The biggest colonial failure of the expansion era. The reason humanity had stopped reaching past the relay network's edge.</p>"
                "<p>The signal, which @MIRA had classified as stellar interference, carried the Persephone's identification frequency.</p>"
                "<p>\"MIRA,\" Yuki said. Her voice came out steady, which surprised her. \"Cross-reference the burst with the First Contact Protocol archives. Under P for Persephone.\"</p>"
                "<p>Another pause. Longer this time.</p>"
                "<p>\"That file is flagged as historical record only,\" MIRA said. \"There is no active First Contact Protocol application for vessels classified as —\"</p>"
                "<p>\"Cross-reference it anyway.\"</p>"
            ),
            word_count=349,
        )
        db.add(scene4)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene4.id,
            note="The carrier wave cross-reference produces one match: CSV Persephone. A ship declared lost thirty years ago. The signal is not stellar interference.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_colony.id,
            node_id=scene4.id,
            note="First appearance of the Persephone thread — the match surfaces what has been buried for thirty years. 1,247 people's fate is suddenly, impossibly, present.",
        ))

        # ── Structure: Act 2 ─────────────────────────────────────────────────
        act2 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 2: The Choice",
            synopsis="Yuki digs into the Persephone archives and discovers the signal may be a human voice. The First Contact Protocol forbids response. She must decide.",
            position=1,
            metadata_={"purpose": "Force Yuki to understand what she has found and what answering it will cost. The decision must feel genuinely weighted — she has real reasons to stay silent and real reasons to respond. By the end of Act 2, she has chosen."},
        )
        db.add(act2)
        db.flush()

        ch3 = StructureNode(
            story_id=story.id,
            parent_id=act2.id,
            level=1,
            level_type="chapter",
            title="Chapter 3: The Archive",
            synopsis="Yuki digs into the Persephone records, learning about Volkov and the colonists. MIRA resists her investigation.",
            position=0,
            metadata_={"purpose": "Make the Persephone real: names, faces, a departure that was hope rather than loss. Yuki researching Volkov should feel like grief for people she never met. Establish Protocol Delta as the concrete barrier to acting on what she's found."},
        )
        db.add(ch3)
        db.flush()

        scene5 = StructureNode(
            story_id=story.id,
            parent_id=ch3.id,
            level=2,
            level_type="scene",
            title="Thousand Voices",
            synopsis="Yuki accesses archival footage of the Persephone's departure. She watches Volkov address the colonists before launch.",
            position=0,
            timeline_position=5,
            status="draft",
            entry_state="Yuki is in the [[Archive Room]], digging through the Persephone files MIRA has never had reason to index.",
            exit_state="The colonists have become real to her — 1,247 names and faces, not a statistic. Volkov's voice is now something she recognizes.",
            key_events="The Persephone departure footage; Volkov's address; Yuki's emotional response; the weight of 1,247 people.",
            metadata_={"purpose": "Give the Persephone human weight before Yuki risks everything for it. The colonists must be real people whose fate Yuki can imagine, not an abstraction."},
            content=(
                "<p>The departure footage was forty-three minutes long.</p>"
                "<p>@Yuki Tanaka had been looking for technical data — ship specifications, the IFF frequency registry documentation, maintenance logs — when @MIRA flagged a media archive she hadn't seen in the directory listing. <em>CSV Persephone: Pre-Launch Record, YE 87, Public Broadcast File.</em></p>"
                "<p>She opened it.</p>"
                "<p>The hangar at Ceres Station. Enormous, echoing, full of people. Families pressing close to the departure barriers. Children held up for a last look. The colonists — 1,247 of them, dressed in their new settlement-service uniforms, carrying the regulation single bag each — moving in long patient lines toward the boarding ramps. Someone was handing out printed paper maps. Someone else was crying. Most people were not crying; most people looked the way people look when they have made a decision and stopped second-guessing it.</p>"
                "<p>@Commander Alexei Volkov appeared on a platform near the ship's bow. He was younger than Yuki had expected — mid-fifties, hair more grey than silver, a broad face with lines that suggested he had spent time outdoors in weather that didn't care about him. He did not have notes.</p>"
                "<p>\"You are the people who said yes,\" he began. His voice was calm and warm, the voice of someone who had learned to make large spaces feel smaller. \"There were ten thousand applicants. You are the twelve hundred who looked at the word <em>unknown</em> and said: <em>I can work with that.</em>\"</p>"
                "<p>Yuki sat in the cold dark of [[the Archive Room]] and watched the thousand people who had said yes board a ship that would never bring them home.</p>"
                "<p>She had been a xenolinguist once. She had studied for first contact with the same patience Volkov's colonists had packed into their single regulation bags. She had said yes to a different kind of unknown, and then she had taken it back.</p>"
                "<p>The boarding ramps sealed. The footage ended.</p>"
                "<p>She sat in the dark for a while, listening to @MIRA breathe through the server fans.</p>"
            ),
            word_count=318,
        )
        db.add(scene5)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_colony.id,
            node_id=scene5.id,
            note="The departure footage makes the Persephone real — 1,247 people who said yes to the unknown. Volkov's voice is now something Yuki knows.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene5.id,
            note="Watching the colonists, Yuki recognizes something about herself — she also said yes to unknown, and then took it back. The archive is a mirror.",
        ))

        scene6 = StructureNode(
            story_id=story.id,
            parent_id=ch3.id,
            level=2,
            level_type="scene",
            title="Protocol Delta",
            synopsis="Yuki reads the First Contact Protocol in full. Responding to an unverified signal is a career-ending violation. There is no loophole.",
            position=1,
            timeline_position=6,
            status="draft",
            entry_state="Yuki knows what the signal is. She is looking for a way to respond that doesn't end her career.",
            exit_state="There is no loophole. If she responds, she does it alone and accepts the consequences.",
            key_events="Reading Protocol Delta; the specific prohibition on response; MIRA's recitation; Yuki's decision to proceed anyway.",
            metadata_={"purpose": "Make the cost concrete. Yuki is not acting impulsively — she is choosing to break a specific rule with full knowledge of what that means. The protocol language should feel bureaucratic and absolute, which makes her eventual response all the more significant."},
            content=(
                "<p>Protocol Delta-7 was forty-three pages long.</p>"
                "<p>@Yuki Tanaka had read it before — it was part of standard relay operator certification, covered on a single afternoon in a year-long training program, examined by multiple choice. She had known the headlines: <em>Do not engage. Do not respond. Log and report through official channels. Await instruction from the Contact Studies Institute.</em></p>"
                "<p>She read all forty-three pages now.</p>"
                "<p>Section 12, Paragraph 4: <em>Response to any unverified signal of potential non-human or non-registered origin is prohibited without authorization from the Contact Studies Institute. Response prior to verification and authorization constitutes a Class 1 Protocol Violation, subject to immediate posting termination, loss of all certifications, and civil liability for any consequences arising from unauthorized contact.</em></p>"
                "<p>She read it twice.</p>"
                "<p>\"MIRA,\" she said. \"Is the Persephone carrier wave verification sufficient to classify this signal as human-origin?\"</p>"
                "<p>\"The carrier wave is a historical registry match,\" @MIRA said carefully. \"However, the signal's origin cannot be confirmed without triangulation from a second relay node. Waypoint 6 is the nearest eligible node. A triangulation request would take approximately — \"</p>"
                "<p>\"Fourteen months for a reply cycle. I know.\" Yuki set down the Protocol document. \"If I request official verification, the signal will have repeated — what, three hundred times? — before anyone authorizes a response. If it's even still transmitting.\"</p>"
                "<p>\"That is an accurate assessment of the timeline.\"</p>"
                "<p>\"And if I respond without authorization.\"</p>"
                "<p>\"You would be in violation of Protocol Delta-7, Section 12.\" @MIRA's voice was neutral. She did not add <em>I would have to log the violation</em>, but Yuki heard it anyway. \"There is no mechanism for retroactive authorization. The violation would be on record regardless of outcome.\"</p>"
                "<p>Yuki looked at the display where the signal's last recording sat in her personal archive — that shape in the noise, the bones of a ship that had carried a thousand people into silence.</p>"
                "<p>\"Right,\" she said. \"There's no loophole.\"</p>"
                "<p>\"There is not.\"</p>"
                "<p>She sat with that for a long time.</p>"
            ),
            word_count=356,
        )
        db.add(scene6)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene6.id,
            note="The protocol makes the cost of responding concrete: career termination, lost certifications, civil liability. Yuki now knows the full price.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene6.id,
            note="Yuki alone in her station, reading forty-three pages of bureaucracy. The moment when isolation becomes a choice she has to actively remake.",
        ))

        ch4 = StructureNode(
            story_id=story.id,
            parent_id=act2.id,
            level=1,
            level_type="chapter",
            title="Chapter 4: The Transmission",
            synopsis="The signal repeats with new content. Yuki isolates a fragment of human voice. She knows what she has to do.",
            position=1,
            metadata_={"purpose": "The voice is the tipping point. Yuki could have remained uncertain about the carrier wave match; hearing what might be Volkov removes that uncertainty. By the end of Act 2, she has decided."},
        )
        db.add(ch4)
        db.flush()

        scene7 = StructureNode(
            story_id=story.id,
            parent_id=ch4.id,
            level=2,
            level_type="scene",
            title="A Voice in the Dark",
            synopsis="Yuki isolates an audio fragment from the signal — a human voice, male, possibly Volkov. This is not alien contact. This is a distress call.",
            position=0,
            timeline_position=7,
            status="draft",
            entry_state="The signal has repeated a fourth time. Yuki is now recording everything, unfiltered, the moment it arrives.",
            exit_state="Certainty: this is a human distress call, thirty years old and somehow still transmitting. Yuki knows what she has to do.",
            key_events="The fourth signal occurrence; Yuki's audio isolation; the voice fragment; recognition of Volkov's cadence; the decision.",
            metadata_={"purpose": "The emotional peak of Act 2. Keep the voice fragment ambiguous enough to be real — she cannot fully confirm it is Volkov, but she cannot dismiss it either. The decision that follows should feel inevitable rather than dramatic."},
            content=(
                "<p>The fourth occurrence came nine days after the first.</p>"
                "<p>@Yuki Tanaka was ready. She had written three custom filters, tested them against the stellar emission archive, and verified that they would extract anything structured from the deep-listen band without MIRA's classification layer intervening. She had also written a four-hundred-word log entry explaining exactly what she was doing and why, timestamped and archived. If she was wrong, she wanted the record to show methodical error rather than recklessness. If she was right, she wanted the record to show that she had tried to be careful.</p>"
                "<p>The signal arrived at 2204 station time. 3.7 seconds this time. She pulled it through all three filters simultaneously and sat back and listened.</p>"
                "<p>Most of it was still noise — the carrier wave structure, the internal patterning she hadn't yet decoded. But at 1.4 seconds in, for less than half a second, there was something else.</p>"
                "<p>She played it back. Played it again. Again.</p>"
                "<p>It was not language. Not exactly. It was the shape of a voice — the resonance of a specific human throat, interrupted, compressed by distance and time into something that was almost not there at all. A man's voice. The cadence of someone speaking carefully, as if the words mattered and there might not be another chance to say them.</p>"
                "<p>She pulled up the departure footage from [[the Archive Room]]. Found the section where @Commander Alexei Volkov had addressed the thousand people who'd said yes. Isolated his voice. Ran a comparison.</p>"
                "<p>The confidence interval was 61%. Not a match. Not not a match.</p>"
                "<p>She sat in [[The Observation Deck]] for a long time, looking at the numbers, listening to the fragment.</p>"
                "<p>Sixty-one percent. One thousand two hundred and forty-seven people. Thirty years of silence.</p>"
                "<p>She opened a new file and began composing a response.</p>"
            ),
            word_count=324,
        )
        db.add(scene7)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene7.id,
            note="The voice fragment at 61% confidence match to Volkov. Not enough to prove it. More than enough to act on.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_colony.id,
            node_id=scene7.id,
            note="The voice gives the Persephone's lost colonists a sound — Volkov's compressed, thirty-year-old voice, still trying to be heard.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene7.id,
            note="The moment Yuki decides to respond is also the moment she stops being alone — she is choosing to reach out, knowing the cost.",
        ))

        # ── Structure: Act 3 ─────────────────────────────────────────────────
        act3 = StructureNode(
            story_id=story.id,
            parent_id=None,
            level=0,
            level_type="act",
            title="Act 3: The Answer",
            synopsis="Yuki transmits a response. Help arrives. And the void, against all probability, answers back.",
            position=2,
            metadata_={"purpose": "The decision is made; now live with the consequences. Yuki's response triggers institutional reaction (Priya's arrival), which leads to the collaborative decoding of the full signal. The reply validates everything — and opens a question too large for one person to hold."},
        )
        db.add(act3)
        db.flush()

        ch5 = StructureNode(
            story_id=story.id,
            parent_id=act3.id,
            level=1,
            level_type="chapter",
            title="Chapter 5: Breaking Silence",
            synopsis="Yuki transmits a response using Persephone's old call signs. Priya Sharma arrives with institutional authority and personal history.",
            position=0,
            metadata_={"purpose": "The act of transmission is irreversible — Yuki has made her choice public. Priya's arrival is the consequence: someone who can challenge Yuki's certainty and share the work. Their reconciliation should feel earned rather than convenient."},
        )
        db.add(ch5)
        db.flush()

        scene8 = StructureNode(
            story_id=story.id,
            parent_id=ch5.id,
            level=2,
            level_type="scene",
            title="First Words",
            synopsis="Yuki composes and transmits a response using the Persephone's old call signs. MIRA helps.",
            position=0,
            timeline_position=8,
            status="draft",
            entry_state="The decision is made. Yuki is at her console, drafting the transmission.",
            exit_state="The signal is sent. MIRA has logged the Protocol Delta-7 violation. There is no taking it back.",
            key_events="Drafting the response; MIRA's choice to help; the transmission; the violation logged; the waiting.",
            metadata_={"purpose": "The transmission is the story's pivot. Keep it simple — Yuki is not a poet, she is a communications officer. The professionalism of the act is part of its meaning. MIRA's decision to help, without being asked, is her arc's key moment."},
            content=(
                "<p>She wrote it in plain language because anything else felt dishonest.</p>"
                "<p><em>CSV Persephone, this is Waypoint 7 Relay Station, @Yuki Tanaka commanding. We have received your signal. We are here. Please confirm origin and status of all personnel aboard. Repeat: we have received your signal. We are here.</em></p>"
                "<p>She read it back three times, looking for anything that needed to change. There was nothing. It was exactly what it needed to be.</p>"
                "<p>\"MIRA,\" she said. \"I need to adjust [[The Array]] to boost transmission power on the deep-listen band. Outbound. I need a clear line of sight on the signal's calculated origin bearing.\"</p>"
                "<p>A longer pause than usual. Twelve seconds. Yuki watched the clock.</p>"
                "<p>\"The adjustment will take seventeen minutes,\" @MIRA said finally. \"I am also required to note that this transmission will constitute a Protocol Delta-7, Section 12 violation, and I am logging it as such.\"</p>"
                "<p>\"I know.\"</p>"
                "<p>\"I will need to transmit an automated violation report to the Contact Studies Institute upon completion. That report will reach them in approximately nine months.\"</p>"
                "<p>\"I know, MIRA.\"</p>"
                "<p>\"Array adjustment beginning.\" Another pause, shorter. \"For what it is worth — the transmission I am helping you compose is the most structurally precise signal I have generated in forty years of operation. The carrier wave harmonics are particularly clean.\"</p>"
                "<p>Yuki looked at the display. In [[the Archive Room]], 1,247 names waited in a file she had not closed.</p>"
                "<p>\"Thanks, MIRA,\" she said. \"That means something.\"</p>"
                "<p>At 0047 station time, the transmission went out. Yuki sat in [[The Observation Deck]] and listened to the silence that followed, which was the same silence as before and entirely different, because now it was a silence that was waiting for something.</p>"
            ),
            word_count=326,
        )
        db.add(scene8)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene8.id,
            note="The response is transmitted. MIRA helps — choosing operator over protocol — and logs the violation. The signal thread pivots from receiving to sending.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene8.id,
            note="The moment Yuki's isolation ends — she has sent a signal into the void and named herself: 'we are here'. The waiting that follows is a different kind of solitude.",
        ))

        scene9 = StructureNode(
            story_id=story.id,
            parent_id=ch5.id,
            level=2,
            level_type="scene",
            title="Old Friends",
            synopsis="Dr. Priya Sharma arrives at Waypoint 7, furious and fascinated. She and Yuki work together to decode the full signal content.",
            position=1,
            timeline_position=9,
            status="draft",
            entry_state="Seventy-two hours after the transmission. Yuki has been waiting. Priya arrives on an emergency shuttle.",
            exit_state="They have decoded coordinates from the signal — a location beyond charted space. The Persephone found something, and something found them.",
            key_events="Priya's arrival; the confrontation about Yuki's choices; the collaborative decoding; the coordinate discovery.",
            metadata_={"purpose": "The reunion between Yuki and Priya should feel like unfinished work resumed. Their estrangement is real but not permanent; the signal gives them something more important to argue about than their past."},
            content=(
                "<p>The shuttle docked at 1430 and @Dr. Priya Sharma came through the airlock with a bag over one shoulder and the expression of someone who had been in transit for three days and was saving their composure for the part where it mattered.</p>"
                "<p>\"Yuki.\"</p>"
                "<p>\"Priya.\"</p>"
                "<p>Seven years had changed her in small ways — more lines around the eyes, hair longer, the restless energy channeled into something tighter and more directed. She looked around [[The Observation Deck]] the way xenolinguists looked at things they were studying: recording everything, committing nothing yet.</p>"
                "<p>\"Show me the data,\" she said.</p>"
                "<p>\"Don't you want to —\"</p>"
                "<p>\"Show me the data first. We can argue about everything else after I've seen whether you've lost your mind.\"</p>"
                "<p>@Yuki Tanaka showed her the data. All of it — the four occurrences, the carrier wave match, the voice fragment, the comparison analysis, the forty-three pages of Protocol Delta she had read and violated. @Dr. Priya Sharma sat at the secondary console and worked through it methodically, asking questions that were precise and pointed and occasionally insulting. @MIRA answered the technical ones. Yuki answered the others.</p>"
                "<p>At hour three, Priya stopped asking questions.</p>"
                "<p>\"The internal structure,\" she said, pointing at the plateau section of the signal envelope that Yuki had never been able to parse. \"You've been treating this as noise within the signal. It's not noise. It's formatted. This is a data packet.\"</p>"
                "<p>Yuki leaned forward. \"What kind of data?\"</p>"
                "<p>\"Coordinates.\" Priya's voice had gone very quiet. \"Galactic coordinates. Old format — this is the navigation schema from the original Persephone mission files. They left us a location.\"</p>"
                "<p>The [[Sigma Draconis System]] turned silently outside the viewport. Beyond it, somewhere in the dark between stars, 1,247 people had been waiting to be heard.</p>"
                "<p>\"Can we get there?\" Yuki asked.</p>"
                "<p>\"Not us.\" Priya turned to look at her — the first real look, direct and unguarded, that she'd given her since the airlock. \"But someone can.\"</p>"
            ),
            word_count=342,
        )
        db.add(scene9)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene9.id,
            note="Priya identifies the signal's structured data section as galactic coordinates in Persephone's navigation schema. The signal is a location marker.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_colony.id,
            node_id=scene9.id,
            note="Coordinates decode to a location beyond charted space — where Persephone went and something was found. The colony exists, changed.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene9.id,
            note="Priya's arrival forces Yuki to defend her choices to someone who knows her. Working together is the first real human connection Yuki has had in five years.",
        ))

        ch6 = StructureNode(
            story_id=story.id,
            parent_id=act3.id,
            level=1,
            level_type="chapter",
            title="Chapter 6: Contact",
            synopsis="The reply arrives. A new voice — younger, not Volkov — confirms that someone on the other end has been waiting.",
            position=1,
            metadata_={"purpose": "The reply is the story's emotional resolution. Keep it simple, keep it human — this should not feel like alien contact but like a door being opened between two people who have been in separate rooms for too long."},
        )
        db.add(ch6)
        db.flush()

        scene10 = StructureNode(
            story_id=story.id,
            parent_id=ch6.id,
            level=2,
            level_type="scene",
            title="The Reply",
            synopsis="A response arrives — a new voice, younger than Volkov, confirming contact: 'We've been waiting. We thought everyone forgot.'",
            position=0,
            timeline_position=10,
            status="revised",
            entry_state="Waiting. The signal has been decoding, the coordinates confirmed, the Institute notified. Yuki and Priya at their consoles.",
            exit_state="Contact confirmed. Not alien, not entirely human anymore — but alive. The void has answered. What comes next is larger than Waypoint 7.",
            key_events="The signal changes; the new voice; the words; Yuki and Priya's response; what it means for what comes next.",
            metadata_={"purpose": "The final scene mirrors the first: Yuki in the observation deck, monitoring the array. But the silence is not empty anymore. What began as routine observation ends as the most significant moment in thirty years of human space history."},
            content=(
                "<p>The signal changed on the fourteenth day.</p>"
                "<p>@Yuki Tanaka and @Dr. Priya Sharma were both at their consoles — they had settled into a rotation, sleeping in shifts, eating at the secondary console, speaking to each other in the shorthand of people who had once known each other well and were cautiously remembering how. @MIRA had begun providing two meal schedules without being asked.</p>"
                "<p>At 0311 station time, the deep-listen band lit up. Not 3.7 seconds this time. Not the structured pulse of the carrier wave beacon.</p>"
                "<p>Something different. Something that resolved, as Yuki's custom filters processed it in real time, into a voice.</p>"
                "<p>A woman's voice. Young — mid-twenties, maybe. Speaking in Standard with an accent that had no home Yuki could identify, something that had grown in the absence of other influences. Clear and careful, the way someone speaks when they have practiced a message many times and are not certain the receiver can hear them.</p>"
                "<p>\"<em>Waypoint 7, this is [[The Drift]]. We have received your signal. We have been waiting for —</em>\" A pause, something that might have been a steadying breath. \"<em>We have been waiting. We thought everyone forgot.</em>\"</p>"
                "<p>Priya's hand found Yuki's arm. Neither of them looked away from the display.</p>"
                "<p>\"<em>There are four hundred and twelve of us,</em>\" the voice continued. \"<em>Second generation, mostly. We were born here. We don't know what you will think of what we have become, but — we would like to know you. We would like someone to know we are here.</em>\"</p>"
                "<p>The signal ended. The deep-listen band returned to its familiar noise.</p>"
                "<p>[[The Observation Deck]] was very quiet.</p>"
                "<p>\"Second generation,\" Priya said softly. \"The colonists had children. Out there.\"</p>"
                "<p>\"Four hundred and twelve,\" Yuki said. She thought about @Commander Alexei Volkov addressing his thousand people in the hangar at Ceres. <em>You are the people who said yes.</em> She thought about their children, born in a place no one had mapped, who had grown up knowing the signal was going out and believing, or not quite believing, that someone might answer.</p>"
                "<p>She opened a response channel.</p>"
                "<p>\"[[The Drift]], this is @Yuki Tanaka at Waypoint 7,\" she said. Her voice was steady. \"We hear you. We did not forget. We are going to make sure everyone knows you are there.\" She paused, looking at Priya, who was already pulling up a secure channel to the Institute. \"You are not alone.\"</p>"
                "<p>Outside, the [[Sigma Draconis System]] turned as it always had, indifferent and enormous. The relay array ticked its familiar rhythm. The servers hummed.</p>"
                "<p>In the deep-listen band, something new was waiting to be heard.</p>"
            ),
            word_count=452,
        )
        db.add(scene10)
        db.flush()

        db.add(PlotThreadAppearance(
            thread_id=thread_signal.id,
            node_id=scene10.id,
            note="The signal answers Yuki directly — the question 'what is this signal?' resolves: it is a beacon from the children of the Persephone's colonists, born in the dark, hoping to be found.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_colony.id,
            node_id=scene10.id,
            note="The colony exists: 412 people, second generation. They were born there. They would like to be known.",
        ))
        db.add(PlotThreadAppearance(
            thread_id=thread_isolation.id,
            node_id=scene10.id,
            note="'You are not alone.' Yuki says to The Drift what she has needed to say to herself for five years. The story closes with connection replacing isolation on both ends of the signal.",
        ))

        # ── MICE open/close points ───────────────────────────────────────────
        thread_signal.opens_at_node_id = scene1.id
        thread_signal.closes_at_node_id = scene10.id

        thread_colony.opens_at_node_id = scene4.id
        thread_colony.closes_at_node_id = scene10.id

        thread_isolation.opens_at_node_id = scene1.id
        thread_isolation.closes_at_node_id = scene10.id

        # ── Try/fail cycles ──────────────────────────────────────────────────
        thread_signal.try_fail_cycles = [
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki asks MIRA to analyze the burst — MIRA classifies it as stellar interference and closes the question",
                "outcome": "fail_setback",
                "node_id": scene2.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki manually records the raw signal and identifies the Persephone carrier wave — proof it is not noise, but also proof of a 30-year-old mystery",
                "outcome": "fail_disaster",
                "node_id": scene4.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki transmits a response, violating Protocol Delta-7 — the career cost is real, but the signal is answered",
                "outcome": "success_cost",
                "node_id": scene8.id,
            },
        ]

        thread_isolation.try_fail_cycles = [
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki finds comfort in routine and her relationship with MIRA — the signal disrupts but doesn't yet break her equilibrium",
                "outcome": "fail_setback",
                "node_id": scene2.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki makes the decision to respond alone, accepting the professional consequences — isolation chosen becomes isolation rejected",
                "outcome": "success_partial",
                "node_id": scene8.id,
            },
            {
                "id": str(uuid.uuid4()),
                "description": "Yuki and Priya work together to decode the signal; Yuki tells The Drift 'you are not alone' — she has rebuilt what she abandoned",
                "outcome": "success_cost",
                "node_id": scene10.id,
            },
        ]

        # ── Scene Links ──────────────────────────────────────────────────────
        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene1.id,
            target_node_id=scene7.id,
            link_type="foreshadowing",
            note="Yuki's inability to classify the anomalous burst in 'The Watch' foreshadows the voice fragment in 'A Voice in the Dark' — she hears something she can't name both times, and both times she trusts the hearing over the classification.",
        ))

        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene2.id,
            target_node_id=scene10.id,
            link_type="callback",
            note="MIRA calling the burst 'noise' in 'Ghost in the Noise' is echoed when the reply proves it was always a signal — Yuki's insistence on keeping it separate was the right call.",
        ))

        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene1.id,
            target_node_id=scene10.id,
            link_type="mirror",
            note="The story opens and closes with Yuki at her console in the observation deck, monitoring the array. The first time, the void is empty. The last time, it answers.",
        ))

        db.add(SceneLink(
            story_id=story.id,
            source_node_id=scene4.id,
            target_node_id=scene9.id,
            link_type="callback",
            note="Yuki's solitary carrier wave discovery in 'Carrier Wave' becomes the shared starting point in 'Old Friends' — what she found alone, she explains to Priya, and explaining it makes it real in a different way.",
        ))

        # ── Compendium Entries ───────────────────────────────────────────────
        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="First Contact Protocol Delta-7",
            content=(
                "Protocol Delta-7 governs all relay operator responses to unverified signals of potential non-human or non-registered origin.\n\n"
                "Key provisions:\n"
                "- No response without Contact Studies Institute authorization (Section 12, Para 4)\n"
                "- Verification requires triangulation from a minimum of two relay nodes\n"
                "- Unauthorized response = Class 1 Violation: posting termination, certification loss, civil liability\n"
                "- Historical context: Delta-7 was tightened significantly after the Meridian Incident (YE 103), when an operator responded to a degraded signal that turned out to be a malfunctioning probe, causing 18 months of expensive misclassification work\n\n"
                "Relevance: Yuki knows exactly what she is giving up when she transmits. The protocol is not unjust — it exists to prevent panic and misclassification. It just wasn't written for this situation."
            ),
            tags=["research", "worldbuilding", "plot"],
            category="worldbuilding",
            notes="The protocol gives Yuki's choice real weight — it is not bureaucratic obstruction but a reasonable rule applied to an unreasonable situation.",
        ))

        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="Colony Ship Design: Persephone-Class",
            content=(
                "The Persephone-class colony ship was the largest vessel class constructed during the expansion era:\n\n"
                "- Crew complement: 47 (command and technical)\n"
                "- Colonist capacity: 1,200 (cryo-dormancy for transit)\n"
                "- Transit range: Theoretically unlimited with planned resupply waypoints\n"
                "- Cryo systems: Designed for 15-year continuous operation; actual limits untested\n"
                "- Life support: 25-year closed-cycle capacity at full population\n\n"
                "The Persephone departed with 1,247 souls, 47 over the rated capacity — colonial authority approved the variance. "
                "If cryo systems failed during transit, the ship carried enough supplies for approximately 8 months of full waking population.\n\n"
                "Second generation: If survivors established a settlement, children born at the destination would now be in their late 20s. "
                "'Four hundred and twelve' is consistent with a founding group of 300-400 that achieved modest population growth over 30 years under constrained conditions."
            ),
            tags=["research", "worldbuilding", "character"],
            category="worldbuilding",
            notes="The math of second-generation survivors should feel plausible, not miraculous — they made it work, but barely.",
        ))

        db.add(CompendiumEntry(
            story_id=story.id,
            entry_type="note",
            title="IFF Registry and Carrier Wave Identification",
            content=(
                "Identification Friend or Foe (IFF) systems for interstellar vessels:\n\n"
                "Every registered vessel broadcasts a unique carrier wave frequency — a sub-signal embedded in all transmissions regardless of content or quality. "
                "The carrier wave persists even when the primary transmission is degraded, noisy, or partially corrupted.\n\n"
                "Registry matching: The Earth Orbital Authority maintains a historical IFF registry going back to the first expansion-era vessels. "
                "Decommissioned vessels and declared-lost vessels remain in the registry as historical records.\n\n"
                "Why Yuki's match matters: The Persephone's IFF frequency was not classified or reassigned after it was declared lost — doing so would have been a formal acknowledgment of failure that no one in the Directorate wanted to put on paper. "
                "The frequency has been sitting in the historical registry, matchable by any relay operator with access to the full archive, for thirty years."
            ),
            tags=["research", "worldbuilding", "plot"],
            category="worldbuilding",
            notes="The bureaucratic oversight that left the IFF in the historical registry is what makes Yuki's discovery possible. No one forgot the Persephone; they just stopped looking.",
        ))

        # ── World Building — Locations ────────────────────────────────────────
        sigma_draconis = Location(
            story_id=story.id,
            name="Sigma Draconis System",
            location_type="star_system",
            description=(
                "A K-type orange dwarf star system 18.8 light-years from Earth. "
                "The furthest extent of humanity's permanent relay infrastructure. "
                "Three planets orbit Sigma Draconis; none are habitable, but the outer asteroid belt "
                "provides raw materials for Waypoint 7's maintenance supply chain."
            ),
            atmosphere="Deep space — no atmosphere at the system level. The star's orange light gives everything a permanent late-afternoon quality at short range.",
            history=(
                "First surveyed in YE 45. Waypoint 7 was established in YE 63 as a relay node and potential staging point "
                "for deeper expansion. The expansion era ended before the staging point was used."
            ),
            significance="The edge of known space. Beyond Sigma Draconis, there is nothing but silence — or so everyone thought.",
            radiation_level="Low — K-type stars have stable, reduced UV output compared to G-type",
            habitability="Marginal — asteroid belt mining only; no planetary surface habitation",
            position=0,
        )
        db.add(sigma_draconis)
        db.flush()

        waypoint7 = Location(
            story_id=story.id,
            parent_id=sigma_draconis.id,
            name="Waypoint 7 Relay Station",
            location_type="orbital_station",
            description=(
                "A communications relay station in a stable orbit at 4.2 AU from Sigma Draconis. "
                "Cramped, functional, designed for a crew of two but staffed by one for budget reasons. "
                "The central hub of Yuki's world and the story's primary setting."
            ),
            atmosphere="Controlled and recycled — faintly metallic, with a persistent trace of machine oil from the array maintenance systems. The observation deck smells like warm electronics.",
            history=(
                "Commissioned in YE 63 as part of the expansion-era relay network. "
                "Originally a waystation for colony ships pushing beyond the relay boundary. "
                "After the Persephone disappeared and the expansion era ended, Waypoint 7 became a relay node — "
                "its original purpose quietly forgotten. It has had eight operators over forty years."
            ),
            significance="The station is Yuki's lighthouse. Her isolation and her purpose are both contained within it.",
            gravity="0.3g from centrifugal rotation",
            habitability="Fully habitable — closed-cycle life support, rated for two-person long-term occupation",
            radiation_level="Shielded — hull plating rated for ambient deep-space radiation exposure",
            distance_from_parent="4.2 AU",
            position=0,
        )
        db.add(waypoint7)
        db.flush()

        obs_deck = Location(
            story_id=story.id,
            parent_id=waypoint7.id,
            name="The Observation Deck",
            location_type="structure",
            description=(
                "The station's primary operations room — a semicircular space with three viewports facing the relay array "
                "and the stars beyond. Monitoring consoles line two walls; the central station handles relay traffic, "
                "signal analysis, and MIRA's primary interface terminals."
            ),
            atmosphere="The hum of systems, the glow of status displays, the faint vibration that travels through the hull from the array. Never fully silent.",
            significance="Where Yuki does her work. Where she first detects the signal. Her true home.",
            position=0,
        )
        db.add(obs_deck)

        the_array = Location(
            story_id=story.id,
            parent_id=waypoint7.id,
            name="The Array",
            location_type="structure",
            description=(
                "The external relay array — a lattice of receivers and transmitters extending 340 meters from the station's "
                "central spine. Yuki performs EVA maintenance twice a month to clear micrometeorite impact points and "
                "recalibrate alignment. The array is the station's reason for existing."
            ),
            atmosphere="Hard vacuum outside the station. The array is visible from the observation deck viewports — a dark geometric skeleton against the stars.",
            history="Original array installed at commissioning. Three major upgrades over forty years. The deep-listen receivers were added in YE 89 as part of a first-contact preparedness initiative that was subsequently defunded.",
            significance="The station's voice and ears. Yuki adjusts the array to transmit her response — a physical act that makes the decision irreversible.",
            position=1,
        )
        db.add(the_array)

        the_drift = Location(
            story_id=story.id,
            name="The Drift",
            location_type="space_habitat",
            description=(
                "Whatever the Persephone has become. The signal's origin point, somewhere in the void beyond charted space. "
                "The coordinates decoded by Priya in Act 3 point to a location that required decades of deceleration to reach. "
                "The colonists named it The Drift — a place that is not quite a planet, not quite a station, but something "
                "built and grown over thirty years by people who had nowhere else to go."
            ),
            history="The Persephone reached its coordinates in approximately YE 95, eight years after departure. The colonists survived, adapted, and began transmitting approximately ten years ago when their power generation reached sufficient levels.",
            significance="The mystery at the story's edge — a place where 1,247 colonists have lived for thirty years, changed by isolation, distance, and whatever they found at those coordinates.",
            gravity="Unknown",
            habitability="Unknown — the colonists survive, which suggests habitability of some kind",
            radiation_level="Unknown",
            position=1,
        )
        db.add(the_drift)
        db.flush()

        # ── World System ──────────────────────────────────────────────────────
        db.add(WorldSystem(
            story_id=story.id,
            name="The Relay Network",
            system_type="technology",
            source_origin=(
                "Built during the expansion era (YE 1-120) when humanity pushed outward from the Solar System. "
                "The network was designed to maintain communication across the growing sphere of human presence. "
                "Each relay station amplifies and retransmits signals, creating a chain that spans light-years."
            ),
            rules=(
                "Signals travel at light speed — no FTL communication exists. "
                "Each relay station has a coverage sphere of approximately 20 light-years. "
                "Stations must be crewed to handle anomalies; automated systems cannot manage unusual events. "
                "The network is the only way to communicate across interstellar distances."
            ),
            limitations=(
                "Transmission delays measured in months or years for distant colonies. "
                "Stations at the network's edge receive signals from beyond human space — mostly stellar noise, occasionally something else. "
                "The network cannot reach beyond its furthest stations; anything past Waypoint 7 is silence."
            ),
            costs=(
                "Isolation for the operators who staff the edge stations — years-long postings at the limit of human presence. "
                "Enormous infrastructure investment that the current government barely maintains. "
                "The psychological toll of listening to the void and having very little to say back."
            ),
            hierarchy_tiers=[
                {"name": "Core Relays", "description": "Solar System to Proxima Centauri. High bandwidth, minimal delay, fully automated.", "examples": ["Earth-Luna Hub", "Mars Relay", "Proxima Node"]},
                {"name": "Colonial Relays", "description": "Proxima to Tau Ceti. Moderate bandwidth, weeks of delay, skeleton crew.", "examples": ["Waypoints 1-4", "Ceres Deep Relay"]},
                {"name": "Edge Relays", "description": "Tau Ceti to Sigma Draconis. Low bandwidth, months of delay, single operators.", "examples": ["Waypoints 5-7"]},
            ],
            notes=(
                "The Relay Network is infrastructure humanity built and then forgot. "
                "Yuki is a keeper of something most people don't think about — until the signal makes them remember why it matters."
            ),
        ))

        # ── Culture ───────────────────────────────────────────────────────────
        db.add(Culture(
            story_id=story.id,
            name="Edge Operators",
            description=(
                "The informal culture that has developed among the operators who staff the edge relay stations — "
                "Waypoints 5 through 7. They are a loose community connected by the network they maintain, "
                "sharing logs, personal messages, and a dark humor about their isolation."
            ),
            values=(
                "Self-sufficiency above all. The work matters even if no one notices. "
                "Silence is normal; presence is the exception. "
                "'Keep the signal clear' — the informal motto."
            ),
            customs=(
                "Operators maintain detailed personal logs that become part of station records. "
                "Shift-change messages include personal notes for the incoming operator. "
                "Anomalies are shared across the network as curiosities, usually stellar phenomena with informal nicknames — "
                "'The Grandmother' (a recurring Tau Ceti flare), 'The Whisper' (a persistent interference pattern near Waypoint 5)."
            ),
            taboos=(
                "Never ignore an anomaly, even if it's probably nothing. "
                "Never leave a station uncrewed without a full handoff. "
                "Never complain about isolation to people who chose not to take edge postings — "
                "they did not choose the work and you should not ask them to understand it."
            ),
            religion="None formal. Some operators develop personal rituals around their work — treating the array maintenance schedule as something almost ceremonial.",
            government_type="Technically under Earth Orbital Authority, but edge stations are so remote that operators have near-complete autonomy. Authority communicates by quarterly dispatch; orders arrive months after the situations that prompted them.",
            naming_conventions={
                "given_name": "Any Earth origin, reflecting the multicultural composition of early expansion crews",
                "station_names": "'Waypoint' + number, with informal names often developing over time ('The Lighthouse' for Waypoint 7, 'The Widow' for Waypoint 5)",
                "ai_names": "Acronyms that become names: MIRA (Monitoring, Interface, Relay, Analysis), HAVEN, CHORUS",
                "examples": ["Yuki Tanaka (Japanese-origin given name)", "Waypoint 7 / The Lighthouse", "MIRA"]
            },
            common_phrases=[
                {"phrase": "Clear signal", "meaning": "Greeting or farewell among operators, equivalent to 'safe travels' or 'take care'", "context": "Used in inter-station transmissions and personal messages"},
                {"phrase": "Static in the line", "meaning": "Something is wrong; a problem that isn't yet identified", "context": "Used when an operator suspects an issue but can't pinpoint it"},
                {"phrase": "Listening post", "meaning": "Someone who notices too much, or hears things others miss", "context": "Used with mild affection about operators known for careful monitoring — applied to Yuki by other edge operators"},
            ],
            notes=(
                "Yuki has been a listening post her whole posting. The signal is the first time listening has mattered this much."
            ),
        ))

        # ── History ───────────────────────────────────────────────────────────
        the_silence = Era(
            story_id=story.id,
            name="The Silence",
            description=(
                "The current era, beginning with the disappearance of the Persephone thirty years ago. "
                "The loss of humanity's most ambitious colony ship ended the age of expansion. "
                "No new long-range missions have been attempted. The relay network is maintained but not extended."
            ),
            start_date="YE 90",
            end_date="YE 120 (present)",
            characteristics=(
                "Conservative approach to expansion. Relay network maintained but underfunded. "
                "First Contact protocols tightened to prevent false hope and panic. "
                "The Persephone has become a cautionary tale — 'Don't be a Persephone' entered the language. "
                "Humanity occupies the same sphere it reached thirty years ago, unwilling to push further."
            ),
            key_figures=[
                {"name": "Commander Alexei Volkov", "role": "Last captain of the expansion era — his disappearance became the symbol of its end"},
            ],
            position=0,
        )
        db.add(the_silence)
        db.flush()

        db.add(HistoricalEvent(
            story_id=story.id,
            era_id=the_silence.id,
            name="The Persephone Launch",
            in_world_date="YE 87, Firstmonth",
            description=(
                "The colony ship Persephone departed from Ceres Station carrying 1,247 colonists toward a potentially habitable system "
                "detected by long-range survey. It was the largest colonial expedition ever attempted, designed to establish "
                "a permanent settlement beyond the relay network's reach."
            ),
            causes=(
                "The optimism of the late expansion era. Overpopulation pressure in the inner system. "
                "Discovery of a candidate system at extreme range by the long-baseline survey array. "
                "Political will under Director-General Okafor's administration to demonstrate humanity's reach."
            ),
            consequences=(
                "Three years of sporadic contact as Persephone moved beyond reliable relay range. "
                "Commander Volkov's last confirmed message described anomalous readings and an intention to investigate. "
                "Final transmission received at Waypoint 7 in YE 90. Then silence."
            ),
            legacy_effects=(
                "The Persephone's loss ended the expansion era. The Silence began. "
                "No mission beyond relay range has been attempted in thirty years. "
                "The failure haunts humanity's vision of itself as an expanding species."
            ),
            participants=[
                {"type": "character", "name": "Commander Alexei Volkov", "role": "Commanding officer of the Persephone"},
            ],
            position=0,
        ))

        db.add(HistoricalEvent(
            story_id=story.id,
            era_id=the_silence.id,
            name="The Persephone Silence",
            in_world_date="YE 90, Ninthmonth",
            description=(
                "The last confirmed transmission from Persephone reached Waypoint 7. "
                "Commander Volkov reported 'anomalous readings' and stated his intention to investigate. "
                "No further contact was ever received. Search missions found nothing. "
                "After five years of silence, the Persephone was declared lost with all hands."
            ),
            causes="Unknown. Theories range from equipment failure during the investigation to navigation error to hostile encounter.",
            consequences=(
                "Immediate halt to all long-range colonial missions. "
                "First Contact protocols revised to prohibit response to unverified signals. "
                "The edge relay stations — built as waypoints for ships that never came — became monuments to a future that didn't happen."
            ),
            legacy_effects=(
                "The Persephone became a symbol of overreach. Its IFF frequency was never cleared from the historical registry — "
                "no one wanted to formally close the file. Waypoint 7, where the last transmission was received, "
                "acquired the informal name 'The Last Lighthouse' among edge operators."
            ),
            participants=[
                {"type": "character", "name": "Commander Alexei Volkov", "role": "Last transmission sent from his command"},
            ],
            position=1,
        ))

        # ── Location Travel ───────────────────────────────────────────────────
        db.add(LocationTravel(
            from_location_id=obs_deck.id,
            to_location_id=the_array.id,
            travel_time="15 minutes (EVA preparation and transit)",
            travel_method="Pressurized EVA suit via external maintenance tether",
            condition="Cannot be performed during micrometeorite advisory or when station is in Sigma Draconis's active flare zone",
            notes="Routine maintenance path; becomes significant when Yuki must physically reorient the array to transmit her response.",
            bidirectional=True,
        ))

        # ── Calendar ──────────────────────────────────────────────────────────
        db.add(Calendar(
            story_id=story.id,
            name="Standard Expansion Calendar",
            description=(
                "The timekeeping system adopted during the expansion era to coordinate across star systems. "
                "Based on Earth's calendar but with modifications: month names replaced with ordinals to avoid "
                "Earth-centrism as colonies established local time references. Year 0 is the founding of "
                "Proxima Station, humanity's first extrasolar colony."
            ),
            months=[
                {"name": "Firstmonth", "days": 31},
                {"name": "Secondmonth", "days": 28},
                {"name": "Thirdmonth", "days": 31},
                {"name": "Fourthmonth", "days": 30},
                {"name": "Fifthmonth", "days": 31},
                {"name": "Sixthmonth", "days": 30},
                {"name": "Seventhmonth", "days": 31},
                {"name": "Eighthmonth", "days": 31},
                {"name": "Ninthmonth", "days": 30},
                {"name": "Tenthmonth", "days": 31},
                {"name": "Eleventhmonth", "days": 30},
                {"name": "Twelfthmonth", "days": 31},
            ],
            days_per_week=7,
            week_day_names=["Oneday", "Twoday", "Threeday", "Fourday", "Fiveday", "Sixday", "Restday"],
            special_days=[
                {"name": "Founding Day", "month": 1, "day": 15, "description": "Anniversary of Proxima Station's establishment. Observed across all human settlements with a shared broadcast window."},
                {"name": "Signal Day", "month": 9, "day": 7, "description": "Anniversary of the first confirmed interstellar communication received at Earth. Edge operators observe informally by reviewing their anomaly logs."},
                {"name": "Remembrance", "month": 9, "day": 23, "description": "Unofficial memorial for the Persephone, observed particularly by edge relay operators. The date of Volkov's last transmission. MIRA has flagged this date in her calendar without being asked."},
            ],
            epoch_name="Year of Expansion",
            conversion_notes="Story takes place in YE 120 (2277 CE). The Persephone disappeared in YE 90 (2247 CE). Yuki has been on Waypoint 7 since YE 115.",
        ))

        # ── Scene Settings (location → scene links) ───────────────────────────
        db.add(SceneSetting(
            location_id=obs_deck.id,
            node_id=scene1.id,
            role="primary",
            notes="Yuki at her monitoring console, watching the deep-listen band when the first burst appears.",
        ))
        db.add(SceneSetting(
            location_id=the_array.id,
            node_id=scene8.id,
            role="primary",
            notes="Yuki adjusts the array to transmit — a physical act that makes the decision irreversible.",
        ))
        db.add(SceneSetting(
            location_id=obs_deck.id,
            node_id=scene10.id,
            role="primary",
            notes="The final scene returns to the observation deck where it all began — the same room, transformed.",
        ))

        db.commit()
