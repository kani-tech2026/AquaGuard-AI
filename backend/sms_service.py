import json
import logging
import os
import smtplib
from email.message import EmailMessage

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
MSG91_URL = "https://control.msg91.com/api/v5/flow"
TWILIO_API_URL = "https://api.twilio.com/2010-04-01/Accounts"


def _not_configured(*settings):
    missing = [name for name in settings if not os.getenv(name)]
    if missing:
        return {
            "status": "not_configured",
            "message": f"Missing settings: {', '.join(missing)}",
        }
    return None


def send_sms(mobile_number, template_id, variables):
    missing = _not_configured("MSG91_AUTHKEY")
    if missing:
        return missing

    if not mobile_number or not template_id:
        return {
            "status": "not_configured",
            "message": "Set ALERT_PHONE_NUMBER and MSG91_TEMPLATE_ID.",
        }

    authkey = os.getenv("MSG91_AUTHKEY", "").strip()
    template_id = template_id.strip()
    if not authkey.isascii():
        return {
            "status": "not_configured",
            "message": (
                "MSG91_AUTHKEY contains non-ASCII characters. Replace it with "
                "the API auth key from your MSG91 account."
            ),
        }
    if not template_id.isascii():
        return {
            "status": "not_configured",
            "message": (
                "MSG91_TEMPLATE_ID contains non-ASCII characters. Replace it "
                "with the approved flow template ID from your MSG91 account."
            ),
        }

    payload = {
        "template_id": template_id,
        "short_url": "0",
        "recipients": [
            {
                "mobiles": mobile_number,
                **variables,
            }
        ],
    }

    try:
        response = requests.post(
            MSG91_URL,
            headers={
                "accept": "application/json",
                "authkey": authkey,
                "content-type": "application/json",
            },
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        try:
            provider_response = response.json()
        except ValueError:
            provider_response = None

        response_type = (
            str(provider_response.get("type", "")).strip().lower()
            if isinstance(provider_response, dict)
            else ""
        )
        if response_type != "success":
            logger.error(
                "MSG91 returned a non-success response for an AquaGuard alert."
            )
            return {
                "status": "failed",
                "message": (
                    "MSG91 did not confirm that it accepted the request. "
                    "Check the MSG91 API response and delivery logs."
                ),
            }

        return {
            "status": "accepted",
            "provider": "MSG91",
            "message": (
                "MSG91 accepted the request; final delivery is not confirmed."
            ),
        }
    except requests.RequestException:
        logger.exception("Unable to deliver AquaGuard SMS through MSG91.")
        return {"status": "failed", "message": "MSG91 request failed."}


def send_whatsapp(mobile_number, content_variables):
    missing = _not_configured(
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_WHATSAPP_FROM",
        "TWILIO_WHATSAPP_CONTENT_SID",
    )
    if missing:
        return missing

    if not mobile_number:
        return {
            "status": "not_configured",
            "message": "Set ALERT_PHONE_NUMBER.",
        }

    account_sid = os.environ["TWILIO_ACCOUNT_SID"]
    endpoint = f"{TWILIO_API_URL}/{account_sid}/Messages.json"
    sender = os.environ["TWILIO_WHATSAPP_FROM"]
    content_sid = os.environ["TWILIO_WHATSAPP_CONTENT_SID"]
    recipient = mobile_number
    if not sender.startswith("whatsapp:"):
        sender = f"whatsapp:{sender}"
    if not recipient.startswith("whatsapp:"):
        recipient = f"whatsapp:{recipient}"

    try:
        response = requests.post(
            endpoint,
            auth=(account_sid, os.environ["TWILIO_AUTH_TOKEN"]),
            data={
                "From": sender,
                "To": recipient,
                "ContentSid": content_sid,
                "ContentVariables": json.dumps(content_variables),
            },
            timeout=20,
        )
        if not response.ok:
            try:
                provider_response = response.json()
            except ValueError:
                provider_response = {}

            error = (
                provider_response.get("message")
                if isinstance(provider_response, dict)
                else None
            )
            code = (
                provider_response.get("code")
                if isinstance(provider_response, dict)
                else None
            )
            logger.error(
                "Twilio rejected an AquaGuard WhatsApp alert (HTTP %s, code %s).",
                response.status_code,
                code or "unknown",
            )
            return {
                "status": "failed",
                "message": str(error or "Twilio rejected the request."),
                "code": code,
            }
        return {
            "status": "accepted",
            "provider": "Twilio",
            "message": (
                "Twilio accepted the request; final delivery is not confirmed."
            ),
        }
    except requests.RequestException as error:
        logger.exception("Unable to deliver AquaGuard WhatsApp through Twilio.")
        error_message = str(error)
        for secret in (account_sid, os.environ["TWILIO_AUTH_TOKEN"]):
            if secret:
                error_message = error_message.replace(secret, "[redacted]")
        return {
            "status": "failed",
            "message": (
                f"Twilio {type(error).__name__}: "
                f"{error_message or 'request could not be completed.'}"
            ),
        }


def send_email_alert(severity, plastic_count, latitude, longitude):
    recipient = os.getenv("ALERT_EMAIL", "").strip()
    settings = (
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "ALERT_EMAIL",
    )
    missing = [
        name for name in settings if not os.getenv(name, "").strip()
    ]
    if missing:
        return {
            "status": "not_configured",
            "message": f"Missing settings: {', '.join(missing)}",
        }

    try:
        port = int(os.environ["SMTP_PORT"])
    except ValueError:
        return {
            "status": "not_configured",
            "message": "SMTP_PORT must be a valid port number.",
        }

    username = os.environ["SMTP_USERNAME"].strip()
    password = os.environ["SMTP_PASSWORD"]
    message = EmailMessage()
    message["Subject"] = f"AquaGuard {severity} pollution alert"
    message["From"] = username
    message["To"] = recipient
    message.set_content(
        "AquaGuard detected high pollution.\n\n"
        f"Severity: {severity}\n"
        f"Plastic detections: {plastic_count}\n"
        f"Location: {latitude}, {longitude}\n"
    )

    try:
        with smtplib.SMTP(
            os.environ["SMTP_HOST"].strip(),
            port,
            timeout=20,
        ) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(message)
        return {
            "status": "accepted",
            "provider": "SMTP",
            "message": (
                "SMTP accepted the email; final delivery is not confirmed."
            ),
        }
    except (OSError, smtplib.SMTPException):
        logger.exception("Unable to send an AquaGuard email alert.")
        return {"status": "failed", "message": "SMTP email request failed."}


def notify_high_pollution(severity, plastic_count, latitude, longitude):
    channel_mode = os.getenv("ALERT_CHANNEL", "").strip().lower()
    if channel_mode == "email":
        return {
            "email": send_email_alert(
                severity,
                plastic_count,
                latitude,
                longitude,
            )
        }

    phone_number = os.getenv("ALERT_PHONE_NUMBER", "").strip()
    if not phone_number:
        not_configured = {
            "status": "not_configured",
            "message": "Set ALERT_PHONE_NUMBER.",
        }
        return {"sms": not_configured, "whatsapp": not_configured}

    sms_settings = ("MSG91_AUTHKEY", "MSG91_TEMPLATE_ID")
    missing_sms_settings = [
        setting for setting in sms_settings if not os.getenv(setting, "").strip()
    ]
    sms_enabled = not missing_sms_settings
    whatsapp_settings = (
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_WHATSAPP_FROM",
        "TWILIO_WHATSAPP_CONTENT_SID",
    )
    missing_whatsapp_settings = [
        setting for setting in whatsapp_settings if not os.getenv(setting, "").strip()
    ]
    whatsapp_enabled = not missing_whatsapp_settings

    if channel_mode == "whatsapp":
        sms_enabled = False
    elif channel_mode == "sms":
        whatsapp_enabled = False

    sms_number = phone_number.removeprefix("+")
    location = f"{latitude}, {longitude}"
    content_variables = {
        "1": severity,
        "2": str(plastic_count),
        "3": location,
    }

    sms = {
        "status": "skipped",
        "message": "SMS alerts are disabled in WhatsApp-only mode.",
    }
    if sms_enabled:
        sms = send_sms(
            sms_number,
            os.getenv("MSG91_TEMPLATE_ID"),
            {
                "var1": severity,
                "var2": str(plastic_count),
                "var3": location,
            },
        )
    elif channel_mode == "sms":
        sms = {
            "status": "not_configured",
            "message": (
                "Missing settings: "
                + ", ".join(missing_sms_settings)
            ),
        }

    whatsapp = {
        "status": "not_configured",
        "message": "Set Twilio WhatsApp sender credentials.",
    }
    if whatsapp_enabled:
        whatsapp = send_whatsapp(phone_number, content_variables)
    elif channel_mode == "sms":
        whatsapp = {
            "status": "skipped",
            "message": "WhatsApp alerts are disabled in SMS-only mode.",
        }
    elif channel_mode == "whatsapp":
        whatsapp = {
            "status": "not_configured",
            "message": (
                "Missing settings: "
                + ", ".join(missing_whatsapp_settings)
                if missing_whatsapp_settings
                else "Set ALERT_PHONE_NUMBER."
            ),
        }

    return {"sms": sms, "whatsapp": whatsapp}


def get_notification_status(notification):
    if not notification:
        return "not_required"

    statuses = {channel.get("status") for channel in notification.values()}
    if "accepted" in statuses:
        return "accepted"
    if "failed" in statuses:
        return "failed"
    if "not_configured" in statuses:
        return "not_configured"
    return "not_required"
