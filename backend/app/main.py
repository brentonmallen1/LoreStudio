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
from .services.seed import seed_admin, seed_structure_templates, seed_demo_story


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_structure_templates()
    seed_admin()
    seed_demo_story()
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


@app.get("/health")
def health():
    return {"status": "ok"}
