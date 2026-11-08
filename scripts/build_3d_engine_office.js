const fs = require('fs');

const threeJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/three.min.js', 'utf8');
const orbitControlsJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/OrbitControls.js', 'utf8');
const tweenJs = fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/public/js/tween.umd.js', 'utf8');

const pcQueue = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/storage/publication_queue.json', 'utf8') || '[]');
const bgQueue = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/blindspot-global/storage/publication_queue.json', 'utf8') || '[]');

console.log('Optimizando encuadres de cámara isométrica cinematográfica...');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oficina 3D Interactiva — Motor Three.js</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #06080d;
      --panel: rgba(12, 16, 26, 0.85);
      --border: rgba(255, 255, 255, 0.1);
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
      padding: 1.5rem 2rem;
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
      padding: 0.6rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .brand-pill {
      font-size: 0.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #00f0ff, #3b82f6);
      color: #050811;
      padding: 0.35rem 0.7rem;
      border-radius: 8px;
    }

    .brand-title {
      font-size: 1rem;
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
      padding: 0.35rem 0.75rem;
      border-radius: 7px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .p-btn.active {
      background: #1e293b;
      color: #fff;
    }

    .live-monitor-pill {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.6rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .monitor-item {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .m-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
      color: var(--muted);
    }

    .m-val {
      font-size: 0.9rem;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
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

    .camera-nav {
      align-self: center;
      background: var(--panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 0.5rem 0.75rem;
      display: flex;
      gap: 0.5rem;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
    }

    .cam-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid transparent;
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.6rem 1.1rem;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.25s ease;
    }

    .cam-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    .cam-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(59, 130, 246, 0.25));
      border-color: var(--cyan);
      color: var(--cyan);
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
    }

    .agent-drawer {
      position: absolute;
      top: 5.5rem;
      right: 2rem;
      width: 400px;
      background: var(--panel);
      backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.5rem;
      display: none;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .agent-drawer.show { display: flex; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .d-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .d-title { font-size: 1.25rem; font-weight: 800; color: #fff; }
    .d-subtitle { font-size: 0.8rem; color: var(--cyan); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .d-close { background: none; border: none; color: var(--muted); font-size: 1.5rem; cursor: pointer; }

    .d-box {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .d-box-title {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .d-list {
      list-style: none;
      font-size: 0.85rem;
      color: var(--text);
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .d-list li::before {
      content: "• ";
      color: var(--cyan);
      font-weight: bold;
    }

    .controls-hint {
      position: absolute;
      bottom: 2rem;
      left: 2rem;
      background: rgba(10, 14, 24, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.5rem 0.9rem;
      font-size: 0.75rem;
      color: var(--muted);
      backdrop-filter: blur(8px);
      pointer-events: none;
    }
  </style>

  <script>${threeJs}</script>
  <script>${orbitControlsJs}</script>
  <script>${tweenJs}</script>
</head>
<body>

  <canvas id="webgl-canvas"></canvas>

  <div class="hud">
    <div class="top-bar">
      <div class="brand-box interactive">
        <div class="brand-pill">3D ENGINE</div>
        <div>
          <div class="brand-title">Oficina Virtual de Redacción</div>
          <div style="font-size:0.75rem; color:var(--muted)">Motor Three.js • 5 Agentes en Tiempo Real</div>
        </div>
        <div class="project-toggle">
          <button class="p-btn active" id="btnPC" onclick="switchProj('pc')">Punto Ciego</button>
          <button class="p-btn" id="btnBG" onclick="switchProj('bg')">Blindspot Global</button>
        </div>
      </div>

      <div class="live-monitor-pill interactive">
        <div style="display:flex; align-items:center; gap:0.5rem">
          <span class="pulse-dot"></span>
          <div class="monitor-item">
            <span class="m-label">Estado de la Nube</span>
            <span class="m-val" id="cloudStatus" style="color:#34d399">AL DÍA (Actions)</span>
          </div>
        </div>
        <div class="monitor-item">
          <span class="m-label">Próximo Reel</span>
          <span class="m-val" id="countdownVal" style="color:var(--cyan)">--:--:--</span>
        </div>
        <div class="monitor-item">
          <span class="m-label">En Cola</span>
          <span class="m-val" id="queueVal">3</span>
        </div>
        <div class="monitor-item">
          <span class="m-label">Publicados Hoy</span>
          <span class="m-val" id="pubVal">110</span>
        </div>
      </div>
    </div>

    <div class="agent-drawer interactive" id="agentDrawer">
      <div class="d-header">
        <div>
          <div class="d-title" id="dName">Nombre Agente</div>
          <div class="d-subtitle" id="dRole">#01 RADAR & INTEL</div>
        </div>
        <button class="d-close" onclick="closeDrawer()">&times;</button>
      </div>

      <div class="d-box">
        <div class="d-box-title">Actividad en Vivo</div>
        <div id="dLiveTask" style="font-size:0.85rem; color:#fff; font-weight:600">Trabajando...</div>
      </div>

      <div class="d-box">
        <div class="d-box-title">Cuaderno de Reglas</div>
        <ul class="d-list" id="dRules"></ul>
      </div>

      <button class="cam-btn interactive" style="justify-content:center; background:#1e293b;" onclick="resetCamera()">
        ⬅ Volver a Vista General
      </button>
    </div>

    <div class="controls-hint">
      🖱️ <b>Arrastrar:</b> Rotar 360° | <b>Rueda:</b> Zoom | <b>Clic en Agente:</b> Enfocar escritorio
    </div>

    <div class="camera-nav interactive">
      <button class="cam-btn active" id="cam-general" onclick="focusAgent('general')">🎥 General</button>
      <button class="cam-btn" id="cam-scout" onclick="focusAgent('scout')">🕵️ Scout</button>
      <button class="cam-btn" id="cam-directora" onclick="focusAgent('directora')">🧠 Directora</button>
      <button class="cam-btn" id="cam-redactor" onclick="focusAgent('redactor')">✍️ Ryan</button>
      <button class="cam-btn" id="cam-disenador" onclick="focusAgent('disenador')">🎨 Oscar</button>
      <button class="cam-btn" id="cam-editor" onclick="focusAgent('editor')">🎬 Jim</button>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('webgl-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.FogExp2(0x07090f, 0.015);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 60;

    const CAM_DEFAULT = { x: 0, y: 17, z: 23, targetX: 0, targetY: 1.2, targetZ: 0 };
    camera.position.set(CAM_DEFAULT.x, CAM_DEFAULT.y, CAM_DEFAULT.z);
    controls.target.set(CAM_DEFAULT.targetX, CAM_DEFAULT.targetY, CAM_DEFAULT.targetZ);

    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    mainLight.position.set(12, 22, 14);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const blueLight = new THREE.PointLight(0x00f0ff, 2.5, 25);
    blueLight.position.set(-8, 5, -5);
    scene.add(blueLight);

    const purpleLight = new THREE.PointLight(0xb026ff, 2.5, 25);
    purpleLight.position.set(8, 5, -5);
    scene.add(purpleLight);

    const radarCanvas = document.createElement('canvas');
    radarCanvas.width = 256; radarCanvas.height = 256;
    const radarCtx = radarCanvas.getContext('2d');
    const radarTex = new THREE.CanvasTexture(radarCanvas);

    const audioCanvas = document.createElement('canvas');
    audioCanvas.width = 256; audioCanvas.height = 256;
    const audioCtx = audioCanvas.getContext('2d');
    const audioTex = new THREE.CanvasTexture(audioCanvas);

    // Cute Lego Face Generator
    function makeLegoFace(glasses = false, beard = false) {
      const fc = document.createElement('canvas');
      fc.width = 256; fc.height = 256;
      const ctx = fc.getContext('2d');
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(85, 110, 14, 0, Math.PI * 2);
      ctx.arc(171, 110, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(82, 106, 5, 0, Math.PI * 2);
      ctx.arc(168, 106, 5, 0, Math.PI * 2);
      ctx.fill();

      if (glasses) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 10;
        ctx.strokeRect(60, 85, 50, 48);
        ctx.strokeRect(146, 85, 50, 48);
        ctx.beginPath(); ctx.moveTo(110, 108); ctx.lineTo(146, 108); ctx.stroke();
      }

      ctx.strokeStyle = '#111';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 160, 26, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      if (beard) {
        ctx.fillStyle = 'rgba(70, 45, 20, 0.25)';
        ctx.beginPath();
        ctx.arc(128, 175, 45, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.fill();
      }

      return new THREE.CanvasTexture(fc);
    }

    const faceDefault = makeLegoFace(false, false);
    const faceGlasses = makeLegoFace(true, false);
    const faceBeard = makeLegoFace(false, true);

    const floorGeo = new THREE.CylinderGeometry(14, 14.5, 0.3, 48);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111624, roughness: 0.3, metalness: 0.4 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringGeo = new THREE.RingGeometry(14.3, 14.6, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.31;
    scene.add(ring);

    // City Skyline Backdrop Windows
    const wallGeo = new THREE.CylinderGeometry(18, 18, 11, 32, 1, true, -Math.PI / 1.5, Math.PI / 0.75);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x070b14, side: THREE.BackSide, roughness: 0.8 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 5.5;
    scene.add(wall);

    for (let angle = -2.1; angle <= 2.1; angle += 0.7) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 7.5, 3),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x1e3a8a, emissiveIntensity: 0.35 })
      );
      win.position.set(Math.sin(angle) * 17.8, 5.5, Math.cos(angle) * 17.8);
      win.rotation.y = angle + Math.PI / 2;
      scene.add(win);
    }

    const AGENTS_DATA = {
      scout: {
        id: 'scout',
        name: 'Scout-95',
        role: '#01 RADAR & INTEL',
        pos: { x: -6, z: -4 },
        rot: Math.PI / 3,
        color: 0x334155,
        hairColor: 0x452818,
        faceTex: faceGlasses,
        deskColor: 0x1e293b,
        task: 'Monitoreando 95 fuentes de noticias en vivo y calculando urgencia.',
        rules: [
          'Filtra farándula, horóscopos y clickbait vacío.',
          'Urgencia mínima: 70 puntos para entrar a cola.',
          'Descarta duplicados semánticos con embeddings de Gemini (0.81).',
          'Protocolo Breaking News inmediato en hechos graves.'
        ]
      },
      directora: {
        id: 'directora',
        name: 'Directora Elena',
        role: '#02 DIRECCIÓN EDITORIAL',
        pos: { x: 0, z: -7 },
        rot: 0,
        color: 0x1e3a8a,
        hairColor: 0x271913,
        faceTex: faceDefault,
        deskColor: 0x451a03,
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
        name: 'Ryan "El Escriba"',
        role: '#03 REDACCIÓN & COPYS',
        pos: { x: 6, z: -4 },
        rot: -Math.PI / 3,
        color: 0x94a3b8,
        hairColor: 0x543319,
        faceTex: faceDefault,
        deskColor: 0x334155,
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
        name: 'Oscar Pixel',
        role: '#04 IDENTIDAD VISUAL',
        pos: { x: -6, z: 4 },
        rot: Math.PI / 1.35,
        color: 0x374151,
        hairColor: 0x1c1917,
        faceTex: faceGlasses,
        deskColor: 0x1e293b,
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
        name: 'Jim Master Audio',
        role: '#05 MONTAJE DE REELS',
        pos: { x: 6, z: 4 },
        rot: -Math.PI / 1.35,
        color: 0x1e40af,
        hairColor: 0x4a2e16,
        faceTex: faceBeard,
        deskColor: 0x18181b,
        task: 'Sintetizando voz neuronal, música con sidechain y compilando Reels.',
        rules: [
          'Voz Edge TTS acelerada al +8% (JorgeNeural).',
          'Sidechain en música original (-18dB bajo la voz).',
          'Subtítulos dinámicos palabra por palabra.',
          'Video real CC recortado si existe en YouTube.'
        ]
      }
    };

    const agentsMeshes = {};
    const interactiveObjects = [];

    function createLegoCharacter(agent) {
      const charGroup = new THREE.Group();

      const headGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.58, 20);
      const headMat = new THREE.MeshStandardMaterial({
        map: agent.faceTex,
        roughness: 0.25,
        metalness: 0.1
      });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.y = 2.1;
      headMesh.rotation.y = Math.PI / 2; // Aligns face decal to +Z (looking to desk)
      headMesh.castShadow = true;
      charGroup.add(headMesh);

      const studGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
      const studMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.25 });
      const studMesh = new THREE.Mesh(studGeo, studMat);
      studMesh.position.y = 2.45;
      charGroup.add(studMesh);

      const hairGeo = new THREE.SphereGeometry(0.48, 16, 16);
      hairGeo.scale(1, 0.7, 1);
      const hairMat = new THREE.MeshStandardMaterial({ color: agent.hairColor, roughness: 0.4 });
      const hairMesh = new THREE.Mesh(hairGeo, hairMat);
      hairMesh.position.set(0, 2.38, -0.05);
      charGroup.add(hairMesh);

      const torsoGeo = new THREE.CylinderGeometry(0.55, 0.75, 0.95, 4);
      torsoGeo.rotateY(Math.PI / 4);
      const torsoMat = new THREE.MeshStandardMaterial({ color: agent.color, roughness: 0.3 });
      const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
      torsoMesh.position.y = 1.35;
      torsoMesh.castShadow = true;
      charGroup.add(torsoMesh);

      const armMat = new THREE.MeshStandardMaterial({ color: agent.color, roughness: 0.4 });
      const handMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.3 });
      const armGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.6, 12);
      const handGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 16, Math.PI * 1.5);

      const leftArm = new THREE.Group();
      const armL = new THREE.Mesh(armGeo, armMat); armL.position.y = -0.25;
      const handL = new THREE.Mesh(handGeo, handMat); handL.rotation.x = Math.PI / 2; handL.position.y = -0.58;
      leftArm.add(armL, handL);
      leftArm.position.set(-0.65, 1.6, 0);
      leftArm.rotation.x = 0.5; leftArm.rotation.z = 0.2;
      charGroup.add(leftArm);

      const rightArm = new THREE.Group();
      const armR = new THREE.Mesh(armGeo, armMat); armR.position.y = -0.25;
      const handR = new THREE.Mesh(handGeo, handMat); handR.rotation.x = Math.PI / 2; handR.position.y = -0.58;
      rightArm.add(armR, handR);
      rightArm.position.set(0.65, 1.6, 0);
      rightArm.rotation.x = 0.5; rightArm.rotation.z = -0.2;
      charGroup.add(rightArm);

      const hipsGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
      const hipsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const hips = new THREE.Mesh(hipsGeo, hipsMat);
      hips.position.y = 0.8;
      charGroup.add(hips);

      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16), hipsMat);
      seat.position.y = 0.6;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), hipsMat);
      back.position.set(0, 1.2, -0.6);
      chair.add(seat, back);
      charGroup.add(chair);

      return { root: charGroup, head: headMesh, leftArm, rightArm, id: agent.id };
    }

    function createWorkstation(agent) {
      const station = new THREE.Group();

      const deskTop = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.15, 1.8),
        new THREE.MeshStandardMaterial({ color: agent.deskColor, roughness: 0.3 })
      );
      deskTop.position.set(0, 1.2, 0.9);
      deskTop.castShadow = true; deskTop.receiveShadow = true;
      station.add(deskTop);

      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      [[-1.4, 0.2], [1.4, 0.2], [-1.4, 1.6], [1.4, 1.6]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.6, lz);
        station.add(leg);
      });

      const character = createLegoCharacter(agent);
      character.root.position.set(0, 0, 0);
      station.add(character.root);

      if (agent.id === 'scout') {
        [-0.8, 0, 0.8].forEach((mx, idx) => {
          const mon = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.55, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x00f0ff, emissiveMap: radarTex, emissiveIntensity: 0.85 })
          );
          mon.position.set(mx, 1.7, 1.35);
          mon.rotation.y = idx === 0 ? 0.3 : (idx === 2 ? -0.3 : 0);
          station.add(mon);
        });
      } else if (agent.id === 'editor') {
        const mixer = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x18181b }));
        mixer.position.set(-0.5, 1.32, 0.85);
        const vMon = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.9, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x10b981, emissiveMap: audioTex, emissiveIntensity: 1.0 })
        );
        vMon.position.set(0.7, 1.85, 1.1);
        station.add(mixer, vMon);
      } else if (agent.id === 'disenador') {
        const tab = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.05, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0x8b5cf6, emissiveIntensity: 0.4 })
        );
        tab.position.set(0, 1.32, 0.7);
        tab.rotation.x = 0.2;
        station.add(tab);
      } else if (agent.id === 'directora') {
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12),
          new THREE.MeshStandardMaterial({ color: 0x15803d, emissive: 0x22c55e, emissiveIntensity: 0.6 })
        );
        lamp.rotation.z = Math.PI / 2; lamp.position.set(-1.1, 1.6, 1.1);
        station.add(lamp);
      } else {
        const mon = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.75, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x38bdf8, emissiveIntensity: 0.4 })
        );
        mon.position.set(0, 1.8, 1.35);
        station.add(mon);
      }

      const hit = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(0, 1.7, 0.5);
      hit.userData = { agentId: agent.id };
      station.add(hit);
      interactiveObjects.push(hit);

      station.position.set(agent.pos.x, 0, agent.pos.z);
      station.rotation.y = agent.rot;
      scene.add(station);

      return character;
    }

    Object.values(AGENTS_DATA).forEach(agent => {
      agentsMeshes[agent.id] = createWorkstation(agent);
    });

    const clock = new THREE.Clock();

    function updateProceduralTextures(t) {
      radarCtx.fillStyle = '#061325';
      radarCtx.fillRect(0, 0, 256, 256);
      radarCtx.strokeStyle = '#00f0ff';
      radarCtx.lineWidth = 3;
      radarCtx.beginPath();
      radarCtx.arc(128, 128, 80, 0, Math.PI * 2);
      radarCtx.arc(128, 128, 40, 0, Math.PI * 2);
      radarCtx.stroke();
      const sweep = t * 2.5;
      radarCtx.beginPath();
      radarCtx.moveTo(128, 128);
      radarCtx.lineTo(128 + Math.cos(sweep) * 90, 128 + Math.sin(sweep) * 90);
      radarCtx.stroke();
      radarTex.needsUpdate = true;

      audioCtx.fillStyle = '#05111b';
      audioCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 12; i++) {
        const h = Math.abs(Math.sin(t * 4 + i * 0.8)) * 180 + 20;
        audioCtx.fillStyle = h > 150 ? '#ef4444' : (h > 100 ? '#f59e0b' : '#10b981');
        audioCtx.fillRect(16 + i * 20, 240 - h, 16, h);
      }
      audioTex.needsUpdate = true;
    }

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      TWEEN.update();
      controls.update();
      updateProceduralTextures(t);

      if (agentsMeshes.scout) {
        agentsMeshes.scout.head.rotation.y = Math.PI / 2 + Math.sin(t * 1.5) * 0.3;
        agentsMeshes.scout.leftArm.rotation.x = 0.5 + Math.sin(t * 8) * 0.08;
        agentsMeshes.scout.rightArm.rotation.x = 0.5 + Math.cos(t * 8) * 0.08;
      }
      if (agentsMeshes.directora) {
        agentsMeshes.directora.head.rotation.x = Math.sin(t * 0.8) * 0.12;
        agentsMeshes.directora.rightArm.rotation.x = 0.45 + Math.sin(t * 2) * 0.05;
      }
      if (agentsMeshes.redactor) {
        agentsMeshes.redactor.head.rotation.y = Math.PI / 2 + Math.sin(t * 2) * 0.1;
        agentsMeshes.redactor.leftArm.rotation.x = 0.52 + Math.sin(t * 14) * 0.12;
        agentsMeshes.redactor.rightArm.rotation.x = 0.52 + Math.cos(t * 14) * 0.12;
      }
      if (agentsMeshes.disenador) {
        agentsMeshes.disenador.rightArm.rotation.x = 0.5 + Math.sin(t * 3) * 0.15;
      }
      if (agentsMeshes.editor) {
        agentsMeshes.editor.head.rotation.x = Math.abs(Math.sin(t * 3.5)) * 0.25;
        agentsMeshes.editor.leftArm.rotation.x = 0.5 + Math.sin(t * 3.5) * 0.1;
      }

      renderer.render(scene, camera);
    }
    animate();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('pointerdown', (e) => {
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

    // Isometric Front-Quarter Camera View for each desk
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

      // Local front-quarter offset (to the side and elevated in front of desk)
      const localOffset = new THREE.Vector3(2.6, 2.3, 0.3);
      localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), agent.rot);
      const camPos = new THREE.Vector3(agent.pos.x, 0, agent.pos.z).add(localOffset);

      const localTarget = new THREE.Vector3(0, 1.6, 0.6);
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
      closeDrawer();
    }

    function openDrawer(agent) {
      document.getElementById('dName').innerText = agent.name;
      document.getElementById('dRole').innerText = agent.role;
      document.getElementById('dLiveTask').innerText = agent.task;
      document.getElementById('dRules').innerHTML = agent.rules.map(r => \`<li>\${r}</li>\`).join('');
      document.getElementById('agentDrawer').classList.add('show');
    }

    function closeDrawer() {
      document.getElementById('agentDrawer').classList.remove('show');
    }

    const localQueues = { pc: ${JSON.stringify(pcQueue)}, bg: ${JSON.stringify(bgQueue)} };
    let activeProject = 'pc';
    let currentQueue = [];
    let nextScheduledTime = null;

    function switchProj(p) {
      activeProject = p;
      document.getElementById('btnPC').classList.toggle('active', p === 'pc');
      document.getElementById('btnBG').classList.toggle('active', p === 'bg');
      fetchRealTimeData();
    }

    async function fetchRealTimeData() {
      const repo = activeProject === 'pc' ? 'Carxlit/carxlit.github.io' : 'Carxlit/blindspot-global';
      const queueUrl = \`https://raw.githubusercontent.com/\${repo}/main/storage/publication_queue.json?t=\${Date.now()}\`;

      try {
        const res = await fetch(queueUrl);
        if (!res.ok) throw new Error('Network error');
        currentQueue = await res.json();
      } catch (e) {
        currentQueue = localQueues[activeProject] || [];
      }

      const queued = currentQueue.filter(i => i.status === 'queued')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
      const published = currentQueue.filter(i => i.status === 'published');

      document.getElementById('queueVal').innerText = queued.length;
      document.getElementById('pubVal').innerText = published.length;

      if (queued.length > 0) {
        nextScheduledTime = new Date(queued[0].scheduledFor);
      } else {
        nextScheduledTime = null;
        document.getElementById('countdownVal').innerText = '00:00:00';
      }
    }

    setInterval(() => {
      if (!nextScheduledTime) return;
      const now = Date.now();
      const diff = nextScheduledTime.getTime() - now;
      if (diff <= 0) {
        document.getElementById('countdownVal').innerText = '00:00:00';
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = n => String(n).padStart(2, '0');
      document.getElementById('countdownVal').innerText = \`\${pad(h)}:\${pad(m)}:\${pad(s)}\`;
    }, 1000);

    fetchRealTimeData();
    setInterval(fetchRealTimeData, 30000);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

fs.writeFileSync('C:/Users/carlo/Desktop/OFICINA_3D_MOTOR.html', htmlContent, 'utf8');
fs.writeFileSync('C:/Users/carlo/Desktop/Nueva carpeta/site/oficina_3d.html', htmlContent, 'utf8');
fs.writeFileSync('C:/Users/carlo/Desktop/blindspot-global/site/oficina_3d.html', htmlContent, 'utf8');
console.log('Oficina 3D optimizada compilada con éxito.');
