from ultralytics import YOLO
import cv2
import pyttsx3
import time

# AquaGuard trained model
model = YOLO(
    r"C:\Users\Admin\Desktop\AquaGuard-AI\runs\detect\aquaguard_yolo26n\weights\best.pt"
)

# Voice engine
engine = pyttsx3.init()
engine.setProperty("rate", 150)

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera open aagala")
    exit()

print("AquaGuard AI Live Detection Started")
print("Press Q to stop")

# Avoid speaking every frame
last_alert_time = 0
alert_cooldown = 5

while True:

    ret, frame = cap.read()

    if not ret:
        print("Camera frame read aagala")
        break

    results = model(frame, conf=0.10)

    annotated = results[0].plot()

    boxes = results[0].boxes

    if boxes is not None and len(boxes) > 0:

        plastic_count = len(boxes)

        cv2.putText(
            annotated,
            f"PLASTIC DETECTED: {plastic_count}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

        # Voice alert only once every 5 seconds
        current_time = time.time()

        if current_time - last_alert_time >= alert_cooldown:

            message = (
                f"Warning. Plastic waste detected in water body. "
                f"{plastic_count} plastic objects detected."
            )

            print("ALERT:", message)

            engine.say(message)
            engine.runAndWait()

            last_alert_time = current_time

    else:

        cv2.putText(
            annotated,
            "WATER STATUS: CLEAR",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )

    cv2.imshow(
        "AquaGuard AI - Live Plastic Detection",
        annotated
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()