
from pathlib import Path
from ultralytics import YOLO


MODEL_PATH = Path("runs/detect/aquaguard_yolo26n/weights/best.pt")


class AquaGuardDetector:

    def __init__(self):

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"YOLO model not found: {MODEL_PATH}"
            )

        self.model = YOLO(str(MODEL_PATH))

    def predict(self, image_path):

        results = self.model.predict(
            source=str(image_path),
            conf=0.25,
            iou=0.45,
            max_det=100,
            verbose=False
        )

        detections = []

        for result in results:

            if result.boxes is None:
                continue

            boxes = result.boxes

            for i in range(len(boxes)):

                class_id = int(boxes.cls[i])
                confidence = float(boxes.conf[i])

                xyxy = boxes.xyxy[i].tolist()

                class_name = self.model.names[class_id]

                is_plastic = class_name.lower() in [
                    "floater",
                    "plastic",
                    "plastic_waste",
                    "plastic_bottle",
                    "plastic_bag",
                    "plastic_container",
                    "plastic_cup",
                    "plastic_wrapper"
                ]

                detections.append({
                    "class_id": class_id,
                    "class_name": class_name,
                    "category": "plastic" if is_plastic else "other",
                    "is_plastic": is_plastic,
                    "confidence": round(confidence, 4),
                    "confidence_percent": round(
                        confidence * 100, 2
                    ),
                    "bbox": [
                        round(value, 2)
                        for value in xyxy
                    ]
                })

        # ----------------------------------------------------
        # Sort by confidence
        # Highest confidence first
        # ----------------------------------------------------

        detections.sort(
            key=lambda x: x["confidence"],
            reverse=True
        )

        # ----------------------------------------------------
        # Assign unique object IDs AFTER sorting
        # ----------------------------------------------------

        for index, item in enumerate(detections, start=1):
            item["object_id"] = index

        return detections

