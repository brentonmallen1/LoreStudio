"""The settings, their documentation and the example .env agree (doc 23 P7).

docs/CONFIGURATION.md once documented CONFIG_PATH, which nothing read, and left out settings
that existed. Every setting is documented and in .env.example; every variable the docs, the
example or an Unraid template names is a setting or a known deployment variable.
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

from app.config import Settings

ROOT = Path(__file__).resolve().parents[2]

#: Read by the compose files, the images or `just dev`, not by the app.
DEPLOYMENT = {"WEB_PORT", "DATA_PATH", "LORESTUDIO_TAG", "TZ", "PUID", "PGID", "API_UPSTREAM", "PORT", "FRONTEND_PORT"}
#: Settings the image sets, never the user's .env.
SET_BY_IMAGE = {"APP_VERSION"}

SETTINGS = {name.upper() for name in Settings.model_fields}
KNOWN = SETTINGS | DEPLOYMENT


def _documented() -> set[str]:
    rows = [line for line in (ROOT / "docs/CONFIGURATION.md").read_text().splitlines() if line.startswith("| `")]
    return {name for row in rows for name in re.findall(r"`([A-Z][A-Z0-9_]+)`", row.split("|")[1])}


def _in_example() -> set[str]:
    text = (ROOT / ".env.example").read_text()
    return set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", text, flags=re.M))


def _in_unraid() -> set[str]:
    out: set[str] = set()
    for xml in (ROOT / "unraid").glob("*.xml"):
        for c in ET.parse(xml).getroot().iter("Config"):
            if c.get("Type") == "Variable":
                out.add(c.get("Target", ""))
    return out


def test_every_setting_is_documented():
    assert SETTINGS - _documented() == set()


def test_every_setting_is_in_the_example_env():
    assert SETTINGS - SET_BY_IMAGE - _in_example() == set()


def test_nothing_documented_that_nothing_reads():
    assert _documented() - KNOWN == set()
    assert _in_example() - KNOWN == set()
    assert _in_unraid() - KNOWN == set()
