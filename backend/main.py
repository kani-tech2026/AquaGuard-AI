from pathlib import Path

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from detection.detector import AquaGuardDetector
from database.db import init_db, get_detections, add_detection
from gps.gps import gps
from sensors.water_sensor import water_sensor


# ============================================================
# AQUAGUARD AI API
# ============================================================

app = FastAPI(
    title="AquaGuard AI API",
    version="2.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:5180",
        "http://localhost:5181",
        "http://localhost:5182",
        "http://localhost:5183",
        "http://localhost:5185",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5179",
        "http://127.0.0.1:5183",
        "http://127.0.0.1:5185",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

init_db()

detector = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "project": "AquaGuard AI",
        "status": "online",
        "version": "2.0.0"
    }


# ============================================================
# HELPER - SEVERITY
# ============================================================

def calculate_severity(plastic_count):

    if plastic_count == 0:
        return "LOW"

    elif plastic_count <= 2:
        return "LOW"

    elif plastic_count <= 5:
        return "MEDIUM"

    elif plastic_count <= 10:
        return "HIGH"

    else:
        return "CRITICAL"


# ============================================================
# STATS
# ============================================================

@app.get("/api/stats")
def stats():

    rows = get_detections()

    plastic_count = 0

    for row in rows:

        class_name = str(row[1]).lower()

        if class_name in [
            "floater",
            "plastic",
            "plastic_waste",
            "plastic_bottle",
            "plastic_bag",
            "plastic_container",
            "plastic_cup",
            "plastic_wrapper"
        ]:

            plastic_count += 1

    return {

        "total_detections": len(rows),

        "plastic_objects": plastic_count,

        "active_alerts": 0,

        "tracked_sources": len(
            set(
                row[7]
                for row in rows
                if len(row) > 7 and row[7]
            )
        ),

        "focus": "plastic",

        "status": "monitoring"
    }


# ============================================================
# DETECTION HISTORY
# ============================================================

@app.get("/api/detections")
def detection_history():

    rows = get_detections()

    output = []

    for row in rows:

        class_name = row[1]

        is_plastic = str(class_name).lower() in [
            "floater",
            "plastic",
            "plastic_waste",
            "plastic_bottle",
            "plastic_bag",
            "plastic_container",
            "plastic_cup",
            "plastic_wrapper"
        ]

        output.append({

            "id": row[0],

            "class_name": class_name,

            "category": (
                "plastic"
                if is_plastic
                else "other"
            ),

            "is_plastic": is_plastic,

            "confidence": row[2],

            "confidence_percent": round(
                float(row[2]) * 100,
                2
            ),

            "bbox": [
                row[3],
                row[4],
                row[5],
                row[6]
            ],

            "source": row[7],

            "latitude": row[8],

            "longitude": row[9],

            "created_at": row[10]
        })

    return output


# ============================================================
# GPS
# ============================================================

@app.get("/api/gps")
def get_gps():

    return gps.read_gps()


# ============================================================
# ENVIRONMENT
# ============================================================

@app.get("/api/environment")
def environment():

    location = gps.read_gps()

    water = water_sensor.read()

    return {

        "gps": location,

        "water": water
    }


# ============================================================
# CAMERA
# ============================================================

@app.get("/api/camera")
def camera_feed():

    image_path = Path(
        "camera/captures/latest.jpg"
    )

    if not image_path.exists():

        return {

            "status": "no_image",

            "message": (
                "Camera image not available."
            )
        }

    return FileResponse(
        image_path,
        media_type="image/jpeg"
    )


# ============================================================
# IMAGE DETECTION
# ============================================================

@app.post("/api/detect")
async def detect(

    file: UploadFile = File(...),

    camera_id: str = "CAM_01",

    latitude: float = 10.38,

    longitude: float = 78.82,

    altitude: float = 100.0
):

    global detector

    # --------------------------------------------------------
    # Upload directory
    # --------------------------------------------------------

    upload_dir = Path("uploads")

    upload_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # Prevent unsafe filenames
    safe_filename = Path(
        file.filename
    ).name

    upload_path = (
        upload_dir / safe_filename
    )

    # --------------------------------------------------------
    # Save uploaded image
    # --------------------------------------------------------

    with open(
        upload_path,
        "wb"
    ) as buffer:

        buffer.write(
            await file.read()
        )

    # --------------------------------------------------------
    # Load YOLO model
    # --------------------------------------------------------

    try:

        if detector is None:

            detector = AquaGuardDetector()

    except FileNotFoundError:

        return {

            "filename": safe_filename,

            "status": "model_not_ready",

            "message": (
                "YOLO model best.pt "
                "is not available."
            ),

            "detections": []
        }

    # --------------------------------------------------------
    # YOLO prediction
    # --------------------------------------------------------

    detections = detector.predict(
        str(upload_path)
    )

    # --------------------------------------------------------
    # GPS + Water Data
    # --------------------------------------------------------

    location = {

        "camera_id": camera_id,

        "latitude": latitude,

        "longitude": longitude,

        "altitude": altitude
    }

    water = water_sensor.read()

    # --------------------------------------------------------
    # Plastic Analysis
    # --------------------------------------------------------

    plastic_detections = [

        item

        for item in detections

        if item.get(
            "is_plastic",
            False
        )
    ]

    plastic_count = len(
        plastic_detections
    )

    total_count = len(
        detections
    )

    # --------------------------------------------------------
    # Average Confidence
    # --------------------------------------------------------

    if total_count > 0:

        average_confidence = (
            sum(
                item["confidence"]
                for item in detections
            )
            / total_count
        )

    else:

        average_confidence = 0.0

    # --------------------------------------------------------
    # Pollution Severity
    # --------------------------------------------------------

    severity = calculate_severity(
        plastic_count
    )

    # --------------------------------------------------------
    # Save Detections
    # --------------------------------------------------------

    for item in detections:

        add_detection(

            class_name=item[
                "class_name"
            ],

            confidence=item[
                "confidence"
            ],

            bbox=item[
                "bbox"
            ],

            source=safe_filename,

            latitude=location[
                "latitude"
            ],

            longitude=location[
                "longitude"
            ]
        )

    # --------------------------------------------------------
    # Alert Status
    # --------------------------------------------------------

    alert_required = (
        plastic_count > 0
    )

    # --------------------------------------------------------
    # Final Response
    # --------------------------------------------------------

    return {

        "filename": safe_filename,

        "status": "success",

        # Overall counts
        "count": total_count,

        "total_objects": total_count,

        "plastic_count": plastic_count,

        "other_count": (
            total_count
            - plastic_count
        ),

        # Analysis
        "average_confidence": round(
            average_confidence,
            4
        ),

        "average_confidence_percent": round(
            average_confidence * 100,
            2
        ),

        "severity": severity,

        "focus": "plastic",

        # Alert
        "alert": {

            "required": alert_required,

            "type": (
                "PLASTIC_WASTE"
                if alert_required
                else None
            ),

            "status": (
                "pending"
                if alert_required
                else "not_required"
            ),

            "recipients": 2
        },

        # Location
        "gps": location,

        # Environment
        "water": water,

        # Individual objects
        "detections": detections
    }