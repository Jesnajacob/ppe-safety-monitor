"""
Dashboard router — aggregated statistics for the main dashboard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Return aggregated statistics for the dashboard."""
    # All analyses
    analyses = db.query(models.AnalysisResult).all()
    violations = db.query(models.Violation).all()

    total_workers = sum(a.total_workers for a in analyses)
    safe_workers = sum(a.safe_workers for a in analyses)
    ppe_violations = sum(a.ppe_violations for a in analyses)
    zone_violations = sum(a.zone_violations for a in analyses)
    avg_score = (
        sum(a.safety_score for a in analyses) / len(analyses)
        if analyses else 88.5  # Default demo score
    )

    # PPE compliance by category (from worker detections)
    workers_all = db.query(models.WorkerDetection).all()
    total_w = len(workers_all) or 1

    helmet_ok = sum(1 for w in workers_all if w.has_helmet)
    vest_ok = sum(1 for w in workers_all if w.has_vest)
    gloves_ok = sum(1 for w in workers_all if w.has_gloves)
    shoes_ok = sum(1 for w in workers_all if w.has_shoes)

    # Violations by type
    type_counts: dict = {}
    for v in violations:
        type_counts[v.violation_type] = type_counts.get(v.violation_type, 0) + 1

    # Safety status distribution
    status_dist = {
        "Safe": safe_workers,
        "PPE Violation": ppe_violations,
        "Zone Violation": zone_violations,
    }

    # Recent violations (last 5)
    recent_violations = (
        db.query(models.Violation)
        .order_by(models.Violation.detected_at.desc())
        .limit(5)
        .all()
    )

    # Violations over time (last 7 days)
    violations_trend = []
    for i in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        count = sum(
            1 for v in violations
            if v.detected_at and day_start <= v.detected_at <= day_end
        )
        violations_trend.append({
            "day": day.strftime("%a"),
            "date": day.strftime("%Y-%m-%d"),
            "count": count,
        })

    # Use demo values if no real data yet
    if not analyses:
        total_workers = 127
        safe_workers = 109
        ppe_violations = 14
        zone_violations = 4
        avg_score = 88.5
        helmet_ok_pct = 94
        vest_ok_pct = 91
        gloves_ok_pct = 78
        shoes_ok_pct = 89
    else:
        helmet_ok_pct = round(helmet_ok / total_w * 100, 1)
        vest_ok_pct = round(vest_ok / total_w * 100, 1)
        gloves_ok_pct = round(gloves_ok / total_w * 100, 1)
        shoes_ok_pct = round(shoes_ok / total_w * 100, 1)

    return {
        "kpis": {
            "total_workers": total_workers,
            "safe_workers": safe_workers,
            "ppe_violations": ppe_violations,
            "zone_violations": zone_violations,
            "safety_score": round(avg_score, 1),
            "total_analyses": len(analyses),
            "total_violations": len(violations),
        },
        "ppe_compliance": {
            "helmet": helmet_ok_pct if analyses else 94,
            "vest": vest_ok_pct if analyses else 91,
            "gloves": gloves_ok_pct if analyses else 78,
            "shoes": shoes_ok_pct if analyses else 89,
        },
        "violations_by_type": type_counts if type_counts else {
            "Missing Gloves": 8,
            "Missing Safety Vest": 5,
            "Restricted Area Violation": 4,
            "Missing Helmet": 3,
            "Missing Safety Shoes": 2,
        },
        "status_distribution": status_dist,
        "violations_trend": violations_trend,
        "recent_violations": [
            {
                "violation_id": v.violation_id,
                "worker_label": v.worker_label,
                "violation_type": v.violation_type,
                "severity": v.severity,
                "location": v.location,
                "status": v.status,
                "detected_at": v.detected_at,
            }
            for v in recent_violations
        ],
    }
