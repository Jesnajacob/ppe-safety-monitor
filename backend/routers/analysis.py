"""
Analysis router — run AI detection, store results, serve annotated image.
"""
import os
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.routers.auth import get_current_user
from backend.services.ai_detection import demo_detect
from backend.services.image_processor import annotate_image

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

ANNOTATED_DIR = "uploads/annotated"
VIOLATION_COUNTER_KEY = "_violation_counter"

# ── Shared violation counter (in-memory, reset on restart)
_violation_seq = {"n": 0}


def _next_violation_id(db: Session) -> str:
    count = db.query(models.Violation).count()
    return f"V{count + 1:03d}"


@router.post("/analyze/{file_id}")
def analyze_media(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Run the AI detection pipeline on an uploaded media file.
    Returns the analysis ID.
    """
    # Fetch media file
    media = db.query(models.MediaFile).filter(models.MediaFile.id == file_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media file not found")

    # Fetch settings
    settings = db.query(models.AppSettings).first()
    required_ppe = []
    if settings:
        if settings.require_helmet: required_ppe.append("helmet")
        if settings.require_vest:   required_ppe.append("vest")
        if settings.require_gloves: required_ppe.append("gloves")
        if settings.require_shoes:  required_ppe.append("shoes")
        conf_threshold = settings.confidence_threshold
    else:
        required_ppe = ["helmet", "vest", "gloves", "shoes"]
        conf_threshold = 0.6

    # ── Run demo detection
    start_ms = time.time()
    detection = demo_detect(
        image_path=media.file_path,
        required_ppe=required_ppe,
        confidence_threshold=conf_threshold,
    )
    elapsed_ms = int((time.time() - start_ms) * 1000)

    summary = detection["summary"]

    # ── Annotate image
    annotated_filename = f"annotated_{media.filename.replace(os.path.splitext(media.filename)[1], '.jpg')}"
    annotated_path = os.path.join(ANNOTATED_DIR, annotated_filename)

    try:
        annotate_image(
            image_path=media.file_path,
            detection_result=detection,
            output_path=annotated_path,
        )
    except Exception as e:
        annotated_path = None
        print(f"[WARN] Could not annotate image: {e}")

    # ── Save AnalysisResult
    analysis = models.AnalysisResult(
        media_file_id=media.id,
        status="completed",
        total_workers=summary["total_workers"],
        safe_workers=summary["safe_workers"],
        ppe_violations=summary["ppe_violations"],
        zone_violations=summary["zone_violations"],
        safety_score=summary["safety_score"],
        annotated_image_path=annotated_path,
        processing_time_ms=elapsed_ms,
        is_demo=True,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # ── Save WorkerDetections + Violations
    for worker in detection["workers"]:
        wd = models.WorkerDetection(
            analysis_id=analysis.id,
            worker_label=worker["worker_label"],
            bounding_box=worker["bounding_box"],
            confidence=worker["confidence"],
            is_safe=worker["is_safe"],
            has_helmet=worker["ppe"].get("helmet", {}).get("detected", True),
            has_vest=worker["ppe"].get("vest", {}).get("detected", True),
            has_gloves=worker["ppe"].get("gloves", {}).get("detected", True),
            has_shoes=worker["ppe"].get("shoes", {}).get("detected", True),
            in_safe_zone=not worker["zone"]["is_restricted"],
            violation_type=worker.get("violation_type"),
            severity=worker.get("severity"),
            zone_label=worker["zone"]["name"],
        )
        db.add(wd)
        db.flush()

        # Create violation record if applicable
        if not worker["is_safe"]:
            vid = _next_violation_id(db)
            ppe_item = None
            if worker["missing_ppe"]:
                ppe_item = worker["missing_ppe"][0]

            v = models.Violation(
                violation_id=vid,
                worker_label=worker["worker_label"],
                violation_type=worker.get("violation_type", "Unknown"),
                ppe_item=ppe_item,
                location=worker["zone"]["name"],
                severity=worker.get("severity", "Medium"),
                status="Open",
                media_file_id=media.id,
                analysis_id=analysis.id,
            )
            db.add(v)

    db.commit()

    return {
        "analysis_id": analysis.id,
        "total_workers": summary["total_workers"],
        "safe_workers": summary["safe_workers"],
        "ppe_violations": summary["ppe_violations"],
        "zone_violations": summary["zone_violations"],
        "safety_score": summary["safety_score"],
        "processing_time_ms": elapsed_ms,
        "is_demo": True,
        "has_annotated_image": annotated_path is not None,
    }


@router.get("/{analysis_id}")
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve full analysis result with per-worker details."""
    analysis = db.query(models.AnalysisResult).filter(
        models.AnalysisResult.id == analysis_id
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    workers = db.query(models.WorkerDetection).filter(
        models.WorkerDetection.analysis_id == analysis_id
    ).all()

    return {
        "id": analysis.id,
        "media_file_id": analysis.media_file_id,
        "status": analysis.status,
        "total_workers": analysis.total_workers,
        "safe_workers": analysis.safe_workers,
        "ppe_violations": analysis.ppe_violations,
        "zone_violations": analysis.zone_violations,
        "safety_score": analysis.safety_score,
        "processing_time_ms": analysis.processing_time_ms,
        "is_demo": analysis.is_demo,
        "analyzed_at": analysis.analyzed_at,
        "has_annotated_image": analysis.annotated_image_path is not None,
        "workers": [
            {
                "worker_label": w.worker_label,
                "confidence": w.confidence,
                "bounding_box": w.bounding_box,
                "is_safe": w.is_safe,
                "has_helmet": w.has_helmet,
                "has_vest": w.has_vest,
                "has_gloves": w.has_gloves,
                "has_shoes": w.has_shoes,
                "in_safe_zone": w.in_safe_zone,
                "violation_type": w.violation_type,
                "severity": w.severity,
                "zone_label": w.zone_label,
            }
            for w in workers
        ],
    }


@router.get("/annotated/{analysis_id}")
def get_annotated_image(
    analysis_id: int,
    db: Session = Depends(get_db),
):
    """Serve the annotated image for a given analysis (no auth required for img src)."""
    analysis = db.query(models.AnalysisResult).filter(
        models.AnalysisResult.id == analysis_id
    ).first()
    if not analysis or not analysis.annotated_image_path:
        raise HTTPException(status_code=404, detail="Annotated image not found")

    if not os.path.exists(analysis.annotated_image_path):
        raise HTTPException(status_code=404, detail="Annotated image file missing")

    return FileResponse(analysis.annotated_image_path, media_type="image/jpeg")


@router.get("/list/all")
def list_analyses(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all analyses, newest first."""
    analyses = (
        db.query(models.AnalysisResult)
        .order_by(models.AnalysisResult.analyzed_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "media_file_id": a.media_file_id,
            "total_workers": a.total_workers,
            "safe_workers": a.safe_workers,
            "ppe_violations": a.ppe_violations,
            "zone_violations": a.zone_violations,
            "safety_score": a.safety_score,
            "analyzed_at": a.analyzed_at,
            "is_demo": a.is_demo,
        }
        for a in analyses
    ]
