import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth.router import router as auth_router
from .config import settings
from .database import Base, engine
from .routers.ai_settings import router as ai_settings_router
from .routers.analysis import router as analysis_router
from .routers.beat_sheets import router as beat_sheets_router
from .routers.brainstorm import router as brainstorm_router
from .routers.calendars import router as calendars_router
from .routers.changes import router as changes_router
from .routers.character_milestones import router as character_milestones_router
from .routers.characters import router as characters_router
from .routers.chat import router as chat_router
from .routers.chronicle import router as chronicle_router
from .routers.compendium import router as compendium_router
from .routers.cultures import router as cultures_router
from .routers.diagrams import router as diagrams_router
from .routers.dialogue import router as dialogue_router
from .routers.discoveries import router as discoveries_router
from .routers.editorial import router as editorial_router
from .routers.export import router as export_router
from .routers.health import router as health_router
from .routers.history import router as history_router
from .routers.import_router import router as import_router
from .routers.interviews import router as interviews_router
from .routers.llm_preview import router as llm_preview_router
from .routers.llm_settings import router as llm_settings_router
from .routers.location_travel import router as location_travel_router
from .routers.locations import router as locations_router
from .routers.media import router as media_router
from .routers.ollama import router as ollama_router
from .routers.outlines import router as outlines_router
from .routers.panel_interviews import router as panel_interviews_router
from .routers.plot_threads import router as plot_threads_router
from .routers.prose_tools import router as prose_tools_router
from .routers.publication import router as publication_router
from .routers.reader_knowledge import router as reader_knowledge_router
from .routers.scene_links import router as scene_links_router
from .routers.scene_planner import router as scene_planner_router
from .routers.search import router as search_router
from .routers.settings_router import router as settings_router
from .routers.snapshots import router as snapshots_router
from .routers.stories import router as stories_router
from .routers.structure import router as structure_router
from .routers.system import router as system_router
from .routers.templates import router as templates_router
from .routers.todos import router as todos_router
from .routers.twists import router as twists_router
from .routers.users import router as users_router
from .routers.whatif import router as whatif_router
from .routers.world_systems import router as world_systems_router
from .routers.worldbuilding_ai import router as worldbuilding_ai_router
from .services.db_backup import backup_loop
from .services.db_migrate import run_migrations
from .services.seed import (
    seed_admin,
    seed_beat_sheets,
    seed_demo_story,
    seed_first_person_demo,
    seed_flash_fiction_demo,
    seed_scifi_demo_story,
    seed_short_story_demo,
    seed_structure_templates,
)

logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("lorestudio")


def refuse_insecure_defaults() -> None:
    """Outside development, default secrets are a misconfiguration, not a warning."""
    problems = settings.insecure_defaults()
    if problems and not settings.is_dev:
        for name in problems:
            logger.critical("%s is still a default value. Set it before starting with ENV=%s.", name, settings.env)
        sys.exit(1)
    for name in problems:
        logger.warning("%s is a default value (fine for ENV=dev, refused otherwise)", name)


def seed_all() -> None:
    seed_structure_templates()
    seed_beat_sheets()
    seed_admin()
    if settings.seed_demo:
        seed_demo_story()
    if settings.seed_extra_demos:
        seed_scifi_demo_story()
        seed_flash_fiction_demo()
        seed_short_story_demo()
        seed_first_person_demo()


@asynccontextmanager
async def lifespan(app: FastAPI):
    refuse_insecure_defaults()
    if settings.auto_migrate:
        run_migrations(engine)
    else:
        Base.metadata.create_all(bind=engine)
    seed_all()
    backup_task = asyncio.create_task(backup_loop(engine)) if settings.db_backup_enabled else None
    logger.info("startup complete (env=%s)", settings.env)
    yield
    if backup_task:
        backup_task.cancel()


app = FastAPI(title="LoreStudio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(stories_router, prefix="/api/stories", tags=["stories"])
app.include_router(structure_router, prefix="/api/structure", tags=["structure"])
app.include_router(characters_router, prefix="/api/characters", tags=["characters"])
app.include_router(character_milestones_router, prefix="/api/characters", tags=["characters"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(interviews_router, prefix="/api/interviews", tags=["interviews"])
app.include_router(templates_router, prefix="/api/templates", tags=["templates"])
app.include_router(analysis_router, prefix="/api", tags=["analysis"])
app.include_router(panel_interviews_router, prefix="/api", tags=["panels"])
app.include_router(plot_threads_router, prefix="/api", tags=["threads"])
app.include_router(scene_links_router, prefix="/api", tags=["scene-links"])
app.include_router(search_router, prefix="/api", tags=["search"])
app.include_router(media_router, prefix="/api", tags=["media"])
app.include_router(diagrams_router, prefix="/api", tags=["diagrams"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(llm_preview_router, prefix="/api", tags=["llm-transparency"])
app.include_router(chronicle_router, prefix="/api", tags=["chronicle"])
app.include_router(ai_settings_router, prefix="/api/ai-settings", tags=["ai-settings"])
app.include_router(llm_settings_router, prefix="/api/llm-settings", tags=["llm-settings"])
app.include_router(compendium_router, prefix="/api", tags=["compendium"])
app.include_router(locations_router, prefix="/api", tags=["locations"])
app.include_router(world_systems_router, prefix="/api", tags=["world-systems"])
app.include_router(cultures_router, prefix="/api", tags=["cultures"])
app.include_router(history_router, prefix="/api", tags=["history"])
app.include_router(location_travel_router, prefix="/api", tags=["location-travel"])
app.include_router(calendars_router, prefix="/api", tags=["calendars"])
app.include_router(beat_sheets_router, prefix="/api", tags=["beat-sheets"])
app.include_router(discoveries_router, prefix="/api", tags=["discoveries"])
app.include_router(ollama_router, prefix="/api", tags=["ollama"])
app.include_router(brainstorm_router, prefix="/api", tags=["brainstorm"])
app.include_router(whatif_router, prefix="/api", tags=["whatif"])
app.include_router(scene_planner_router, prefix="/api", tags=["scene-planner"])
app.include_router(worldbuilding_ai_router, prefix="/api", tags=["worldbuilding-ai"])
app.include_router(export_router, prefix="/api", tags=["export"])
app.include_router(dialogue_router, prefix="/api", tags=["dialogue"])
app.include_router(twists_router, prefix="/api", tags=["twists"])
app.include_router(todos_router, prefix="/api", tags=["todos"])
app.include_router(outlines_router, prefix="/api", tags=["outline"])
app.include_router(snapshots_router, prefix="/api", tags=["snapshots"])
app.include_router(import_router, prefix="/api", tags=["import"])
app.include_router(publication_router, prefix="/api", tags=["publication"])
app.include_router(reader_knowledge_router, prefix="/api", tags=["reader-knowledge"])
app.include_router(system_router, prefix="/api", tags=["system"])
app.include_router(prose_tools_router, prefix="/api", tags=["prose-tools"])
app.include_router(changes_router, prefix="/api", tags=["changes"])
app.include_router(editorial_router, prefix="/api", tags=["editorial"])


@app.get("/health")
def health():
    return {"status": "ok"}
