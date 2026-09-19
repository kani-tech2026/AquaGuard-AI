from ultralytics import YOLO

model = YOLO(r"C:\Users\Admin\runs\detect\train-3\weights\best.pt")

model.predict(
    source=r"C:\Users\Admin\Desktop\AquaGuard-AI\dataset\images\0002.jpg",
    conf=0.10,
    save=True
)