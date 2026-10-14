"""Reading a Novelcrafter "full" export (doc 28).

The zip holds ``novel.docx`` (the manuscript), one folder per codex entry
(``<kind>/<slug>-<id>/metadata.json``, ``entry.md`` with front matter, perhaps ``notes.md`` and
``thumbnail.jpg``), ``snippets/*.md``, ``chats/*.md`` and ``codex.html`` (a printable copy of the
codex, nothing more). It is read in memory and never extracted: every name is checked, the
entries are counted and their sizes capped before a byte is read.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass, field

#: Guards for a file someone else made: a zip bomb or a path that climbs out is refused.
MAX_ENTRIES = 5000
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_TEXT_BYTES = 2 * 1024 * 1024
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

_DATE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


class NotAnExport(ValueError):
    """The file is not a Novelcrafter export, or not one it is safe to read."""


@dataclass
class Entry:
    """One codex entry, as Novelcrafter wrote it."""

    id: str
    origin: str  # the entry's folder in the archive
    type: str  # character | location | object | lore | subplot | other
    name: str
    aliases: list[str]
    tags: list[str]
    body: str
    notes: str = ""
    color: str | None = None
    #: The AI settings: always include, never include by itself, don't track mentions.
    flags: dict[str, bool] = field(default_factory=dict)
    fields: dict[str, str] = field(default_factory=dict)
    urls: list[str] = field(default_factory=list)
    nested: list[str] = field(default_factory=list)
    thumbnail: bytes | None = None
    thumbnail_name: str = ""
    #: metadata.json as it was, kept with a leftover so nothing in it is lost.
    raw: dict = field(default_factory=dict)


@dataclass
class Snippet:
    id: str
    origin: str
    title: str
    body: str
    favourite: bool
    date: str


@dataclass
class Chat:
    id: str
    origin: str
    title: str
    date: str
    #: (role, text): role is "user" or "assistant".
    turns: list[tuple[str, str]]


@dataclass
class Export:
    docx: bytes
    entries: list[Entry]
    snippets: list[Snippet]
    chats: list[Chat]
    has_codex_html: bool = False


def looks_like_export(data: bytes) -> bool:
    """A zip with ``novel.docx`` and at least one codex entry: worth reading as one."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile:
        return False
    return "novel.docx" in names and any(n.count("/") == 2 and n.endswith("/metadata.json") for n in names)


def _safe(name: str) -> bool:
    parts = name.replace("\\", "/").split("/")
    return not name.startswith(("/", "\\")) and ".." not in parts and ":" not in parts[0]


def _decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


def front_matter(text: str) -> tuple[dict, str]:
    """``---`` front matter and the body after it. Novelcrafter writes a small YAML: scalars,
    lists of ``- item`` and one level of mapping (``fields``), which is all this reads."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    head, body = text[3:end], text[end + 4 :]
    out: dict = {}
    key: str | None = None
    for line in head.splitlines():
        if not line.strip():
            continue
        if line.startswith((" ", "\t")) and key is not None:
            item = line.strip()
            if item.startswith("- "):
                if not isinstance(out.get(key), list):
                    out[key] = []
                out[key].append(_scalar(item[2:]))
            elif ":" in item:
                k, _, v = item.partition(":")
                if not isinstance(out.get(key), dict):
                    out[key] = {}
                out[key][k.strip()] = _scalar(v)
            continue
        k, _, v = line.partition(":")
        key = k.strip()
        out[key] = _scalar(v) if v.strip() else None
    return out, body.lstrip("\n")


def _scalar(value: str):
    v = value.strip()
    if v in ("[]",):
        return []
    if v in ("{}",):
        return {}
    if v in ("null", "~", ""):
        return None
    if v in ("true", "false"):
        return v == "true"
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def parse_chat(text: str) -> tuple[str, list[tuple[str, str]]]:
    """A chat's title and its turns, from ``## User`` and ``## AI`` headings."""
    meta, body = front_matter(text)
    turns: list[tuple[str, str]] = []
    role: str | None = None
    lines: list[str] = []

    def close() -> None:
        if role and "\n".join(lines).strip():
            turns.append((role, "\n".join(lines).strip()))

    for line in body.splitlines():
        heading = line.strip().lower()
        if heading in ("## user", "## ai", "## assistant"):
            close()
            role, lines = ("user" if heading == "## user" else "assistant"), []
        else:
            lines.append(line)
    close()
    return str(meta.get("title") or ""), turns


def _stem(path: str) -> str:
    return path.rsplit("/", 1)[-1].rsplit(".", 1)[0]


def _id_after_dash(stem: str) -> str:
    """``2024-07-20 opening - 2jUbK9ce`` and ``2024-07-20 2jWND7Dz`` both end in the id."""
    return stem.rsplit(" ", 1)[-1]


class _Archive:
    """The zip, checked: every name inside its own folder, sizes capped before reading."""

    def __init__(self, zf: zipfile.ZipFile):
        infos = zf.infolist()
        if len(infos) > MAX_ENTRIES:
            raise NotAnExport("The archive holds too many files")
        if sum(i.file_size for i in infos) > MAX_TOTAL_BYTES:
            raise NotAnExport("The archive is too large once unpacked")
        bad = [i.filename for i in infos if not _safe(i.filename)]
        if bad:
            raise NotAnExport(f"The archive has a file outside its own folder: {bad[0]}")
        self.zf = zf
        self.by_name = {i.filename: i for i in infos if not i.is_dir()}

    def read(self, name: str, limit: int) -> bytes:
        info = self.by_name[name]
        if info.file_size > limit:
            raise NotAnExport(f"{name} is too large")
        return self.zf.read(info)

    def text(self, name: str) -> str:
        return _decode(self.read(name, MAX_TEXT_BYTES)) if name in self.by_name else ""

    def entry(self, folder: str) -> Entry | None:
        try:
            meta = json.loads(self.text(f"{folder}/metadata.json"))
        except ValueError:
            return None
        kind, slug = folder.split("/")
        attrs = meta.get("attributes") or {}
        front, body = front_matter(self.text(f"{folder}/entry.md"))
        thumb = next(
            (
                n
                for n in self.by_name
                if n.startswith(f"{folder}/thumbnail.") and "." + n.rsplit(".", 1)[-1].lower() in IMAGE_TYPES
            ),
            "",
        )
        found = front.get("fields")
        fields: dict = found if isinstance(found, dict) else {}
        return Entry(
            id=str(meta.get("id") or slug.rsplit("-", 1)[-1]),
            origin=folder,
            type=str(attrs.get("type") or kind.rstrip("s")),
            name=str(attrs.get("name") or front.get("name") or slug),
            aliases=[str(a) for a in attrs.get("aliases") or [] if str(a).strip()],
            tags=[str(t) for t in attrs.get("tags") or [] if str(t).strip()],
            body=body.strip(),
            notes=self.text(f"{folder}/notes.md").strip(),
            color=attrs.get("color") or None,
            flags={k: bool(attrs.get(k)) for k in ("alwaysIncludeInContext", "noAutoInclude", "doNotTrack")},
            fields={str(k): str(v) for k, v in fields.items() if v not in (None, "")},
            urls=[str(u) for u in (meta.get("links") or {}).get("externalReferences") or [] if u],
            nested=[str(n) for n in (meta.get("relationships") or {}).get("nestedEntries") or []],
            thumbnail=self.read(thumb, MAX_IMAGE_BYTES) if thumb else None,
            thumbnail_name=thumb.rsplit("/", 1)[-1],
            raw=meta,
        )

    def writing(self) -> tuple[list[Snippet], list[Chat]]:
        snippets: list[Snippet] = []
        chats: list[Chat] = []
        for name in sorted(self.by_name):
            if not name.endswith(".md") or name.count("/") != 1:
                continue
            folder, stem = name.split("/")[0], _stem(name)
            dated = _DATE.match(stem)
            date = dated.group(1) if dated else ""
            if folder == "snippets":
                meta, body = front_matter(self.text(name))
                snippets.append(
                    Snippet(
                        id=_id_after_dash(stem),
                        origin=name,
                        title=str(meta.get("title") or ""),
                        body=body.strip(),
                        favourite=bool(meta.get("favourite")),
                        date=date,
                    )
                )
            elif folder == "chats":
                title, turns = parse_chat(self.text(name))
                if turns:
                    chats.append(Chat(id=_id_after_dash(stem), origin=name, title=title, date=date, turns=turns))
        return snippets, chats


def read_export(data: bytes) -> Export:
    """The whole export, or NotAnExport saying why not."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise NotAnExport("This is not a zip file") from e
    with zf:
        archive = _Archive(zf)
        if "novel.docx" not in archive.by_name:
            raise NotAnExport("The archive has no novel.docx")
        folders = sorted(
            n.rsplit("/", 1)[0] for n in archive.by_name if n.count("/") == 2 and n.endswith("/metadata.json")
        )
        entries = [e for e in (archive.entry(f) for f in folders) if e is not None]
        snippets, chats = archive.writing()
        return Export(
            docx=archive.read("novel.docx", MAX_TOTAL_BYTES),
            entries=entries,
            snippets=snippets,
            chats=chats,
            has_codex_html="codex.html" in archive.by_name,
        )
