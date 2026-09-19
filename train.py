from ultralytics import YOLO

model = YOLO("yolo26n.pt")

model.train(
    data="dataset/clean/data.yaml",
    epochs=30,
    imgsz=640,
    batch=4,
    device="cpu",
    workers=0,
    project="runs/detect",
    name="aquaguard_yolo26n"
)
