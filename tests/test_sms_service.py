import json
import os
import unittest
from unittest.mock import patch

import requests

from backend.sms_service import (
    get_notification_status,
    notify_high_pollution,
    send_email_alert,
    send_sms,
    send_whatsapp,
)


class NotificationServiceTests(unittest.TestCase):
    def test_email_alert_reports_missing_settings_without_connecting(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("backend.sms_service.smtplib.SMTP") as smtp:
                result = send_email_alert("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["status"], "not_configured")
        self.assertIn("ALERT_EMAIL", result["message"])
        smtp.assert_not_called()

    def test_email_alert_sends_message_over_authenticated_starttls(self):
        smtp_server = unittest.mock.MagicMock()
        smtp_server.__enter__.return_value = smtp_server
        with patch.dict(
            os.environ,
            {
                "ALERT_EMAIL": "recipient@example.com",
                "SMTP_HOST": "smtp.example.com",
                "SMTP_PORT": "587",
                "SMTP_USERNAME": "sender@example.com",
                "SMTP_PASSWORD": "test-password",
            },
            clear=True,
        ):
            with patch(
                "backend.sms_service.smtplib.SMTP",
                return_value=smtp_server,
            ) as smtp:
                result = send_email_alert("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["status"], "accepted")
        smtp.assert_called_once_with("smtp.example.com", 587, timeout=20)
        smtp_server.starttls.assert_called_once()
        smtp_server.login.assert_called_once_with(
            "sender@example.com",
            "test-password",
        )
        sent_message = smtp_server.send_message.call_args.args[0]
        self.assertEqual(sent_message["To"], "recipient@example.com")
        self.assertIn("Plastic detections: 6", sent_message.get_content())
        self.assertIn("Location: 10.0, 20.0", sent_message.get_content())

    def test_sms_reports_missing_settings_without_sending(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("backend.sms_service.requests.post") as post:
                result = send_sms("918072832105", None, {})

        self.assertEqual(result["status"], "not_configured")
        post.assert_not_called()

    def test_sms_sends_msg91_template_variables(self):
        response = unittest.mock.Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"type": "success"}

        with patch.dict(os.environ, {"MSG91_AUTHKEY": "test-key"}, clear=True):
            with patch(
                "backend.sms_service.requests.post",
                return_value=response,
            ) as post:
                result = send_sms(
                    "918072832105",
                    "test-template",
                    {"var1": "HIGH", "var2": "6", "var3": "10, 20"},
                )

        self.assertEqual(result["status"], "accepted")
        payload = post.call_args.kwargs["json"]
        self.assertEqual(
            payload["recipients"][0],
            {
                "mobiles": "918072832105",
                "var1": "HIGH",
                "var2": "6",
                "var3": "10, 20",
            },
        )

    def test_sms_does_not_claim_acceptance_for_unexpected_provider_response(self):
        response = unittest.mock.Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"type": "queued"}

        with patch.dict(os.environ, {"MSG91_AUTHKEY": "test-key"}, clear=True):
            with patch(
                "backend.sms_service.requests.post",
                return_value=response,
            ):
                result = send_sms(
                    "918072832105",
                    "test-template",
                    {"var1": "HIGH", "var2": "6", "var3": "10, 20"},
                )

        self.assertEqual(result["status"], "failed")
        self.assertIn("delivery logs", result["message"])

    def test_sms_rejects_non_ascii_authkey_before_http_request(self):
        with patch.dict(
            os.environ,
            {
                "MSG91_AUTHKEY": "தமிழ்",
            },
            clear=True,
        ):
            with patch("backend.sms_service.requests.post") as post:
                result = send_sms(
                    "918072832105",
                    "test-template",
                    {"var1": "HIGH", "var2": "6", "var3": "10, 20"},
                )

        self.assertEqual(result["status"], "not_configured")
        self.assertIn("MSG91_AUTHKEY contains non-ASCII", result["message"])
        post.assert_not_called()

    def test_sms_rejects_non_ascii_template_id_before_http_request(self):
        with patch.dict(
            os.environ,
            {"MSG91_AUTHKEY": "ascii-test-key"},
            clear=True,
        ):
            with patch("backend.sms_service.requests.post") as post:
                result = send_sms(
                    "918072832105",
                    "தமிழ்",
                    {"var1": "HIGH", "var2": "6", "var3": "10, 20"},
                )

        self.assertEqual(result["status"], "not_configured")
        self.assertIn("MSG91_TEMPLATE_ID contains non-ASCII", result["message"])
        post.assert_not_called()

    def test_whatsapp_sends_approved_template_to_configured_test_recipient(self):
        response = unittest.mock.Mock()
        response.ok = True
        response.raise_for_status.return_value = None

        with patch.dict(
            os.environ,
            {
                "TWILIO_ACCOUNT_SID": "test-account",
                "TWILIO_AUTH_TOKEN": "test-token",
                "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
                "TWILIO_WHATSAPP_CONTENT_SID": "HX-test-template",
            },
            clear=True,
        ):
            with patch(
                "backend.sms_service.requests.post",
                return_value=response,
            ) as post:
                result = send_whatsapp(
                    "+918072832105",
                    {"1": "HIGH", "2": "6", "3": "10.0, 20.0"},
                )

        self.assertEqual(result["status"], "accepted")
        payload = post.call_args.kwargs["data"]
        self.assertEqual(payload["To"], "whatsapp:+918072832105")
        self.assertEqual(payload["ContentSid"], "HX-test-template")
        self.assertEqual(
            json.loads(payload["ContentVariables"]),
            {"1": "HIGH", "2": "6", "3": "10.0, 20.0"},
        )
        self.assertNotIn("Body", payload)

    def test_whatsapp_reports_twilio_error_code_and_message(self):
        response = unittest.mock.Mock()
        response.ok = False
        response.status_code = 400
        response.json.return_value = {
            "code": 63007,
            "message": "The WhatsApp sender is not registered.",
        }

        with patch.dict(
            os.environ,
            {
                "TWILIO_ACCOUNT_SID": "test-account",
                "TWILIO_AUTH_TOKEN": "test-token",
                "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
                "TWILIO_WHATSAPP_CONTENT_SID": "HX-test-template",
            },
            clear=True,
        ):
            with patch(
                "backend.sms_service.requests.post",
                return_value=response,
            ):
                result = send_whatsapp(
                    "+918072832105",
                    {"1": "HIGH", "2": "6", "3": "10.0, 20.0"},
                )

        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["code"], 63007)
        self.assertEqual(
            result["message"],
            "The WhatsApp sender is not registered.",
        )

    def test_whatsapp_reports_safe_connection_error(self):
        with patch.dict(
            os.environ,
            {
                "TWILIO_ACCOUNT_SID": "test-account",
                "TWILIO_AUTH_TOKEN": "secret-token",
                "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
                "TWILIO_WHATSAPP_CONTENT_SID": "HX-test-template",
            },
            clear=True,
        ):
            with patch(
                "backend.sms_service.requests.post",
                side_effect=requests.ConnectionError(
                    "Connection to https://api.test/secret-token failed"
                ),
            ):
                result = send_whatsapp(
                    "+918072832105",
                    {"1": "HIGH", "2": "6", "3": "10.0, 20.0"},
                )

        self.assertEqual(result["status"], "failed")
        self.assertIn("ConnectionError", result["message"])
        self.assertNotIn("secret-token", result["message"])

    def test_whatsapp_requires_a_twilio_content_template(self):
        with patch.dict(
            os.environ,
            {
                "TWILIO_ACCOUNT_SID": "test-account",
                "TWILIO_AUTH_TOKEN": "test-token",
                "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
            },
            clear=True,
        ):
            with patch("backend.sms_service.requests.post") as post:
                result = send_whatsapp(
                    "+918072832105",
                    {"1": "HIGH", "2": "6", "3": "10.0, 20.0"},
                )

        self.assertEqual(result["status"], "not_configured")
        self.assertIn("TWILIO_WHATSAPP_CONTENT_SID", result["message"])
        post.assert_not_called()

    def test_high_alert_without_recipient_does_not_send(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("backend.sms_service.requests.post") as post:
                result = notify_high_pollution("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["sms"]["status"], "not_configured")
        self.assertEqual(result["whatsapp"]["status"], "not_configured")
        post.assert_not_called()

    def test_email_only_mode_does_not_send_sms_or_whatsapp(self):
        with patch.dict(
            os.environ,
            {
                "ALERT_CHANNEL": "email",
                "ALERT_EMAIL": "recipient@example.com",
                "SMTP_HOST": "smtp.example.com",
                "SMTP_PORT": "587",
                "SMTP_USERNAME": "sender@example.com",
                "SMTP_PASSWORD": "test-password",
            },
            clear=True,
        ):
            with (
                patch(
                    "backend.sms_service.send_email_alert",
                    return_value={"status": "accepted"},
                ) as email,
                patch("backend.sms_service.send_sms") as sms,
                patch("backend.sms_service.send_whatsapp") as whatsapp,
            ):
                result = notify_high_pollution("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result, {"email": {"status": "accepted"}})
        email.assert_called_once_with("HIGH", 6, 10.0, 20.0)
        sms.assert_not_called()
        whatsapp.assert_not_called()

    def test_whatsapp_only_mode_skips_sms(self):
        with patch.dict(
            os.environ,
            {
                "ALERT_PHONE_NUMBER": "+918072832105",
                "ALERT_CHANNEL": "whatsapp",
                "TWILIO_ACCOUNT_SID": "test-account",
                "TWILIO_AUTH_TOKEN": "test-token",
                "TWILIO_WHATSAPP_FROM": "whatsapp:+14155238886",
                "TWILIO_WHATSAPP_CONTENT_SID": "HX-test-template",
            },
            clear=True,
        ):
            with patch(
                "backend.sms_service.send_whatsapp",
                return_value={"status": "accepted", "provider": "Twilio"},
            ) as whatsapp:
                result = notify_high_pollution("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["sms"]["status"], "skipped")
        self.assertEqual(result["whatsapp"]["status"], "accepted")
        whatsapp.assert_called_once()

    def test_sms_only_mode_skips_whatsapp(self):
        with patch.dict(
            os.environ,
            {
                "ALERT_PHONE_NUMBER": "+918072832105",
                "ALERT_CHANNEL": "sms",
                "MSG91_AUTHKEY": "test-key",
                "MSG91_TEMPLATE_ID": "test-template",
            },
            clear=True,
        ):
            with (
                patch(
                    "backend.sms_service.send_sms",
                    return_value={"status": "accepted", "provider": "MSG91"},
                ) as sms,
                patch("backend.sms_service.send_whatsapp") as whatsapp,
            ):
                result = notify_high_pollution("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["sms"]["status"], "accepted")
        self.assertEqual(result["whatsapp"]["status"], "skipped")
        sms.assert_called_once()
        whatsapp.assert_not_called()

    def test_sms_only_mode_reports_missing_msg91_settings(self):
        with patch.dict(
            os.environ,
            {
                "ALERT_PHONE_NUMBER": "+918072832105",
                "ALERT_CHANNEL": "sms",
            },
            clear=True,
        ):
            with patch("backend.sms_service.requests.post") as post:
                result = notify_high_pollution("HIGH", 6, 10.0, 20.0)

        self.assertEqual(result["sms"]["status"], "not_configured")
        self.assertIn("MSG91_AUTHKEY", result["sms"]["message"])
        self.assertIn("MSG91_TEMPLATE_ID", result["sms"]["message"])
        self.assertEqual(result["whatsapp"]["status"], "skipped")
        post.assert_not_called()

    def test_notification_status_reports_partial_success(self):
        result = get_notification_status(
            {
                "sms": {"status": "accepted"},
                "whatsapp": {"status": "not_configured"},
            }
        )

        self.assertEqual(result, "accepted")


if __name__ == "__main__":
    unittest.main()
