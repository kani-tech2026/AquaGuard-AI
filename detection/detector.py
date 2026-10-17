from pathlib import Path
from ultralytics import YOLO

MODEL_PATH = Path("runs/detect/aquaguard_yolo26n/weights/best.pt")
PLASTIC_CLASS_NAMES = {
    "floater",
    "plastic",
    "plastic_waste",
    "plastic_bottle",
    "plastic_bag",
    "plastic_container",
    "plastic_cup",
    "plastic_wrapper",
}


def is_plastic_class(class_name):
    return str(class_name).strip().lower() in PLASTIC_CLASS_NAMES


class AquaGuardDetector:

    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"YOLO model not found: {MODEL_PATH}"
            )

        self.model = YOLO(str(MODEL_PATH))

    def predict(self, image_path):
        results = self.model.predict(
            source=image_path,
            conf=0.25,
            verbose=False
        )

        detections = []

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = self.model.names[class_id]

                xyxy = box.xyxy[0].tolist()

                detections.append({
                    "class_name": class_name,
                    "is_plastic": is_plastic_class(class_name),
                    "confidence": round(confidence, 4),
                    "confidence_percent": round(
                        confidence * 100, 2
                    ),
                    "bbox": [
                        round(value, 2)
                        for value in xyxy
                    ]
                })

        return detections

    def predict_video(self, video_path):
        import cv2

        cap = cv2.VideoCapture(str(video_path))

        if not cap.isOpened():
            raise ValueError("Unable to open video")

        frame_count = 0
        total_plastic = 0
        detections = []

        try:
            while True:
                ret, frame = cap.read()

                if not ret:
                    break

                frame_count += 1

                results = self.model.predict(
                    source=frame,
                    conf=0.25,
                    verbose=False
                )

                frame_detections = []

                for result in results:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])
                        class_name = self.model.names[class_id]

                        if is_plastic_class(class_name):
                            total_plastic += 1

                            frame_detections.append({
                                "class_name": class_name,
                                "confidence": round(
                                    confidence, 4
                                )
                            })

                if frame_detections:
                    detections.append({
                        "frame": frame_count,
                        "plastic_count": len(
                            frame_detections
                        ),
                        "detections": frame_detections
                    })
        finally:
            cap.release()

        if frame_count == 0:
            raise ValueError("Video contains no readable frames.")

        return {
            "video": str(video_path),
            "frames_processed": frame_count,
            "total_plastic_detections": total_plastic,
            "detections": detections
        }