import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  Recycle,
  Target,
  Upload,
  Waves,
} from "lucide-react";

import "./App.css";

const API = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function SourceTrackingMap({ latitude, longitude, plasticCount }) {
  const position = [latitude, longitude];

  return (
    <div
      style={{
        height: "420px",
        width: "100%",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={position}>
          <Popup>
            <strong>AquaGuard AI</strong>
            <br />
            Plastic Hotspot
            <br />
            Plastic Count: {plasticCount}
            <br />
            Latitude: {latitude}
            <br />
            Longitude: {longitude}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [videoResult, setVideoResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [cameraOnline, setCameraOnline] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraDetections, setCameraDetections] = useState([]);
  const [cameraFrameSize, setCameraFrameSize] = useState({
    width: 0,
    height: 0,
  });
  const [cameraDetectionError, setCameraDetectionError] = useState("");
  const [videoError, setVideoError] = useState("");
  const [municipalityStatus, setMunicipalityStatus] = useState("standby");
  const [notificationResults, setNotificationResults] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastAlertRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const [imageSize, setImageSize] = useState({
    width: 1,
    height: 1,
  });

  useEffect(() => {
    loadHistory();
    loadEnvironment();

    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraOnline) {
      return undefined;
    }

    let active = true;
    let timeoutId;

    const analyzeFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        if (active) {
          timeoutId = window.setTimeout(analyzeFrame, 300);
        }
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Unable to prepare a camera frame for detection.");
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frame = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Unable to capture a camera frame."));
              }
            },
            "image/jpeg",
            0.85,
          );
        });
        if (!active) return;

        const formData = new FormData();
        formData.append("file", frame, "camera-frame.jpg");
        const response = await fetch(`${API}/api/detect-frame`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || `Detection failed (${response.status}).`);
        }

        if (active) {
          setCameraDetections(data.detections ?? []);
          setCameraFrameSize(data.frame_size ?? {
            width: canvas.width,
            height: canvas.height,
          });
          setCameraDetectionError("");
        }
      } catch (error) {
        if (active) {
          console.error("Live camera detection error:", error);
          setCameraDetectionError(
            error.message || "Live camera detection failed.",
          );
        }
      } finally {
        if (active) {
          timeoutId = window.setTimeout(analyzeFrame, 1000);
        }
      }
    };

    analyzeFrame();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [cameraOnline]);

  const startCamera = async () => {
    setCameraError("");
    setCameraDetections([]);
    setCameraFrameSize({ width: 0, height: 0 });
    setCameraDetectionError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support webcam access.");
      return;
    }

    setCameraStarting(true);
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      cameraStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.addEventListener(
        "ended",
        () => {
          if (cameraStreamRef.current === stream) {
            cameraStreamRef.current = null;
            setCameraOnline(false);
            setCameraDetections([]);
            setCameraFrameSize({ width: 0, height: 0 });
            setCameraError("The camera was disconnected.");
          }
        },
        { once: true },
      );

      const video = videoRef.current;
      if (!video) {
        throw new Error("The camera preview is not available.");
      }
      video.srcObject = stream;
      await video.play();

      if (cameraStreamRef.current !== stream) {
        return;
      }
      setCameraOnline(true);
    } catch (error) {
      if (cameraStreamRef.current === stream) {
        cameraStreamRef.current = null;
        if (videoRef.current?.srcObject === stream) {
          videoRef.current.srcObject = null;
        }
        stream?.getTracks().forEach((track) => track.stop());
      }

      if (error.name === "AbortError") {
        return;
      }

      console.error("Camera error:", error);

      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        setCameraError("Allow camera access in your browser to start the live feed.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera was found on this device.");
      } else {
        setCameraError(error.message || "Unable to start the camera.");
      }
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    const stream = cameraStreamRef.current;
    cameraStreamRef.current = null;
    if (videoRef.current?.srcObject === stream) {
      videoRef.current.srcObject = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    setCameraOnline(false);
    setCameraError("");
    setCameraDetections([]);
  };

  const speakAlert = (message) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const announcement = new SpeechSynthesisUtterance(message);
    announcement.lang = "en-IN";
    announcement.rate = 0.92;
    window.speechSynthesis.speak(announcement);
  };

  const updateNotificationStatus = (alert) => {
    setNotificationResults(alert?.notification ?? null);
    if (!alert?.required) {
      setMunicipalityStatus("standby");
      return;
    }

    const channelStatuses = Object.values(alert.notification ?? {}).map(
      (channel) => channel.status,
    );

    if (channelStatuses.includes("accepted")) {
      setMunicipalityStatus("accepted");
    } else if (channelStatuses.includes("failed")) {
      setMunicipalityStatus("failed");
    } else {
      setMunicipalityStatus("setup");
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API}/api/detections`);

      if (!response.ok) {
        throw new Error("History request failed");
      }

      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("History error:", error);
    }
  };

  const loadEnvironment = async () => {
    try {
      const response = await fetch(`${API}/api/environment`);

      if (!response.ok) {
        throw new Error("Environment request failed");
      }

      const data = await response.json();
      setEnvironment(data);
    } catch (error) {
      console.error("Environment error:", error);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setResult(null);

    const imageURL = URL.createObjectURL(selectedFile);
    setPreview(imageURL);
  };

  const runDetection = async () => {
    if (!file) {
      alert("Please upload an image first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/api/detect`, {
        method: "POST",
        body: formData,
      });

      const responseBody = await response.text();
      let data;
      try {
        data = responseBody ? JSON.parse(responseBody) : {};
      } catch {
        if (!response.ok) {
          throw new Error(
            `Image detection failed (${response.status}): ${
              responseBody || response.statusText
            }`,
          );
        }
        throw new Error("The backend returned an invalid image response.");
      }
      if (!response.ok) {
        throw new Error(
          data.detail || `Image detection failed (${response.status}).`,
        );
      }

      console.log("YOLO RESPONSE:", data);
      console.log("DETECTIONS:", data.detections);

      setResult(data);

      updateNotificationStatus(data.alert);
      if (data.alert?.required) {
        const alertKey = `${data.filename}-${data.plastic_count}-${data.severity}`;
        if (lastAlertRef.current !== alertKey) {
          lastAlertRef.current = alertKey;
          const notificationAccepted = Object.values(
            data.alert.notification ?? {},
          ).some((channel) => channel.status === "accepted");
          speakAlert(
            notificationAccepted
              ? `AquaGuard alert. ${data.plastic_count} plastic waste objects detected. The notification provider accepted the request. Delivery is not confirmed.`
              : `AquaGuard alert. ${data.plastic_count} plastic waste objects detected. Notification setup or delivery needs attention.`,
          );
        }
      }

      if (data.status === "success") {
        await loadHistory();
        await loadEnvironment();
      }
    } catch (error) {
      console.error("Detection error:", error);

      setResult({
        status: "error",
        message: error.message || "Image detection failed.",
        detections: [],
      });
    } finally {
      setLoading(false);
    }
  };
  const handleVideoUpload = async (videoFile) => {
    if (!videoFile) return;

    setLoading(true);
    setVideoResult(null);
    setVideoError("");

    const formData = new FormData();
    formData.append("file", videoFile);

    try {
      const response = await fetch(
        `${API}/api/detect-video`,
        {
          method: "POST",
          body: formData,
        }
      );

      const responseBody = await response.text();
      let data;
      try {
        data = responseBody ? JSON.parse(responseBody) : {};
      } catch {
        if (!response.ok) {
          throw new Error(
            `Video detection failed (${response.status}): ${
              responseBody || response.statusText
            }`,
          );
        }
        throw new Error("The backend returned an invalid video response.");
      }
      if (!response.ok) {
        throw new Error(data.detail || `Video detection failed (${response.status}).`);
      }

      setVideoResult(data);
      updateNotificationStatus(data.alert);
      if (data.alert?.required) {
        const alertKey = `video-${videoFile.name}-${data.total_plastic_detections}-${data.severity}`;
        if (lastAlertRef.current !== alertKey) {
          lastAlertRef.current = alertKey;
          const notificationAccepted = Object.values(
            data.alert.notification ?? {},
          ).some((channel) => channel.status === "accepted");
          speakAlert(
            notificationAccepted
              ? `AquaGuard alert. ${data.total_plastic_detections} plastic detections found in the video. The notification provider accepted the request. Delivery is not confirmed.`
              : `AquaGuard alert. ${data.total_plastic_detections} plastic detections found in the video. Notification delivery needs attention.`,
          );
        }
      }

    } catch (error) {
      console.error("Video detection error:", error);
      setVideoError(error.message || "Video detection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            <Waves size={24} />
          </div>

          <div>
            <h2>AquaGuard</h2>
            <span>AI MONITORING</span>
          </div>
        </div>

        <nav>
          <a className="active">
            <Activity size={18} />
            Overview
          </a>

          <a>
            <Camera size={18} />
            Live Detection
          </a>

          <a>
            <Recycle size={18} />
            Waste Analytics
          </a>

          <a>
            <MapPin size={18} />
            Source Tracking
          </a>

          <a>
            <AlertTriangle size={18} />
            Alerts
          </a>
        </nav>

        <div className="system-status">
          <span className="status-dot"></span>

          <div>
            <strong>System Online</strong>
            <small>AI Engine Ready</small>
          </div>
        </div>

      </aside>

      {/* MAIN */}
      <main className="main">

        {/* TOP BAR */}
        <header className="topbar">
          <div>
            <p className="eyebrow">WATER BODY INTELLIGENCE / MUNICIPAL RESPONSE</p>

            <h1>AquaGuard Command Center</h1>
          </div>

          <div className="top-status">
            <span className="status-dot"></span>
            {cameraOnline ? "Camera online" : "Camera offline"}
          </div>
        </header>

        {/* HERO */}
        <section className="hero">

          <div>
            <span className="hero-tag">
              AI-POWERED PLASTIC DETECTION
            </span>

            <h2>
              See the alert.
              <br />
              Move the response.
            </h2>

            <p>
              Live camera monitoring with a clear handoff to the municipality.
            </p>
          </div>

          <div className="hero-icon">
            <Waves size={72} />
          </div>

        </section>

        <section className="response-strip">
          <div className="response-copy">
            <span className="panel-label">ALERT NOTIFICATIONS</span>
            <h3>
              {municipalityStatus === "accepted"
                ? "High-pollution alert request accepted"
                : municipalityStatus === "failed"
                  ? "High-pollution alert delivery failed"
                  : municipalityStatus === "setup"
                    ? "High pollution detected — notification setup needed"
                    : "Monitoring for high pollution"}
            </h3>
            <p>
              {municipalityStatus === "accepted"
                ? "The notification provider accepted the request. Check your email inbox or provider delivery report to confirm delivery."
                : municipalityStatus === "failed"
                  ? "Check your notification provider settings and try the scan again."
                  : municipalityStatus === "setup"
                    ? "Configure your recipient email and SMTP credentials in the backend .env file."
                    : "Email notifications are sent only for HIGH pollution."}
              {notificationResults && (
                <>
                  {" "}
                  {Object.entries(notificationResults)
                    .map(([channel, outcome]) => {
                      const detail = outcome.code
                        ? ` (${outcome.code}: ${outcome.message})`
                        : outcome.message
                          ? ` (${outcome.message})`
                          : "";
                      return `${channel.toUpperCase()}: ${outcome.status}${detail}`;
                    })
                    .join(" · ")}
                </>
              )}
            </p>
          </div>
          <div className={`response-status ${municipalityStatus}`}>
            {municipalityStatus === "accepted" ? (
              <CheckCircle2 size={18} />
            ) : municipalityStatus === "failed" || municipalityStatus === "setup" ? (
              <AlertTriangle size={18} />
            ) : (
              <Clock3 size={18} />
            )}
            {municipalityStatus === "accepted"
              ? "ACCEPTED"
              : municipalityStatus === "failed"
                ? "FAILED"
                : municipalityStatus === "setup"
                  ? "SETUP NEEDED"
                  : "STANDBY"}
          </div>
          <button className="voice-toggle" onClick={() => setVoiceEnabled((enabled) => !enabled)}>
            {voiceEnabled ? "Voice alerts on" : "Voice alerts off"}
          </button>
        </section>

        {/* ENVIRONMENT */}
        <section className="environment-panel">

          <div className="panel-header">
            <div>
              <span className="panel-label">
                ENVIRONMENT MONITORING
              </span>

              <h3>Water Body Sensors</h3>
            </div>
          </div>

          <div className="environment-grid">

            <div className="environment-card">
              <span>🌊 Turbidity</span>

              <strong>
                {environment?.water
                  ? `${environment.water.turbidity_ntu} NTU`
                  : "—"}
              </strong>
            </div>

            <div className="environment-card">
              <span>🌡️ Temperature</span>

              <strong>
                {environment?.water
                  ? `${environment.water.temperature_c} °C`
                  : "—"}
              </strong>
            </div>

            <div className="environment-card">
              <span>🧪 pH Level</span>

              <strong>
                {environment?.water
                  ? environment.water.ph
                  : "—"}
              </strong>
            </div>

            <div className="environment-card">
              <span>📍 GPS Location</span>

              <strong>
                {environment?.gps
                  ? `${environment.gps.latitude}, ${environment.gps.longitude}`
                  : "—"}
              </strong>
            </div>

          </div>
        </section>

        {/* STATS */}
        <section className="stats-grid">

          <StatCard
            icon={<Recycle />}
            label="Total Detections"
            value={result?.total_objects ?? result?.count ?? 0}
            change="Current scan"
          />

          <StatCard
            icon={<Target />}
            label="AI Confidence"
            value={
              result?.average_confidence_percent != null
                ? `${result.average_confidence_percent}%`
                : "—"
            }
            change="Average YOLO confidence"
          />

          <StatCard
            icon={<AlertTriangle />}
            label="Active Alerts"
            value={
              result?.alert?.required ? 1 : 0
            }
            change={
              result?.severity
                ? `${result.severity} severity`
                : "Current image"
            }
          />

          <StatCard
            icon={<MapPin />}
            label="Tracked Sources"
            value={history.length > 0 ? "1" : "0"}
            change="Detection source"
          />

        </section>

        {/* CONTENT */}
        <section className="content-grid">

          {/* DETECTION PANEL */}
          <div className="panel">

            <div className="panel-header">

              <div>
                <span className="panel-label">
                  AI DETECTION
                </span>

                <h3>Plastic Waste Detection</h3>
              </div>

              <Recycle size={20} />
            </div>

            {/* UPLOAD */}
            <div className="upload-box">

              <Upload size={42} />

              <h3>Upload water-body image</h3>

              <p>
                Select an image containing floating plastic.
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              {file && (
                <p className="selected-file">
                  Selected: {file.name}
                </p>
              )}

              <button
                className="detect-button"
                onClick={runDetection}
                disabled={loading}
              >
                {loading
                  ? "Running YOLO..."
                  : "Run AI Detection"}
                            </button>

            </div>


            {/* VIDEO UPLOAD */}
            <div className="upload-box">

              <Upload size={42} />

              <h3>Upload water-body video</h3>

              <p>
                Select a video to detect floating plastic frame-by-frame.
              </p>

              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  setVideoError("");
                  setVideoResult(null);
                  const videoFile = e.target.files?.[0];

                  if (videoFile) {
                    handleVideoUpload(videoFile);
                  }
                }}
              />

              {loading && (
                <p className="selected-file">
                  Uploading video and analyzing every frame... Please wait.
                </p>
              )}

              {videoError && (
                <p className="camera-error" role="alert">
                  {videoError}
                </p>
              )}

              {videoResult && (
                <div className="selected-file">
                  <p>
                    Frames Processed:{" "}
                    {videoResult.frames_processed}
                  </p>

                  <p>
                    Plastic Detections:{" "}
                    {videoResult.total_plastic_detections}
                  </p>

                  <p>
                    Camera:{" "}
                    {videoResult.camera?.camera_id}
                  </p>

                  <p>
                    GPS:{" "}
                    {videoResult.camera?.latitude},{" "}
                    {videoResult.camera?.longitude}
                  </p>
                  <p>
                    Severity:{" "}
                    <strong>
                      {videoResult.severity}
                    </strong>
                  </p>
                  <p>
                    Alert:{" "}
                    <strong>
                      {videoResult.alert?.required
                        ? "MUNICIPALITY ALERT REQUIRED"
                        : "No Alert Required"}
                    </strong>
                  </p>
                </div>
              )}

            </div>

              {videoResult && (
  <div className="panel">
    <div className="panel-header">
      <div>
        <span className="panel-label">
          VIDEO ANALYTICS
        </span>

        <h3>Plastic Pollution Analysis</h3>
      </div>

      <Activity size={20} />
    </div>

    <div className="stats-grid">

      <div className="stat-card">
        <span>FRAMES PROCESSED</span>
        <strong>
          {videoResult.frames_processed}
        </strong>
      </div>

      <div className="stat-card">
        <span>PLASTIC DETECTIONS</span>
        <strong>
          {videoResult.total_plastic_detections}
        </strong>
      </div>

      <div className="stat-card">
        <span>SEVERITY</span>
        <strong>
          {videoResult.severity}
        </strong>
      </div>

      <div className="stat-card">
        <span>ALERT STATUS</span>
        <strong>
          {videoResult.alert?.required
            ? "REQUIRED"
            : "NORMAL"}
        </strong>
      </div>

    </div>
  </div>
)}


            {/* IMAGE OUTPUT */}
            {preview && (
              <div className="output-section">

                <div className="output-title">
                  <span className="panel-label">
                    AI OUTPUT
                  </span>

                  <h3>Detection Result</h3>
                </div>

                {/* IMPORTANT:
                    Wrapper has position: relative.
                    Image and boxes use the exact same container.
                */}
                <div className="detection-image">

                  <img
                    src={preview}
                    alt="Uploaded water body"
                    onLoad={(event) => {
                      const image = event.currentTarget;

                      setImageSize({
                        width: image.naturalWidth,
                        height: image.naturalHeight,
                      });

                      console.log(
                        "IMAGE NATURAL SIZE:",
                        image.naturalWidth,
                        image.naturalHeight
                      );
                    }}
                  />

                  {/* BOUNDING BOXES */}
                  {result?.detections?.map((item, index) => {

                    if (
                      !item.bbox ||
                      item.bbox.length !== 4
                    ) {
                      return null;
                    }

                    const [
                      x1,
                      y1,
                      x2,
                      y2,
                    ] = item.bbox;

                    const left =
                      (Number(x1) /
                        imageSize.width) *
                      100;

                    const top =
                      (Number(y1) /
                        imageSize.height) *
                      100;

                    const width =
                      ((Number(x2) - Number(x1)) /
                        imageSize.width) *
                      100;

                    const height =
                      ((Number(y2) - Number(y1)) /
                        imageSize.height) *
                      100;

                    return (
                      <div
                        key={`${item.object_id ?? index}-${index}`}
                        className="bounding-box"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                      >
                        <span className="box-label">
                          {item.class_name || "floater"}
                          {" "}
                          {Math.round(
                            Number(item.confidence) * 100
                          )}
                          %
                        </span>
                      </div>
                    );
                  })}

                </div>

              </div>
            )}

            {/* RESULT */}
            {result && (
              <div className="result-box">

                <strong>
                  Status: {result.status}
                </strong>

                {result.message && (
                  <p>{result.message}</p>
                )}

                {result.status === "success" && (
                  <>
                    <div className="result-summary">

                      <div>
                        <span>Objects</span>
                        <strong>
                          {result.total_objects ?? result.count ?? 0}
                        </strong>
                      </div>

                      <div>
                        <span>Plastic</span>
                        <strong>
                          {result.plastic_count ?? 0}
                        </strong>
                      </div>

                      <div>
                        <span>Severity</span>
                        <strong>
                          {result.severity ?? "LOW"}
                        </strong>
                      </div>

                    </div>

                    {result.detections?.length > 0 && (
                      <div className="detection-list">

                        <h4>Detected Objects</h4>

                        {result.detections.map(
                          (item, index) => (
                            <div
                              className="detection-item"
                              key={`${item.object_id ?? index}-detail`}
                            >
                              <span>
                                #{item.object_id ?? index + 1}
                                {" "}
                                {item.class_name}
                              </span>

                              <strong>
                                {Math.round(
                                  Number(item.confidence) * 100
                                )}
                                %
                              </strong>
                            </div>
                          )
                        )}

                      </div>
                    )}

                    {result.count === 0 && (
                      <p>
                        No plastic detected in this image.
                      </p>
                    )}
                  </>
                )}

              </div>
            )}

          </div>

          {/* CAMERA */}
          <div className="panel camera-panel">

            <div className="panel-header">

              <div>
                <span className="panel-label">
                  VISION FEED
                </span>

                <h3>Live Camera</h3>
              </div>

              <Camera size={20} />

            </div>

            <div className="camera-view">

              <video
                ref={videoRef}
                className="live-camera-image"
                autoPlay
                playsInline
                muted
                aria-label="Live camera feed"
              />
              {cameraFrameSize.width > 0 && (
                <svg
                  className="camera-detection-overlay"
                  viewBox={`0 0 ${cameraFrameSize.width} ${cameraFrameSize.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label={`${cameraDetections.length} detected objects`}
                >
                  {cameraDetections
                    .filter((detection) => detection.is_plastic)
                    .map((detection, index) => {
                      const [x1, y1, x2, y2] = detection.bbox;
                      return (
                        <g key={`${detection.class_name}-${index}`}>
                          <rect
                            x={x1}
                            y={y1}
                            width={x2 - x1}
                            height={y2 - y1}
                          />
                          <text x={x1} y={Math.max(18, y1 - 6)}>
                            {detection.class_name}{" "}
                            {Math.round(detection.confidence * 100)}%
                          </text>
                        </g>
                      );
                    })}
                </svg>
              )}

              <div className="camera-overlay">
                <span className="rec-dot"></span>
                {cameraOnline ? "LIVE / LOCAL WEBCAM" : "WAITING FOR CAMERA"}
              </div>
              {cameraOnline && (
                <p className="camera-detection-status" aria-live="polite">
                  {cameraDetectionError
                    ? cameraDetectionError
                    : `${cameraDetections.filter((item) => item.is_plastic).length} plastic object(s) detected`}
                </p>
              )}

              {!cameraOnline && <div className="camera-center">
                <Camera size={50} />

                <p>Camera feed unavailable</p>

                <small>
                  Start the webcam to show its real-time feed here.
                </small>
              </div>}

            </div>
            <button
              className="camera-action"
              type="button"
              onClick={cameraOnline ? stopCamera : startCamera}
              disabled={cameraStarting}
            >
              {cameraStarting
                ? "Starting Camera..."
                : cameraOnline
                  ? "Stop Camera"
                  : "Start Camera"}
            </button>
            {cameraError && <p className="camera-error">{cameraError}</p>}

          </div>

        </section>
        {/* SOURCE TRACKING MAP */}
<section className="panel">
  <div className="panel-header">
    <div>
      <span className="panel-label">
        SOURCE TRACKING
      </span>

      <h3>Plastic Waste Hotspot Map</h3>
    </div>

    <MapPin size={20} />
  </div>

  {videoResult?.camera || environment?.gps ? (
  <SourceTrackingMap
    latitude={
      videoResult?.camera?.latitude ??
      environment?.gps?.latitude
    }
    longitude={
      videoResult?.camera?.longitude ??
      environment?.gps?.longitude
    }
    plasticCount={
      videoResult?.total_plastic_detections ??
      result?.plastic_count ??
      history.length
    }
  />
) : (
    <div className="empty-history">
      <MapPin size={32} />
      <p>GPS location unavailable.</p>
    </div>
  )}
</section>

        {/* HISTORY */}
        <section className="panel history-panel">

          <div className="panel-header">

            <div>
              <span className="panel-label">
                DETECTION LOG
              </span>

              <h3>Recent Plastic Detections</h3>
            </div>

            <span className="live-badge">
              {history.length} RECORDS
            </span>

          </div>

          {history.length === 0 ? (

            <div className="empty-history">
              <Recycle size={32} />

              <p>
                No detections recorded yet.
              </p>
            </div>

          ) : (

            <div className="history-table">

              <div className="history-row history-header">
                <span>CLASS</span>
                <span>CONFIDENCE</span>
                <span>SOURCE</span>
                <span>TIME</span>
              </div>

              {history.map((item) => (

                <div
                  className="history-row"
                  key={item.id}
                >

                  <span>
                    {item.class_name}
                  </span>

                  <strong>
                    {Math.round(
                      Number(item.confidence) * 100
                    )}
                    %
                  </strong>

                  <span>
                    {item.source}
                  </span>

                  <span>
                    {item.created_at}
                  </span>

                </div>

              ))}

            </div>
          )}

        </section>

      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  change,
}) {
  return (
    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <span>{label}</span>

      <strong>{value}</strong>

      <small>{change}</small>

    </div>
  );
}

export default App;