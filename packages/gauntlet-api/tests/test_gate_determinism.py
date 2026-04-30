"""Gate must be deterministic — same corpus + same agent version = same hash.

We test the hash function directly (no DB required)."""
import uuid
from types import SimpleNamespace

from gauntlet_api.gate.gate import corpus_hash


def _case(**kw):
    base = dict(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        input={"request": "x"},
        rubric="r",
        difficulty=3,
        cluster_tag="t",
        generation_method="human",
        golden=False,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_same_corpus_yields_same_hash():
    a = _case()
    b = _case()
    assert corpus_hash([a]) == corpus_hash([b])


def test_corpus_order_does_not_affect_hash():
    a = _case(id=uuid.UUID("00000000-0000-0000-0000-000000000001"))
    b = _case(id=uuid.UUID("00000000-0000-0000-0000-000000000002"))
    assert corpus_hash([a, b]) == corpus_hash([b, a])


def test_different_input_changes_hash():
    a = _case()
    b = _case(input={"request": "y"})
    assert corpus_hash([a]) != corpus_hash([b])


def test_golden_promotion_changes_hash():
    a = _case()
    b = _case(golden=True)
    assert corpus_hash([a]) != corpus_hash([b])
