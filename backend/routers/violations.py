"""
Violations router — list, filter, acknowledge and resolve safety violations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date
from typing import Optional

from backend.database import get_db
from backend import models
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/violations", tags=["violations"])


@router.get("/")
def list_violations(
    violation_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    worker: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List violations with optional filters."""
    query = db.query(models.Violation)

    if violation_type:
        query = query.filter(models.Violation.violation_type.ilike(f"%{violation_type}%"))
    if severity:
        query = query.filter(models.Violation.severity == severity)
    if status:
        query = query.filter(models.Violation.status == status)
    if worker:
        query = query.filter(models.Violation.worker_label.ilike(f"%{worker}%"))
    if date_from:
        try:
            dt = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(models.Violation.detected_at >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(models.Violation.detected_at <= dt)
        except ValueError:
            pass

    total = query.count()
    violations = (
        query.order_by(models.Violation.detected_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "violations": [
            {
                "id": v.id,
                "violation_id": v.violation_id,
                "worker_label": v.worker_label,
                "violation_type": v.violation_type,
                "ppe_item": v.ppe_item,
                "location": v.location,
                "severity": v.severity,
                "status": v.status,
                "detected_at": v.detected_at,
                "acknowledged_at": v.acknowledged_at,
                "resolved_at": v.resolved_at,
                "notes": v.notes,
            }
            for v in violations
        ]
    }


@router.patch("/{violation_id}/acknowledge")
def acknowledge_violation(
    violation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Acknowledge an open violation."""
    v = db.query(models.Violation).filter(models.Violation.id == violation_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    v.status = "Acknowledged"
    v.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"message": "Violation acknowledged", "id": violation_id}


@router.patch("/{violation_id}/resolve")
def resolve_violation(
    violation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark a violation as resolved."""
    v = db.query(models.Violation).filter(models.Violation.id == violation_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    v.status = "Resolved"
    v.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Violation resolved", "id": violation_id}


@router.get("/stats/summary")
def violation_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Return violation counts by type and severity."""
    violations = db.query(models.Violation).all()

    by_type: dict = {}
    by_severity: dict = {}
    by_status: dict = {"Open": 0, "Acknowledged": 0, "Resolved": 0}

    for v in violations:
        by_type[v.violation_type] = by_type.get(v.violation_type, 0) + 1
        by_severity[v.severity] = by_severity.get(v.severity, 0) + 1
        by_status[v.status] = by_status.get(v.status, 0) + 1

    return {
        "total": len(violations),
        "by_type": by_type,
        "by_severity": by_severity,
        "by_status": by_status,
    }
