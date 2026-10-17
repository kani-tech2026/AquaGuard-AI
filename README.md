# AquaGuard AI

AI-Powered Plastic Waste Detection and Source Tracking System for Water Bodies.

## Objective

Detect and classify floating plastic waste using deep learning and computer vision, analyze pollution levels, identify accumulation hotspots, and provide a monitoring dashboard.

## Technology

- Python
- YOLO26
- OpenCV
- PyTorch
- FastAPI
- SQLite
- React
- Leaflet

## Main Features

- Plastic waste detection
- Plastic waste classification
- Object counting
- Confidence score
- Pollution severity estimation
- GPS-based location tracking
- Pollution hotspot mapping
- Probable pollution source analysis
- Real-time monitoring dashboard

## Live camera and video detection

On the dashboard, allow browser camera access and start Live Camera to run
plastic detection continuously. Camera frames are sent to the local backend for
analysis about once per second; live detections are displayed over the preview
and are not saved to detection history. Uploaded videos are analyzed frame by
frame, and the dashboard shows a clear error if the backend cannot process the
file. During local development, Vite proxies dashboard API requests to the
backend on `127.0.0.1:8000`; for a separate production API, set
`VITE_API_URL` to its base URL when building the frontend.

## High-pollution notifications

HIGH or CRITICAL image detections (6 or more plastic objects) and HIGH video
results (150 or more plastic detections) trigger a notification to the
configured channel. Set `ALERT_CHANNEL=email` to send email without SMS or
WhatsApp. `ACCEPTED` means the SMTP server accepted the message; it does not
confirm final delivery.

Configure these values in the local, untracked `.env` file; never commit provider
credentials:

```dotenv
ALERT_CHANNEL=email
ALERT_EMAIL=<recipient-email>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<sender-gmail-address>
SMTP_PASSWORD=<gmail-app-password>
```

For Gmail, create an App Password in your Google Account and use it as
`SMTP_PASSWORD`; do not use your normal account password. `SMTP_USERNAME` is
also used as the sender address. Restart the backend after changing `.env`.
Email is sent only for HIGH or CRITICAL image detections and HIGH video
results. Test first with an inbox you control.

## Project Status

Phase 1 - Project Setup