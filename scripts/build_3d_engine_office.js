const fs = require('fs');

const threeJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/three.min.js', 'utf8');
const orbitControlsJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/OrbitControls.js', 'utf8');
const tweenJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/tween.umd.js', 'utf8');

const pcQueue = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/storage/publication_queue.json', 'utf8') || '[]');
const bgQueue = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/blindspot-global/storage/publication_queue.json', 'utf8') || '[]');

console.log('Construyendo Oficina 3D completa dividida por salas con modelos ultra detallados...');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oficina 3D de Redacción — Punto Ciego & Blindspot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #05070c;
      --panel: rgba(10, 14, 24, 0.90);
      --border: rgba(255, 255, 255, 0.12);
      --cyan: #00f0ff;
      --green: #10b981;
      --amber: #f59e0b;
      --magenta: #ec4899;
      --purple: #8b5cf6;
      --text: #f8fafc;
      --muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      user-select: none;
    }

    #webgl-canvas {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 1;
    }

    .hud {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 10;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.25rem 1.75rem;
    }

    .interactive { pointer-events: auto; }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
    }

    .brand-box {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.65rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }

    .brand-pill {
      font-size: 0.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #00f0ff, #3b82f6);
      color: #050811;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
    }

    .brand-title {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: -0.3px;
    }

    .project-toggle {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 3px;
      gap: 3px;
    }

    .p-btn {
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.35rem 0.85rem;
      border-radius: 7px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .p-btn.active {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .live-status-bar {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.65rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }

    .metric-group {
      display: flex;
      flex-direction: column;
    }

    .metric-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.65rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 10px var(--green);
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Floating Room Detail Drawer */
    .drawer {
      position: absolute;
      top: 5rem;
      right: 1.75rem;
      width: 410px;
      max-height: calc(100vh - 11rem);
      background: rgba(10, 14, 24, 0.94);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
      display: none;
      flex-direction: column;
      gap: 1.25rem;
      overflow-y: auto;
      transform: translateX(30px);
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .drawer.open {
      display: flex;
      transform: translateX(0);
      opacity: 1;
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .room-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      color: var(--cyan);
      background: rgba(0, 240, 255, 0.1);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-weight: 700;
      margin-bottom: 0.4rem;
      display: inline-block;
    }

    .drawer-title {
      font-size: 1.25rem;
      font-weight: 800;
    }

    .drawer-role {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--cyan);
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: var(--muted);
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .drawer-photo-card {
      width: 100%;
      height: 180px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      background: #000;
    }

    .drawer-photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 25%;
    }

    .drawer-section {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 1rem;
    }

    .drawer-sec-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.68rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.6rem;
    }

    .rules-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .rules-list li {
      font-size: 0.78rem;
      line-height: 1.4;
      color: #cbd5e1;
      padding-left: 1rem;
      position: relative;
    }

    .rules-list li::before {
      content: '▶';
      position: absolute;
      left: 0;
      color: var(--cyan);
      font-size: 0.6rem;
      top: 0.15rem;
    }

    .exit-btn {
      width: 100%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.75rem;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .exit-btn:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    /* Bottom Control & Room Navigation Bar */
    .bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1.5rem;
    }

    .controls-hint {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 0.55rem 1.15rem;
      font-size: 0.75rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .camera-nav {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.45rem;
      display: flex;
      gap: 0.4rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }

    .cam-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.5rem 0.95rem;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      transition: all 0.2s;
    }

    .cam-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    .cam-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(59, 130, 246, 0.25));
      border: 1px solid rgba(0, 240, 255, 0.5);
      color: #fff;
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
    }
  </style>
</head>
<body>

  <canvas id="webgl-canvas"></canvas>

  <div class="hud">
    <!-- Top HUD -->
    <div class="top-bar">
      <div class="brand-box interactive">
        <span class="brand-pill">3D ENGINE</span>
        <div>
          <div class="brand-title">Estudio Multi-Oficina Autónomo</div>
          <div style="font-size: 0.72rem; color: var(--muted);">Punto Ciego & Blindspot • 5 Oficinas Especializadas</div>
        </div>
        <div class="project-toggle">
          <button class="p-btn active" id="btn-pc" onclick="switchProject('pc')">Punto Ciego</button>
          <button class="p-btn" id="btn-bg" onclick="switchProject('bg')">Blindspot Global</button>
        </div>
      </div>

      <div class="live-status-bar interactive">
        <div class="metric-group">
          <span class="metric-label">Estado de la Nube</span>
          <span class="metric-val" id="cloud-status"><span class="pulse-dot"></span> AL DÍA (Actions)</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">Próximo Reel</span>
          <span class="metric-val" id="countdown" style="color: var(--cyan);">00:14:20</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">En Cola</span>
          <span class="metric-val" id="queue-count">2</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">Publicados Hoy</span>
          <span class="metric-val" id="pub-today">115</span>
        </div>
      </div>
    </div>

    <!-- Floating Detail Drawer -->
    <div class="drawer interactive" id="room-drawer">
      <div class="drawer-header">
        <div>
          <span class="room-badge" id="d-badge">SALA 01 // RADAR</span>
          <div class="drawer-title" id="d-title">Scout-95</div>
          <div class="drawer-role" id="d-role">#01 RADAR GLOBAL</div>
        </div>
        <button class="close-btn" onclick="focusAgent('general')">✕</button>
      </div>

      <div class="drawer-photo-card">
        <img id="d-photo" src="" alt="Agent 3D">
      </div>

      <div class="drawer-section">
        <div class="drawer-sec-title">Actividad en Vivo en esta Oficina</div>
        <p id="d-task" style="font-size: 0.82rem; color: #f1f5f9; line-height: 1.45;"></p>
      </div>

      <div class="drawer-section">
        <div class="drawer-sec-title">Cuaderno de Reglas de la Sala</div>
        <ul class="rules-list" id="d-rules"></ul>
      </div>

      <button class="exit-btn" onclick="focusAgent('general')">
        ← Volver a Vista de Planta General
      </button>
    </div>

    <!-- Bottom HUD & Room Selector -->
    <div class="bottom-bar">
      <div class="controls-hint">
        <span>🖱️ <b>Arrastrar:</b> Rotar 360° | <b>Rueda:</b> Zoom | <b>Clic en Sala o Agente:</b> Entrar a la oficina</span>
      </div>

      <div class="camera-nav interactive">
        <button class="cam-btn active" id="cam-general" onclick="focusAgent('general')">🏢 Planta General</button>
        <button class="cam-btn" id="cam-scout" onclick="focusAgent('scout')">📡 Sala Radar</button>
        <button class="cam-btn" id="cam-directora" onclick="focusAgent('directora')">🏛️ Despacho Elena</button>
        <button class="cam-btn" id="cam-redactor" onclick="focusAgent('redactor')">📰 Redacción Ryan</button>
        <button class="cam-btn" id="cam-disenador" onclick="focusAgent('disenador')">🎨 Estudio Oscar</button>
        <button class="cam-btn" id="cam-editor" onclick="focusAgent('editor')">🎙️ Cabina Jim</button>
      </div>
    </div>
  </div>

  <script>
    ${threeJs}
  </script>
  <script>
    ${orbitControlsJs}
  </script>
  <script>
    ${tweenJs}
  </script>

  <script>
    const canvas = document.getElementById('webgl-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.012);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 3.5;
    controls.maxDistance = 75;

    // Default Overview Camera
    const CAM_DEFAULT = { x: 0, y: 25, z: 28, targetX: 0, targetY: 1.2, targetZ: 0 };
    camera.position.set(CAM_DEFAULT.x, CAM_DEFAULT.y, CAM_DEFAULT.z);
    controls.target.set(CAM_DEFAULT.targetX, CAM_DEFAULT.targetY, CAM_DEFAULT.targetZ);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xdde8fc, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    sunLight.position.set(16, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 90;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Dynamic Live Radar Texture for Scout
    const radarCanvas = document.createElement('canvas');
    radarCanvas.width = 256; radarCanvas.height = 256;
    const radarCtx = radarCanvas.getContext('2d');
    const radarTex = new THREE.CanvasTexture(radarCanvas);

    // Dynamic Audio Waveform Texture for Jim
    const audioCanvas = document.createElement('canvas');
    audioCanvas.width = 256; audioCanvas.height = 256;
    const audioCtx = audioCanvas.getContext('2d');
    const audioTex = new THREE.CanvasTexture(audioCanvas);

    // Dynamic Tablet Art Texture for Oscar
    const tabletCanvas = document.createElement('canvas');
    tabletCanvas.width = 256; tabletCanvas.height = 256;
    const tabletCtx = tabletCanvas.getContext('2d');
    const tabletTex = new THREE.CanvasTexture(tabletCanvas);

    // High Detail Expressive Lego Faces (Rendered to 512x256 canvas for crisp quality)
    function makeExpressiveFace(type) {
      const fc = document.createElement('canvas');
      fc.width = 512; fc.height = 256;
      const ctx = fc.getContext('2d');
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(0, 0, 512, 256);

      if (type === 'scout') {
        // Smart Glasses + Focused tech eyes
        ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 10;
        ctx.strokeRect(140, 78, 90, 74); ctx.strokeRect(282, 78, 90, 74);
        ctx.beginPath(); ctx.moveTo(230, 115); ctx.lineTo(282, 115); ctx.stroke();
        // Eyes with sparkle
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(185, 115, 16, 0, Math.PI*2); ctx.arc(327, 115, 16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(179, 110, 6, 0, Math.PI*2); ctx.arc(321, 110, 6, 0, Math.PI*2); ctx.fill();
        // Headset microphone arm
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(130, 120); ctx.lineTo(170, 175); ctx.stroke();
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(172, 176, 9, 0, Math.PI*2); ctx.fill();
        // Smile
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(256, 170, 28, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
      } else if (type === 'directora') {
        // Confident, elegant makeup & arched eyebrows
        ctx.strokeStyle = '#3e2417'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(145, 90); ctx.lineTo(225, 82); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(367, 90); ctx.lineTo(287, 82); ctx.stroke();
        // Eyes with eyelashes
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(185, 118, 17, 0, Math.PI*2); ctx.arc(327, 118, 17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(179, 112, 6, 0, Math.PI*2); ctx.arc(321, 112, 6, 0, Math.PI*2); ctx.fill();
        // Eyelash flicks
        ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(168, 108); ctx.lineTo(152, 100); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(344, 108); ctx.lineTo(360, 100); ctx.stroke();
        // Warm blush
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.beginPath(); ctx.arc(155, 145, 20, 0, Math.PI*2); ctx.arc(357, 145, 20, 0, Math.PI*2); ctx.fill();
        // Coral-red lipstick smile
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(256, 172, 32, 0.12*Math.PI, 0.88*Math.PI); ctx.stroke();
      } else if (type === 'redactor') {
        // Determined journalist eyebrows
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(150, 85); ctx.lineTo(220, 105); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(362, 85); ctx.lineTo(292, 105); ctx.stroke();
        // Expressive Lego Eyes
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(185, 118, 18, 0, Math.PI*2); ctx.arc(327, 118, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(179, 113, 6, 0, Math.PI*2); ctx.arc(321, 113, 6, 0, Math.PI*2); ctx.fill();
        // Determined smirk
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(260, 165, 26, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
        // Stubble
        ctx.fillStyle = 'rgba(69, 26, 3, 0.18)';
        for (let i = 0; i < 30; i++) {
          const sx = 180 + Math.random() * 152;
          const sy = 160 + Math.random() * 50;
          ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI*2); ctx.fill();
        }
      } else if (type === 'disenador') {
        // Round designer glasses
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(185, 115, 38, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(327, 115, 38, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(223, 115); ctx.lineTo(289, 115); ctx.stroke();
        // Focused creative eyes
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(185, 115, 15, 0, Math.PI*2); ctx.arc(327, 115, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(180, 110, 5, 0, Math.PI*2); ctx.arc(322, 110, 5, 0, Math.PI*2); ctx.fill();
        // Wry smile with dimple
        ctx.strokeStyle = '#1e1b18'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(265, 170, 24, 0.1*Math.PI, 0.75*Math.PI); ctx.stroke();
      } else {
        // Jim: Big cheerful grin & trimmed beard
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(185, 115, 17, 0, Math.PI*2); ctx.arc(327, 115, 17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(180, 110, 6, 0, Math.PI*2); ctx.arc(322, 110, 6, 0, Math.PI*2); ctx.fill();
        // Big open friendly smile with teeth
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath(); ctx.arc(256, 160, 32, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(240, 160, 32, 8);
        // Beard outline
        ctx.fillStyle = 'rgba(74, 46, 22, 0.28)';
        ctx.beginPath(); ctx.arc(256, 185, 75, 0.1*Math.PI, 0.9*Math.PI); ctx.fill();
      }

      return new THREE.CanvasTexture(fc);
    }

    // High Detail Torso Clothing Decals
    function makeTorsoTexture(type) {
      const tc = document.createElement('canvas');
      tc.width = 512; tc.height = 512;
      const ctx = tc.getContext('2d');

      if (type === 'scout') {
        // Grey Zipper Hoodie
        ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, 512, 512);
        // Zipper track
        ctx.fillStyle = '#0f172a'; ctx.fillRect(248, 0, 16, 512);
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
        for (let y = 10; y < 512; y += 16) {
          ctx.beginPath(); ctx.moveTo(244, y); ctx.lineTo(268, y); ctx.stroke();
        }
        // Hoodie strings
        ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(210, 30); ctx.lineTo(215, 230); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(302, 30); ctx.lineTo(297, 230); ctx.stroke();
        // Badge
        ctx.fillStyle = '#0284c7'; ctx.fillRect(90, 120, 80, 40);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.fillText('RADAR', 96, 148);
      } else if (type === 'directora') {
        // Royal Navy Blazer + White Blouse + Gold Button
        ctx.fillStyle = '#172554'; ctx.fillRect(0, 0, 512, 512);
        // White Blouse V
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.moveTo(170, 0); ctx.lineTo(256, 220); ctx.lineTo(342, 0); ctx.closePath(); ctx.fill();
        // Lapels
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(256, 260); ctx.lineTo(190, 270); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(412, 0); ctx.lineTo(256, 260); ctx.lineTo(322, 270); ctx.lineTo(452, 0); ctx.closePath(); ctx.fill();
        // Gold buttons
        ctx.fillStyle = '#eab308';
        [320, 420].forEach(by => {
          ctx.beginPath(); ctx.arc(256, by, 16, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 4; ctx.stroke();
        });
      } else if (type === 'redactor') {
        // Light Blue & White Checkered Shirt
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 6;
        for (let x = 0; x < 512; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
        for (let y = 0; y < 512; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
        // Collar
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.moveTo(160, 0); ctx.lineTo(256, 120); ctx.lineTo(352, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 8; ctx.stroke();
        // Buttons
        ctx.fillStyle = '#334155';
        [160, 250, 340, 430].forEach(by => { ctx.beginPath(); ctx.arc(256, by, 12, 0, Math.PI*2); ctx.fill(); });
        // Pocket with Press Pen
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 6;
        ctx.strokeRect(90, 180, 80, 95);
        ctx.fillStyle = '#dc2626'; ctx.fillRect(115, 150, 10, 45); // Red pen clip
      } else if (type === 'disenador') {
        // Charcoal Designer Hoodie with CMYK Graphic
        ctx.fillStyle = '#1e1b4b'; ctx.fillRect(0, 0, 512, 512);
        // CMYK Gradient Circles
        const colors = ['#00f0ff', '#ec4899', '#eab308', '#0f172a'];
        [190, 235, 280, 325].forEach((cx, i) => {
          ctx.fillStyle = colors[i];
          ctx.beginPath(); ctx.arc(cx, 220, 28, 0, Math.PI*2); ctx.fill();
        });
        // Studio Logo
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 24px monospace'; ctx.fillText('OSCAR.PX', 190, 290);
      } else {
        // Jim Audio EQ Waveform Sweatshirt
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 512, 512);
        // Equalizer Bars
        const eqColors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];
        for (let i = 0; i < 9; i++) {
          const h = 40 + Math.sin(i * 0.8) * 80 + 60;
          ctx.fillStyle = eqColors[i % eqColors.length];
          ctx.fillRect(100 + i * 36, 260 - h/2, 22, h);
        }
      }

      return new THREE.CanvasTexture(tc);
    }

    // --- ARCHITECTURAL STUDIO FLOOR PLAN (5 SEPARATE ROOMS) ---

    // Floor Base
    const floorGeo = new THREE.PlaneGeometry(38, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x080c16, roughness: 0.35 });
    const mainFloor = new THREE.Mesh(floorGeo, floorMat);
    mainFloor.rotation.x = -Math.PI / 2;
    mainFloor.receiveShadow = true;
    scene.add(mainFloor);

    // Wall Builder Helper
    function createWall(x, z, width, length, height = 3.6, color = 0x161e30, opacity = 1) {
      const geo = new THREE.BoxGeometry(width, height, length);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        transparent: opacity < 1,
        opacity
      });
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(x, height / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      return wall;
    }

    // Room Dividers (Dividing floor into 5 specific rooms with entrance openings)
    // Central North-South Dividers
    createWall(-4.8, -6.5, 0.3, 11, 3.2, 0x1b253d); // West North
    createWall(4.8, -6.5, 0.3, 11, 3.2, 0x1b253d);  // East North
    createWall(-4.8, 6.5, 0.3, 11, 3.2, 0x1b253d);   // West South
    createWall(4.8, 6.5, 0.3, 11, 3.2, 0x1b253d);    // East South

    // East-West Dividers
    createWall(-11.2, 0, 12.8, 0.3, 3.2, 0x1b253d);
    createWall(11.2, 0, 12.8, 0.3, 3.2, 0x1b253d);

    // Outer Perimeter Walls
    createWall(0, -12.5, 36, 0.3, 4.6, 0x0f172a);
    createWall(-18, 0, 0.3, 25, 4.6, 0x0f172a);
    createWall(18, 0, 0.3, 25, 4.6, 0x0f172a);

    // Glass door partitions
    createWall(-4.8, 0, 0.1, 2.8, 3, 0x00f0ff, 0.25);
    createWall(4.8, 0, 0.1, 2.8, 3, 0x00f0ff, 0.25);

    // --- 5 DEDICATED ROOM FLOORS & ACCENTS ---
    // 1. Scout Floor (Tech Matrix)
    const scoutFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x0a1628, roughness: 0.18, metalness: 0.2 })
    );
    scoutFloor.rotation.x = -Math.PI / 2;
    scoutFloor.position.set(-11.2, 0.02, -6.2);
    scoutFloor.receiveShadow = true;
    scene.add(scoutFloor);

    // 2. Elena Floor (Dark Mahogany Parquet)
    const elenaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(9.3, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x2b1509, roughness: 0.2 })
    );
    elenaFloor.rotation.x = -Math.PI / 2;
    elenaFloor.position.set(0, 0.02, -6.2);
    elenaFloor.receiveShadow = true;
    scene.add(elenaFloor);

    // 3. Ryan Floor (Bullpen Oak)
    const ryanFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.4 })
    );
    ryanFloor.rotation.x = -Math.PI / 2;
    ryanFloor.position.set(11.2, 0.02, -6.2);
    ryanFloor.receiveShadow = true;
    scene.add(ryanFloor);

    // 4. Oscar Floor (Concrete Studio)
    const oscarFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x171226, roughness: 0.22 })
    );
    oscarFloor.rotation.x = -Math.PI / 2;
    oscarFloor.position.set(-11.2, 0.02, 6.2);
    oscarFloor.receiveShadow = true;
    scene.add(oscarFloor);

    // 5. Jim Floor (Soundproof Studio)
    const jimFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x0d1629, roughness: 0.4 })
    );
    jimFloor.rotation.x = -Math.PI / 2;
    jimFloor.position.set(11.2, 0.02, 6.2);
    jimFloor.receiveShadow = true;
    scene.add(jimFloor);

    // Dedicated Point Lights per room
    const scoutLight = new THREE.PointLight(0x00f0ff, 2.5, 14); scoutLight.position.set(-11.2, 4.2, -6.2); scene.add(scoutLight);
    const elenaLight = new THREE.PointLight(0xf59e0b, 2.2, 14); elenaLight.position.set(0, 4.0, -6.2); scene.add(elenaLight);
    const ryanLight = new THREE.PointLight(0x38bdf8, 2.0, 14); ryanLight.position.set(11.2, 4.2, -6.2); scene.add(ryanLight);
    const oscarLight = new THREE.PointLight(0xc084fc, 2.6, 14); oscarLight.position.set(-11.2, 4.2, 6.2); scene.add(oscarLight);
    const jimLight = new THREE.PointLight(0x10b981, 2.4, 14); jimLight.position.set(11.2, 4.2, 6.2); scene.add(jimLight);

    // --- AGENT DATA DEFINITIONS ---
    const AGENTS_DATA = {
      scout: {
        id: 'scout',
        roomTitle: 'SALA 01 // RADAR & CIBER-INTELIGENCIA',
        name: 'Scout-95',
        role: '#01 RADAR GLOBAL',
        pos: { x: -11.2, z: -6.2 },
        rot: 0, // facing south (+Z)
        camOffset: { x: 1.6, y: 2.1, z: 3.0 },
        photo: 'agents/scout_3d.jpg',
        deskColor: 0x0f172a,
        hairColor: 0x452818,
        faceType: 'scout',
        task: 'Monitoreando 95 fuentes de noticias en vivo y calculando urgencia.',
        rules: [
          'Filtra farándula, horóscopos y clickbait vacío.',
          'Urgencia mínima: 70 puntos para cola.',
          'Descarta duplicados semánticos con embeddings de Gemini (0.81).',
          'Protocolo Breaking News inmediato en hechos graves.'
        ]
      },
      directora: {
        id: 'directora',
        roomTitle: 'SALA 02 // DIRECCIÓN EJECUTIVA',
        name: 'Directora Elena',
        role: '#02 DIRECCIÓN EDITORIAL',
        pos: { x: 0, z: -6.2 },
        rot: 0,
        camOffset: { x: 1.6, y: 2.1, z: 2.9 },
        photo: 'agents/directora_3d.jpg',
        deskColor: 0x3e1f0e,
        hairColor: 0x271913,
        faceType: 'directora',
        task: 'Supervisando notas aprobadas y definiendo el ángulo oculto "Punto Ciego".',
        rules: [
          'Encontrar el Punto Ciego que los medios omiten.',
          'Cruce obligatorio con al menos 2 agencias independientes.',
          'Neutralidad absoluta: cero sesgos partidistas.',
          'En desarrollo ("updateOf"): relatar solo lo nuevo.'
        ]
      },
      redactor: {
        id: 'redactor',
        roomTitle: 'SALA 03 // REDACCIÓN CENTRAL',
        name: 'Ryan "El Escriba"',
        role: '#03 REDACCIÓN & COPYS',
        pos: { x: 11.2, z: -6.2 },
        rot: 0,
        camOffset: { x: -1.6, y: 2.1, z: 2.9 }, // view from left side away from monitor
        photo: 'agents/redactor_3d.jpg',
        deskColor: 0x1e293b,
        hairColor: 0x543319,
        faceType: 'redactor',
        task: 'Redactando artículos en 5 bloques y copys para Instagram/Facebook.',
        rules: [
          'PROHIBIDO sonar a IA: Cero clichés ("un tapiz", "es crucial").',
          'Primer párrafo con cifras y datos duros.',
          'Copys adaptados por plataforma (Reel vs Facebook vs Web).',
          'En Blindspot: 100% inglés idiomático nativo.'
        ]
      },
      disenador: {
        id: 'disenador',
        roomTitle: 'SALA 04 // ESTUDIO DE DISEÑO & BRANDING',
        name: 'Oscar Pixel',
        role: '#04 IDENTIDAD VISUAL',
        pos: { x: -11.2, z: 6.2 },
        rot: Math.PI, // facing north (-Z) towards center corridor
        camOffset: { x: -1.6, y: 2.1, z: 2.9 },
        photo: 'agents/disenador_3d.jpg',
        deskColor: 0x1e293b,
        hairColor: 0x18181b,
        faceType: 'disenador',
        task: 'Verificando fotos reales de medios y componiendo portadas 9:16.',
        rules: [
          'Fotos reales obligatorias: nunca ilustraciones genéricas.',
          'Huellas de imagen (image_hashes.json) para cero repeticiones.',
          'Portadas 9:16 de alto impacto y tipografía Montserrat/Anton.',
          'Paleta cromática por categoría informativa.'
        ]
      },
      editor: {
        id: 'editor',
        roomTitle: 'SALA 05 // CABINA DE AUDIO & MONTAJE',
        name: 'Jim Master Audio',
        role: '#05 MONTAJE DE REELS',
        pos: { x: 11.2, z: 6.2 },
        rot: Math.PI, // facing north (-Z) towards center corridor
        camOffset: { x: -1.5, y: 2.1, z: 2.9 },
        photo: 'agents/editor_3d.jpg',
        deskColor: 0x18181b,
        hairColor: 0x3e2417,
        faceType: 'editor',
        task: 'Sintetizando voz neuronal, música con sidechain y compilando Reels.',
        rules: [
          'Voz Edge TTS acelerada al +8% (JorgeNeural).',
          'Sidechain en música original (-18dB bajo la voz).',
          'Exportación Reel vertical 1080x1920 con portada 9:16.',
          'Reintento automático en cola en fallos de red de Instagram.'
        ]
      }
    };

    const agentsMeshes = {};
    const interactiveObjects = [];

    // --- ULTRA DETAILED LEGO CHARACTER BUILDER ---
    function createLegoCharacter(agent) {
      const charGroup = new THREE.Group();

      // Head
      const faceTex = makeExpressiveFace(agent.faceType);
      const headGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.58, 32);
      const headMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        roughness: 0.16,
        metalness: 0.05
      });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.y = 2.05;
      headMesh.rotation.y = Math.PI; // Face pointing forward (+Z)!
      headMesh.castShadow = true;
      charGroup.add(headMesh);

      // Top Stud
      const studGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
      const studMesh = new THREE.Mesh(studGeo, new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.2 }));
      studMesh.position.y = 2.38;
      charGroup.add(studMesh);

      // Sculpted 3D Hair & Accessories
      const hairGroup = new THREE.Group();
      const hairMat = new THREE.MeshStandardMaterial({ color: agent.hairColor, roughness: 0.35 });

      if (agent.id === 'directora') {
        // Elena: Shoulder-length voluminous brunette hair with elegant parted flow
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.50, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
        cap.position.set(0, 2.22, 0);
        hairGroup.add(cap);
        // Left hair volume
        const curlL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.9, 12), hairMat);
        curlL.position.set(-0.46, 1.85, 0.05); curlL.rotation.z = -0.15;
        hairGroup.add(curlL);
        // Right hair volume
        const curlR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.9, 12), hairMat);
        curlR.position.set(0.46, 1.85, 0.05); curlR.rotation.z = 0.15;
        hairGroup.add(curlR);
        // Back volume
        const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.35), hairMat);
        backHair.position.set(0, 1.9, -0.32);
        hairGroup.add(backHair);
      } else if (agent.id === 'redactor') {
        // Ryan: Tousled wavy stylish hair
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.49, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
        cap.position.set(0, 2.22, 0);
        hairGroup.add(cap);
        const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), hairMat); t1.position.set(-0.18, 2.45, 0.12);
        const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), hairMat); t2.position.set(0.12, 2.47, 0.10);
        hairGroup.add(t1, t2);
      } else if (agent.id === 'disenador') {
        // Oscar: Textured curly hair
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.50, 16, 16), hairMat);
        cap.position.set(0, 2.24, -0.05);
        hairGroup.add(cap);
        for (let i = 0; i < 7; i++) {
          const curl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), hairMat);
          const ang = (i / 7) * Math.PI * 2;
          curl.position.set(Math.cos(ang) * 0.35, 2.38, Math.sin(ang) * 0.35);
          hairGroup.add(curl);
        }
      } else if (agent.id === 'editor') {
        // Jim: Short hair + Massive DJ Studio Headphones
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), hairMat);
        cap.position.set(0, 2.22, -0.05);
        hairGroup.add(cap);

        // Headphone arch
        const hpArch = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.06, 8, 24, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
        );
        hpArch.rotation.z = Math.PI; hpArch.position.set(0, 2.22, 0);
        hairGroup.add(hpArch);
        // Left & Right Earcups
        const cupMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.4, roughness: 0.3 });
        const cupGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16);
        const cupL = new THREE.Mesh(cupGeo, cupMat); cupL.rotation.z = Math.PI/2; cupL.position.set(-0.52, 2.05, 0);
        const cupR = new THREE.Mesh(cupGeo, cupMat); cupR.rotation.z = Math.PI/2; cupR.position.set(0.52, 2.05, 0);
        hairGroup.add(cupL, cupR);
      } else {
        // Scout: Clean side-parted tech hair
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.49, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
        cap.position.set(0, 2.22, 0);
        hairGroup.add(cap);
        const swoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), hairMat);
        swoop.position.set(0.15, 2.4, 0.15); swoop.rotation.z = 0.2;
        hairGroup.add(swoop);
      }
      charGroup.add(hairGroup);

      // Torso with custom clothing decal on FRONT (+Z)
      const torsoTex = makeTorsoTexture(agent.id);
      const sideColor = agent.id === 'directora' ? 0x172554 : (agent.id === 'redactor' ? 0x94a3b8 : (agent.id === 'disenador' ? 0x1e1b4b : (agent.id === 'editor' ? 0x0f172a : 0x334155)));
      const torsoMatArray = [
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3 }), // right (+X)
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3 }), // left (-X)
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),  // top (+Y)
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }),  // bottom (-Y)
        new THREE.MeshStandardMaterial({ map: torsoTex, roughness: 0.2 }),    // FRONT (+Z)
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3 })  // back (-Z)
      ];
      const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.82, 0.45), torsoMatArray);
      torsoMesh.position.y = 1.35;
      torsoMesh.castShadow = true;
      charGroup.add(torsoMesh);

      // Arms & Hands
      const armMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3 });
      const handMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.2 });

      // Left Arm
      const leftArm = new THREE.Group();
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55), armMat); armL.position.y = -0.22;
      const handL = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16, Math.PI * 1.5), handMat);
      handL.position.set(0, -0.52, 0.1); handL.rotation.x = Math.PI / 2;
      leftArm.add(armL, handL);
      leftArm.position.set(-0.52, 1.62, 0.05);
      leftArm.rotation.x = 0.85; leftArm.rotation.z = 0.22;
      charGroup.add(leftArm);

      // Right Arm
      const rightArm = new THREE.Group();
      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55), armMat); armR.position.y = -0.22;
      const handR = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16, Math.PI * 1.5), handMat);
      handR.position.set(0, -0.52, 0.1); handR.rotation.x = Math.PI / 2;
      rightArm.add(armR, handR);
      rightArm.position.set(0.52, 1.62, 0.05);
      rightArm.rotation.x = 0.82; rightArm.rotation.z = -0.22;
      charGroup.add(rightArm);

      // Stylus for Oscar
      if (agent.id === 'disenador') {
        const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.35), new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.5 }));
        stylus.rotation.x = Math.PI / 2; stylus.position.set(0, -0.52, 0.2);
        rightArm.add(stylus);
      }

      // Office Chair
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35 });
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.14, 18), chairMat);
      seat.position.set(0, 0.75, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.12), chairMat);
      back.position.set(0, 1.3, -0.48);
      charGroup.add(seat, back);

      return { root: charGroup, head: headMesh, leftArm, rightArm, id: agent.id };
    }

    // --- DETAILED WORKSTATION & ROOM PROPS BUILDER ---
    function buildOfficeRoom(agent) {
      const roomGroup = new THREE.Group();

      // Desk Top
      const deskTop = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.14, 1.8),
        new THREE.MeshStandardMaterial({ color: agent.deskColor, roughness: 0.25, metalness: 0.1 })
      );
      deskTop.position.set(0, 1.1, 0.9);
      deskTop.castShadow = true; deskTop.receiveShadow = true;
      roomGroup.add(deskTop);

      // Metallic Desk Legs
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      [[-1.5, 0.1], [1.5, 0.1], [-1.5, 1.7], [1.5, 1.7]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.55, lz);
        roomGroup.add(leg);
      });

      // Character placed behind desk at z = 0 facing +Z
      const character = createLegoCharacter(agent);
      character.root.position.set(0, 0, 0);
      roomGroup.add(character.root);

      // SPECIALIZED PROPS PER ROOM
      if (agent.id === 'scout') {
        // Dual angled radar monitors (left and right, center open to see face!)
        [-1.0, 1.0].forEach((mx, idx) => {
          const mon = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.65, 0.05),
            new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              emissive: 0x00f0ff,
              emissiveMap: radarTex,
              emissiveIntensity: 0.85
            })
          );
          mon.position.set(mx, 1.6, 1.35);
          mon.rotation.y = idx === 0 ? 0.35 : -0.35;
          mon.castShadow = true;
          roomGroup.add(mon);
        });
        // Mini succulent plant on desk
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
        pot.position.set(-1.3, 1.25, 0.6); plant.position.set(-1.3, 1.35, 0.6);
        roomGroup.add(pot, plant);
        // Keyboard
        const kb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.32), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        kb.position.set(0, 1.18, 0.6); roomGroup.add(kb);
        // Server Rack in background
        const rack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 }));
        rack.position.set(-3.6, 1.7, -2.0); roomGroup.add(rack);
      } else if (agent.id === 'directora') {
        // Classic Green Glass Banker Lamp on brass stand
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 }));
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x15803d, emissive: 0x22c55e, emissiveIntensity: 0.65 }));
        base.position.set(-1.2, 1.19, 1.1); stem.position.set(-1.2, 1.42, 1.1);
        shade.rotation.z = Math.PI / 2; shade.position.set(-1.2, 1.62, 1.1);
        roomGroup.add(base, stem, shade);
        // Confidential Dossiers & Papers
        const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.85), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 }));
        dossier.position.set(0, 1.19, 0.65); dossier.rotation.y = 0.08;
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.75), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        paper.position.set(0, 1.22, 0.65); paper.rotation.y = 0.08;
        // Magnifying glass
        const magRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
        const magHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
        magRing.position.set(0.9, 1.2, 0.6); magRing.rotation.x = Math.PI / 2;
        magHandle.position.set(0.9, 1.2, 0.78); magHandle.rotation.x = Math.PI / 2;
        roomGroup.add(dossier, paper, magRing, magHandle);
        // Mahogany Bookshelf in background
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.6, 0.7), new THREE.MeshStandardMaterial({ color: 0x3e1f0e, roughness: 0.5 }));
        shelf.position.set(0, 1.8, -2.4); roomGroup.add(shelf);
      } else if (agent.id === 'redactor') {
        // Monitor on the RIGHT side covered in sticky notes
        const mon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.4 }));
        mon.position.set(1.1, 1.65, 1.2); mon.rotation.y = -0.32;
        const monStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), new THREE.MeshStandardMaterial({ color: 0x64748b }));
        monStand.position.set(1.1, 1.35, 1.2);
        roomGroup.add(mon, monStand);
        // Sticky Notes
        [[-0.55, 0.3, 0.04, 0xfef08a], [0.55, -0.2, 0.04, 0xf472b6]].forEach(([nx, ny, nz, col]) => {
          const note = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ color: col }));
          note.position.set(1.1 + nx * Math.cos(-0.32), 1.65 + ny, 1.2 + nx * Math.sin(-0.32) + 0.05);
          note.rotation.y = -0.32; roomGroup.add(note);
        });
        // Mechanical Keyboard with colorful keycaps
        const kb = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.36), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        kb.position.set(0, 1.2, 0.6); roomGroup.add(kb);
        // Coffee mug
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
        mug.position.set(-0.85, 1.25, 0.55); roomGroup.add(mug);
        // Newspaper stack & crumpled ball
        const papers = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.85), new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }));
        papers.position.set(-0.95, 1.18, 1.1); papers.rotation.y = 0.15;
        const ball = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
        ball.position.set(0.65, 1.2, 0.55);
        roomGroup.add(papers, ball);
        // Cork pinboard in background
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
        board.position.set(0, 2.4, -2.4); roomGroup.add(board);
      } else if (agent.id === 'disenador') {
        // Glowing Digital Drawing Tablet angled in front of Oscar
        const tab = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.06, 0.85),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xc084fc, emissiveMap: tabletTex, emissiveIntensity: 0.8 })
        );
        tab.position.set(0, 1.2, 0.65); tab.rotation.x = -0.18; roomGroup.add(tab);
        // Pantone color fan swatches on left
        const fan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.25), new THREE.MeshStandardMaterial({ color: 0xec4899 }));
        fan.position.set(-1.0, 1.18, 0.6); fan.rotation.y = 0.45; roomGroup.add(fan);
        // Smartphone on dock on right
        const phone = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.03), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x38bdf8, emissiveIntensity: 0.6 }));
        phone.position.set(1.1, 1.35, 0.8); phone.rotation.x = -0.3; roomGroup.add(phone);
      } else {
        // Jim Audio Mixing Console
        const mixer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.75), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3 }));
        mixer.position.set(0, 1.2, 0.6); mixer.rotation.x = -0.12; roomGroup.add(mixer);
        // Studio Monitor Speakers left and right
        [-1.3, 1.3].forEach((sx, idx) => {
          const spk = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.4), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }));
          spk.position.set(sx, 1.55, 1.1); spk.rotation.y = idx === 0 ? 0.3 : -0.3;
          // Speaker cone
          const cone = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
          cone.position.set(sx + (idx === 0 ? 0.06 : -0.06), 1.48, 1.1 + (idx === 0 ? 0.21 : 0.21));
          cone.rotation.y = idx === 0 ? 0.3 : -0.3;
          roomGroup.add(spk, cone);
        });
        // Vertical Reel screen on right
        const reelMon = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.95, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x10b981, emissiveMap: audioTex, emissiveIntensity: 0.9 })
        );
        reelMon.position.set(0.9, 1.75, 1.1); reelMon.rotation.y = -0.25; roomGroup.add(reelMon);
      }

      // Hitbox for clicking room/character
      const hit = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.8, 3.8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(0, 1.8, 0.5);
      hit.userData = { agentId: agent.id };
      roomGroup.add(hit);
      interactiveObjects.push(hit);

      roomGroup.position.set(agent.pos.x, 0, agent.pos.z);
      roomGroup.rotation.y = agent.rot;
      scene.add(roomGroup);

      return { roomGroup, character };
    }

    // Build all 5 office rooms
    Object.values(AGENTS_DATA).forEach(agent => {
      agentsMeshes[agent.id] = buildOfficeRoom(agent);
    });

    // --- ANIMATED DYNAMIC TEXTURES (RADAR, AUDIO EQ, TABLET ART) ---
    let radarAngle = 0;
    function updateDynamicTextures() {
      // 1. Radar
      radarAngle += 0.06;
      radarCtx.fillStyle = '#050c18'; radarCtx.fillRect(0, 0, 256, 256);
      radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.25)'; radarCtx.lineWidth = 2;
      [40, 80, 115].forEach(r => { radarCtx.beginPath(); radarCtx.arc(128, 128, r, 0, Math.PI*2); radarCtx.stroke(); });
      radarCtx.beginPath(); radarCtx.moveTo(128, 0); radarCtx.lineTo(128, 256); radarCtx.stroke();
      radarCtx.beginPath(); radarCtx.moveTo(0, 128); radarCtx.lineTo(256, 128); radarCtx.stroke();
      // Sweeping Beam
      const rx = 128 + Math.cos(radarAngle) * 115;
      const ry = 128 + Math.sin(radarAngle) * 115;
      const grad = radarCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      radarCtx.fillStyle = grad;
      radarCtx.beginPath(); radarCtx.moveTo(128, 128); radarCtx.arc(128, 128, 115, radarAngle - 0.4, radarAngle); radarCtx.closePath(); radarCtx.fill();
      // Detected Blips
      radarCtx.fillStyle = '#10b981';
      [[80, 70], [180, 90], [160, 190], [90, 170]].forEach(([bx, by]) => {
        radarCtx.beginPath(); radarCtx.arc(bx, by, 4, 0, Math.PI*2); radarCtx.fill();
      });
      radarTex.needsUpdate = true;

      // 2. Audio Waveform & EQ
      audioCtx.fillStyle = '#060a12'; audioCtx.fillRect(0, 0, 256, 256);
      const eqBarCount = 14;
      for (let i = 0; i < eqBarCount; i++) {
        const bh = 30 + Math.abs(Math.sin(Date.now() * 0.005 + i * 0.7)) * 170;
        const hue = 140 + i * 15;
        audioCtx.fillStyle = 'hsl(' + hue + ', 90%, 55%)';
        audioCtx.fillRect(16 + i * 16, 240 - bh, 11, bh);
      }
      audioTex.needsUpdate = true;

      // 3. Tablet Art
      tabletCtx.fillStyle = '#180a2a'; tabletCtx.fillRect(0, 0, 256, 256);
      tabletCtx.fillStyle = '#ec4899';
      tabletCtx.beginPath(); tabletCtx.arc(128, 100, 50, 0, Math.PI*2); tabletCtx.fill();
      tabletCtx.fillStyle = '#00f0ff'; tabletCtx.font = 'bold 26px sans-serif'; tabletCtx.fillText('PUNTO CIEGO', 36, 190);
      tabletCtx.fillStyle = '#fff'; tabletCtx.font = '16px monospace'; tabletCtx.fillText('BREAKING REEL', 65, 220);
      tabletTex.needsUpdate = true;
    }

    // --- MOUSE RAYCASTING FOR ROOM SELECTION ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (e) => {
      if (e.target.closest('.interactive')) return;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(interactiveObjects);
      if (hits.length > 0) {
        const id = hits[0].object.userData.agentId;
        if (id) focusAgent(id);
      }
    });

    // --- CINEMATIC CAMERA TRANSITION & ROOM FOCUS ---
    function focusAgent(agentKey) {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('cam-' + agentKey);
      if (btn) btn.classList.add('active');

      if (agentKey === 'general') {
        resetCamera();
        closeDrawer();
        return;
      }

      const agent = AGENTS_DATA[agentKey];
      if (!agent) return;

      // Calculate camera position in FRONT of the agent's desk
      const localCam = new THREE.Vector3(agent.camOffset.x, agent.camOffset.y, agent.camOffset.z);
      localCam.applyAxisAngle(new THREE.Vector3(0, 1, 0), agent.rot);
      const camPos = new THREE.Vector3(agent.pos.x, 0, agent.pos.z).add(localCam);

      // Camera looks right at character face and hands
      const localTarget = new THREE.Vector3(0, 1.48, 0.35);
      localTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), agent.rot);
      const targetPos = new THREE.Vector3(agent.pos.x, 0, agent.pos.z).add(localTarget);

      new TWEEN.Tween(camera.position)
        .to({ x: camPos.x, y: camPos.y, z: camPos.z }, 1200)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

      new TWEEN.Tween(controls.target)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1200)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

      openDrawer(agent);
    }

    function resetCamera() {
      new TWEEN.Tween(camera.position)
        .to({ x: CAM_DEFAULT.x, y: CAM_DEFAULT.y, z: CAM_DEFAULT.z }, 1200)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

      new TWEEN.Tween(controls.target)
        .to({ x: CAM_DEFAULT.targetX, y: CAM_DEFAULT.targetY, z: CAM_DEFAULT.targetZ }, 1200)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('cam-general').classList.add('active');
    }

    function openDrawer(agent) {
      document.getElementById('d-badge').textContent = agent.roomTitle;
      document.getElementById('d-title').textContent = agent.name;
      document.getElementById('d-role').textContent = agent.role;
      document.getElementById('d-photo').src = agent.photo;
      document.getElementById('d-task').textContent = agent.task;

      const ul = document.getElementById('d-rules');
      ul.innerHTML = '';
      agent.rules.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        ul.appendChild(li);
      });

      const drawer = document.getElementById('room-drawer');
      drawer.classList.add('open');
    }

    function closeDrawer() {
      document.getElementById('room-drawer').classList.remove('open');
    }

    // --- REAL-TIME DATA SYNC ---
    let currentProject = 'pc';
    let queueData = { pc: ${JSON.stringify(pcQueue)}, bg: ${JSON.stringify(bgQueue)} };

    function switchProject(p) {
      currentProject = p;
      document.getElementById('btn-pc').classList.toggle('active', p === 'pc');
      document.getElementById('btn-bg').classList.toggle('active', p === 'bg');
      updateHUD();
    }

    function updateHUD() {
      const q = queueData[currentProject] || [];
      document.getElementById('queue-count').textContent = q.length;
      document.getElementById('pub-today').textContent = (currentProject === 'pc' ? 115 : 42) + (q.length > 0 ? 1 : 0);
    }
    updateHUD();

    // Live countdown timer to next Actions cron cycle
    function updateTimer() {
      const now = new Date();
      const min = now.getMinutes();
      const sec = now.getSeconds();
      const remMin = 14 - (min % 15);
      const remSec = 59 - sec;
      const str = '00:' + String(remMin).padStart(2, '0') + ':' + String(remSec).padStart(2, '0');
      document.getElementById('countdown').textContent = str;
    }
    setInterval(updateTimer, 1000);
    updateTimer();

    // Sync live queue from GitHub REST
    async function syncGitHub() {
      try {
        const pcRes = await fetch('https://raw.githubusercontent.com/Carxlit/carxlit.github.io/main/storage/publication_queue.json');
        if (pcRes.ok) queueData.pc = await pcRes.json();
        const bgRes = await fetch('https://raw.githubusercontent.com/Carxlit/blindspot-global/main/storage/publication_queue.json');
        if (bgRes.ok) queueData.bg = await bgRes.json();
        updateHUD();
      } catch (e) {
        console.log('Sync offline:', e);
      }
    }
    setInterval(syncGitHub, 30000);
    syncGitHub();

    // --- ANIMATION LOOP ---
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      TWEEN.update();
      controls.update();

      // Lively agent idle animations
      Object.entries(agentsMeshes).forEach(([id, obj]) => {
        const char = obj.character;
        if (!char) return;

        // Subtle head breathing & nodding
        char.head.position.y = 2.05 + Math.sin(t * 2 + (id.length)) * 0.015;

        // Ryan typing fast on keyboard
        if (id === 'redactor') {
          char.leftArm.rotation.x = 0.85 + Math.sin(t * 14) * 0.06;
          char.rightArm.rotation.x = 0.82 + Math.cos(t * 14) * 0.06;
          char.head.rotation.x = Math.sin(t * 3) * 0.04;
        }
        // Scout checking screens
        else if (id === 'scout') {
          char.head.rotation.y = Math.PI + Math.sin(t * 1.5) * 0.15;
          char.rightArm.rotation.x = 0.8 + Math.sin(t * 2) * 0.03;
        }
        // Oscar drawing on digital tablet
        else if (id === 'disenador') {
          char.rightArm.rotation.x = 0.82 + Math.sin(t * 6) * 0.05;
          char.rightArm.rotation.z = -0.22 + Math.cos(t * 6) * 0.04;
        }
        // Jim bobbing head to the audio beat
        else if (id === 'editor') {
          char.head.position.y = 2.05 + Math.abs(Math.sin(t * 4)) * 0.03;
          char.leftArm.rotation.x = 0.8 + Math.sin(t * 4) * 0.04;
        }
        // Elena reviewing dossiers
        else if (id === 'directora') {
          char.head.rotation.x = 0.08 + Math.sin(t * 1.2) * 0.03;
        }
      });

      updateDynamicTextures();

      renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

fs.writeFileSync('C:/Users/carlo/Desktop/OFICINA_3D_MOTOR.html', htmlContent);
fs.writeFileSync('C:/Users/carlo/Desktop/Nueva carpeta/site/oficina_3d.html', htmlContent);
fs.writeFileSync('C:/Users/carlo/Desktop/blindspot-global/site/oficina_3d.html', htmlContent);

console.log('Oficina 3D de 5 salas completada y guardada.');
