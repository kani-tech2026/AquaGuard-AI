import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  Droplets,
  MapPin,
  Recycle,
  Target,
  Upload,
  Waves,
  BarChart3,
  Bell,
  Radio,
  ShieldCheck,
  Thermometer,
} from "lucide-react";

import "./App.css";

const API = "http://127.0.0.1:8001";

function App() {
  // ============================================================
  // STATE
  // ============================================================

  const [activePage, setActivePage] = useState("Overview");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [stats, setStats] = useState(null);

  const [imageSize, setImageSize] = useState({
    width: 1,
    height: 1,
  });

  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef(null);
  const lastAlertKeyRef = useRef("");

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadDashboardData();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!result || result.status !== "success") {
      return;
    }

    if (!result.alert?.required) {
      return;
    }

    const alertKey = `${result.plastic_count}-${result.severity}-${result.filename ?? "scan"}`;

    if (lastAlertKeyRef.current === alertKey) {
      return;
    }

    lastAlertKeyRef.current = alertKey;

    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const message = `Warning. Plastic waste detected in the monitored water body. ${result.plastic_count} plastic objects detected. Severity ${result.severity}.`;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }, [result]);

  // ============================================================
  // LOAD ALL DATA
  // ============================================================

  const loadDashboardData = async () => {
    await Promise.all([
      loadHistory(),
      loadEnvironment(),
      loadStats(),
    ]);
  };

  // ============================================================
  // LOAD HISTORY
  // ============================================================

  const loadHistory = async () => {
    try {
      const response = await fetch(
        `${API}/api/detections`
      );

      if (!response.ok) return;

      const data = await response.json();

      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("History error:", error);
    }
  };

  // ============================================================
  // LOAD ENVIRONMENT
  // ============================================================

  const loadEnvironment = async () => {
    try {
      const response = await fetch(
        `${API}/api/environment`
      );

      if (!response.ok) return;

      const data = await response.json();

      setEnvironment(data);
    } catch (error) {
      console.error("Environment error:", error);
    }
  };

  // ============================================================
  // LOAD STATS
  // ============================================================

  const loadStats = async () => {
    try {
      const response = await fetch(
        `${API}/api/stats`
      );

      if (!response.ok) return;

      const data = await response.json();

      setStats(data);
    } catch (error) {
      console.error("Stats error:", error);
    }
  };

  // ============================================================
  // FILE SELECT
  // ============================================================

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const imageURL =
      URL.createObjectURL(selectedFile);

    setPreview(imageURL);
  };

  // ============================================================
  // RUN YOLO DETECTION
  // ============================================================

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

      console.log(
        "Sending image to:",
        `${API}/api/detect`
      );

      const response = await fetch(
        `${API}/api/detect`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log("YOLO RESULT:", data);

      if (!response.ok) {
        throw new Error(
          data.message || "Detection failed"
        );
      }

      setResult(data);

      if (data.status === "success") {
        await loadDashboardData();
      }
    } catch (error) {
      console.error(
        "DETECTION ERROR:",
        error
      );

      setResult({
        status: "error",
        message:
          "Backend connection failed. Please check the AquaGuard API.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // START CAMERA
  // ============================================================

  const startCamera = async () => {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        alert(
          "Camera is not supported by this browser."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: true,
            audio: false,
          }
        );

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraOn(true);
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      alert(
        "Camera permission denied or camera is not available."
      );
    }
  };

  // ============================================================
  // STOP CAMERA
  // ============================================================

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());

      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const navigateTo = (page) => {
    setActivePage(page);
  };

  // ============================================================
  // CALCULATIONS
  // ============================================================

  const totalDetections =
    stats?.total_detections ??
    history.length;

  const plasticObjects =
    stats?.plastic_objects ??
    history.filter(
      (item) => item.is_plastic
    ).length;

  const activeAlerts =
    result?.alert?.required
      ? 1
      : 0;

  const trackedSources =
    new Set(
      history
        .map((item) => item.source)
        .filter(Boolean)
    ).size;

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            <Waves size={24} />
          </div>

          <div>
            <h2>AquaGuard</h2>

            <span>
              AI MONITORING
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <SidebarItem
            icon={<Activity size={18} />}
            label="Overview"
            active={
              activePage === "Overview"
            }
            onClick={() =>
              navigateTo("Overview")
            }
          />

          <SidebarItem
            icon={<Camera size={18} />}
            label="Live Detection"
            active={
              activePage ===
              "Live Detection"
            }
            onClick={() =>
              navigateTo("Live Detection")
            }
          />

          <SidebarItem
            icon={<Recycle size={18} />}
            label="Waste Analytics"
            active={
              activePage ===
              "Waste Analytics"
            }
            onClick={() =>
              navigateTo("Waste Analytics")
            }
          />

          <SidebarItem
            icon={<MapPin size={18} />}
            label="Source Tracking"
            active={
              activePage ===
              "Source Tracking"
            }
            onClick={() =>
              navigateTo("Source Tracking")
            }
          />

          <SidebarItem
            icon={<Bell size={18} />}
            label="Alerts"
            active={
              activePage === "Alerts"
            }
            onClick={() =>
              navigateTo("Alerts")
            }
          />

          <SidebarItem
            icon={<Droplets size={18} />}
            label="Water Body Sensors"
            active={
              activePage ===
              "Water Body Sensors"
            }
            onClick={() =>
              navigateTo(
                "Water Body Sensors"
              )
            }
          />

        </nav>

        {/* SYSTEM STATUS */}

        <div className="system-status">

          <span className="status-dot"></span>

          <div>
            <strong>
              System Online
            </strong>

            <small>
              AI Engine Ready
            </small>
          </div>

        </div>

      </aside>

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="main">

        {/* TOP BAR */}

        <header className="topbar">

          <div>

            <p className="eyebrow">
              WATER BODY INTELLIGENCE
            </p>

            <h1>
              AquaGuard Command Center
            </h1>

          </div>

          <div className="top-status">

            <span className="status-dot"></span>

            <span>
              Live System
            </span>

          </div>

        </header>

        {/* ====================================================
            PAGE TITLE
        ==================================================== */}

        <div className="page-heading">

          <div>

            <span className="panel-label">
              AQUAGUARD AI
            </span>

            <h2>
              {activePage}
            </h2>

          </div>

          <div className="monitoring-badge">

            <Radio size={15} />

            Monitoring Active

          </div>

        </div>

        {/* ====================================================
            OVERVIEW
        ==================================================== */}

        {activePage === "Overview" && (

          <OverviewPage
            environment={environment}
            totalDetections={
              totalDetections
            }
            plasticObjects={
              plasticObjects
            }
            activeAlerts={
              activeAlerts
            }
            trackedSources={
              trackedSources
            }
            history={history}
            result={result}
            onDetection={() =>
              navigateTo(
                "Live Detection"
              )
            }
            onAnalytics={() =>
              navigateTo(
                "Waste Analytics"
              )
            }
            onAlerts={() =>
              navigateTo("Alerts")
            }
          />

        )}

        {/* ====================================================
            LIVE DETECTION
        ==================================================== */}

        {activePage ===
          "Live Detection" && (

          <LiveDetectionPage
            file={file}
            preview={preview}
            result={result}
            loading={loading}
            imageSize={imageSize}
            videoRef={videoRef}
            cameraOn={cameraOn}
            handleFileChange={
              handleFileChange
            }
            runDetection={
              runDetection
            }
            startCamera={
              startCamera
            }
            stopCamera={
              stopCamera
            }
            setImageSize={
              setImageSize
            }
          />

        )}

        {/* ====================================================
            WASTE ANALYTICS
        ==================================================== */}

        {activePage ===
          "Waste Analytics" && (

          <WasteAnalyticsPage
            history={history}
            stats={stats}
            result={result}
          />

        )}

        {/* ====================================================
            SOURCE TRACKING
        ==================================================== */}

        {activePage ===
          "Source Tracking" && (

          <SourceTrackingPage
            history={history}
            environment={environment}
          />

        )}

        {/* ====================================================
            ALERTS
        ==================================================== */}

        {activePage === "Alerts" && (

          <AlertsPage
            result={result}
            history={history}
          />

        )}

        {/* ====================================================
            WATER SENSORS
        ==================================================== */}

        {activePage ===
          "Water Body Sensors" && (

          <WaterSensorsPage
            environment={
              environment
            }
          />

        )}

      </main>
    </div>
  );
}


/* ============================================================
   SIDEBAR ITEM
============================================================ */

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}) {
  return (
    <button
      className={`sidebar-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      {icon}

      <span>{label}</span>
    </button>
  );
}


/* ============================================================
   OVERVIEW PAGE
============================================================ */

function OverviewPage({
  environment,
  totalDetections,
  plasticObjects,
  activeAlerts,
  trackedSources,
  history,
  result,
  onDetection,
  onAnalytics,
  onAlerts,
}) {
  return (
    <>
      {/* HERO */}

      <section className="hero">

        <div>

          <span className="hero-tag">
            AI-POWERED PLASTIC DETECTION
          </span>

          <h2>
            Protecting water bodies
            <br />
            with intelligent vision.
          </h2>

          <p>
            Detect floating plastic waste,
            monitor water conditions and
            identify pollution hotspots
            using AI-powered vision.
          </p>

          <button
            className="primary-action"
            onClick={onDetection}
          >
            <Camera size={18} />
            Start Detection
          </button>

        </div>

        <div className="hero-icon">
          <Waves size={72} />
        </div>

      </section>


      {/* STAT CARDS */}

      <section className="stats-grid">

        <StatCard
          icon={<Recycle />}
          label="Total Detections"
          value={totalDetections}
          change="Recorded scans"
        />

        <StatCard
          icon={<Target />}
          label="Plastic Objects"
          value={plasticObjects}
          change="Plastic waste detected"
        />

        <StatCard
          icon={<AlertTriangle />}
          label="Active Alerts"
          value={activeAlerts}
          change="Current alert state"
        />

        <StatCard
          icon={<MapPin />}
          label="Tracked Sources"
          value={trackedSources}
          change="Detection sources"
        />

      </section>


      {/* ENVIRONMENT */}

      <section className="panel">

        <PanelHeader
          label="ENVIRONMENT MONITORING"
          title="Water Body Sensors"
          icon={<Droplets size={20} />}
        />

        <div className="environment-grid">

          <EnvironmentCard
            icon={<Waves size={19} />}
            title="Turbidity"
            value={
              environment
                ? `${environment.water?.turbidity_ntu ?? "—"} NTU`
                : "—"
            }
          />

          <EnvironmentCard
            icon={
              <Thermometer size={19} />
            }
            title="Temperature"
            value={
              environment
                ? `${environment.water?.temperature_c ?? "—"} °C`
                : "—"
            }
          />

          <EnvironmentCard
            icon={<Activity size={19} />}
            title="pH Level"
            value={
              environment
                ? environment.water?.ph ?? "—"
                : "—"
            }
          />

          <EnvironmentCard
            icon={<MapPin size={19} />}
            title="GPS Location"
            value={
              environment
                ? `${environment.gps?.latitude ?? "—"}, ${environment.gps?.longitude ?? "—"}`
                : "—"
            }
          />

        </div>

      </section>


      {/* QUICK ACTIONS */}

      <section className="content-grid">

        <div className="panel">

          <PanelHeader
            label="SYSTEM CONTROL"
            title="Monitoring Actions"
            icon={<ShieldCheck size={20} />}
          />

          <div className="quick-actions">

            <button
              className="quick-action"
              onClick={onDetection}
            >
              <Camera size={22} />

              <div>
                <strong>
                  Live Detection
                </strong>

                <span>
                  Run AI plastic detection
                </span>
              </div>
            </button>

            <button
              className="quick-action"
              onClick={onAnalytics}
            >
              <BarChart3 size={22} />

              <div>
                <strong>
                  Waste Analytics
                </strong>

                <span>
                  View detection statistics
                </span>
              </div>
            </button>

            <button
              className="quick-action"
              onClick={onAlerts}
            >
              <Bell size={22} />

              <div>
                <strong>
                  Alert Center
                </strong>

                <span>
                  Check pollution alerts
                </span>
              </div>
            </button>

          </div>

        </div>


        {/* LATEST RESULT */}

        <div className="panel">

          <PanelHeader
            label="LATEST ANALYSIS"
            title="Current Detection"
            icon={<Activity size={20} />}
          />

          {result?.status ===
          "success" ? (

            <div className="latest-result">

              <div className="latest-number">
                {result.plastic_count}
              </div>

              <div>
                <strong>
                  Plastic objects
                </strong>

                <span>
                  Severity:{" "}
                  {result.severity}
                </span>

                <span>
                  Confidence:{" "}
                  {
                    result.average_confidence_percent
                  }
                  %
                </span>
              </div>

            </div>

          ) : (

            <div className="empty-state">

              <Activity size={30} />

              <p>
                No recent detection
              </p>

              <small>
                Run an AI scan to see
                analysis here.
              </small>

            </div>

          )}

        </div>

      </section>


      {/* RECENT HISTORY */}

      <HistoryPanel
        history={history}
      />
    </>
  );
}


/* ============================================================
   LIVE DETECTION PAGE
============================================================ */

function LiveDetectionPage({
  file,
  preview,
  result,
  loading,
  imageSize,
  videoRef,
  cameraOn,
  handleFileChange,
  runDetection,
  startCamera,
  stopCamera,
  setImageSize,
}) {
  return (
    <section className="content-grid">

      {/* IMAGE DETECTION */}

      <div className="panel">

        <PanelHeader
          label="AI DETECTION"
          title="Plastic Waste Detection"
          icon={<Recycle size={20} />}
        />

        <div className="upload-box">

          <Upload size={42} />

          <h3>
            Upload water-body image
          </h3>

          <p>
            Select an image containing
            floating plastic waste.
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


        {/* IMAGE RESULT */}

        {preview && (

          <div className="output-section">

            <div className="output-title">

              <span className="panel-label">
                AI OUTPUT
              </span>

              <h3>
                Detection Result
              </h3>

            </div>

            <div className="detection-image">

              <img
                src={preview}
                alt="Uploaded water body"
                onLoad={(event) => {

                  const image =
                    event.currentTarget;

                  setImageSize({
                    width:
                      image.naturalWidth,
                    height:
                      image.naturalHeight,
                  });

                }}
              />

              {result?.detections?.map(
                (item, index) => {

                  const [
                    x1,
                    y1,
                    x2,
                    y2,
                  ] = item.bbox;

                  const left =
                    (x1 /
                      imageSize.width) *
                    100;

                  const top =
                    (y1 /
                      imageSize.height) *
                    100;

                  const width =
                    ((x2 - x1) /
                      imageSize.width) *
                    100;

                  const height =
                    ((y2 - y1) /
                      imageSize.height) *
                    100;

                  return (
                    <div
                      key={
                        item.object_id ??
                        index
                      }
                      className="bounding-box"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                    >
                      <span className="box-label">
                        {item.class_name}{" "}
                        {Math.round(
                          item.confidence *
                            100
                        )}
                        %
                      </span>
                    </div>
                  );
                }
              )}

            </div>

          </div>

        )}


        {/* RESULT */}

        {result && (

          <DetectionAnalysis
            result={result}
          />

        )}

      </div>


      {/* CAMERA */}

      <div className="panel camera-panel">

        <PanelHeader
          label="VISION FEED"
          title="Live Camera"
          icon={<Camera size={20} />}
        />

        <div className="camera-view">

          {cameraOn ? (

            <video
              ref={videoRef}
              className="live-camera-image"
              autoPlay
              playsInline
              muted
            />

          ) : (

            <div className="camera-center">

              <Camera size={50} />

              <p>
                Camera Ready
              </p>

              <small>
                Click Start Camera
                to begin live feed.
              </small>

            </div>

          )}

          <div className="camera-overlay">

            <span className="rec-dot"></span>

            {cameraOn
              ? "AI CAMERA 01 • LIVE"
              : "AI CAMERA 01"}

          </div>

          <div className="camera-buttons">

            {!cameraOn ? (

              <button
                className="detect-button"
                onClick={startCamera}
              >
                <Camera size={16} />
                Start Camera
              </button>

            ) : (

              <button
                className="stop-camera-button"
                onClick={stopCamera}
              >
                Stop Camera
              </button>

            )}

          </div>

        </div>

      </div>

    </section>
  );
}


/* ============================================================
   DETECTION ANALYSIS
============================================================ */

function DetectionAnalysis({
  result,
}) {
  return (
    <div className="result-box">

      <div className="result-top">

        <div>

          <span className="panel-label">
            AI ANALYSIS
          </span>

          <h3>
            Detection Analysis
          </h3>

        </div>

        <span
          className={`result-status ${
            result.status ===
            "success"
              ? "success"
              : "error"
          }`}
        >
          {result.status}
        </span>

      </div>


      {result.message && (
        <p className="result-message">
          {result.message}
        </p>
      )}


      {result.status ===
        "success" && (
        <>

          <div className="result-summary">

            <AnalysisCard
              icon={<Recycle size={20} />}
              label="Total Objects"
              value={
                result.total_objects
              }
            />

            <AnalysisCard
              icon={<Target size={20} />}
              label="Plastic Waste"
              value={
                result.plastic_count
              }
            />

            <AnalysisCard
              icon={<Activity size={20} />}
              label="Confidence"
              value={`${result.average_confidence_percent}%`}
            />

            <AnalysisCard
              icon={
                <AlertTriangle size={20} />
              }
              label="Severity"
              value={
                result.severity
              }
              extraClass="severity-value"
            />

          </div>


          {/* ALERT */}

          {result.alert?.required && (

            <div className="cleanup-alert">

              <div className="cleanup-alert-icon">
                <AlertTriangle size={24} />
              </div>

              <div className="cleanup-alert-content">

                <strong>
                  🚨 PLASTIC WASTE ALERT
                </strong>

                <p>
                  Plastic waste detected
                  in the monitored water
                  body. Cleanup action
                  may be required.
                </p>

                <div className="cleanup-alert-details">

                  <span>
                    Plastic:{" "}
                    <b>
                      {result.plastic_count}
                    </b>
                  </span>

                  <span>
                    Severity:{" "}
                    <b>
                      {result.severity}
                    </b>
                  </span>

                  <span>
                    Recipients:{" "}
                    <b>
                      {
                        result.alert
                          .recipients
                      }
                    </b>
                  </span>

                  <span>
                    Status:{" "}
                    <b>
                      {
                        result.alert
                          .status
                      }
                    </b>
                  </span>

                </div>

              </div>

            </div>

          )}


          {/* DETAILS */}

          <div className="analysis-details">

            <div className="detail-box">

              <span className="panel-label">
                LOCATION
              </span>

              <div className="gps-value">

                <MapPin size={22} />

                <div>

                  <strong>
                    {
                      result.gps
                        ?.latitude
                    }
                    ,{" "}
                    {
                      result.gps
                        ?.longitude
                    }
                  </strong>

                  <span>
                    GPS detection location
                  </span>

                  {result.gps?.altitude !=
                    null && (
                    <span>
                      Altitude:{" "}
                      {
                        result.gps
                          .altitude
                      } m
                    </span>
                  )}

                </div>

              </div>

            </div>


            <div className="detail-box">

              <span className="panel-label">
                WATER CONDITION
              </span>

              <div className="detail-row">
                <span>
                  Turbidity
                </span>

                <strong>
                  {
                    result.water
                      ?.turbidity_ntu
                  }{" "}
                  NTU
                </strong>
              </div>

              <div className="detail-row">
                <span>
                  Temperature
                </span>

                <strong>
                  {
                    result.water
                      ?.temperature_c
                  }{" "}
                  °C
                </strong>
              </div>

              <div className="detail-row">
                <span>pH</span>

                <strong>
                  {
                    result.water?.ph
                  }
                </strong>
              </div>

            </div>

          </div>


          {/* OBJECT LIST */}

          {result.detections?.length >
            0 && (

            <div className="object-list">

              <div className="object-list-header">

                <div>

                  <span className="panel-label">
                    OBJECT TRACKING
                  </span>

                  <h4>
                    Detected Plastic
                    Objects
                  </h4>

                </div>

              </div>


              {result.detections.map(
                (item, index) => (

                  <div
                    className="object-row"
                    key={
                      item.object_id ??
                      index
                    }
                  >

                    <div className="object-number">
                      {item.object_id ??
                        index + 1}
                    </div>

                    <div className="object-name">

                      <strong>
                        {
                          item.class_name
                        }
                      </strong>

                      <span>
                        {
                          item.category
                        }
                      </span>

                    </div>

                    <div className="object-confidence">

                      <div className="confidence-bar">

                        <div
                          className="confidence-fill"
                          style={{
                            width: `${
                              item.confidence *
                              100
                            }%`,
                          }}
                        />

                      </div>

                      <strong>
                        {Math.round(
                          item.confidence *
                            100
                        )}
                        %
                      </strong>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </>
      )}

    </div>
  );
}


/* ============================================================
   WASTE ANALYTICS
============================================================ */

function WasteAnalyticsPage({
  history,
  stats,
  result,
}) {
  const plasticCount =
    stats?.plastic_objects ??
    history.filter(
      (item) => item.is_plastic
    ).length;

  const total =
    stats?.total_detections ??
    history.length;

  const averageConfidence =
    history.length > 0
      ? Math.round(
          (history.reduce(
            (sum, item) =>
              sum +
              Number(
                item.confidence || 0
              ),
            0
          ) /
            history.length) *
            100
        )
      : 0;

  return (
    <>

      <section className="stats-grid">

        <StatCard
          icon={<Recycle />}
          label="Plastic Objects"
          value={plasticCount}
          change="Detected plastic waste"
        />

        <StatCard
          icon={<BarChart3 />}
          label="Total Records"
          value={total}
          change="Detection history"
        />

        <StatCard
          icon={<Target />}
          label="Average Confidence"
          value={`${averageConfidence}%`}
          change="YOLO detection confidence"
        />

        <StatCard
          icon={<AlertTriangle />}
          label="Latest Severity"
          value={
            result?.severity ?? "—"
          }
          change="Current analysis"
        />

      </section>


      <section className="panel">

        <PanelHeader
          label="WASTE ANALYTICS"
          title="Plastic Detection History"
          icon={<BarChart3 size={20} />}
        />

        {history.length === 0 ? (

          <div className="empty-state">
            <Recycle size={34} />

            <p>
              No detection data
              available.
            </p>
          </div>

        ) : (

          <div className="analytics-list">

            {history.map(
              (item, index) => (

                <div
                  className="analytics-row"
                  key={
                    item.id ?? index
                  }
                >

                  <div className="analytics-index">
                    {index + 1}
                  </div>

                  <div className="analytics-main">

                    <strong>
                      {
                        item.class_name
                      }
                    </strong>

                    <span>
                      {item.category}
                    </span>

                  </div>

                  <div className="analytics-confidence">

                    <div className="confidence-bar">

                      <div
                        className="confidence-fill"
                        style={{
                          width: `${
                            Number(
                              item.confidence ||
                                0
                            ) * 100
                          }%`,
                        }}
                      />

                    </div>

                    <strong>
                      {Math.round(
                        Number(
                          item.confidence ||
                            0
                        ) * 100
                      )}
                      %
                    </strong>

                  </div>

                  <div className="analytics-source">
                    <MapPin size={15} />

                    {item.source ||
                      "Unknown source"}
                  </div>

                </div>

              )
            )}

          </div>

        )}

      </section>

    </>
  );
}


/* ============================================================
   SOURCE TRACKING
============================================================ */

function SourceTrackingPage({
  history,
  environment,
}) {
  const sources = Array.from(
    new Map(
      history
        .filter(
          (item) => item.source
        )
        .map((item) => [
          item.source,
          item,
        ])
    ).values()
  );

  return (
    <>

      <section className="panel source-map-panel">

        <PanelHeader
          label="SOURCE TRACKING"
          title="Plastic Detection Locations"
          icon={<MapPin size={20} />}
        />

        <div className="source-location">

          <div className="source-location-icon">
            <MapPin size={36} />
          </div>

          <div>

            <span className="panel-label">
              CURRENT MONITORING LOCATION
            </span>

            <h3>
              {environment?.gps
                ? `${environment.gps.latitude}, ${environment.gps.longitude}`
                : "Location unavailable"}
            </h3>

            <p>
              AquaGuard monitoring
              coordinates
            </p>

          </div>

        </div>

      </section>


      <section className="panel">

        <PanelHeader
          label="DETECTION SOURCES"
          title="Tracked Camera Sources"
          icon={<Camera size={20} />}
        />

        {sources.length === 0 ? (

          <div className="empty-state">

            <MapPin size={34} />

            <p>
              No sources tracked yet.
            </p>

            <small>
              Detection source
              information will appear
              after scanning images.
            </small>

          </div>

        ) : (

          <div className="source-grid">

            {sources.map(
              (source, index) => (

                <div
                  className="source-card"
                  key={
                    source.source ??
                    index
                  }
                >

                  <div className="source-card-icon">
                    <Camera size={21} />
                  </div>

                  <div>

                    <strong>
                      {source.source}
                    </strong>

                    <span>
                      Plastic detection
                      source
                    </span>

                    <small>
                      Location:{" "}
                      {
                        source.latitude
                      }
                      ,{" "}
                      {
                        source.longitude
                      }
                    </small>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </section>

    </>
  );
}


/* ============================================================
   ALERTS
============================================================ */

function AlertsPage({
  result,
  history,
}) {
  const latestAlert =
    result?.alert?.required;

  const plasticDetections =
    history.filter(
      (item) => item.is_plastic
    ).length;

  return (
    <>

      <section className="stats-grid">

        <StatCard
          icon={<Bell />}
          label="Current Alerts"
          value={
            latestAlert ? 1 : 0
          }
          change="Latest detection"
        />

        <StatCard
          icon={<Recycle />}
          label="Plastic Records"
          value={plasticDetections}
          change="Historical plastic detections"
        />

        <StatCard
          icon={<Radio />}
          label="Recipients"
          value={
            result?.alert
              ?.recipients ?? 2
          }
          change="Configured recipients"
        />

        <StatCard
          icon={<ShieldCheck />}
          label="Alert System"
          value="Ready"
          change="AquaGuard notification module"
        />

      </section>


      <section className="panel">

        <PanelHeader
          label="ALERT CENTER"
          title="Plastic Waste Alerts"
          icon={<Bell size={20} />}
        />

        {latestAlert ? (

          <div className="cleanup-alert large-alert">

            <div className="cleanup-alert-icon">
              <AlertTriangle size={30} />
            </div>

            <div className="cleanup-alert-content">

              <strong>
                🚨 PLASTIC WASTE DETECTED
              </strong>

              <p>
                The latest AI analysis
                detected plastic waste
                in the monitored water
                body.
              </p>

              <div className="cleanup-alert-details">

                <span>
                  Plastic:{" "}
                  <b>
                    {
                      result.plastic_count
                    }
                  </b>
                </span>

                <span>
                  Severity:{" "}
                  <b>
                    {result.severity}
                  </b>
                </span>

                <span>
                  Recipients:{" "}
                  <b>
                    {
                      result.alert
                        .recipients
                    }
                  </b>
                </span>

                <span>
                  Status:{" "}
                  <b>
                    {
                      result.alert
                        .status
                    }
                  </b>
                </span>

              </div>

            </div>

          </div>

        ) : (

          <div className="no-alert">

            <ShieldCheck size={42} />

            <h3>
              No Active Plastic Alert
            </h3>

            <p>
              The latest detection does
              not currently require an
              alert.
            </p>

          </div>

        )}

      </section>


      <section className="panel">

        <PanelHeader
          label="ALERT WORKFLOW"
          title="Response Flow"
          icon={<Activity size={20} />}
        />

        <div className="alert-flow">

          <AlertStep
            number="01"
            title="AI Detection"
            text="YOLO identifies floating plastic waste."
          />

          <AlertStep
            number="02"
            title="Severity Analysis"
            text="Plastic count is used to determine pollution severity."
          />

          <AlertStep
            number="03"
            title="Location Capture"
            text="GPS coordinates are attached to the detection."
          />

          <AlertStep
            number="04"
            title="Notification"
            text="Configured recipients can be notified when an alert condition is reached."
          />

        </div>

      </section>

    </>
  );
}


/* ============================================================
   WATER SENSOR PAGE
============================================================ */

function WaterSensorsPage({
  environment,
}) {
  const water =
    environment?.water;

  const gps =
    environment?.gps;

  return (
    <>

      <section className="environment-grid sensor-page-grid">

        <SensorCard
          icon={<Waves size={25} />}
          title="Turbidity"
          value={
            water
              ? `${water.turbidity_ntu} NTU`
              : "—"
          }
          description="Water clarity measurement"
        />

        <SensorCard
          icon={
            <Thermometer size={25} />
          }
          title="Temperature"
          value={
            water
              ? `${water.temperature_c} °C`
              : "—"
          }
          description="Water temperature"
        />

        <SensorCard
          icon={<Activity size={25} />}
          title="pH Level"
          value={
            water
              ? water.ph
              : "—"
          }
          description="Water acidity / alkalinity"
        />

        <SensorCard
          icon={<MapPin size={25} />}
          title="Latitude"
          value={
            gps
              ? gps.latitude
              : "—"
          }
          description="Monitoring location"
        />

        <SensorCard
          icon={<MapPin size={25} />}
          title="Longitude"
          value={
            gps
              ? gps.longitude
              : "—"
          }
          description="Monitoring location"
        />

        <SensorCard
          icon={<Target size={25} />}
          title="Altitude"
          value={
            gps
              ? `${gps.altitude ?? "—"} m`
              : "—"
          }
          description="GPS altitude"
        />

      </section>


      <section className="panel">

        <PanelHeader
          label="ENVIRONMENT STATUS"
          title="Current Water Body Condition"
          icon={<Droplets size={20} />}
        />

        <div className="sensor-status">

          <div className="sensor-status-icon">
            <Waves size={32} />
          </div>

          <div>

            <strong>
              Monitoring Active
            </strong>

            <p>
              AquaGuard is monitoring
              environmental parameters
              together with plastic waste
              detection.
            </p>

          </div>

        </div>

      </section>

    </>
  );
}


/* ============================================================
   HISTORY PANEL
============================================================ */

function HistoryPanel({
  history,
}) {
  return (
    <section className="panel history-panel">

      <PanelHeader
        label="DETECTION LOG"
        title="Recent Plastic Detections"
        icon={<Recycle size={20} />}
        right={
          <span className="live-badge">
            {history.length} RECORDS
          </span>
        }
      />

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

            <span>
              CONFIDENCE
            </span>

            <span>SOURCE</span>

            <span>TIME</span>

          </div>

          {history
            .slice(0, 10)
            .map((item) => (

              <div
                className="history-row"
                key={item.id}
              >

                <span>
                  {item.class_name}
                </span>

                <strong>
                  {Math.round(
                    item.confidence *
                      100
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
  );
}


/* ============================================================
   PANEL HEADER
============================================================ */

function PanelHeader({
  label,
  title,
  icon,
  right,
}) {
  return (
    <div className="panel-header">

      <div>

        <span className="panel-label">
          {label}
        </span>

        <h3>{title}</h3>

      </div>

      <div className="panel-header-right">

        {right}

        {icon}

      </div>

    </div>
  );
}


/* ============================================================
   STAT CARD
============================================================ */

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


/* ============================================================
   ENVIRONMENT CARD
============================================================ */

function EnvironmentCard({
  icon,
  title,
  value,
}) {
  return (
    <div className="environment-card">

      <div className="environment-icon">
        {icon}
      </div>

      <div>

        <span>{title}</span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}


/* ============================================================
   ANALYSIS CARD
============================================================ */

function AnalysisCard({
  icon,
  label,
  value,
  extraClass = "",
}) {
  return (
    <div className="analysis-card">

      {icon}

      <span>{label}</span>

      <strong
        className={extraClass}
      >
        {value}
      </strong>

    </div>
  );
}


/* ============================================================
   SENSOR CARD
============================================================ */

function SensorCard({
  icon,
  title,
  value,
  description,
}) {
  return (
    <div className="sensor-card">

      <div className="sensor-card-icon">
        {icon}
      </div>

      <span>{title}</span>

      <strong>{value}</strong>

      <small>
        {description}
      </small>

    </div>
  );
}


/* ============================================================
   QUICK ALERT STEP
============================================================ */

function AlertStep({
  number,
  title,
  text,
}) {
  return (
    <div className="alert-step">

      <div className="alert-step-number">
        {number}
      </div>

      <div>

        <strong>{title}</strong>

        <p>{text}</p>

      </div>

    </div>
  );
}


export default App;