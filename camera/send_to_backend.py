import requests
from pathlib import Path

from camera_api import CAMERA_ID, CAMERA_LOCATION


API_URL = "http://127.0.0.1:8000/api/detect"
IMAGE_PATH = Path("camera/captures/latest.jpg")


def send_image():

    if not IMAGE_PATH.exists():

        print("Image not found:", IMAGE_PATH)

        return

    try:

        with open(IMAGE_PATH, "rb") as image:

            response = requests.post(

                API_URL,

                files={
                    "file": (
                        IMAGE_PATH.name,
                        image,
                        "image/jpeg"
                    )
                },

                data={
                    "camera_id": CAMERA_ID,
                    "latitude": CAMERA_LOCATION["latitude"],
                    "longitude": CAMERA_LOCATION["longitude"],
                    "altitude": CAMERA_LOCATION["altitude"]
                },

                timeout=120
            )

        print("Backend response:")
        print(response.text)

    except requests.exceptions.RequestException as error:

        print("Backend connection failed:")
        print(error)


if __name__ == "__main__":

    send_image()