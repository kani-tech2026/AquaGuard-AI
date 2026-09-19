from ultralytics import YOLO
from pathlib import Path


MODEL_PATH = Path("runs/detect/aquaguard_yolo26n/weights/best.pt")
IMAGE_PATH = Path("test_images/0007.jpg")


if not MODEL_PATH.exists():
    print("ERROR: best.pt not found yet.")
    print(f"Expected: {MODEL_PATH}")
    exit()


if not IMAGE_PATH.exists():
    print("ERROR: Test image not found.")
    print(f"Expected: {IMAGE_PATH}")
    exit()


print("Loading YOLO model...")

model = YOLO(str(MODEL_PATH))

print("Running detection...")

results = model.predict(
    source=str(IMAGE_PATH),
    conf=0.25,
    save=True
)

for result in results:
    print("\nDetections:")

    if result.boxes is None or len(result.boxes) == 0:
        print("No plastic detected.")
        continue

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])

        print(
            f"Class: {model.names[class_id]} | "
            f"Confidence: {confidence:.2%}"
        )

print("\nDetection complete.")