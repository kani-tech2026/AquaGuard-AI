# AquaGuard AI 🌊

**AI-Powered Plastic Waste Detection and Source Tracking System for Water Bodies**

AquaGuard AI is an AI-based environmental monitoring system designed to detect floating plastic waste in water bodies, measure pollution severity, track locations, and support pollution hotspot analysis through a monitoring dashboard.

## 🎯 Objective

The system uses deep learning and computer vision to detect floating plastic waste from images and camera feeds. Detected waste is counted, analyzed based on confidence and severity, associated with a GPS location, and presented through a web-based monitoring dashboard.

## 🚀 Main Features

* ♻️ Plastic waste detection using YOLO
* 📊 Plastic object counting
* 🎯 Detection confidence analysis
* 🚨 Pollution severity estimation
* 📍 GPS-based location tracking
* 🗺️ Pollution hotspot and source tracking
* 💧 Water-body environmental data monitoring
* 📷 Image and live-camera detection
* 🔔 Plastic pollution alerts
* 🖥️ Real-time monitoring dashboard
* 💾 Detection data storage using SQLite

## 🏗️ System Workflow

```text
Camera / Image Input
        ↓
YOLO Plastic Waste Detection
        ↓
Object Counting & Confidence Analysis
        ↓
Pollution Severity Estimation
        ↓
GPS Location + Water Sensor Data
        ↓
Database Storage
        ↓
Backend API
        ↓
Monitoring Dashboard
        ↓
Alert & Hotspot Analysis
```

## 🛠️ Technology Stack

### AI & Computer Vision

* Python
* YOLO
* OpenCV
* PyTorch

### Backend

* FastAPI
* SQLite

### Frontend

* React
* Vite
* Leaflet
* Recharts

## 📁 Project Structure

```text
AquaGuard-AI/
│
├── backend/
│   └── main.py
│
├── camera/
│   ├── camera_api.py
│   └── send_to_backend.py
│
├── detection/
│   └── detector.py
│
├── database/
│
├── gps/
│   └── gps.py
│
├── sensors/
│   └── water_sensor.py
│
├── frontend/
│
├── frontend-ui/
│
├── test_images/
│
├── train.py
├── test_model.py
├── live_detection.py
└── README.md
```

## 📊 Detection & Analysis

AquaGuard AI focuses specifically on floating plastic waste. The system processes the detected objects and provides:

* Number of detected plastic objects
* Average detection confidence
* Pollution severity level
* Detection location
* Environmental sensor information
* Alert status

## 🌍 Environmental Impact

The project supports **SDG 14 – Life Below Water** by providing an automated approach for monitoring plastic pollution in water bodies and identifying areas requiring attention.

## 🔬 Current Implementation

The current implementation includes:

* Trained YOLO-based plastic waste detector
* Image-based plastic detection
* Object counting and confidence analysis
* FastAPI backend
* SQLite detection storage
* GPS integration
* Water sensor integration
* React monitoring dashboard
* Camera integration
* Pollution severity and alert logic

## 📌 Project Status

**Current Status: Working Prototype / Implementation Phase**

The system is being developed toward an integrated real-time water pollution monitoring solution.

## 👩‍💻 Author

**Kanimozhi**

B.Tech Artificial Intelligence and Data Science
Kongu Engineering College
