"""
SQLAlchemy ORM models for all database tables.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from backend.database import Base


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class SeverityLevel(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ViolationStatus(str, enum.Enum):
    OPEN = "Open"
    ACKNOWLEDGED = "Acknowledged"
    RESOLVED = "Resolved"


class ViolationType(str, enum.Enum):
    MISSING_HELMET = "Missing Helmet"
    MISSING_VEST = "Missing Safety Vest"
    MISSING_GLOVES = "Missing Gloves"
    MISSING_SHOES = "Missing Safety Shoes"
    RESTRICTED_AREA = "Restricted Area Violation"
    MULTIPLE_PPE = "Multiple PPE Violations"


# ─────────────────────────────────────────────
# ORM Models
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200))
    role = Column(String(50), default="admin")
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now())
    last_login = Column(DateTime, nullable=True)


class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_type = Column(String(20))  # image / video
    file_size = Column(Integer)  # bytes
    file_path = Column(String(1000))
    mime_type = Column(String(100))
    uploaded_at = Column(DateTime, default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"))

    analyses = relationship("AnalysisResult", back_populates="media_file")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    media_file_id = Column(Integer, ForeignKey("media_files.id"))
    status = Column(String(50), default="completed")  # pending / running / completed / failed
    total_workers = Column(Integer, default=0)
    safe_workers = Column(Integer, default=0)
    ppe_violations = Column(Integer, default=0)
    zone_violations = Column(Integer, default=0)
    safety_score = Column(Float, default=0.0)
    annotated_image_path = Column(String(1000), nullable=True)
    processing_time_ms = Column(Integer, default=0)
    is_demo = Column(Boolean, default=True)
    analyzed_at = Column(DateTime, default=func.now())

    media_file = relationship("MediaFile", back_populates="analyses")
    worker_detections = relationship("WorkerDetection", back_populates="analysis")


class WorkerDetection(Base):
    __tablename__ = "worker_detections"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analysis_results.id"))
    worker_label = Column(String(50))  # "Worker #01"
    bounding_box = Column(JSON)  # {x, y, w, h} normalized 0-1
    confidence = Column(Float, default=0.95)
    is_safe = Column(Boolean, default=True)
    has_helmet = Column(Boolean, default=True)
    has_vest = Column(Boolean, default=True)
    has_gloves = Column(Boolean, default=True)
    has_shoes = Column(Boolean, default=True)
    in_safe_zone = Column(Boolean, default=True)
    violation_type = Column(String(200), nullable=True)
    severity = Column(String(50), nullable=True)
    zone_label = Column(String(100), nullable=True)

    analysis = relationship("AnalysisResult", back_populates="worker_detections")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_id = Column(String(20), unique=True)  # V001, V002...
    worker_label = Column(String(50))
    violation_type = Column(String(200))
    ppe_item = Column(String(100), nullable=True)
    location = Column(String(200), default="Zone A")
    severity = Column(String(50), default="Medium")
    status = Column(String(50), default="Open")
    media_file_id = Column(Integer, ForeignKey("media_files.id"), nullable=True)
    analysis_id = Column(Integer, ForeignKey("analysis_results.id"), nullable=True)
    detected_at = Column(DateTime, default=func.now())
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


class RestrictedZone(Base):
    __tablename__ = "restricted_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    zone_type = Column(String(100), default="Rectangle")  # Rectangle / Polygon
    coordinates = Column(JSON)  # [{x, y}] list of points (normalized)
    color = Column(String(20), default="#EF4444")
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))


class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50))  # daily / weekly / monthly
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    total_inspections = Column(Integer, default=0)
    total_workers = Column(Integer, default=0)
    safe_workers = Column(Integer, default=0)
    total_violations = Column(Integer, default=0)
    ppe_compliance_pct = Column(Float, default=0.0)
    safety_score = Column(Float, default=0.0)
    most_common_violation = Column(String(200), nullable=True)
    highest_violation_zone = Column(String(100), nullable=True)
    generated_at = Column(DateTime, default=func.now())


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    require_helmet = Column(Boolean, default=True)
    require_vest = Column(Boolean, default=True)
    require_gloves = Column(Boolean, default=True)
    require_shoes = Column(Boolean, default=True)
    confidence_threshold = Column(Float, default=0.6)
    alert_on_violation = Column(Boolean, default=True)
    alert_email = Column(String(200), nullable=True)
    max_workers_per_frame = Column(Integer, default=20)
    demo_mode = Column(Boolean, default=True)
    site_name = Column(String(200), default="Construction Site A")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
