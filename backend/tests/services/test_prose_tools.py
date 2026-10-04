"""Quote normalisation and consistency checks: deterministic, markup-safe."""

from app.services.consistency import levenshtein, name_drift
from app.services.text_utils import count_quote_styles, normalize_quotes_html, normalize_quotes_text


def test_curly_conversion_picks_opening_and_closing():
    assert normalize_quotes_text("\"Hello,\" she said. It's Mara's.", "curly") == "“Hello,” she said. It’s Mara’s."
    assert normalize_quotes_text("'Quoted' word", "curly") == "‘Quoted’ word"


def test_straight_conversion_and_roundtrip_counts():
    curly = "“Hello,” she said. It’s fine."
    assert normalize_quotes_text(curly, "straight") == '"Hello," she said. It\'s fine.'
    html = '<p>"Hi"<Maya> and <b>"there"</b></p>'
    out, n = normalize_quotes_html(html, "curly")
    assert n == 4
    assert "<maya>" in out.lower()  # speaker tag untouched
    assert "“there”" in out
    assert count_quote_styles(out) == {"straight": 0, "curly": 4}


def test_levenshtein_and_name_drift():
    assert levenshtein("Mara", "Marra") == 1
    assert levenshtein("Mara", "Tomas") > 2

    class Node:
        def __init__(self, id, title, content):
            self.id, self.title, self.content = id, title, content

    class Char:
        def __init__(self, name):
            self.name = name

    nodes = [Node("n1", "Lamp", "<p>Marra walked in. Mara sat. Then Tomas left. Thomas was gone.</p>")]
    findings = name_drift(nodes, [Char("Mara"), Char("Tomas")])
    flagged = {(f.text, f.suggestion) for f in findings}
    assert ("Marra", "Mara") in flagged
    assert ("Thomas", "Tomas") in flagged
    assert all(f.text != "Then" for f in findings)


def test_quote_endpoints_and_name_drift_in_the_feed(client):
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    client.post(f"/api/stories/{sid}/characters", json={"name": "Mara"})
    node = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "S", "level": 0, "level_type": "scene", "content": '<p>"Go," said Marra.</p>'},
    ).json()
    q = client.get(f"/api/stories/{sid}/quotes").json()
    assert q["total"]["straight"] == 2 and q["mixed"] is False
    dry = client.post(f"/api/stories/{sid}/quotes/normalize", json={"style": "curly", "dry_run": True}).json()
    assert dry["changed_chars"] == 2
    assert '"Go,"' in client.get(f"/api/structure/{node['id']}").json()["content"]
    real = client.post(f"/api/stories/{sid}/quotes/normalize", json={"style": "curly"}).json()
    assert real["changed_chars"] == 2
    assert "“Go,”" in client.get(f"/api/structure/{node['id']}").json()["content"]
    feed = client.get(f"/api/stories/{sid}/findings").json()["findings"]
    assert any(
        f["check"] == "name_drift"
        and {k: f["fix"][k] for k in ("kind", "old", "new")} == {"kind": "rename", "old": "Marra", "new": "Mara"}
        for f in feed
    )


def test_patch_me_merges_settings(client):
    r = client.patch("/api/auth/me", json={"settings": {"ui": {"mode": "writer"}}})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["ui"]["mode"] == "writer"
    r = client.patch("/api/auth/me", json={"settings": {"ui": {"theme": "nord"}}, "display_name": "Bee"})
    assert r.json()["settings"]["ui"] == {"mode": "writer", "theme": "nord"}
    assert r.json()["display_name"] == "Bee"


def test_name_drift_reads_the_words_of_a_name_not_its_punctuation():
    """ "The Visitor (Calder)" is Calder: the bare name is not a misspelling of "(Calder)"."""

    class Node:
        def __init__(self, id, title, content):
            self.id, self.title, self.content = id, title, content

    class Char:
        def __init__(self, name):
            self.name = name

    found = name_drift(
        [Node("n1", "Night Passage", "<p>Calder set down her bag. Caldor looked away.</p>")],
        [Char("The Visitor (Calder)")],
    )
    assert [(f.text, f.suggestion) for f in found] == [("Caldor", "Calder")]
