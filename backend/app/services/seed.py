import uuid
from sqlalchemy.orm import Session
from ..database import engine
from ..models.user import User
from ..models.story import Story
from ..models.character import Character
from ..models.structure import StoryStructureTemplate, StructureNode
from ..models.plot_thread import PlotThread, PlotThreadAppearance
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
            # Story Bible fields
            genre="Literary Fiction",
            tone="Atmospheric, melancholic, quietly tense",
            themes=["solitude", "memory", "secrets", "grief", "identity"],
            central_conflict="Eleanor's need to protect her carefully constructed isolation versus the truth that threatens to surface",
            target_audience="Adult literary fiction readers",
            # Narrative grounding
            narrative_intent="Explore how self-imposed isolation can be both sanctuary and prison, and how the past finds us regardless of where we hide.",
            premise="A solitary lighthouse keeper on a dying island must confront her buried past when a mysterious stranger arrives seeking answers she's spent years avoiding.",
            logline="When a mysterious historian arrives during a storm, a reclusive lighthouse keeper must decide whether to protect her secrets or finally face what she buried.",
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
            name="The Visitor",
            role="supporting",
            personality="Enigmatic and precise, speaks carefully as if choosing each word from a limited supply. Unsettling not because of anything threatening, but because of how much they seem to already know.",
            motivation="Claims to be researching the island's history. The truth is more complicated.",
            background="Arrived by boat during a storm, soaked and calm in equal measure. Says they're a historian from the university. Their papers are in order. Their story isn't.",
            appearance="Indeterminate age. Dark coat, small leather notebook always in hand. Never seems cold despite the weather.",
            arc_notes="Functions as a mirror for Eleanor — their presence forces her to examine the story she tells herself about why she stayed.",
            interview_prompts=[
                "What are you really looking for here?",
                "Have we met before?",
                "Why this island, why now?",
            ],
            traits={"Known as": "The Visitor", "Carries": "Leather notebook"},
            narrative_intent="Functions as a catalyst and mirror for Eleanor. Their questions force her to examine the story she tells herself. The mystery of their identity keeps tension high throughout the second act.",
            narrative_intent_hidden=True,
            arc_milestones=[
                {"id": str(uuid.uuid4()), "text": "Arrives with an apparent purpose (historical research)", "completed": True},
                {"id": str(uuid.uuid4()), "text": "Gains Eleanor's grudging trust through patience and honesty about small things", "completed": False},
                {"id": str(uuid.uuid4()), "text": "True purpose revealed — and its connection to Eleanor's past", "completed": False},
            ],
        )
        db.add(visitor)
        db.flush()

        # Plot threads
        thread_logs = PlotThread(
            story_id=story.id,
            name="The Missing Logs",
            description="Several entries from five years ago are missing or damaged. What was recorded there — and why were they removed?",
            status="open",
            color="#3b82f6",
        )
        db.add(thread_logs)

        thread_identity = PlotThread(
            story_id=story.id,
            name="The Visitor's Identity",
            description="Who is this 'historian' really, and why do they know so much about Harrow Island and the Vance family?",
            status="developing",
            color="#8b5cf6",
        )
        db.add(thread_identity)

        thread_father = PlotThread(
            story_id=story.id,
            name="Eleanor's Father",
            description="What really happened in the final months of Thomas Vance's life? Eleanor's account has gaps she won't examine.",
            status="open",
            color="#ef4444",
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
            metadata_={"purpose": "Open in Eleanor's element — she is competent and alone by choice. The barometer and the log establish her observational nature and her father's lingering presence. The boat at the end pivots the scene: something is coming that she can't control."},
            content=(
                "<p>The barometer had been falling since noon.</p>"
                "<p>Eleanor noted it in the log — <em>1012, 1008, 1003</em> — each reading a quiet sentence in a language she'd learned to read before she could properly read words. Her father had taught her that. <em>The glass doesn't lie,</em> he'd said. <em>People lie. Weather lies sometimes too, but the glass is always honest about what it knows.</em></p>"
                "<p>She climbed to the lamp room at half past four and stood at the railing while the sky turned the colour of a bruise. The sea was doing what the sea did before a storm: going very still, as if drawing a breath.</p>"
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
            metadata_={"purpose": "First direct encounter between Eleanor and the Visitor. Establish Eleanor's suspicion without hostility — she lets them in against her better judgment. The Visitor's calm is the first signal that something about their story doesn't add up."},
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

        db.commit()
