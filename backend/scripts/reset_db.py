"""Reset and reseed the database. Run from the backend directory."""

import importlib
import os

for f in os.listdir("app/models"):
    if f.endswith(".py") and f != "__init__.py":
        try:
            importlib.import_module(f"app.models.{f[:-3]}")
        except Exception:
            pass

from app.database import Base, engine  # noqa: E402
from app.services.seed import seed_admin, seed_demo_story, seed_structure_templates  # noqa: E402

Base.metadata.create_all(engine)
seed_structure_templates()
seed_admin()
seed_demo_story()
print("Database reset and seeded.")
