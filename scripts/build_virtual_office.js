const fs = require('fs');
const path = require('path');

const imgDir = 'C:/Users/carlo/Desktop/Nueva carpeta/public/agents';
const getBase64 = (file) => {
  const buf = fs.readFileSync(path.join(imgDir, file));
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
};

console.log('Cargando imágenes de los agentes en Base64...');
const scoutImg = getBase64('scout.jpg');
const directoraImg = getBase64('directora.jpg');
const redactorImg = getBase64('redactor.jpg');
const disenadorImg = getBase64('disenador.jpg');
const editorImg = getBase64('editor.jpg');

console.log('Imágenes cargadas. Generando HTML de la Oficina Virtual...');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oficina Virtual — Redacción Autónoma Punto Ciego & Blindspot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0b0d13;
      --bg-card: #141824;
      --bg-card-hover: #1b2133;
      --cyan: #00f0ff;
      --green: #00ff66;
      --magenta: #ff007f;
      --yellow: #ffd000;
      --amber: #ff9900;
      --purple: #b026ff;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #242c40;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-dark);
      color: var(--text);
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(0, 240, 255, 0.08) 0%, transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(176, 38, 255, 0.05) 0%, transparent 50%),
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
    }

    /* Scanline CRT overlay */
    body::after {
      content: " ";
      display: block;
      position: fixed;
      top: 0; left: 0; bottom: 0; right: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 4px;
      z-index: 999;
      pointer-events: none;
      opacity: 0.6;
    }

    header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--border);
      background: rgba(20, 24, 36, 0.7);
      backdrop-filter: blur(12px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-badge {
      font-family: 'Press Start 2P', monospace;
      font-size: 0.7rem;
      background: var(--magenta);
      color: #fff;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
      box-shadow: 0 0 15px rgba(255, 0, 127, 0.5);
      letter-spacing: 1px;
    }

    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      background: rgba(0, 255, 102, 0.1);
      border: 1px solid rgba(0, 255, 102, 0.3);
      color: var(--green);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }

    .btn:hover {
      border-color: var(--cyan);
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.25);
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #00f0ff 0%, #0077ff 100%);
      color: #0b0d13;
      border: none;
      font-weight: 700;
      box-shadow: 0 4px 15px rgba(0, 240, 255, 0.3);
    }

    .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(0, 240, 255, 0.5);
      transform: translateY(-2px);
    }

    /* Main Container */
    main {
      flex: 1;
      max-width: 1500px;
      margin: 0 auto;
      padding: 2rem;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    /* Sub-nav banner */
    .banner {
      background: rgba(20, 24, 36, 0.5);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .banner-text {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .banner-text strong {
      color: var(--cyan);
    }

    /* Grid of Agents */
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 1.5rem;
    }

    .agent-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
      transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      display: flex;
      flex-direction: column;
    }

    .agent-card:hover {
      transform: translateY(-6px);
      border-color: var(--cyan);
      box-shadow: 0 12px 30px rgba(0, 240, 255, 0.15);
    }

    .agent-card.active-work {
      border-color: var(--green);
      box-shadow: 0 0 30px rgba(0, 255, 102, 0.4);
      animation: workingGlow 1.5s infinite alternate;
    }

    @keyframes workingGlow {
      from { box-shadow: 0 0 15px rgba(0, 255, 102, 0.3); }
      to { box-shadow: 0 0 35px rgba(0, 255, 102, 0.7); }
    }

    .agent-img-box {
      position: relative;
      width: 100%;
      padding-top: 100%; /* 1:1 Aspect */
      background: #000;
      overflow: hidden;
    }

    .agent-img-box img {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      image-rendering: pixelated;
      transition: transform 0.4s ease;
    }

    .agent-card:hover .agent-img-box img {
      transform: scale(1.05);
    }

    .agent-role-tag {
      position: absolute;
      bottom: 12px;
      left: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(11, 13, 19, 0.85);
      border: 1px solid var(--border);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      backdrop-filter: blur(8px);
      color: var(--cyan);
    }

    .agent-info {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }

    .agent-name-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .agent-name {
      font-size: 1.15rem;
      font-weight: 700;
    }

    .agent-status-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
    }

    .agent-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .agent-card-footer {
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: var(--cyan);
      font-weight: 600;
    }

    /* Live Pipeline Feed Section */
    .live-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 1.1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    /* Simulation Terminal */
    .terminal {
      background: #080a0f;
      border: 1px solid #1a2234;
      border-radius: 10px;
      padding: 1.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      min-height: 160px;
      max-height: 240px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.6);
    }

    .terminal-line {
      display: flex;
      gap: 0.75rem;
      line-height: 1.5;
    }

    .t-time { color: #64748b; }
    .t-agent { font-weight: 700; }
    .t-scout { color: var(--cyan); }
    .t-directora { color: var(--amber); }
    .t-redactor { color: var(--green); }
    .t-disenador { color: var(--purple); }
    .t-editor { color: var(--magenta); }
    .t-dispatch { color: var(--yellow); }

    /* Modal for Notebook */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .modal-backdrop.open {
      display: flex;
    }

    .notebook-card {
      background: #111520;
      border: 2px solid var(--border);
      border-radius: 20px;
      max-width: 750px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
      position: relative;
      display: flex;
      flex-direction: column;
      animation: modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlide {
      from { opacity: 0; transform: scale(0.95) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .notebook-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 1.25rem;
      position: relative;
    }

    .modal-avatar {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      object-fit: cover;
      image-rendering: pixelated;
      border: 2px solid var(--cyan);
    }

    .modal-title-area h2 {
      font-size: 1.3rem;
      font-weight: 700;
    }

    .modal-title-area p {
      color: var(--text-muted);
      font-size: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
    }

    .close-btn {
      position: absolute;
      top: 1.25rem;
      right: 1.5rem;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1.6rem;
      cursor: pointer;
      line-height: 1;
    }

    .close-btn:hover { color: #fff; }

    .notebook-body {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .rule-box {
      background: rgba(255, 255, 255, 0.03);
      border-left: 4px solid var(--cyan);
      padding: 1rem 1.25rem;
      border-radius: 0 10px 10px 0;
    }

    .rule-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--cyan);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .rule-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .rule-list li::before {
      content: "▸ ";
      color: var(--cyan);
      font-weight: bold;
    }

    .tools-tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .tool-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background: #1e2638;
      border: 1px solid var(--border);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      color: #93c5fd;
    }

    footer {
      padding: 1.5rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>

  <header>
    <div class="logo-area">
      <div class="logo-badge">100% IA</div>
      <h1>Oficina Virtual de Redacción</h1>
      <div class="status-pill">
        <span class="status-dot"></span>
        <span id="systemStatus">5 AGENTES ONLINE</span>
      </div>
    </div>
    <div class="header-controls">
      <button class="btn" id="soundToggle" onclick="toggleSound()">🔊 Sonido: ON</button>
      <button class="btn btn-primary" id="btnSimulate" onclick="runSimulation()">▶ Simular Ciclo en Vivo</button>
    </div>
  </header>

  <main>
    <div class="banner">
      <div class="banner-text">
        <strong>Punto Ciego & Blindspot Global:</strong> Redacción 100% autónoma y 100% gratuita. Haz clic en cualquier agente para abrir su <strong>Cuaderno de Lecciones</strong> y reglas no negociables.
      </div>
      <div class="banner-text" style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">
        Ciclo: <span style="color:var(--green)">Cada 15 min</span> | Cupo: <span style="color:var(--cyan)">16/día</span> | Costo: <span style="color:var(--yellow)">$0.00 USD</span>
      </div>
    </div>

    <!-- Agent Cards Grid -->
    <div class="agents-grid">

      <!-- 1. SCOUT -->
      <div class="agent-card" id="card-scout" onclick="openNotebook('scout')">
        <div class="agent-img-box">
          <img src="${scoutImg}" alt="Agente Scout">
          <div class="agent-role-tag">#01 RADAR & INTEL</div>
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">Scout-95</span>
            <span class="agent-status-tag" id="status-scout">VIGILANDO</span>
          </div>
          <p class="agent-desc">Monitorea ~95 fuentes RSS y agencias en tiempo real (AP, Reuters, El País, BBC). Mide impacto y descarta repetidos con embeddings de Gemini.</p>
          <div class="agent-card-footer">
            <span>Ver Cuaderno de Reglas →</span>
          </div>
        </div>
      </div>

      <!-- 2. DIRECTORA -->
      <div class="agent-card" id="card-directora" onclick="openNotebook('directora')">
        <div class="agent-img-box">
          <img src="${directoraImg}" alt="Directora Editorial">
          <div class="agent-role-tag" style="color:var(--amber)">#02 DIRECCIÓN EDITORIAL</div>
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">Directora Elena</span>
            <span class="agent-status-tag" id="status-directora">ANALIZANDO</span>
          </div>
          <p class="agent-desc">Cruza al menos 2 fuentes independientes. Define el "Punto Ciego": el ángulo oculto que la prensa corporativa no publica por intereses.</p>
          <div class="agent-card-footer" style="color:var(--amber)">
            <span>Ver Cuaderno de Reglas →</span>
          </div>
        </div>
      </div>

      <!-- 3. REDACTOR -->
      <div class="agent-card" id="card-redactor" onclick="openNotebook('redactor')">
        <div class="agent-img-box">
          <img src="${redactorImg}" alt="Redactor Ryan">
          <div class="agent-role-tag" style="color:var(--green)">#03 REDACCIÓN & COPYS</div>
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">Ryan "El Escriba"</span>
            <span class="agent-status-tag" id="status-redactor">LISTO</span>
          </div>
          <p class="agent-desc">Escribe el artículo web en 5 bloques analíticos y los copys de Instagram/Facebook. Regla: Cero clichés de IA o lenguaje de marketing.</p>
          <div class="agent-card-footer" style="color:var(--green)">
            <span>Ver Cuaderno de Reglas →</span>
          </div>
        </div>
      </div>

      <!-- 4. DISEÑADOR -->
      <div class="agent-card" id="card-disenador" onclick="openNotebook('disenador')">
        <div class="agent-img-box">
          <img src="${disenadorImg}" alt="Diseñador Oscar">
          <div class="agent-role-tag" style="color:var(--purple)">#04 ARTE & IDENTIDAD</div>
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">Oscar Pixel</span>
            <span class="agent-status-tag" id="status-disenador">EN ESPERA</span>
          </div>
          <p class="agent-desc">Verifica fotos reales de medios y bloquea repeticiones con hashes visuales. Diseña la portada 9:16 e infografías animadas.</p>
          <div class="agent-card-footer" style="color:var(--purple)">
            <span>Ver Cuaderno de Reglas →</span>
          </div>
        </div>
      </div>

      <!-- 5. EDITOR VIDEO -->
      <div class="agent-card" id="card-editor" onclick="openNotebook('editor')">
        <div class="agent-img-box">
          <img src="${editorImg}" alt="Editor Jim">
          <div class="agent-role-tag" style="color:var(--magenta)">#05 MONTAJE DE REELS</div>
        </div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">Jim Master Audio</span>
            <span class="agent-status-tag" id="status-editor">ESPERANDO AUDIO</span>
          </div>
          <p class="agent-desc">Voz Edge TTS (+8%), sintetizador de música con sidechain bajo la voz y renderizado de frames en Chromium a 1080x1920 con FFmpeg.</p>
          <div class="agent-card-footer" style="color:var(--magenta)">
            <span>Ver Cuaderno de Reglas →</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Live Simulation Terminal -->
    <div class="live-section">
      <div class="section-header">
        <div class="section-title">
          <span>📟</span>
          <span>Terminal de la Redacción en Tiempo Real</span>
        </div>
        <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.75rem;" onclick="clearTerminal()">Limpiar</button>
      </div>
      <div class="terminal" id="terminalLog">
        <div class="terminal-line">
          <span class="t-time">[09:00:00]</span>
          <span class="t-agent t-scout">[SISTEMA]</span>
          <span>Oficina iniciada. 5 agentes autónomos sincronizados con GitHub Actions.</span>
        </div>
        <div class="terminal-line">
          <span class="t-time">[09:00:05]</span>
          <span class="t-agent t-scout">[SCOUT]</span>
          <span>Escaneando 95 fuentes globales RSS / Google News (Español & English)...</span>
        </div>
      </div>
    </div>
  </main>

  <!-- Modal Cuaderno de Lecciones -->
  <div class="modal-backdrop" id="notebookModal" onclick="closeNotebook(event)">
    <div class="notebook-card" onclick="event.stopPropagation()">
      <div class="notebook-header">
        <img class="modal-avatar" id="modalImg" src="" alt="Avatar">
        <div class="modal-title-area">
          <h2 id="modalName">Nombre del Agente</h2>
          <p id="modalRole">Rol Oficial en la Redacción</p>
        </div>
        <button class="close-btn" onclick="closeNotebook()">&times;</button>
      </div>
      <div class="notebook-body" id="modalBody">
        <!-- Injected via JS -->
      </div>
    </div>
  </div>

  <footer>
    PUNTO CIEGO & BLINDSPOT GLOBAL — REDACCIÓN AUTÓNOMA DE NOTICIAS CON INTELIGENCIA ARTIFICIAL &copy; 2026
  </footer>

  <script>
    // Audio synthesizer for retro beeps (zero external audio files needed)
    let soundEnabled = true;
    let audioCtx = null;

    function playBeep(freq = 440, duration = 0.08, type = 'sine') {
      if (!soundEnabled) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById('soundToggle').innerText = soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
    }

    // Cuaderno de Lecciones Data
    const notebooks = {
      scout: {
        name: 'Scout-95',
        role: 'Agente #01 — Radar de Inteligencia Global',
        img: '${scoutImg}',
        rules: [
          'PROHIBIDO: Noticias de farándula, celebridades, horóscopos o clickbait sensacionalista vacío.',
          'REGLA SEMÁNTICA: Si una noticia tiene similitud de embeddings > 0.81 con otra de las últimas 48 horas, se bloquea de inmediato (evita repeticiones).',
          'PUNTUACIÓN DE URGENCIA: Solo pasan a cola noticias con puntuación de impacto ≥ 70.',
          'PROTOCOLO BREAKING NEWS: Si el hecho es grave (muertes, conflicto militar, catástrofe institucional) y la fuente es Tier-1, se publica de inmediato sin esperar.',
          'EQUILIBRIO TEMÁTICO: Vigilar que ninguna categoría (Geopolítica, Economía, Tecnología, Poder, Seguridad) supere el 30% del volumen diario.'
        ],
        tools: ['news-scout.ts', 'rss-parser', 'Google News RSS (EN/ES)', 'semantic-dedupe.ts', 'Gemini Text Embeddings (text-embedding-004)']
      },
      directora: {
        name: 'Directora Elena',
        role: 'Agente #02 — Estrategia & Dirección Editorial',
        img: '${directoraImg}',
        rules: [
          'MISIÓN SAGRADA: Identificar siempre el "Punto Ciego" — lo que los titulares de prensa masiva no te dicen por intereses comerciales o políticos.',
          'CRUCE OBLIGATORIO: Contrastar cada hecho con al menos 2 fuentes independientes antes de autorizar la redacción.',
          'NEUTRALIDAD TOTAL: Cero sesgo partidista. Desarmar relatos tanto de izquierda como de derecha; hablar siempre desde los datos y las consecuencias reales.',
          'FILTRO DE TONO: Si el evento involucra tragedias o vidas humanas, exigir formato SERIO y bloquear cualquier elemento festivo o infografía liviana.',
          'CONTROL DE ACTUALIZACIONES: Si es una historia en desarrollo ("updateOf"), ordenar al equipo que cuente ÚNICAMENTE los nuevos avances sin repetir el contexto viejo.'
        ],
        tools: ['deep-researcher.ts', 'editorial-director.ts', 'orchestrator.ts', 'Gemini 1.5 Flash / Groq Llama-3.3-70B']
      },
      redactor: {
        name: 'Ryan "El Escriba"',
        role: 'Agente #03 — Redacción Periodística & Copys',
        img: '${redactorImg}',
        rules: [
          'PROHIBIDO SONAR A IA: Vetadas las frases cliché ("un tapiz de", "es importante destacar", "en resumen", "un testimonio de resiliencia"). Escribir con crudeza periodística.',
          'PRIMER PÁRRAFO DEMOLEDOR: La cifra dura, el hecho y las partes involucradas van en las dos primeras líneas.',
          'ESTRUCTURA WEB EN 5 BLOQUES: (1) Qué pasó, (2) El Contexto, (3) El Punto Ciego, (4) Ganadores y Perdedores, (5) Qué vigilar.',
          'COPYS DIFERENCIADOS: Instagram lleva gancho potente con espacios limpios y reflexión; Facebook lleva análisis de fondo para generar debate; Telegram lleva viñetas ejecutivas.',
          'VERSIÓN BLINDSPOT GLOBAL: Traducir cualquier cable en español al inglés más fluido, directo y nativo, sin traducciones literales.'
        ],
        tools: ['article-writer.ts', 'editorial-desk.ts', 'multi-platform-copywriter.ts', 'Markdown Engine']
      },
      disenador: {
        name: 'Oscar Pixel',
        role: 'Agente #04 — Identidad Visual & Portadas',
        img: '${disenadorImg}',
        rules: [
          'REGLA DE ORO DE FOTOS: La imagen DEBE corresponder exactamente al hecho o sus protagonistas reales.',
          'CERO REPETICIONES: Prohibido usar la misma foto en dos noticias distintas (control de huellas criptográficas en image_hashes.json).',
          'PROHIBIDO: Marcas de agua gigantescas, capturas de pantalla de baja calidad o logos de canales de TV.',
          'PORTADA 9:16: Titular en fuente Montserrat/Anton de alto contraste en el tercio superior, legible en menos de 1 segundo en feed de Reels.',
          'PALETA POR SECCIÓN: Azul para Geopolítica, Verde para Economía, Violeta para Tecnología & IA, Rojo para Seguridad & Defensa, Ámbar para Poder & Sociedad.'
        ],
        tools: ['news-images.ts', 'reel-infographic.ts', 'reel-cover.ts', 'photo_checks.json', 'image_hashes.json']
      },
      editor: {
        name: 'Jim Master Audio',
        role: 'Agente #05 — Montaje de Video & Sonido (Reels)',
        img: '${editorImg}',
        rules: [
          'VOZ NATURAL Y RÁPIDA: Edge TTS con locutor es-MX-JorgeNeural acelerado al +8% para retener a la audiencia sin sonar robótico.',
          'MÚSICA CON SIDECHAIN: La música original baja a -18dB automáticamente mientras la voz habla y sube suavemente en las pausas dramáticas.',
          'SUBTÍTULOS DINÁMICOS: Palabra por palabra en el tercio inferior, con resaltado de color amarillo y blanco sincronizado al milisegundo.',
          'VIDEO REAL PRIMERO: Si existe video real con licencia Creative Commons en YouTube (yt-dlp), se descarga y se recorta como escena clave.',
          'DURACIÓN DE RETENCIÓN: Cada Reel debe durar entre 40 y 55 segundos para maximizar el algoritmo de Instagram.'
        ],
        tools: ['reel-generator.ts', 'Microsoft Edge TTS', 'background-music.ts', 'Chromium Frame Renderer', 'FFmpeg with sidechaincompress']
      }
    };

    function openNotebook(agentKey) {
      playBeep(600, 0.05);
      const data = notebooks[agentKey];
      if (!data) return;

      document.getElementById('modalImg').src = data.img;
      document.getElementById('modalName').innerText = data.name;
      document.getElementById('modalRole').innerText = data.role;

      let html = \`
        <div class="rule-box">
          <div class="rule-title">📜 Cuaderno de Lecciones — Reglas de Oro</div>
          <ul class="rule-list">
            \${data.rules.map(r => \`<li>\${r}</li>\`).join('')}
          </ul>
        </div>
        <div class="rule-box" style="border-left-color: var(--purple);">
          <div class="rule-title" style="color: var(--purple);">⚙️ Herramientas de Código & APIs</div>
          <div class="tools-tag-list">
            \${data.tools.map(t => \`<span class="tool-tag">\${t}</span>\`).join('')}
          </div>
        </div>
      \`;

      document.getElementById('modalBody').innerHTML = html;
      document.getElementById('notebookModal').classList.add('open');
    }

    function closeNotebook(e) {
      playBeep(350, 0.04);
      document.getElementById('notebookModal').classList.remove('open');
    }

    function addLog(agent, className, message) {
      const log = document.getElementById('terminalLog');
      const time = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'terminal-line';
      div.innerHTML = \`<span class="t-time">[\${time}]</span> <span class="t-agent \${className}">[\${agent}]</span> <span>\${message}</span>\`;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    function clearTerminal() {
      document.getElementById('terminalLog').innerHTML = '';
      playBeep(300, 0.05);
    }

    // Interactive Live Newsroom Simulation
    let isSimulating = false;
    async function runSimulation() {
      if (isSimulating) return;
      isSimulating = true;
      const btn = document.getElementById('btnSimulate');
      btn.disabled = true;
      btn.innerText = '⚙️ Ciclo en Progreso...';

      // Clear highlights
      document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active-work'));

      playBeep(520, 0.1);
      addLog('SISTEMA', 't-scout', '🔔 Disparo de ciclo (cron 15 min / workflow_dispatch). Activando agentes...');

      // 1. Scout step
      await sleep(1000);
      highlightCard('card-scout', 'status-scout', 'ESCANEANDO 95 FUENTES...');
      playBeep(650, 0.12);
      addLog('SCOUT', 't-scout', 'Detectado cable internacional: "Paraguay ratifica acusación fiscal contra expresidente Peña".');
      addLog('SCOUT', 't-scout', 'Comprobando embeddings en caché: Similitud 0.32 (noticia fresca, aprobada con Urgencia 86/100).');

      // 2. Directora step
      await sleep(2000);
      unhighlightCard('card-scout', 'status-scout', 'VIGILANDO');
      highlightCard('card-directora', 'status-directora', 'DEFINIENDO ENFOQUE...');
      playBeep(780, 0.12);
      addLog('DIRECTORA', 't-directora', 'Cruzando con 3 agencias de noticias. Enfoque definido: "Punto Ciego sobre el control judicial y la disputa por rutas aduaneras".');
      addLog('DIRECTORA', 't-directora', 'Aprobado para formato completo (Web + Reel vertical 9:16).');

      // 3. Redactor step
      await sleep(2200);
      unhighlightCard('card-directora', 'status-directora', 'ANALIZANDO');
      highlightCard('card-redactor', 'status-redactor', 'ESCRIBIENDO NOTA...');
      playBeep(880, 0.12);
      addLog('REDACTOR', 't-redactor', 'Redactando 5 bloques analíticos. Eliminados clichés de IA y frases vacías.');
      addLog('REDACTOR', 't-redactor', 'Copys generados: Gancho de 3 segundos para Reel, resumen para Telegram y post de análisis para Facebook.');

      // 4. Diseñador step
      await sleep(2200);
      unhighlightCard('card-redactor', 'status-redactor', 'DISEÑANDO PORTADA...');
      highlightCard('card-disenador', 'status-disenador', 'VERIFICANDO FOTOS...');
      playBeep(980, 0.12);
      addLog('DISEÑADOR', 't-disenador', 'Foto del protagonista validada por IA. Hash de imagen guardado para evitar duplicados.');
      addLog('DISEÑADOR', 't-disenador', 'Portada 9:16 compuesta con tipografía Anton de alto impacto e infografía de sección Poder & Sociedad.');

      // 5. Editor step
      await sleep(2200);
      unhighlightCard('card-disenador', 'status-disenador', 'LISTO');
      highlightCard('card-editor', 'status-editor', 'RENDERIZANDO VIDEO...');
      playBeep(1100, 0.15);
      addLog('EDITOR', 't-editor', 'Audio neuronal generado con Edge TTS (JorgeNeural +8%).');
      addLog('EDITOR', 't-editor', 'FFmpeg mezcló sintetizador original con sidechain (-18dB) + subtítulos animados sincronizados (Duración: 52s).');

      // 6. Dispatch step
      await sleep(1800);
      unhighlightCard('card-editor', 'status-editor', 'ESPERANDO AUDIO');
      playBeep(1320, 0.2);
      addLog('DESPACHO', 't-dispatch', '✅ Noticia publicada en el sitio estático y programada en la cola para Instagram Reel y Facebook.');

      btn.disabled = false;
      btn.innerText = '▶ Simular Otro Ciclo';
      isSimulating = false;
    }

    function highlightCard(cardId, statusId, text) {
      const card = document.getElementById(cardId);
      if (card) card.classList.add('active-work');
      const st = document.getElementById(statusId);
      if (st) {
        st.innerText = text;
        st.style.color = 'var(--cyan)';
      }
    }

    function unhighlightCard(cardId, statusId, text) {
      const card = document.getElementById(cardId);
      if (card) card.classList.remove('active-work');
      const st = document.getElementById(statusId);
      if (st) {
        st.innerText = text;
        st.style.color = '';
      }
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  </script>
</body>
</html>`;

const outPathDesktop = 'C:/Users/carlo/Desktop/OFICINA_VIRTUAL_PUNTO_CIEGO.html';
const outPathPC = 'C:/Users/carlo/Desktop/Nueva carpeta/site/oficina_virtual.html';
const outPathBG = 'C:/Users/carlo/Desktop/blindspot-global/site/oficina_virtual.html';

fs.writeFileSync(outPathDesktop, htmlContent, 'utf8');
fs.writeFileSync(outPathPC, htmlContent, 'utf8');
fs.writeFileSync(outPathBG, htmlContent, 'utf8');

console.log('Oficina Virtual HTML escrita con éxito en:');
console.log(' - ' + outPathDesktop);
console.log(' - ' + outPathPC);
console.log(' - ' + outPathBG);

// Crear el launcher .bat en el Escritorio
const batContent = `@echo off
title Oficina Virtual - Punto Ciego
start "" "C:\\Users\\carlo\\Desktop\\OFICINA_VIRTUAL_PUNTO_CIEGO.html"
exit
`;

fs.writeFileSync('C:/Users/carlo/Desktop/OFICINA_VIRTUAL.bat', batContent, 'utf8');
console.log('Creado acceso directo en Escritorio: C:/Users/carlo/Desktop/OFICINA_VIRTUAL.bat');
