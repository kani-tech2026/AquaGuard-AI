import cv2
import time
from pathlib import Path


CAMERA_INDEX = 0
CAMERA_ID = "CAM_01"

CAMERA_LOCATION = {
    "latitude": 10.38,
    "longitude": 78.82,
    "altitude": 100.0
}
OUTPUT_DIR = Path("camera/captures")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def capture_image():
    camera = cv2.VideoCapture(CAMERA_INDEX)

    if not camera.isOpened():
        return None

    time.sleep(1)

    success, frame = camera.read()
    camera.release()

    if not success:
        return None

    filename = OUTPUT_DIR / "latest.jpg"
    cv2.imwrite(str(filename), frame)

    return str(filename)


if __name__ == "__main__":
    image_path = capture_image()

    if image_path:
        print("Camera image captured successfully.")
        print("Saved:", image_path)
    else:
        print("Camera capture failed.")