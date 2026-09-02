"""
Media upload router — upload images and videos for analysis.
"""
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/media", tags=["media"])

UPLOAD_DIR = "uploads/originals"
ALLOWED_TYPES = {
    "image/jpeg": "image",
    "image/jpg": "image",
    "image/png": "image",
    "video/mp4": "video",
    "video/avi": "video",
    "video/quicktime": "video",
    "video/x-msvideo": "video",
}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload an image or video file for safety analysis."""
    # Validate mime type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
                   f"Allowed: JPG, PNG, MP4, AVI, MOV"
        )

    file_type = ALLOWED_TYPES[file.content_type]

    # Read file content
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 200 MB)")

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_filename)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Save file
    async with aiofiles.open(save_path, "wb") as f:
        await f.write(content)

    # Save DB record
    media = models.MediaFile(
        filename=unique_filename,
        original_filename=file.filename,
        file_type=file_type,
        file_size=file_size,
        file_path=save_path,
        mime_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        "id": media.id,
        "filename": media.filename,
        "original_filename": media.original_filename,
        "file_type": media.file_type,
        "file_size": media.file_size,
        "uploaded_at": media.uploaded_at,
    }


@router.get("/")
def list_media(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all uploaded media files."""
    files = (
        db.query(models.MediaFile)
        .order_by(models.MediaFile.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": f.id,
            "original_filename": f.original_filename,
            "file_type": f.file_type,
            "file_size": f.file_size,
            "uploaded_at": f.uploaded_at,
        }
        for f in files
    ]


@router.get("/{file_id}")
def get_media(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a single media file record."""
    media = db.query(models.MediaFile).filter(models.MediaFile.id == file_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media file not found")
    return {
        "id": media.id,
        "filename": media.filename,
        "original_filename": media.original_filename,
        "file_type": media.file_type,
        "file_size": media.file_size,
        "file_path": media.file_path,
        "mime_type": media.mime_type,
        "uploaded_at": media.uploaded_at,
    }
