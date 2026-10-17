import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend import main
from detection.detector import AquaGuardDetector, is_plastic_class


class FakeBox:
    cls = [0]
    conf = [0.9]

    class Coordinates:
        def tolist(self):
            return [1, 2, 8, 9]

    xyxy = [Coordinates()]


class FakeResult:
    boxes = [FakeBox()]


class FakeModel:
    names = {0: "floater"}

    def predict(self, source, conf, verbose):
        _ = (source, conf, verbose)
        return [FakeResult()]


class DetectorTests(unittest.TestCase):
    def test_plastic_class_names_are_case_insensitive(self):
        self.assertTrue(is_plastic_class(" Floater "))
        self.assertTrue(is_plastic_class("plastic_bottle"))
        self.assertFalse(is_plastic_class("rock"))

    def test_predict_marks_plastic_detections(self):
        detector = AquaGuardDetector.__new__(AquaGuardDetector)
        detector.model = FakeModel()

        result = detector.predict("frame.jpg")

        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["is_plastic"])
        self.assertEqual(result[0]["bbox"], [1, 2, 8, 9])

    def test_camera_frame_endpoint_returns_detection_and_dimensions(self):
        ok, encoded_frame = cv2.imencode(
            ".jpg",
            np.zeros((20, 30, 3), dtype=np.uint8),
        )
        self.assertTrue(ok)

        fake_detector = AquaGuardDetector.__new__(AquaGuardDetector)
        fake_detector.model = FakeModel()
        with patch.object(main, "detector", fake_detector):
            response = TestClient(main.app).post(
                "/api/detect-frame",
                files={
                    "file": (
                        "frame.jpg",
                        encoded_frame.tobytes(),
                        "image/jpeg",
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["plastic_count"], 1)
        self.assertEqual(
            response.json()["frame_size"],
            {"width": 30, "height": 20},
        )
        self.assertTrue(response.json()["detections"][0]["is_plastic"])

    def test_camera_frame_endpoint_rejects_invalid_image(self):
        response = TestClient(main.app).post(
            "/api/detect-frame",
            files={"file": ("frame.jpg", b"not an image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 400)

    def test_image_inference_failure_returns_actionable_error(self):
        class BrokenDetector:
            def predict(self, image_path):
                raise RuntimeError(
                    f"simulated inference failure for {image_path}"
                )

        upload_path = Path("uploads/image-inference-error-test.jpg")
        try:
            with patch.object(main, "detector", BrokenDetector()):
                response = TestClient(main.app).post(
                    "/api/detect",
                    files={
                        "file": (
                            upload_path.name,
                            b"image bytes",
                            "image/jpeg",
                        )
                    },
                )
        finally:
            upload_path.unlink(missing_ok=True)

        self.assertEqual(response.status_code, 500)
        self.assertIn(
            "Image inference failed (RuntimeError)",
            response.json()["detail"],
        )

    def test_video_notification_error_does_not_hide_analysis(self):
        fake_detector = AquaGuardDetector.__new__(AquaGuardDetector)

        def predict_video(path):
            return {
                "frames_processed": 30,
                "total_plastic_detections": 173,
                "detections": [],
                "video": path,
            }

        fake_detector.predict_video = predict_video
        with (
            patch.object(main, "detector", fake_detector),
            patch.object(
                main,
                "notify_high_pollution",
                side_effect=RuntimeError("simulated notification failure"),
            ),
        ):
            response = TestClient(main.app).post(
                "/api/detect-video",
                files={"file": ("notification-check.mp4", b"video", "video/mp4")},
            )

        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["frames_processed"], 30)
        self.assertEqual(body["alert"]["status"], "failed")
        self.assertEqual(body["alert"]["notification"]["dispatch"]["status"], "failed")
        self.assertIn(
            "RuntimeError: simulated notification failure",
            body["alert"]["notification"]["dispatch"]["message"],
        )


if __name__ == "__main__":
    unittest.main()
