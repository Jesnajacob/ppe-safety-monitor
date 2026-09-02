"""
Restricted Zones router — CRUD for safety/restricted zone definitions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/zones", tags=["zones"])


class ZoneCreate(BaseModel):
    name: str
    zone_type: str = "Rectangle"
    coordinates: list
    color: str = "#EF4444"
    description: Optional[str] = None


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    color: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
def list_zones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all restricted zones."""
    zones = db.query(models.RestrictedZone).all()
    return [
        {
            "id": z.id,
            "name": z.name,
            "zone_type": z.zone_type,
            "coordinates": z.coordinates,
            "color": z.color,
            "is_active": z.is_active,
            "description": z.description,
            "created_at": z.created_at,
        }
        for z in zones
    ]


@router.post("/")
def create_zone(
    payload: ZoneCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new restricted zone."""
    zone = models.RestrictedZone(
        name=payload.name,
        zone_type=payload.zone_type,
        coordinates=payload.coordinates,
        color=payload.color,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return {"id": zone.id, "name": zone.name, "message": "Zone created"}


@router.patch("/{zone_id}")
def update_zone(
    zone_id: int,
    payload: ZoneUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a restricted zone."""
    zone = db.query(models.RestrictedZone).filter(models.RestrictedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    if payload.name is not None:
        zone.name = payload.name
    if payload.is_active is not None:
        zone.is_active = payload.is_active
    if payload.color is not None:
        zone.color = payload.color
    if payload.description is not None:
        zone.description = payload.description

    db.commit()
    return {"message": "Zone updated", "id": zone_id}


@router.delete("/{zone_id}")
def delete_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a restricted zone."""
    zone = db.query(models.RestrictedZone).filter(models.RestrictedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    db.delete(zone)
    db.commit()
    return {"message": "Zone deleted"}
