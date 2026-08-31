"""
Reports router — generate daily/weekly/monthly safety reports + CSV export.
"""
import csv
import io
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _get_period_bounds(period: str):
    now = datetime.utcnow()
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "weekly":
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    else:
        start = datetime(2000, 1, 1)
        end = now
    return start, end


@router.get("/summary")
def get_report_summary(
    period: str = Query("monthly", enum=["daily", "weekly", "monthly", "all"]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Generate a safety report summary for the given time period."""
    start, end = _get_period_bounds(period)

    # Analyses in period
    analyses = (
        db.query(models.AnalysisResult)
        .filter(models.AnalysisResult.analyzed_at >= start)
        .filter(models.AnalysisResult.analyzed_at <= end)
        .all()
    )

    total_inspections = len(analyses)
    total_workers = sum(a.total_workers for a in analyses)
    safe_workers = sum(a.safe_workers for a in analyses)
    total_ppe_violations = sum(a.ppe_violations for a in analyses)
    total_zone_violations = sum(a.zone_violations for a in analyses)
    total_violations = total_ppe_violations + total_zone_violations
    avg_score = (
        sum(a.safety_score for a in analyses) / total_inspections
        if total_inspections > 0 else 0
    )
    ppe_compliance = (
        (safe_workers / total_workers * 100) if total_workers > 0 else 0
    )

    # Violations in period
    violations = (
        db.query(models.Violation)
        .filter(models.Violation.detected_at >= start)
        .filter(models.Violation.detected_at <= end)
        .all()
    )

    # Most common violation type
    type_counts: dict = {}
    zone_counts: dict = {}
    for v in violations:
        type_counts[v.violation_type] = type_counts.get(v.violation_type, 0) + 1
        zone_counts[v.location] = zone_counts.get(v.location, 0) + 1

    most_common_violation = max(type_counts, key=type_counts.get) if type_counts else "N/A"
    highest_violation_zone = max(zone_counts, key=zone_counts.get) if zone_counts else "N/A"

    # Daily breakdown for chart (last 30 days)
    daily_data = []
    for i in range(30, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        day_analyses = [
            a for a in
            db.query(models.AnalysisResult)
            .filter(models.AnalysisResult.analyzed_at >= day_start)
            .filter(models.AnalysisResult.analyzed_at <= day_end)
            .all()
        ]
        day_violations = sum(a.ppe_violations + a.zone_violations for a in day_analyses)
        daily_data.append({
            "date": day.strftime("%Y-%m-%d"),
            "violations": day_violations,
            "inspections": len(day_analyses),
        })

    return {
        "period": period,
        "period_start": start,
        "period_end": end,
        "total_inspections": total_inspections,
        "total_workers": total_workers,
        "safe_workers": safe_workers,
        "total_violations": total_violations,
        "ppe_violations": total_ppe_violations,
        "zone_violations": total_zone_violations,
        "ppe_compliance_pct": round(ppe_compliance, 1),
        "safety_score": round(avg_score, 1),
        "most_common_violation": most_common_violation,
        "highest_violation_zone": highest_violation_zone,
        "daily_data": daily_data,
    }


@router.get("/export/csv")
def export_violations_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Export all violations as a CSV file."""
    violations = db.query(models.Violation).order_by(models.Violation.detected_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Violation ID", "Worker", "Violation Type", "PPE Item",
        "Location", "Severity", "Status",
        "Detected At", "Acknowledged At", "Resolved At", "Notes"
    ])

    for v in violations:
        writer.writerow([
            v.violation_id,
            v.worker_label,
            v.violation_type,
            v.ppe_item or "",
            v.location,
            v.severity,
            v.status,
            v.detected_at.strftime("%Y-%m-%d %H:%M") if v.detected_at else "",
            v.acknowledged_at.strftime("%Y-%m-%d %H:%M") if v.acknowledged_at else "",
            v.resolved_at.strftime("%Y-%m-%d %H:%M") if v.resolved_at else "",
            v.notes or "",
        ])

    output.seek(0)
    filename = f"violations_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
