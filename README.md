# 🦺 AI Workplace Safety & PPE Monitoring System

A full-stack, computer vision-based workplace safety monitoring web application tailored for construction sites, industrial plants, and factories.

---

## 🌟 Features

1. **Dashboard & Analytics**: Real-time KPI summary cards, circular SVG safety score meter, PPE compliance by category, violation distribution, and 7-day safety trend charts.
2. **Media Analysis (Images & Video)**: Drag-and-drop file uploader with preview and multi-class AI computer vision detector.
3. **Detection & Bounding Boxes**:
   - Worker detection (`Person`)
   - Mandatory PPE items (`Safety Helmet`, `Safety Vest`, `Safety Gloves`, `Safety Shoes`)
   - Bounding boxes drawn server-side using Pillow with confidence ratings.
4. **Violations Management**: Sortable, filterable violation database with severity tags (`Low`, `Medium`, `High`, `Critical`) and status tracking (`Open`, `Acknowledged`, `Resolved`).
5. **Restricted Zone Monitoring**: Interactive HTML5 canvas polygon tool to define restricted hazard zones with violation entry alerts.
6. **Reports & Exports**: Daily, weekly, monthly report summaries with CSV download and printable PDF views.
7. **Settings & Policies**: Fine-grained toggle controls for mandatory PPE items, detection confidence thresholds, and notification routing.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ installed
- Web browser (Chrome, Edge, Firefox)

### 2. Backend Setup
Navigate to the project root and install dependencies:
```bash
pip install -r requirements.txt
```

Run the FastAPI backend server:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
- API Docs will be live at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend Setup
You can host the `frontend/` folder using Python's built-in HTTP server or open `frontend/index.html` directly in your browser:
```bash
cd frontend
python -m http.server 3000
```
- Open [http://localhost:3000](http://localhost:3000)

### 4. Demo Login Credentials
- **Email**: `admin@safety.com`
- **Password**: `admin123`

---

## 📂 Project Architecture

```
├── backend/
│   ├── database.py              # SQLite & SQLAlchemy engine
│   ├── models.py                # Database ORM models
│   ├── main.py                  # FastAPI application entrypoint
│   ├── seed_data.py             # Automatic demo data seeding
│   ├── routers/
│   │   ├── auth.py              # JWT authentication & profile
│   │   ├── dashboard.py         # Dashboard aggregated metrics
│   │   ├── media.py             # Image/video uploads
│   │   ├── analysis.py          # AI detection execution
│   │   ├── violations.py        # Violation tracking & actions
│   │   ├── zones.py             # Restricted zone definitions
│   │   ├── reports.py           # Safety reports & CSV export
│   │   └── settings.py          # Policy settings
│   └── services/
│       ├── ai_detection.py      # Simulated YOLO PPE detector (pluggable)
│       └── image_processor.py   # Pillow image annotation & bounding boxes
│
├── frontend/
│   ├── index.html               # Login page
│   ├── dashboard.html           # Main dashboard
│   ├── upload.html              # Media upload page
│   ├── analysis.html            # AI detection visual results
│   ├── violations.html          # Violation management table
│   ├── zones.html               # Restricted zones canvas tool
│   ├── reports.html             # Reports & CSV export
│   ├── settings.html            # Configuration & Settings
│   ├── css/
│   │   └── styles.css           # Industrial dark glassmorphism design system
│   └── js/
│       ├── app.js               # Global auth, sidebar, toast system
│       ├── dashboard.js         # Chart.js visualizations
│       ├── upload.js            # Upload logic & progress
│       ├── analysis.js          # Detection cards & score logic
│       ├── violations.js        # Filterable violation table
│       ├── zones.js             # HTML5 canvas zone drawing
│       ├── reports.js           # Reporting period switcher
│       └── settings.js          # Settings synchronization
│
└── requirements.txt             # Python backend dependencies
```

---

## 🔌 Integrating a Real YOLO Model
In `backend/services/ai_detection.py`, replace `demo_detect()` with inference calls using `ultralytics.YOLO` (e.g., `model = YOLO("ppe_best.pt")`). The returned dictionary structure matches standard YOLO bounding box and classification outputs.
