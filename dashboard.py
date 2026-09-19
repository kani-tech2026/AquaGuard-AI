import streamlit as st
from ultralytics import YOLO
from PIL import Image
import numpy as np
import pandas as pd
from datetime import datetime

# =========================
# MODEL
# =========================

MODEL_PATH = r"C:\Users\Admin\runs\detect\train-3\weights\best.pt"

model = YOLO(MODEL_PATH)


# =========================
# PAGE
# =========================

st.set_page_config(
    page_title="AquaGuard AI",
    page_icon="💧",
    layout="wide"
)

st.title("💧 AquaGuard AI")
st.subheader(
    "AI-Powered Plastic Waste Detection & Monitoring System"
)

st.success("🟢 AquaGuard AI Monitoring System — ONLINE")


# =========================
# TOP STATUS
# =========================

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        "System Status",
        "ONLINE"
    )

with col2:
    st.metric(
        "AI Model",
        "YOLO26n"
    )

with col3:
    st.metric(
        "Monitoring",
        "ACTIVE"
    )

with col4:
    st.metric(
        "Detection Type",
        "PLASTIC"
    )


# =========================
# SIDEBAR
# =========================

st.sidebar.header("⚙️ Monitoring Settings")

location = st.sidebar.text_input(
    "📍 Water Body Location",
    value="Kongu Engineering College"
)

confidence = st.sidebar.slider(
    "Detection Confidence",
    0.05,
    0.90,
    0.25,
    0.05
)

alert_limit = st.sidebar.number_input(
    "🚨 Alert Threshold",
    min_value=1,
    max_value=50,
    value=5
)

st.sidebar.info(
    f"Office alert triggers when plastic count reaches "
    f"{alert_limit}."
)


# =========================
# INPUT
# =========================

st.header("📷 Water Body Monitoring")

input_type = st.radio(
    "Choose Input Method",
    ["Upload Image", "Laptop Camera"],
    horizontal=True
)

image = None

if input_type == "Upload Image":

    uploaded_file = st.file_uploader(
        "Upload Water Body Image",
        type=["jpg", "jpeg", "png"]
    )

    if uploaded_file:
        image = Image.open(
            uploaded_file
        ).convert("RGB")

else:

    camera_image = st.camera_input(
        "Take Water Body Picture"
    )

    if camera_image:
        image = Image.open(
            camera_image
        ).convert("RGB")


# =========================
# DETECTION
# =========================

if image is not None:

    st.image(
        image,
        caption="Water Body Image",
        width="stretch"
    )

    if st.button(
        "🔍 Detect Plastic Waste",
        width="stretch"
    ):

        image_array = np.array(image)

        with st.spinner(
            "🤖 AquaGuard AI is analyzing..."
        ):

            results = model.predict(
                source=image_array,
                conf=0.05,
                verbose=False
            )

        result = results[0]

        count = len(result.boxes)


        # =========================
        # STATUS
        # =========================

        if count >= alert_limit:

            status = "HIGH"

        elif count > 0:

            status = "WARNING"

        else:

            status = "CLEAR"


        # =========================
        # RISK LEVEL
        # =========================

        if count >= 5:

            risk_level = "🔴 HIGH RISK"

        elif count >= 3:

            risk_level = "🟡 MEDIUM RISK"

        else:

            risk_level = "🟢 LOW RISK"


        # =========================
        # TIME
        # =========================

        detection_time = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )


        # =========================
        # SAVE HISTORY
        # =========================

        history_file = "detection_history.csv"

        new_record = pd.DataFrame([{

            "Time": detection_time,

            "Location": location,

            "Plastic Count": count,

            "Status": status,

            "Risk Level": risk_level

        }])


        try:

            old_history = pd.read_csv(
                history_file
            )

            history = pd.concat(
                [
                    old_history,
                    new_record
                ],
                ignore_index=True
            )

        except FileNotFoundError:

            history = new_record


        history.to_csv(
            history_file,
            index=False
        )


        # =========================
        # RESULT
        # =========================

        st.divider()

        st.subheader(
            "📊 Detection Result"
        )


        col1, col2, col3, col4 = st.columns(4)


        # Plastic Count

        with col1:

            st.metric(
                "🧴 Plastic Detected",
                count
            )


        # Status

        with col2:

            if status == "HIGH":

                st.metric(
                    "Status",
                    "🚨 HIGH"
                )

            elif status == "WARNING":

                st.metric(
                    "Status",
                    "⚠️ WARNING"
                )

            else:

                st.metric(
                    "Status",
                    "✅ CLEAR"
                )


        # Confidence

        with col3:

            if count > 0:

                confidence_values = [

                    float(box.conf[0])

                    for box in result.boxes

                ]

                avg_confidence = (

                    sum(confidence_values)
                    /
                    len(confidence_values)

                )

                st.metric(
                    "🎯 Avg Confidence",
                    f"{avg_confidence:.1%}"
                )

            else:

                st.metric(
                    "🎯 Avg Confidence",
                    "—"
                )


        # Risk

        with col4:

            st.metric(
                "🌊 Risk Level",
                risk_level
            )


        # =========================
        # OFFICE ALERT
        # =========================

        if status == "HIGH":

            st.error(
                f"🚨 HIGH PLASTIC WASTE ALERT\n\n"
                f"{count} plastic floaters detected "
                f"at {location}."
            )

            st.warning(
                "⚠️ Immediate inspection recommended."
            )


            # Office Alert

            st.info(
                f"""
📢 OFFICE ALERT GENERATED

📍 Location:
{location}

🧴 Plastic Count:
{count}

🌊 Risk Level:
{risk_level}

🕐 Detection Time:
{detection_time}

📌 Action:
Immediate inspection recommended.
"""
            )


        elif status == "WARNING":

            st.warning(
                f"⚠️ {count} plastic floater(s) "
                f"detected at {location}."
            )


        else:

            st.success(
                f"✅ WATER CLEAR\n\n"
                f"No plastic waste detected "
                f"at {location}."
            )


        # =========================
        # DETECTION DETAILS
        # =========================

        if count > 0:

            st.subheader(
                "🔎 Detection Details"
            )

            for i, box in enumerate(
                result.boxes,
                start=1
            ):

                conf = float(
                    box.conf[0]
                )

                st.write(
                    f"**Floater {i}** — "
                    f"Confidence: {conf:.1%}"
                )


        # =========================
        # ANNOTATED IMAGE
        # =========================

        st.subheader(
            "🖼️ AI Detection Result"
        )

        annotated = result.plot()

        st.image(
            annotated,
            caption="AquaGuard AI Detection",
            width="stretch"
        )


# =========================
# MONITORING HISTORY
# =========================

st.divider()

st.header(
    "📈 Monitoring History"
)


try:

    history = pd.read_csv(
        "detection_history.csv"
    )


    if len(history) > 0:

        # =========================
        # SUMMARY
        # =========================

        total_detections = len(history)

        total_plastic = int(
            history["Plastic Count"].sum()
        )

        high_alerts = int(
            (history["Status"] == "HIGH").sum()
        )


        col1, col2, col3 = st.columns(3)


        with col1:

            st.metric(
                "🔍 Total Detections",
                total_detections
            )


        with col2:

            st.metric(
                "🧴 Total Plastic Found",
                total_plastic
            )


        with col3:

            st.metric(
                "🚨 High Alerts",
                high_alerts
            )


        # =========================
        # TABLE
        # =========================

        st.subheader(
            "🗂️ Recent Detection Records"
        )

        st.dataframe(
            history.tail(10),
            width="stretch"
        )


        # =========================
        # TREND
        # =========================

        st.subheader(
            "📊 Plastic Waste Trend"
        )

        chart_data = history[
            ["Time", "Plastic Count"]
        ].copy()

        chart_data["Time"] = pd.to_datetime(
            chart_data["Time"]
        )

        chart_data = chart_data.set_index(
            "Time"
        )

        st.line_chart(
            chart_data["Plastic Count"]
        )


        # =========================
        # DOWNLOAD REPORT
        # =========================

        st.subheader(
            "📥 Monitoring Report"
        )

        csv_data = history.to_csv(
            index=False
        ).encode("utf-8")


        st.download_button(
            "📥 Download Monitoring Report",
            data=csv_data,
            file_name=(
                "aquaguard_monitoring_report.csv"
            ),
            mime="text/csv",
            width="stretch"
        )


except FileNotFoundError:

    st.info(
        "No monitoring history yet. "
        "Run your first detection."
    )