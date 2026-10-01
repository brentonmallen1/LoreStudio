"""A finding's id is stable across reads and specific to what it is about (doc 12 P3)."""

from app.schemas.findings import FindingAnchor
from app.services.findings.fingerprint import content_hash, fingerprint, normalise


def test_the_same_finding_gets_the_same_id():
    a = FindingAnchor(node_id="n1")
    assert fingerprint("name_drift", a, "Elenor") == fingerprint("name_drift", a, "Elenor")


def test_wording_noise_does_not_change_the_id():
    a = FindingAnchor(node_id="n1")
    assert fingerprint("x", a, "“She  said”\n") == fingerprint("x", a, '"she said"')


def test_a_different_place_or_check_is_a_different_finding():
    base = fingerprint("name_drift", FindingAnchor(node_id="n1"), "Elenor")
    assert base != fingerprint("name_drift", FindingAnchor(node_id="n2"), "Elenor")
    assert base != fingerprint("unknown_speaker", FindingAnchor(node_id="n1"), "Elenor")
    assert base != fingerprint("name_drift", FindingAnchor(character_id="n1"), "Elenor")


def test_normalise_and_content_hash():
    assert normalise("  It’s   “fine”. ") == 'it\'s "fine".'
    assert content_hash("<p>a</p>") == content_hash("<p>a</p>") != content_hash("<p>b</p>")
    assert content_hash(None) == content_hash("")
