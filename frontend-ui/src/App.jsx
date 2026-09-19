import { useEffect, useRef, useState } from "react";
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

const API = "http://127.0.0.1:8000";

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [cameraOnline, setCameraOnline] = useState(false);
  const [cameraTick, setCameraTick] = useState(Date.now());
  const [municipalityStatus, setMunicipalityStatus] = useState("standby");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastAlertRef = useRef(null);
  const [imageSize, setImageSize] = useState({
    width: 1,
    height: 1,
  });

  useEffect(() => {
    loadHistory();
    loadEnvironment();

    const cameraTimer = window.setInterval(() => {
      setCameraTick(Date.now());
      checkCamera();
    }, 3000);

    checkCamera();
    return () => window.clearInterval(cameraTimer);
  }, []);

  const checkCamera = async () => {
    try {
      const response = await fetch(`${API}/api/camera?tick=${Date.now()}`);
      setCameraOnline(response.ok && response.headers.get("content-type")?.includes("image"));
    } catch {
      setCameraOnline(false);
    }
  };

  const speakAlert = (message) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const announcement = new SpeechSynthesisUtterance(message);
    announcement.lang = "en-IN";
    announcement.rate = 0.92;
    window.speechSynthesis.speak(announcement);
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

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      console.log("YOLO RESPONSE:", data);
      console.log("DETECTIONS:", data.detections);

      setResult(data);

      if (data.alert?.required) {
        setMunicipalityStatus("sent");
        const alertKey = `${data.filename}-${data.plastic_count}-${data.severity}`;
        if (lastAlertRef.current !== alertKey) {
          lastAlertRef.current = alertKey;
          speakAlert(`AquaGuard alert. ${data.plastic_count} plastic waste objects detected. Municipality notification sent.`);
        }
      } else {
        setMunicipalityStatus("standby");
      }

      if (data.status === "success") {
        await loadHistory();
        await loadEnvironment();
      }
    } catch (error) {
      console.error("Detection error:", error);

      setResult({
        status: "error",
        message: "Backend connection failed.",
        detections: [],
      });
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
            <span className="panel-label">MUNICIPALITY RESPONSE</span>
            <h3>{municipalityStatus === "sent" ? "Alert sent to municipality" : "Ready for municipality alert"}</h3>
            <p>{municipalityStatus === "sent" ? "The latest plastic-waste detection is queued for field action." : "Run a scan to create a response alert."}</p>
          </div>
          <div className={`response-status ${municipalityStatus}`}>
            {municipalityStatus === "sent" ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
            {municipalityStatus === "sent" ? "SENT" : "STANDBY"}
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

              {cameraOnline && (
                <img
                  className="live-camera-image"
                  src={`${API}/api/camera?tick=${cameraTick}`}
                  alt="Live water body camera"
                  onError={() => setCameraOnline(false)}
                />
              )}

              <div className="camera-overlay">
                <span className="rec-dot"></span>
                {cameraOnline ? "LIVE / AI CAMERA 01" : "WAITING FOR CAMERA"}
              </div>

              {!cameraOnline && <div className="camera-center">
                <Camera size={50} />

                <p>Camera feed unavailable</p>

                <small>
                  Start the camera sender to see the latest frame here.
                </small>
              </div>}

            </div>

          </div>

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