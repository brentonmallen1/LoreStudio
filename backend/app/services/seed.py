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
