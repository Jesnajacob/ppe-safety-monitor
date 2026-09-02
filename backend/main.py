"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.database import create_tables
from backend.routers import (
    auth,
    media,
    analysis,
    violations,
    zones,
    reports,
    settings,
    dashboard
)

# ── Create directories
for d in ["uploads/originals", "uploads/annotated"]:
    os.makedirs(d, exist_ok=True)

# ── App
app = FastAPI(
    title="AI Workplace Safety & PPE Monitoring API",
    description="Computer vision-based safety monitoring for construction and industrial sites.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

# ── Routers
app.include_router(auth.router)
app.include_router(media.router)
app.include_router(analysis.router)
app.include_router(violations.router)
app.include_router(zones.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(dashboard.router)


@app.on_event("startup")
async def startup_event():
    """Initialize DB tables and seed demo data on first run."""
    create_tables()

    # Seed demo data only if DB is empty
    from backend.seed_data import seed_if_empty
    seed_if_empty()


@app.get("/")
def root():
    return {
        "message": "AI Workplace Safety & PPE Monitoring API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
