from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .auth.router import router as auth_router
from .routers.users import router as users_router
from .routers.stories import router as stories_router
from .routers.structure import router as structure_router
from .routers.characters import router as characters_router
from .routers.settings_router import router as settings_router
from .routers.interviews import router as interviews_router
from .routers.templates import router as templates_router
from .routers.analysis import router as analysis_router
from .routers.panel_interviews import router as panel_interviews_router
from .routers.plot_threads import router as plot_threads_router
from .routers.scene_links import router as scene_links_router
from .routers.search import router as search_router
from .routers.media import router as media_router
from .routers.diagrams import router as diagrams_router
from .routers.chat import router as chat_router
from .routers.health import router as health_router
from .routers.llm_preview import router as llm_preview_router
from .routers.chronicle import router as chronicle_router
from .routers.ai_settings import router as ai_settings_router
from .routers.llm_settings import router as llm_settings_router
from .routers.compendium import router as compendium_router
from .routers.locations import router as locations_router
from .routers.world_systems import router as world_systems_router
from .routers.cultures import router as cultures_router
from .routers.history import router as history_router
from .routers.location_travel import router as location_travel_router
from .routers.calendars import router as calendars_router
from .routers.beat_sheets import router as beat_sheets_router
from .routers.discoveries import router as discoveries_router
from .routers.ollama import router as ollama_router
from .routers.brainstorm import router as brainstorm_router
from .services.seed import seed_admin, seed_structure_templates, seed_demo_story, seed_scifi_demo_story, seed_beat_sheets


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_structure_templates()
    seed_beat_sheets()
    seed_admin()
    seed_demo_story()
    seed_scifi_demo_story()
    yield


app = FastAPI(title="LoreStudio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(stories_router, prefix="/api/stories", tags=["stories"])
app.include_router(structure_router, prefix="/api/structure", tags=["structure"])
app.include_router(characters_router, prefix="/api/characters", tags=["characters"])
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


@app.get("/health")
def health():
    return {"status": "ok"}
