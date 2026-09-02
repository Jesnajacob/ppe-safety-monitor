"""
Settings router — get/update app-level configuration.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from backend.database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    require_helmet: Optional[bool] = None
    require_vest: Optional[bool] = None
    require_gloves: Optional[bool] = None
    require_shoes: Optional[bool] = None
    confidence_threshold: Optional[float] = None
    alert_on_violation: Optional[bool] = None
    alert_email: Optional[str] = None
    max_workers_per_frame: Optional[int] = None
    demo_mode: Optional[bool] = None
    site_name: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get application settings."""
    settings = db.query(models.AppSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not initialized")

    return {
        "require_helmet": settings.require_helmet,
        "require_vest": settings.require_vest,
        "require_gloves": settings.require_gloves,
        "require_shoes": settings.require_shoes,
        "confidence_threshold": settings.confidence_threshold,
        "alert_on_violation": settings.alert_on_violation,
        "alert_email": settings.alert_email,
        "max_workers_per_frame": settings.max_workers_per_frame,
        "demo_mode": settings.demo_mode,
        "site_name": settings.site_name,
        "updated_at": settings.updated_at,
    }


@router.put("/")
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update application settings."""
    settings = db.query(models.AppSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not initialized")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Settings updated successfully"}


@router.put("/profile")
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update the current user's profile."""
    user = db.query(models.User).filter(models.User.id == current_user.id).first()

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        # Check uniqueness
        existing = db.query(models.User).filter(
            models.User.email == payload.email,
            models.User.id != user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email

    db.commit()
    return {"message": "Profile updated"}
