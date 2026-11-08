const fs = require('fs');
const path = require('path');

const imgDir = 'C:/Users/carlo/Desktop/Nueva carpeta/public/agents';
const getBase64 = (file) => {
  const buf = fs.readFileSync(path.join(imgDir, file));
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
};

console.log('Cargando imágenes 3D Lego en Base64...');
const scout3D = getBase64('scout_3d.jpg');
const directora3D = getBase64('directora_3d.jpg');
const redactor3D = getBase64('redactor_3d.jpg');
const disenador3D = getBase64('disenador_3d.jpg');
const editor3D = getBase64('editor_3d.jpg');

// Cargar estado inicial local como respaldo
const pcQueueLocal = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/Nueva carpeta/storage/publication_queue.json', 'utf8') || '[]');
const bgQueueLocal = JSON.parse(fs.readFileSync('C:/Users/carlo/Desktop/blindspot-global/storage/publication_queue.json', 'utf8') || '[]');

console.log('Generando panel 3D en tiempo real...');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oficina 3D en Tiempo Real — Punto Ciego & Blindspot Global</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: rgba(18, 22, 34, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover-border: rgba(0, 240, 255, 0.4);
      --cyan: #00f0ff;
      --green: #10b981;
      --amber: #f59e0b;
      --magenta: #ec4899;
      --purple: #8b5cf6;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 50% -20%, rgba(0, 240, 255, 0.15) 0%, transparent 60%),
        radial-gradient(circle at 100% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 0% 50%, rgba(245, 158, 11, 0.08) 0%, transparent 40%);
      background-attachment: fixed;
    }

    /* Top Nav */
    header {
      padding: 1.25rem 2.5rem;
      border-bottom: 1px solid var(--card-border);
      background: rgba(10, 13, 20, 0.85);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand-area {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .brand-badge {
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #00f0ff, #3b82f6);
      color: #050811;
      box-shadow: 0 4px 15px rgba(0, 240, 255, 0.3);
    }

    .project-selector {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 4px;
      gap: 4px;
    }

    .proj-btn {
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .proj-btn.active {
      background: #1e293b;
      color: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .live-pulse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      font-size: 0.85rem;
      font-weight: 600;
      color: #34d399;
      font-family: 'JetBrains Mono', monospace;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: liveGlow 1.5s infinite;
    }

    @keyframes liveGlow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .btn-sync {
      padding: 0.55rem 1.1rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }

    .btn-sync:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }

    /* Main Container */
    main {
      max-width: 1550px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    /* Live Status Bar */
    .hero-monitor {
      background: linear-gradient(135deg, rgba(20, 26, 42, 0.9) 0%, rgba(13, 17, 28, 0.85) 100%);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 1.75rem 2.25rem;
      display: grid;
      grid-template-columns: 2fr 1.2fr 1fr;
      gap: 2rem;
      align-items: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }

    .next-release-box h3 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
      font-family: 'JetBrains Mono', monospace;
    }

    .next-release-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .next-release-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .badge-cat {
      background: rgba(0, 240, 255, 0.15);
      color: var(--cyan);
      border: 1px solid rgba(0, 240, 255, 0.3);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .timer-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .timer-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .timer-clock {
      font-size: 1.8rem;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: var(--cyan);
      margin-top: 0.2rem;
      letter-spacing: 1px;
    }

    .metrics-col {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .metric-val {
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
    }

    /* 3D Agents Office Grid */
    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: -1rem;
    }

    .section-title {
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .section-subtitle {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .agents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.75rem;
    }

    .agent-3d-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
      display: flex;
      flex-direction: column;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
    }

    .agent-3d-card:hover {
      transform: translateY(-8px) scale(1.01);
      border-color: var(--card-hover-border);
      box-shadow: 0 25px 50px rgba(0, 240, 255, 0.2);
    }

    .agent-img-wrap {
      position: relative;
      width: 100%;
      padding-top: 100%; /* 1:1 Aspect */
      background: #000;
      overflow: hidden;
    }

    .agent-img-wrap img {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .agent-3d-card:hover .agent-img-wrap img {
      transform: scale(1.06);
    }

    .agent-status-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      backdrop-filter: blur(12px);
      background: rgba(10, 14, 24, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .agent-number {
      position: absolute;
      bottom: 16px;
      left: 16px;
      padding: 0.35rem 0.75rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(10, 14, 24, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      backdrop-filter: blur(12px);
    }

    .agent-card-content {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 1;
    }

    .agent-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .agent-char-name {
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
    }

    .agent-char-title {
      font-size: 0.85rem;
      color: var(--cyan);
      font-weight: 600;
    }

    .agent-char-bio {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .agent-action-footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--cyan);
      font-weight: 600;
    }

    /* Live Queue & Recent Posts Tabs */
    .dashboard-tables {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .table-title {
      font-size: 1.1rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      max-height: 380px;
      overflow-y: auto;
    }

    .queue-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }

    .queue-item:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(0, 240, 255, 0.3);
    }

    .queue-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
    }

    .queue-item-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.35;
    }

    .queue-item-angle {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.35;
      font-style: italic;
    }

    /* Slideover Modal for Notebook */
    .drawer-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      z-index: 1000;
      display: none;
      justify-content: flex-end;
    }

    .drawer-backdrop.open { display: flex; }

    .drawer {
      background: #0d111a;
      border-left: 1px solid var(--card-border);
      width: 100%;
      max-width: 580px;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      box-shadow: -20px 0 60px rgba(0, 0, 0, 0.8);
      animation: drawerSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes drawerSlide {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-hero {
      position: relative;
      width: 100%;
      height: 280px;
      overflow: hidden;
    }

    .drawer-hero img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .drawer-close {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }

    .drawer-content {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .drawer-title-area h2 {
      font-size: 1.6rem;
      font-weight: 800;
    }

    .drawer-title-area p {
      color: var(--cyan);
      font-size: 0.9rem;
      font-weight: 600;
      margin-top: 0.2rem;
    }

    .rule-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .rule-card-title {
      font-size: 0.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cyan);
      font-family: 'JetBrains Mono', monospace;
    }

    .rule-items {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      font-size: 0.9rem;
      color: var(--text);
      line-height: 1.5;
    }

    .rule-items li {
      position: relative;
      padding-left: 1.25rem;
    }

    .rule-items li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--cyan);
      font-size: 1.2rem;
      line-height: 1;
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .code-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: #93c5fd;
    }

    footer {
      padding: 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      border-top: 1px solid var(--card-border);
      font-family: 'JetBrains Mono', monospace;
    }

    @media (max-width: 950px) {
      .hero-monitor { grid-template-columns: 1fr; }
      .dashboard-tables { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <header>
    <div class="brand-area">
      <div class="brand-badge">SISTEMA MULTI-AGENTE 3D</div>
      <div class="project-selector">
        <button class="proj-btn active" id="btnPC" onclick="switchProject('pc')">🇪🇸 Punto Ciego</button>
        <button class="proj-btn" id="btnBG" onclick="switchProject('bg')">🇺🇸 Blindspot Global</button>
      </div>
    </div>
    <div class="header-actions">
      <div class="live-pulse-badge">
        <span class="pulse-dot"></span>
        <span id="cloudStatusText">GITHUB ACTIONS: ACTIVO</span>
      </div>
      <button class="btn-sync" onclick="fetchLiveCloudData()">🔄 Sincronizar en Vivo</button>
    </div>
  </header>

  <main>

    <!-- Real-Time Hero Monitor -->
    <div class="hero-monitor">
      <div class="next-release-box">
        <h3>Próxima Publicación en Cola (En Vivo)</h3>
        <div class="next-release-title" id="nextHeadline">Cargando datos de la redacción...</div>
        <div class="next-release-meta">
          <span class="badge-cat" id="nextCategory">GEOPOLÍTICA</span>
          <span id="nextTimeFormatted">Calculando hora...</span>
        </div>
      </div>

      <div class="timer-box">
        <span class="timer-label">Cuenta Regresiva al Próximo Post</span>
        <div class="timer-clock" id="countdownTimer">--:--:--</div>
      </div>

      <div class="metrics-col">
        <div class="metric-row">
          <span style="color:var(--text-muted)">En cola ahora:</span>
          <span class="metric-val" id="metricQueueCount">-</span>
        </div>
        <div class="metric-row">
          <span style="color:var(--text-muted)">Publicados hoy:</span>
          <span class="metric-val" id="metricPublishedCount">-</span>
        </div>
        <div class="metric-row">
          <span style="color:var(--text-muted)">Cupo diario:</span>
          <span class="metric-val">16 Reels / día</span>
        </div>
      </div>
    </div>

    <!-- 3D Agents Office Showcase -->
    <div class="section-title-row">
      <div>
        <h2 class="section-title">Los 5 Agentes de la Redacción</h2>
        <p class="section-subtitle">Renderizados en 3D estilo figura de colección. Haz clic en cualquiera para abrir su Cuaderno de Reglas y Directrices.</p>
      </div>
    </div>

    <div class="agents-grid">

      <!-- 1. Scout -->
      <div class="agent-3d-card" onclick="openDrawer('scout')">
        <div class="agent-img-wrap">
          <img src="${scout3D}" alt="Scout 3D">
          <div class="agent-number">#01 RADAR</div>
          <div class="agent-status-badge">
            <span class="pulse-dot" style="background:var(--cyan); box-shadow:0 0 8px var(--cyan)"></span>
            <span>ESCANEANDO</span>
          </div>
        </div>
        <div class="agent-card-content">
          <div class="agent-header-row">
            <span class="agent-char-name">Scout</span>
            <span class="agent-char-title">Radar Global</span>
          </div>
          <p class="agent-char-bio">Vigila 95 fuentes globales simultáneas (AP, Reuters, El País, BBC). Mide impacto y filtra repetidos con embeddings de Gemini.</p>
          <div class="agent-action-footer">
            <span>Ver Cuaderno de Lecciones →</span>
          </div>
        </div>
      </div>

      <!-- 2. Directora Elena -->
      <div class="agent-3d-card" onclick="openDrawer('directora')">
        <div class="agent-img-wrap">
          <img src="${directora3D}" alt="Directora Elena 3D">
          <div class="agent-number">#02 DIRECCIÓN</div>
          <div class="agent-status-badge">
            <span class="pulse-dot" style="background:var(--amber); box-shadow:0 0 8px var(--amber)"></span>
            <span>SUPERVISANDO</span>
          </div>
        </div>
        <div class="agent-card-content">
          <div class="agent-header-row">
            <span class="agent-char-name">Directora Elena</span>
            <span class="agent-char-title">Estrategia Editorial</span>
          </div>
          <p class="agent-char-bio">Investiga el trasfondo y extrae el "Punto Ciego" — la verdad que los grandes medios corporativos omiten por intereses.</p>
          <div class="agent-action-footer" style="color:var(--amber)">
            <span>Ver Cuaderno de Lecciones →</span>
          </div>
        </div>
      </div>

      <!-- 3. Ryan -->
      <div class="agent-3d-card" onclick="openDrawer('redactor')">
        <div class="agent-img-wrap">
          <img src="${redactor3D}" alt="Ryan 3D">
          <div class="agent-number">#03 REDACCIÓN</div>
          <div class="agent-status-badge">
            <span class="pulse-dot" style="background:var(--green); box-shadow:0 0 8px var(--green)"></span>
            <span>LISTO</span>
          </div>
        </div>
        <div class="agent-card-content">
          <div class="agent-header-row">
            <span class="agent-char-name">Ryan</span>
            <span class="agent-char-title">Redacción & Copys</span>
          </div>
          <p class="agent-char-bio">Escribe artículos y copys con crudeza periodística. Vetado el lenguaje cliché de IA ("un tapiz", "es crucial destacar").</p>
          <div class="agent-action-footer" style="color:var(--green)">
            <span>Ver Cuaderno de Lecciones →</span>
          </div>
        </div>
      </div>

      <!-- 4. Oscar -->
      <div class="agent-3d-card" onclick="openDrawer('disenador')">
        <div class="agent-img-wrap">
          <img src="${disenador3D}" alt="Oscar 3D">
          <div class="agent-number">#04 DISEÑO</div>
          <div class="agent-status-badge">
            <span class="pulse-dot" style="background:var(--purple); box-shadow:0 0 8px var(--purple)"></span>
            <span>COMPONIENDO</span>
          </div>
        </div>
        <div class="agent-card-content">
          <div class="agent-header-row">
            <span class="agent-char-name">Oscar</span>
            <span class="agent-char-title">Arte & Portadas</span>
          </div>
          <p class="agent-char-bio">Verifica la autenticidad visual de fotos reales y diseña portadas 9:16 e infografías animadas con paletas de color por sección.</p>
          <div class="agent-action-footer" style="color:var(--purple)">
            <span>Ver Cuaderno de Lecciones →</span>
          </div>
        </div>
      </div>

      <!-- 5. Jim -->
      <div class="agent-3d-card" onclick="openDrawer('editor')">
        <div class="agent-img-wrap">
          <img src="${editor3D}" alt="Jim 3D">
          <div class="agent-number">#05 VIDEO</div>
          <div class="agent-status-badge">
            <span class="pulse-dot" style="background:var(--magenta); box-shadow:0 0 8px var(--magenta)"></span>
            <span>AUDIO & RENDER</span>
          </div>
        </div>
        <div class="agent-card-content">
          <div class="agent-header-row">
            <span class="agent-char-name">Jim</span>
            <span class="agent-char-title">Montaje de Reels</span>
          </div>
          <p class="agent-char-bio">Genera la voz neuronal con Edge TTS (+8%), sintetiza música con sidechain a -18dB y compila el video 1080x1920 con FFmpeg.</p>
          <div class="agent-action-footer" style="color:var(--magenta)">
            <span>Ver Cuaderno de Lecciones →</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Live Data Tables (Real-Time Queue & Real-Time Published) -->
    <div class="dashboard-tables">

      <!-- Real-Time Queue Table -->
      <div class="table-card">
        <div class="table-title">
          <span>⏳ Noticias en Cola para Publicar</span>
          <span style="font-size:0.8rem; color:var(--cyan); font-family:'JetBrains Mono',monospace" id="queueBadge">-</span>
        </div>
        <div class="items-list" id="queueItemsList">
          <div style="padding:1rem; text-align:center; color:var(--text-muted)">Cargando cola real...</div>
        </div>
      </div>

      <!-- Real-Time Published Table -->
      <div class="table-card">
        <div class="table-title">
          <span>✅ Últimas Noticias Publicadas Hoy</span>
          <span style="font-size:0.8rem; color:var(--green); font-family:'JetBrains Mono',monospace" id="publishedBadge">-</span>
        </div>
        <div class="items-list" id="publishedItemsList">
          <div style="padding:1rem; text-align:center; color:var(--text-muted)">Cargando publicaciones...</div>
        </div>
      </div>

    </div>

  </main>

  <!-- Slideover Drawer for Notebook -->
  <div class="drawer-backdrop" id="drawerBackdrop" onclick="closeDrawer(event)">
    <div class="drawer" onclick="event.stopPropagation()">
      <div class="drawer-hero">
        <img id="drawerImg" src="" alt="Hero">
        <button class="drawer-close" onclick="closeDrawer()">&times;</button>
      </div>
      <div class="drawer-content">
        <div class="drawer-title-area">
          <h2 id="drawerName">Nombre</h2>
          <p id="drawerRole">Rol</p>
        </div>

        <div class="rule-card">
          <div class="rule-card-title">📖 Cuaderno de Lecciones — Reglas de Oro</div>
          <ul class="rule-items" id="drawerRules"></ul>
        </div>

        <div class="rule-card" style="border-color: rgba(139, 92, 246, 0.3);">
          <div class="rule-card-title" style="color: var(--purple);">⚙️ Archivos de Código & APIs</div>
          <div class="tags-container" id="drawerTools"></div>
        </div>
      </div>
    </div>
  </div>

  <footer>
    REDACCIÓN AUTÓNOMA EN TIEMPO REAL &copy; 2026 — SINCRONIZADA CON GITHUB ACTIONS & META GRAPH API
  </footer>

  <script>
    // Embedded Local Backups
    const localData = {
      pc: ${JSON.stringify(pcQueueLocal)},
      bg: ${JSON.stringify(bgQueueLocal)}
    };

    let currentProject = 'pc';
    let currentQueue = [];
    let nextScheduledDate = null;
    let countdownInterval = null;

    // Agent Notebooks Data
    const notebooks = {
      scout: {
        name: 'Scout',
        role: 'Agente #01 — Radar de Inteligencia Global',
        img: '${scout3D}',
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
        img: '${directora3D}',
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
        name: 'Ryan',
        role: 'Agente #03 — Redacción Periodística & Copys',
        img: '${redactor3D}',
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
        name: 'Oscar',
        role: 'Agente #04 — Identidad Visual & Portadas',
        img: '${disenador3D}',
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
        name: 'Jim',
        role: 'Agente #05 — Montaje de Video & Sonido (Reels)',
        img: '${editor3D}',
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

    function switchProject(p) {
      currentProject = p;
      document.getElementById('btnPC').classList.toggle('active', p === 'pc');
      document.getElementById('btnBG').classList.toggle('active', p === 'bg');
      fetchLiveCloudData();
    }

    async function fetchLiveCloudData() {
      const repo = currentProject === 'pc' ? 'Carxlit/carxlit.github.io' : 'Carxlit/blindspot-global';
      const queueUrl = \`https://raw.githubusercontent.com/\${repo}/main/storage/publication_queue.json?t=\${Date.now()}\`;

      try {
        const res = await fetch(queueUrl);
        if (!res.ok) throw new Error('Network error');
        currentQueue = await res.json();
      } catch (e) {
        console.warn('Usando respaldo local...', e);
        currentQueue = localData[currentProject] || [];
      }

      // Check Actions API status
      checkGithubActions(repo);

      renderDashboard();
    }

    async function checkGithubActions(repo) {
      try {
        const res = await fetch(\`https://api.github.com/repos/\${repo}/actions/runs?per_page=1\`);
        if (res.ok) {
          const data = await res.json();
          const latestRun = data.workflow_runs?.[0];
          if (latestRun && latestRun.status === 'in_progress') {
            document.getElementById('cloudStatusText').innerText = '🔥 REDACCIÓN EN PROCESO (GITHUB ACTIONS CORRIENDO)';
            document.getElementById('cloudStatusText').style.color = 'var(--amber)';
          } else {
            const timeAgo = getTimeAgo(new Date(latestRun?.updated_at || Date.now()));
            document.getElementById('cloudStatusText').innerText = \`GITHUB ACTIONS: AL DÍA (\${timeAgo})\`;
            document.getElementById('cloudStatusText').style.color = '#34d399';
          }
        }
      } catch (e) {}
    }

    function renderDashboard() {
      const queued = currentQueue.filter(i => i.status === 'queued')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
      
      const published = currentQueue.filter(i => i.status === 'published')
        .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

      // Update counters
      document.getElementById('metricQueueCount').innerText = queued.length;
      document.getElementById('metricPublishedCount').innerText = published.length;
      document.getElementById('queueBadge').innerText = \`\${queued.length} PENDIENTES\`;
      document.getElementById('publishedBadge').innerText = \`\${published.length} PUBLICADAS\`;

      // Next Scheduled
      if (queued.length > 0) {
        const next = queued[0];
        document.getElementById('nextHeadline').innerText = next.news?.headline || next.news?.originalTitle || 'Sin titular';
        document.getElementById('nextCategory').innerText = next.news?.category || 'GENERAL';
        nextScheduledDate = new Date(next.scheduledFor);
        document.getElementById('nextTimeFormatted').innerText = 'Hora programada: ' + nextScheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        startCountdown();
      } else {
        document.getElementById('nextHeadline').innerText = 'Cola al día. No hay publicaciones pendientes.';
        document.getElementById('nextCategory').innerText = 'COMPLETO';
        document.getElementById('nextTimeFormatted').innerText = 'Próximo escaneo automático en 15 min';
        document.getElementById('countdownTimer').innerText = '00:00:00';
        if (countdownInterval) clearInterval(countdownInterval);
      }

      // Render Queue list
      const qListEl = document.getElementById('queueItemsList');
      if (queued.length === 0) {
        qListEl.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted)">No hay elementos en espera. El bot añadirá más en el siguiente ciclo.</div>';
      } else {
        qListEl.innerHTML = queued.map(item => {
          const time = new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return \`
            <div class="queue-item">
              <div class="queue-item-header">
                <span style="color:var(--cyan)">\${item.news?.category || 'NOTICIA'}</span>
                <span>📅 \${time}</span>
              </div>
              <div class="queue-item-title">\${item.news?.headline || item.news?.originalTitle}</div>
              <div class="queue-item-angle">\${item.news?.blindSpotAngle ? 'Ángulo: ' + item.news.blindSpotAngle.slice(0, 140) + '...' : ''}</div>
            </div>
          \`;
        }).join('');
      }

      // Render Published list
      const pListEl = document.getElementById('publishedItemsList');
      if (published.length === 0) {
        pListEl.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted)">Sin publicaciones recientes.</div>';
      } else {
        pListEl.innerHTML = published.slice(0, 10).map(item => {
          const time = item.publishedAt ? new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy';
          return \`
            <div class="queue-item">
              <div class="queue-item-header">
                <span style="color:var(--green)">✓ PUBLICADO</span>
                <span>🕒 \${time}</span>
              </div>
              <div class="queue-item-title">\${item.news?.headline || item.news?.originalTitle}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:0.5rem; margin-top:0.2rem">
                <span>Canales: Instagram Reel • Facebook</span>
              </div>
            </div>
          \`;
        }).join('');
      }
    }

    function startCountdown() {
      if (countdownInterval) clearInterval(countdownInterval);

      function update() {
        if (!nextScheduledDate) return;
        const now = new Date().getTime();
        const diff = nextScheduledDate.getTime() - now;

        if (diff <= 0) {
          document.getElementById('countdownTimer').innerText = '00:00:00';
          document.getElementById('countdownTimer').style.color = 'var(--green)';
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (n) => String(n).padStart(2, '0');
        document.getElementById('countdownTimer').innerText = \`\${pad(h)}:\${pad(m)}:\${pad(s)}\`;
      }

      update();
      countdownInterval = setInterval(update, 1000);
    }

    function openDrawer(agentKey) {
      const data = notebooks[agentKey];
      if (!data) return;

      document.getElementById('drawerImg').src = data.img;
      document.getElementById('drawerName').innerText = data.name;
      document.getElementById('drawerRole').innerText = data.role;
      document.getElementById('drawerRules').innerHTML = data.rules.map(r => \`<li>\${r}</li>\`).join('');
      document.getElementById('drawerTools').innerHTML = data.tools.map(t => \`<span class="code-tag">\${t}</span>\`).join('');

      document.getElementById('drawerBackdrop').classList.add('open');
    }

    function closeDrawer() {
      document.getElementById('drawerBackdrop').classList.remove('open');
    }

    function getTimeAgo(date) {
      const sec = Math.floor((new Date() - date) / 1000);
      if (sec < 60) return 'hace segundos';
      const min = Math.floor(sec / 60);
      if (min < 60) return \`hace \${min}m\`;
      const hrs = Math.floor(min / 60);
      return \`hace \${hrs}h\`;
    }

    // Auto-fetch on load & refresh every 30s
    fetchLiveCloudData();
    setInterval(fetchLiveCloudData, 30000);
  </script>
</body>
</html>`;

const outDesktop = 'C:/Users/carlo/Desktop/OFICINA_VIRTUAL_PUNTO_CIEGO.html';
const outPC = 'C:/Users/carlo/Desktop/Nueva carpeta/site/oficina_virtual.html';
const outBG = 'C:/Users/carlo/Desktop/blindspot-global/site/oficina_virtual.html';

fs.writeFileSync(outDesktop, htmlContent, 'utf8');
fs.writeFileSync(outPC, htmlContent, 'utf8');
fs.writeFileSync(outBG, htmlContent, 'utf8');

console.log('Panel 3D en tiempo real compilado exitosamente.');
