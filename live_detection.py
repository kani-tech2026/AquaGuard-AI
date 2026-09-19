from ultralytics import YOLO
import cv2

model = YOLO(r"C:\Users\Admin\runs\detect\train-3\weights\best.pt")

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()

    if not ret:
        print("Camera not found")
        break

    results = model(frame, conf=0.25)

    annotated = results[0].plot()

    cv2.imshow("AquaGuard AI - Floater Detection", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()