"""
Demo AI Detection Service.

Simulates a YOLO-based PPE detection pipeline with realistic results.
Architecture is fully pluggable — replace `demo_detect()` with `yolo_detect()`
using the same interface to integrate a real model.

Detection output schema:
{
  "workers": [
    {
      "worker_id": 1,
      "worker_label": "Worker #01",
      "bounding_box": {"x": 0.1, "y": 0.05, "w": 0.15, "h": 0.45},
      "confidence": 0.97,
      "ppe": {
        "helmet":  {"detected": True,  "confidence": 0.98, "box": {...}},
        "vest":    {"detected": True,  "confidence": 0.93, "box": {...}},
        "gloves":  {"detected": False, "confidence": 0.0,  "box": None},
        "shoes":   {"detected": True,  "confidence": 0.89, "box": {...}},
      },
      "zone": {"name": "Zone A", "is_restricted": False},
      "is_safe": False,
      "violation_type": "Missing Gloves",
      "severity": "Medium"
    }
  ],
  "summary": {
    "total_workers": 4,
    "safe_workers": 3,
    "ppe_violations": 1,
    "zone_violations": 0,
    "safety_score": 87.5
  },
  "is_demo": True
}
"""

import random
import math
from typing import Optional


# ─────────────────────────────────────────────
# PPE Configuration
# ─────────────────────────────────────────────

PPE_ITEMS = ["helmet", "vest", "gloves", "shoes"]

PPE_DISPLAY = {
    "helmet": "Safety Helmet",
    "vest": "Safety Vest",
    "gloves": "Safety Gloves",
    "shoes": "Safety Shoes",
}

ZONES = ["Zone A", "Zone B", "Zone C", "Entrance", "Loading Bay", "Assembly Line", "Warehouse", "Rooftop"]

SEVERITY_MAP = {
    "Missing Helmet": "High",
    "Missing Safety Vest": "Medium",
    "Missing Gloves": "Medium",
    "Missing Safety Shoes": "Medium",
    "Restricted Area Violation": "Critical",
    "Multiple PPE Violations": "High",
}


# ─────────────────────────────────────────────
# Helper: Random bounding box within image area
# ─────────────────────────────────────────────

def _random_person_box(index: int, total: int) -> dict:
    """Generate a person bounding box. Distributes workers across the image width."""
    col = index % 4
    row = index // 4

    # Base column position
    x_start = col * 0.22 + random.uniform(0.0, 0.05)
    y_start = row * 0.5 + random.uniform(0.0, 0.08)

    w = random.uniform(0.12, 0.18)
    h = random.uniform(0.35, 0.50)

    # Clamp to [0, 1]
    x_start = min(max(x_start, 0.0), 0.80)
    y_start = min(max(y_start, 0.0), 0.50)
    w = min(w, 1.0 - x_start)
    h = min(h, 1.0 - y_start)

    return {"x": round(x_start, 4), "y": round(y_start, 4), "w": round(w, 4), "h": round(h, 4)}


def _ppe_box_inside(person_box: dict, ppe_type: str) -> dict:
    """Generate a PPE bounding box relative to the person box."""
    px, py, pw, ph = person_box["x"], person_box["y"], person_box["w"], person_box["h"]

    offsets = {
        "helmet": (0.15, 0.02, 0.70, 0.22),
        "vest":   (0.10, 0.25, 0.80, 0.35),
        "gloves": (0.05, 0.55, 0.30, 0.20),
        "shoes":  (0.10, 0.78, 0.80, 0.18),
    }
    ox, oy, ow, oh = offsets.get(ppe_type, (0.1, 0.1, 0.8, 0.2))

    bx = round(px + ox * pw, 4)
    by = round(py + oy * ph, 4)
    bw = round(ow * pw, 4)
    bh = round(oh * ph, 4)

    return {"x": bx, "y": by, "w": bw, "h": bh}


# ─────────────────────────────────────────────
# Core detection function
# ─────────────────────────────────────────────

def demo_detect(
    image_path: str,
    required_ppe: Optional[list] = None,
    confidence_threshold: float = 0.6,
    seed: Optional[int] = None
) -> dict:
    """
    Demo AI detection — simulates a YOLO PPE detection pipeline.

    Args:
        image_path: Path to the uploaded image/video frame.
        required_ppe: List of required PPE items. Defaults to all four.
        confidence_threshold: Minimum confidence to count as detected.
        seed: Optional random seed for reproducibility.

    Returns:
        Detection result dict following the schema above.
    """
    if seed is not None:
        random.seed(seed)

    if required_ppe is None:
        required_ppe = PPE_ITEMS

    # ── Decide number of workers (realistic range)
    num_workers = random.randint(2, 8)

    workers = []
    total_ppe_required = 0
    total_ppe_compliant = 0
    zone_violations = 0

    # Pre-decide: ensure at least 1 safe worker and at least 1 violation for demo interest
    forced_safe = random.randint(0, num_workers - 1)
    forced_violation = (forced_safe + 1) % num_workers

    for i in range(num_workers):
        worker_id = i + 1
        worker_label = f"Worker #{worker_id:02d}"
        person_box = _random_person_box(i, num_workers)
        person_confidence = round(random.uniform(0.85, 0.99), 3)

        # Zone assignment
        zone_name = random.choice(ZONES)
        # ~15% chance of restricted zone violation (except for forced_safe)
        is_restricted = False
        if i != forced_safe and random.random() < 0.15:
            is_restricted = True
            zone_name = random.choice(["Restricted Zone B", "Danger Zone", "No-Entry Area"])

        # PPE detection per item
        ppe_results = {}
        for ppe in PPE_ITEMS:
            if ppe not in required_ppe:
                continue

            # Determine if detected
            if i == forced_safe:
                # This worker is always fully compliant
                detected = True
                conf = round(random.uniform(0.88, 0.99), 3)
            elif i == forced_violation:
                # Guarantee at least one item missing
                if ppe == PPE_ITEMS[random.randint(0, len(PPE_ITEMS) - 1)]:
                    detected = False
                    conf = 0.0
                else:
                    detected = random.random() > 0.25
                    conf = round(random.uniform(0.70, 0.98), 3) if detected else 0.0
            else:
                # ~75% detection probability
                detected = random.random() > 0.25
                conf = round(random.uniform(0.70, 0.98), 3) if detected else 0.0

            box = _ppe_box_inside(person_box, ppe) if detected else None

            ppe_results[ppe] = {
                "detected": detected,
                "confidence": conf,
                "box": box,
                "display_name": PPE_DISPLAY[ppe],
            }

            total_ppe_required += 1
            if detected:
                total_ppe_compliant += 1

        # Determine missing PPE
        missing_ppe = [
            PPE_DISPLAY[k] for k, v in ppe_results.items() if not v["detected"]
        ]

        # Violation type
        is_safe = not missing_ppe and not is_restricted
        violation_type = None
        severity = None

        if is_restricted:
            violation_type = "Restricted Area Violation"
            severity = "Critical"
            zone_violations += 1
        elif len(missing_ppe) > 1:
            violation_type = "Multiple PPE Violations"
            severity = "High"
        elif len(missing_ppe) == 1:
            violation_type = f"Missing {missing_ppe[0]}"
            severity = SEVERITY_MAP.get(violation_type, "Medium")

        workers.append({
            "worker_id": worker_id,
            "worker_label": worker_label,
            "bounding_box": person_box,
            "confidence": person_confidence,
            "ppe": ppe_results,
            "zone": {
                "name": zone_name,
                "is_restricted": is_restricted,
            },
            "is_safe": is_safe,
            "violation_type": violation_type,
            "severity": severity,
            "missing_ppe": missing_ppe,
        })

    # ── Summary
    safe_workers = sum(1 for w in workers if w["is_safe"])
    ppe_violations = sum(
        1 for w in workers
        if not w["is_safe"] and not w["zone"]["is_restricted"]
    )

    # Safety score: (compliant PPE / required PPE) weighted with zone violations
    base_score = (total_ppe_compliant / total_ppe_required * 100) if total_ppe_required > 0 else 100
    zone_penalty = zone_violations * 5
    safety_score = max(0.0, round(base_score - zone_penalty, 1))

    return {
        "workers": workers,
        "summary": {
            "total_workers": num_workers,
            "safe_workers": safe_workers,
            "ppe_violations": ppe_violations,
            "zone_violations": zone_violations,
            "safety_score": safety_score,
        },
        "is_demo": True,
    }


# ─────────────────────────────────────────────
# Real YOLO integration placeholder
# ─────────────────────────────────────────────

def yolo_detect(
    image_path: str,
    model_path: str = "models/ppe_yolo.pt",
    required_ppe: Optional[list] = None,
    confidence_threshold: float = 0.6,
) -> dict:
    """
    Real YOLO detection — replace this with your trained PPE model.

    To use:
      1. Install: pip install ultralytics
      2. Load your model: model = YOLO(model_path)
      3. Run: results = model(image_path)
      4. Parse results into the same schema as demo_detect()

    Example class mapping for a custom PPE YOLO model:
      0: person
      1: helmet
      2: safety-vest
      3: gloves
      4: safety-shoes
    """
    raise NotImplementedError(
        "Real YOLO model not configured. "
        "Replace this function with your trained model inference code. "
        "See docstring for integration instructions."
    )
