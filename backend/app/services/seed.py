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
            narrative_intent="Thomas is the mystery at the story's center. His presence is felt through Eleanor's grief, the missing log entries, and the Visitor's purpose. His character must reveal itself through what others remember — and misremember.",
            narrative_intent_hidden=True,
            arc_milestones=[],
        )
        db.add(thomas)

        margaret = Character(
            story_id=story.id,
            name="Margaret Holt",
            role="minor",
            personality="Economical and unsentimental. Has outlasted most of what she loved about the island without bitterness, which Eleanor finds both admirable and slightly unnerving.",
            motivation="Finish out her years on the island she was born on. Leave it in better shape than she found it.",
            background="Born on Harrow Island, married a fisherman, buried him here. One of three residents who never left. At seventy-four, she keeps a kitchen garden and trades supplies with Eleanor once a week.",
            appearance="Small, deliberate in her movements. Wears the same oilskin coat regardless of weather. Knows more about the island's history than she lets on.",
            arc_notes="Margaret is a minor but useful presence — a witness to the island's past who speaks only when directly asked, and then with precision.",
            interview_prompts=[
                "What do you remember about the night Thomas died?",
                "Have you seen strangers on the island before?",
            ],
            traits={"Age": "74", "Status": "Year-round resident", "Relationship to Eleanor": "Neighbor and occasional confidante"},
            narrative_intent="Margaret grounds the story in the island's longer history. She knows more than she says, and her sparse dialogue can be a source of revelation or misdirection as needed.",
            narrative_intent_hidden=True,
            arc_milestones=[],
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
            description="The Visitor met Thomas Vance once before his death. The nature of that meeting — and what Thomas told them — is what brought them to the island.",
        ))
        db.add(CharacterRelationship(
            character_id=margaret.id,
            related_character_id=thomas.id,
            relationship_type="old friend",
            description="Margaret and Thomas Vance were neighbors for thirty years. She is one of the few people who knew him well. She has not volunteered what she knows.",
        ))
        db.flush()

        # Settings (locations)
        db.add(Setting(
            story_id=story.id,
            name="The Lighthouse",
            description="Harrow Point Lighthouse — a working lighthouse on the southern tip of Harrow Island. Three storeys of whitewashed stone, a lamp room with a Fresnel lens, and a keeper's quarters that still smells of Thomas Vance's pipe tobacco.",
            atmosphere="Isolated, purposeful, faintly haunted by routine. The lamp room at the top is where Eleanor feels most herself. The log room below is where the gaps live.",
            history="Built in 1887, the lighthouse has had only three keepers in its history — the last being Thomas Vance, who passed the role to Eleanor when his health failed.",
            significance="The lighthouse is both Eleanor's home and her inheritance. It represents her father's world, which she absorbed entirely — and may have to re-examine.",
        ))
        db.add(Setting(
            story_id=story.id,
            name="The Keeper's Cottage",
            description="A low stone cottage attached to the base of the lighthouse. Two rooms: a main room with a woodstove and Eleanor's books, and a bedroom. Spartan by choice.",
            atmosphere="Spare and self-sufficient. Everything has a place. Nothing is decorative except a framed photograph of Eleanor and her father on the mantle.",
            history="The cottage was Thomas Vance's home for forty years. Eleanor moved back in after his death and has changed very little.",
            significance="The cottage is where Eleanor is most off-guard — and where the Visitor disrupts her most, because guests are not part of its logic.",
        ))
        db.add(Setting(
            story_id=story.id,
            name="Harrow Island",
            description="A small island three miles off the mainland, accessible only by boat. Eleven houses at peak; three occupied now. A general store that opens twice a week. A disused fishing pier.",
            atmosphere="The quiet of a place people left. The few who remain have made peace with the diminishment.",
            history="Harrow Island was a fishing community until the 1980s, when the catch dried up. The lighthouse kept the island on maps after the community forgot why it mattered.",
            significance="The island's isolation is not just physical — it mirrors Eleanor's chosen remove from everything that might ask something of her.",
        ))
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
            metadata_={"purpose": "The missing entries are the story's central wound made visible. Eleanor has been avoiding looking at this gap. The Visitor's unsurprised reaction confirms they came here knowing about it."},
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
            metadata_={"purpose": "The Visitor's partial confession raises the stakes: they know more than they've said, and some of it is damaging. Eleanor has to decide how much she wants to know. The scene should end with her asking the question she's been afraid to ask."},
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
            metadata_={"purpose": "The revelation scene. Keep it grounded — Eleanor receives this information in her body, not just her mind. The facts matter less than what they cost her to hear."},
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
            metadata_={"purpose": "Eleanor's choice is the story's true ending. It should tell us who she is — not who she was at the start. Whether she protects her father's memory or burns it down, the act must be hers."},
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

        db.commit()
