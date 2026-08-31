"""
Seed script — populate the database with a demo admin user,
sample violations, restricted zones, and app settings on first run.
"""
from datetime import datetime, timedelta
import random

from database import SessionLocal
import models
from routers.auth import hash_password


DEMO_VIOLATIONS = [
    ("Worker #03", "Missing Helmet", "Helmet", "Zone A", "High", "Open"),
    ("Worker #05", "Missing Gloves", "Gloves", "Zone B", "Medium", "Open"),
    ("Worker #07", "Restricted Area Violation", None, "Restricted Zone B", "Critical", "Acknowledged"),
    ("Worker #02", "Missing Safety Vest", "Safety Vest", "Zone C", "Medium", "Open"),
    ("Worker #09", "Missing Safety Shoes", "Safety Shoes", "Entrance", "Medium", "Resolved"),
    ("Worker #11", "Multiple PPE Violations", "Gloves, Helmet", "Loading Bay", "High", "Open"),
    ("Worker #04", "Missing Gloves", "Gloves", "Assembly Line", "Medium", "Acknowledged"),
    ("Worker #06", "Restricted Area Violation", None, "Danger Zone", "Critical", "Open"),
    ("Worker #08", "Missing Helmet", "Helmet", "Rooftop", "High", "Open"),
    ("Worker #01", "Missing Safety Vest", "Safety Vest", "Zone A", "Medium", "Resolved"),
    ("Worker #12", "Missing Gloves", "Gloves", "Warehouse", "Medium", "Open"),
    ("Worker #15", "Missing Safety Shoes", "Safety Shoes", "Zone B", "Medium", "Open"),
    ("Worker #10", "Multiple PPE Violations", "Helmet, Vest", "Zone C", "High", "Acknowledged"),
    ("Worker #14", "Restricted Area Violation", None, "No-Entry Area", "Critical", "Open"),
    ("Worker #13", "Missing Helmet", "Helmet", "Loading Bay", "High", "Resolved"),
    ("Worker #16", "Missing Gloves", "Gloves", "Zone A", "Medium", "Open"),
    ("Worker #17", "Missing Safety Vest", "Safety Vest", "Assembly Line", "Medium", "Open"),
    ("Worker #18", "Restricted Area Violation", None, "Restricted Zone B", "Critical", "Acknowledged"),
    ("Worker #19", "Missing Safety Shoes", "Safety Shoes", "Entrance", "Medium", "Open"),
    ("Worker #20", "Missing Helmet", "Helmet", "Rooftop", "High", "Open"),
]

DEMO_ZONES = [
    {
        "name": "Restricted Zone B",
        "zone_type": "Rectangle",
        "coordinates": [
            {"x": 0.6, "y": 0.1},
            {"x": 0.9, "y": 0.1},
            {"x": 0.9, "y": 0.5},
            {"x": 0.6, "y": 0.5},
        ],
        "color": "#EF4444",
        "description": "Heavy machinery area — authorized personnel only",
    },
    {
        "name": "Danger Zone",
        "zone_type": "Rectangle",
        "coordinates": [
            {"x": 0.1, "y": 0.6},
            {"x": 0.4, "y": 0.6},
            {"x": 0.4, "y": 0.95},
            {"x": 0.1, "y": 0.95},
        ],
        "color": "#F59E0B",
        "description": "Chemical storage — full PPE required",
    },
    {
        "name": "No-Entry Area",
        "zone_type": "Rectangle",
        "coordinates": [
            {"x": 0.55, "y": 0.55},
            {"x": 0.85, "y": 0.55},
            {"x": 0.85, "y": 0.95},
            {"x": 0.55, "y": 0.95},
        ],
        "color": "#8B5CF6",
        "description": "Electrical panel room — authorized electricians only",
    },
]


def seed_if_empty():
    """Seed demo data only if the users table is empty."""
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(models.User).count() > 0:
            return

        print("[SEED] Seeding demo data...")

        # ── Admin user
        admin = models.User(
            username="admin",
            email="admin@safety.com",
            hashed_password=hash_password("admin123"),
            full_name="Safety Administrator",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.flush()

        # ── App settings
        settings = models.AppSettings(
            require_helmet=True,
            require_vest=True,
            require_gloves=True,
            require_shoes=True,
            confidence_threshold=0.6,
            alert_on_violation=True,
            alert_email="admin@safety.com",
            site_name="Construction Site A — Demo",
            demo_mode=True,
        )
        db.add(settings)
        db.flush()

        # ── Restricted zones
        for z in DEMO_ZONES:
            zone = models.RestrictedZone(
                name=z["name"],
                zone_type=z["zone_type"],
                coordinates=z["coordinates"],
                color=z["color"],
                description=z["description"],
                is_active=True,
                created_by=admin.id,
            )
            db.add(zone)

        # ── Demo violations (with realistic timestamps spread over last 30 days)
        for i, (worker, v_type, ppe_item, location, severity, status) in enumerate(DEMO_VIOLATIONS):
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            detected_at = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)

            acknowledged_at = None
            resolved_at = None
            if status == "Acknowledged":
                acknowledged_at = detected_at + timedelta(hours=random.randint(1, 4))
            elif status == "Resolved":
                acknowledged_at = detected_at + timedelta(hours=1)
                resolved_at = detected_at + timedelta(hours=random.randint(4, 24))

            violation = models.Violation(
                violation_id=f"V{i + 1:03d}",
                worker_label=worker,
                violation_type=v_type,
                ppe_item=ppe_item,
                location=location,
                severity=severity,
                status=status,
                detected_at=detected_at,
                acknowledged_at=acknowledged_at,
                resolved_at=resolved_at,
            )
            db.add(violation)

        db.commit()
        print("[SEED] Demo data seeded successfully.")
        print("[SEED]  Login: admin@safety.com / admin123")

    except Exception as e:
        db.rollback()
        print(f"[SEED ERROR] {e}")
    finally:
        db.close()
