"""
Unit tests for IoU scoring functions.
Run with:  python3 -m pytest test_iou.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# Import the functions directly without starting the FastAPI app
from main import compute_iou, score_submission


# ── compute_iou ───────────────────────────────────────────────────────────────

def test_perfect_overlap():
    box = {"x": 0, "y": 0, "w": 100, "h": 100}
    assert compute_iou(box, box) == 1.0


def test_zero_overlap():
    a = {"x": 0,   "y": 0,   "w": 50, "h": 50}
    b = {"x": 100, "y": 100, "w": 50, "h": 50}
    assert compute_iou(a, b) == 0.0


def test_partial_overlap():
    # a covers [0,100] x [0,100], b covers [50,150] x [50,150]
    # Intersection: 50x50 = 2500; Union: 10000 + 10000 - 2500 = 17500
    a = {"x": 0,  "y": 0,  "w": 100, "h": 100}
    b = {"x": 50, "y": 50, "w": 100, "h": 100}
    expected = 2500 / 17500
    assert abs(compute_iou(a, b) - expected) < 1e-6


def test_contained_box():
    # b completely inside a
    a = {"x": 0, "y": 0, "w": 100, "h": 100}
    b = {"x": 25, "y": 25, "w": 50, "h": 50}
    # Intersection = 50*50 = 2500; Union = 10000 + 2500 - 2500 = 10000
    assert abs(compute_iou(a, b) - 0.25) < 1e-6


def test_zero_area_box_returns_zero():
    a = {"x": 0, "y": 0, "w": 0, "h": 0}
    b = {"x": 0, "y": 0, "w": 100, "h": 100}
    assert compute_iou(a, b) == 0.0


# ── score_submission ──────────────────────────────────────────────────────────

def test_score_empty_gt_returns_zero():
    submitted = [{"label": "cat", "x": 0, "y": 0, "w": 50, "h": 50}]
    assert score_submission(submitted, []) == 0.0


def test_score_wrong_label_returns_zero():
    gt        = [{"label": "cat",  "x": 0, "y": 0, "w": 100, "h": 100}]
    submitted = [{"label": "dog",  "x": 0, "y": 0, "w": 100, "h": 100}]
    # No same-label match → best IoU = 0.0
    assert score_submission(submitted, gt) == 0.0


def test_score_perfect_match():
    box = {"label": "cat", "x": 0, "y": 0, "w": 100, "h": 100}
    assert score_submission([box], [box]) == 1.0


def test_score_partial_match():
    gt        = [{"label": "hat", "x": 0, "y": 0, "w": 100, "h": 100}]
    submitted = [{"label": "hat", "x": 50, "y": 50, "w": 100, "h": 100}]
    iou = compute_iou(gt[0], submitted[0])
    assert abs(score_submission(submitted, gt) - iou) < 1e-6


def test_score_multiple_gt_boxes():
    gt = [
        {"label": "hat",    "x": 0,   "y": 0,   "w": 100, "h": 100},
        {"label": "person", "x": 200, "y": 200,  "w": 100, "h": 100},
    ]
    submitted = [
        {"label": "hat",    "x": 0,   "y": 0,   "w": 100, "h": 100},  # perfect
        {"label": "person", "x": 250, "y": 250,  "w": 100, "h": 100},  # partial
    ]
    iou_person = compute_iou(gt[1], submitted[1])
    expected = (1.0 + iou_person) / 2
    assert abs(score_submission(submitted, gt) - expected) < 1e-6


# ── computeSharesBps equivalent (Python port for validation) ─────────────────

def compute_shares_bps(iou_scores: list, min_iou: float = 0.30) -> list:
    """Python port of annotation-indexer.js computeSharesBps for validation."""
    floored = [s if s >= min_iou else 0.0 for s in iou_scores]
    total = sum(floored)
    if total == 0:
        return [0] * len(iou_scores)

    raw = [int((s / total) * 10000) for s in floored]
    remainder = 10000 - sum(raw)
    max_idx = raw.index(max(raw))
    raw[max_idx] += remainder
    return raw


def test_shares_sum_to_10000():
    scores = [0.87, 0.73, 0.47]
    shares = compute_shares_bps(scores)
    assert sum(shares) == 10000


def test_shares_below_threshold_get_zero():
    scores = [0.87, 0.12]   # 0.12 < MIN_IOU=0.30
    shares = compute_shares_bps(scores)
    assert shares[1] == 0
    assert shares[0] == 10000


def test_shares_all_below_threshold():
    scores = [0.10, 0.15, 0.20]
    shares = compute_shares_bps(scores)
    assert shares == [0, 0, 0]


def test_shares_proportional():
    scores = [1.0, 1.0]   # equal quality → equal split
    shares = compute_shares_bps(scores)
    assert shares[0] == shares[1] == 5000


def test_shares_always_nonnegative():
    scores = [0.5, 0.0, 0.3]
    shares = compute_shares_bps(scores)
    assert all(s >= 0 for s in shares)
    assert sum(shares) == 10000
