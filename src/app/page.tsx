'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Sparkles, 
  Send, 
  RefreshCw, 
  Settings, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Download, 
  Clock, 
  Zap, 
  Globe, 
  Share2, 
  FileText,
  Key,
  X as CloseIcon,
  HelpCircle,
  Calendar,
  Layers,
  Trash2,
  AlertCircle,
  Play,
  ShieldAlert,
  Flame,
  Cpu,
  BarChart2,
  Check,
  Compass,
  ShieldCheck
} from 'lucide-react';
import { RawArticle, ProcessedNews, NewsConfig, QueuedPublication, ChannelSelection, EditorialCategory } from '@/types/news';
import type { DailyEditorialReport } from '@/lib/agents/autonomous-newsroom';

type PlatformTab = 'facebook' | 'telegram' | 'bluesky' | 'linkedIn';

export default function AutoNewsDashboard() {
  const [radarArticles, setRadarArticles] = useState<RawArticle[]>([]);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [isAutonomousRunning, setIsAutonomousRunning] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditScore, setAuditScore] = useState<number | null>(null);

  // Reporte Diario de Autonomía (Cadencia interactiva y balance temático)
  const [dailyReport, setDailyReport] = useState<DailyEditorialReport | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(8);

  const [currentNews, setCurrentNews] = useState<ProcessedNews | null>(null);
  
  // Pestaña de Red Social Activa y Copies Individuales Editables
  const [activePlatformTab, setActivePlatformTab] = useState<PlatformTab>('facebook');
  const [copies, setCopies] = useState<{
    facebook: string;
    telegram: string;
    bluesky: string;
    linkedIn: string;
  }>({
    facebook: '',
    telegram: '',
    bluesky: '',
    linkedIn: '',
  });

  // Toggles de selección de canales (Facebook, Telegram, Bluesky, LinkedIn)
  const [channels, setChannels] = useState<ChannelSelection>({
    facebook: true,
    telegram: true,
    bluesky: true,
    linkedIn: true,
  });

  // Cola de Publicaciones con Jitter
  const [queueItems, setQueueItems] = useState<QueuedPublication[]>([]);
  const [nextEtaMinutes, setNextEtaMinutes] = useState<number | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Historial de Publicados
  const [publishedHistory, setPublishedHistory] = useState<ProcessedNews[]>([]);

  // Configuración de Canales y Marca
  const [config, setConfig] = useState<NewsConfig>({
    autoPilot: false,
    checkIntervalMinutes: 10,
    brandName: 'Punto Ciego',
    badgeText: '',
    badgeColor: '#dc2626',
    selectedCategories: ['GEOPOLÍTICA', 'SEGURIDAD & DEFENSA', 'ECONOMÍA GLOBAL', 'PODER & SOCIEDAD'],
    facebookPageId: '1418440394683304',
    facebookAccessToken: '',
  });

  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [blueskyHandle, setBlueskyHandle] = useState('puntociegoglobal.bsky.social');
  const [blueskyPassword, setBlueskyPassword] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isValidatingFacebook, setIsValidatingFacebook] = useState(false);
  const [facebookValidationStatus, setFacebookValidationStatus] = useState<{
    valid: boolean;
    pageName?: string;
    error?: string;
  } | null>(null);

  const [customTopic, setCustomTopic] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const autoPilotTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRadar();
    loadHistory();
    loadQueue();
    loadDailyReport();
    loadStoredCredentials();

    // Polling ligero para actualizar el visor de cola y reporte diario cada 30 segundos
    const queueInterval = setInterval(() => {
      loadQueue();
      loadDailyReport();
    }, 30000);

    return () => clearInterval(queueInterval);
  }, []);

  const loadStoredCredentials = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.credentials) {
        const c = data.credentials;
        setConfig((prev) => ({
          ...prev,
          facebookPageId: c.facebookPageId || '1418440394683304',
          facebookAccessToken: c.facebookAccessToken || '',
          brandName: c.brandName || 'Punto Ciego',
        }));
        if (c.telegramToken) setTelegramToken(c.telegramToken);
        if (c.telegramChatId) setTelegramChatId(c.telegramChatId);
        if (c.blueskyHandle) setBlueskyHandle(c.blueskyHandle);
        if (c.blueskyPassword) setBlueskyPassword(c.blueskyPassword);
      }
    } catch (err) {
      console.error('Error al cargar credenciales del servidor:', err);
    }
  };

  const handleValidateFacebookToken = async () => {
    const token = config.facebookAccessToken?.trim();
    if (!token) {
      setFacebookValidationStatus({ valid: false, error: 'Por favor pega un token de Facebook primero.' });
      return;
    }

    setIsValidatingFacebook(true);
    setFacebookValidationStatus(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_facebook',
          credentials: {
            facebookAccessToken: token,
            facebookPageId: config.facebookPageId || '1418440394683304',
          },
        }),
      });

      const data = await res.json();
      if (data.validation) {
        setFacebookValidationStatus({
          valid: data.validation.valid,
          pageName: data.validation.pageName,
          error: data.validation.error,
        });

        // Si se resolvió un Page Token a partir de un User Token, actualizar estado
        if (data.validation.resolvedToken && data.validation.resolvedToken !== token) {
          setConfig((prev) => ({ ...prev, facebookAccessToken: data.validation.resolvedToken }));
        }
      } else {
        setFacebookValidationStatus({ valid: false, error: data.error || 'Fallo de validación' });
      }
    } catch (err: any) {
      setFacebookValidationStatus({ valid: false, error: err.message || 'Error de conexión' });
    } finally {
      setIsValidatingFacebook(false);
    }
  };

  const saveSettings = async () => {
    try {
      setStatusMessage({ type: 'info', text: 'Validando y guardando credenciales en el servidor...' });
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: {
            facebookPageId: config.facebookPageId,
            facebookAccessToken: config.facebookAccessToken,
            telegramToken,
            telegramChatId,
            blueskyHandle,
            blueskyPassword,
            brandName: config.brandName,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.credentials?.facebookAccessToken) {
          setConfig((prev) => ({ ...prev, facebookAccessToken: data.credentials.facebookAccessToken }));
        }
        setIsSettingsOpen(false);
        setStatusMessage({
          type: 'success',
          text: '✅ Credenciales y Token de Facebook validados y guardados exitosamente en el servidor.',
        });
        loadQueue();
      } else {
        setStatusMessage({
          type: 'error',
          text: `❌ Error de Facebook: ${data.error || 'Token inválido'}. Verifica el token en Ajustes.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Error al comunicarse con el servidor para guardar ajustes.' });
    }
  };

  useEffect(() => {
    if (config.autoPilot) {
      setStatusMessage({ 
        type: 'info', 
        text: `Piloto Multi-Agente 24/7 activo con Anti-Spam Jitter (45-75 min). Monitoreando cada ${config.checkIntervalMinutes} min...` 
      });

      runAutoPilotCycle();

      autoPilotTimerRef.current = setInterval(() => {
        runAutoPilotCycle();
      }, config.checkIntervalMinutes * 60 * 1000);
    } else {
      if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
    }

    return () => {
      if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
    };
  }, [config.autoPilot, config.checkIntervalMinutes]);

  const loadRadar = async () => {
    setIsLoadingRadar(true);
    try {
      const res = await fetch('/api/news/radar');
      const data = await res.json();
      if (data.articles) {
        setRadarArticles(data.articles);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingRadar(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/news/publish');
      const data = await res.json();
      if (data.history) {
        setPublishedHistory(data.history);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const res = await fetch('/api/news/queue');
      const data = await res.json();
      if (data.queue) {
        setQueueItems(data.queue);
        setNextEtaMinutes(data.nextEtaMinutes);
      }
    } catch (err) {
      console.error('Error al cargar cola:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const loadDailyReport = async () => {
    try {
      const res = await fetch('/api/news/autonomous');
      const data = await res.json();
      if (data.report) {
        setDailyReport(data.report);
      }
      if (data.config?.maxDailyPosts) {
        setDailyLimit(data.config.maxDailyPosts);
      } else if (data.report?.maxDailyPosts) {
        setDailyLimit(data.report.maxDailyPosts);
      }
    } catch (err) {
      console.error('Error al cargar reporte editorial diario:', err);
    }
  };

  const handleUpdateCadence = async (newLimit: number) => {
    try {
      setStatusMessage({ type: 'info', text: `Ajustando cadencia del motor autónomo a ${newLimit} publicaciones diarias...` });
      const res = await fetch('/api/news/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          config: { maxDailyPosts: newLimit },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDailyLimit(newLimit);
        if (data.report) setDailyReport(data.report);
        setStatusMessage({ type: 'success', text: `Cadencia autónoma actualizada: ${newLimit} publicaciones al día.` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error al cambiar cadencia autónoma.' });
    }
  };

  // Disparar ciclo del Newsroom Autónomo bajo demanda
  const handleTriggerAutonomousCycle = async () => {
    setIsAutonomousRunning(true);
    setStatusMessage({
      type: 'info',
      text: 'Newsroom Autónomo investigando en vivo: analizando Tecnología & IA, Geopolítica, Economía y Seguridad...',
    });

    try {
      const res = await fetch('/api/news/autonomous', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || 'Ciclo autónomo completado con éxito.',
        });
        loadDailyReport();
        loadQueue();
        loadRadar();
        loadHistory();

        if (data.news) {
          const n: ProcessedNews = data.news;
          setCurrentNews(n);
          setCopies({
            facebook: n.facebookPost || n.copies?.facebook || '',
            telegram: n.telegramPost || n.copies?.telegram || '',
            bluesky: n.blueskyPost || n.copies?.bluesky || '',
            linkedIn: n.linkedInPost || n.copies?.linkedIn || '',
          });
        }
      } else {
        throw new Error(data.error || 'Error al ejecutar ciclo autónomo');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error en el Newsroom Autónomo' });
    } finally {
      setIsAutonomousRunning(false);
    }
  };

  const handleRunAuditAndHeal = async () => {
    setIsAuditing(true);
    setStatusMessage({ type: 'info', text: 'Agente Auditor en marcha: diagnosticando salud de canales y sanando fallos...' });
    try {
      const res = await fetch('/api/news/audit', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.report) {
        setAuditScore(data.report.overallHealthScore);
        const actionsText = data.report.healingActions?.length > 0 
          ? ` (${data.report.healingActions.length} auto-reparaciones aplicadas)` 
          : '';
        setStatusMessage({
          type: 'success',
          text: `Auditoría OK: Salud ${data.report.overallHealthScore}/100${actionsText}. Canales en línea.`
        });
        loadQueue();
        loadHistory();
      } else {
        throw new Error(data.error || 'Fallo en auditoría');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error en auditoría' });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleProcessArticle = async (article: RawArticle) => {
    setIsProcessing(true);
    setStatusMessage({ 
      type: 'info', 
      text: `Pipeline Multi-Agente activado: Director Editorial, Redactor Omnicanal y Card Studio procesando "${article.title.slice(0, 45)}..."` 
    });

    try {
      const res = await fetch('/api/news/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, config }),
      });
      const data = await res.json();

      if (data.news) {
        const n: ProcessedNews = data.news;
        setCurrentNews(n);
        setCopies({
          facebook: n.facebookPost || n.copies?.facebook || '',
          telegram: n.telegramPost || n.copies?.telegram || '',
          bluesky: n.blueskyPost || n.copies?.bluesky || '',
          linkedIn: n.linkedInPost || n.copies?.linkedIn || '',
        });
        setStatusMessage({ 
          type: 'success', 
          text: `Noticia estructurada con éxito bajo el ángulo: "${n.blindSpotAngle?.slice(0, 70)}..."` 
        });
      } else {
        throw new Error(data.error || 'Error al procesar la noticia en el pipeline');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error en el procesamiento multi-agente.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessCustomTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;

    const pseudoArticle: RawArticle = {
      id: Math.random().toString(36).substring(2, 9),
      title: customTopic.trim(),
      link: '',
      pubDate: new Date().toISOString(),
      contentSnippet: customTopic.trim(),
      sourceName: 'Redacción Punto Ciego',
      category: 'GEOPOLÍTICA',
    };

    await handleProcessArticle(pseudoArticle);
    setCustomTopic('');
  };

  // 1. Publicar Inmediatamente
  const handlePublishImmediate = async () => {
    if (!currentNews) return;

    setIsPublishing(true);
    setStatusMessage({ type: 'info', text: 'Despachando publicación inmediata a los canales activados...' });

    try {
      const res = await fetch('/api/news/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          news: currentNews,
          channels,
          customCopies: copies,
          pageId: config.facebookPageId,
          accessToken: config.facebookAccessToken,
          telegramToken,
          telegramChatId,
          blueskyHandle,
          blueskyPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const successes: string[] = [];
        if (data.telegram?.success) successes.push('Telegram ✅');
        if (data.bluesky?.success) successes.push('Bluesky ✅');
        if (data.linkedIn?.success) successes.push('LinkedIn ✅');
        if (data.postId || (!data.simulated && channels.facebook)) successes.push('Facebook ✅');

        const modeText = data.simulated 
          ? 'Guardado en Borradores (Modo Simulación: configura tu Token en Ajustes para publicar en vivo)' 
          : `¡Publicación enviada exitosamente! [${successes.join(' | ')}]`;
        
        setStatusMessage({ type: 'success', text: modeText });
        loadHistory();
        loadQueue();
      } else {
        const errorText = data.error || 'No se pudo publicar';
        if (errorText.includes('Session has expired')) {
          setStatusMessage({ 
            type: 'error', 
            text: '❌ El Token de Facebook ha expirado (01-Nov 07:00 PST). Renueva el token en "Canales & APIs".' 
          });
        } else {
          setStatusMessage({ type: 'error', text: `Error de publicación: ${errorText}` });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error de publicación.' });
    } finally {
      setIsPublishing(false);
    }
  };

  // 2. Encolar con Anti-Spam Jitter (45 a 75 min)
  const handleEnqueueWithJitter = async () => {
    if (!currentNews) return;

    setIsEnqueuing(true);
    try {
      const res = await fetch('/api/news/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enqueue',
          news: currentNews,
          channels,
          customCopies: copies,
          options: { minJitterMinutes: 45, maxJitterMinutes: 75 },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ 
          type: 'success', 
          text: `Agregado a la cola con Anti-Spam Jitter. Salida programada para: ${new Date(data.queuedItem.scheduledFor).toLocaleTimeString()}` 
        });
        loadQueue();
      } else {
        throw new Error(data.error || 'No se pudo encolar la noticia');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al encolar.' });
    } finally {
      setIsEnqueuing(false);
    }
  };

  // Acciones sobre elementos de la cola
  const handleForcePublishQueueItem = async (id: string) => {
    try {
      setStatusMessage({ type: 'info', text: 'Forzando despacho inmediato del elemento en cola...' });
      const res = await fetch('/api/news/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_publish',
          id,
          credentials: {
            facebookPageId: config.facebookPageId,
            facebookAccessToken: config.facebookAccessToken,
            telegramBotToken: telegramToken,
            telegramChatId,
            blueskyHandle,
            blueskyPassword,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        const item = data.item;
        const fb = item.results?.facebook;
        const tg = item.results?.telegram;
        const bsky = item.results?.bluesky;
        const li = item.results?.linkedIn;

        const successes: string[] = [];
        const errors: string[] = [];

        if (tg?.success) successes.push('Telegram ✅');
        if (bsky?.success) successes.push('Bluesky ✅');
        if (li?.success) successes.push('LinkedIn ✅');
        if (fb?.success) successes.push('Facebook ✅');

        if (fb && !fb.success) {
          if (fb.error?.includes('Session has expired')) {
            errors.push('Facebook ❌ Token expirado hoy a las 07:00 PST');
          } else {
            errors.push('Facebook ❌');
          }
        }
        if (li && !li.success) {
          errors.push('LinkedIn ❌');
        }

        if (errors.length > 0) {
          setStatusMessage({ 
            type: successes.length > 0 ? 'info' : 'error', 
            text: `Despacho: ${successes.join(' | ')}${successes.length > 0 ? ' — ' : ''}${errors.join(' | ')}. ${errors.some(e => e.includes('Facebook')) ? 'Renueva tu token de Facebook en Canales & APIs.' : ''}`
          });
        } else {
          setStatusMessage({ type: 'success', text: `¡Publicado exitosamente en: ${successes.join(', ')}!` });
        }
        loadQueue();
        loadHistory();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Error al forzar publicación.' });
    }
  };

  const handleCancelQueueItem = async (id: string) => {
    try {
      const res = await fetch(`/api/news/queue?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'info', text: 'Elemento cancelado de la cola.' });
        loadQueue();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Error al cancelar elemento.' });
    }
  };

  const runAutoPilotCycle = async () => {
    try {
      const res = await fetch('/api/news/auto-pilot', { method: 'POST' });
      const data = await res.json();
      loadDailyReport();
      loadHistory();
      loadRadar();
      loadQueue();
      if (data.news) {
        setCurrentNews(data.news);
        setCopies({
          facebook: data.news.facebookPost || '',
          telegram: data.news.telegramPost || '',
          bluesky: data.news.blueskyPost || '',
          linkedIn: data.news.linkedInPost || '',
        });
      }
    } catch (err) {
      console.error('Error en ciclo auto-pilot:', err);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      
      {/* 1. BARRA SUPERIOR DE CONTROL */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white uppercase font-sans">
                  Punto Ciego
                </h1>
                <span className="text-[10px] font-mono font-bold bg-red-950 text-red-400 border border-red-800/80 px-2 py-0.5 rounded-full tracking-wider">
                  PIPELINE MULTI-AGENTE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Periodismo geopolítico, ángulo crítico desclasificado y distribución omnicanal con Anti-Spam Jitter.
              </p>
            </div>
          </div>

          {/* Toggle de Piloto Automático y Botón de Ajustes */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl transition-colors border border-slate-700 shadow-sm"
            >
              <Settings className="h-4 w-4 text-slate-300" />
              Canales & APIs
            </button>

            <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 px-4 py-1.5 rounded-xl">
              <div className="text-right">
                <div className="text-xs font-bold text-white uppercase flex items-center gap-1.5 justify-end">
                  <Flame className={`h-3.5 w-3.5 ${config.autoPilot ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                  Piloto 24/7
                </div>
                <div className="text-[10px] text-slate-400">
                  {config.autoPilot ? 'Jitter Activo' : 'Manual'}
                </div>
              </div>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, autoPilot: !prev.autoPilot }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoPilot ? 'bg-red-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoPilot ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* AVISO CRÍTICO: TOKEN DE FACEBOOK EXPIRADO */}
      {queueItems.some(i => i.results?.facebook?.error?.includes('Session has expired') || i.error?.includes('Session has expired')) && (
        <div className="bg-amber-950/90 border-b border-amber-600/70 px-6 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <b>Aviso de Facebook:</b> Tu token de sesión expiró hoy domingo a las 07:00 PST. <b>Telegram y Bluesky están publicando con éxito</b>. Para reactivar Facebook, genera un nuevo token en Graph API Explorer y pégalo en &quot;Canales &amp; APIs&quot;.
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-[11px] transition-colors"
          >
            Actualizar Token de Facebook
          </button>
        </div>
      )}

      {/* 2. MENSAJE DE ESTADO FLOTANTE */}
      {statusMessage && (
        <div className={`px-6 py-2.5 text-xs font-medium text-center border-b transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800' 
            : statusMessage.type === 'error'
            ? 'bg-red-950/90 text-red-300 border-red-800'
            : 'bg-blue-950/90 text-blue-300 border-blue-800'
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* 3. CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto w-full p-6 flex flex-col gap-6 flex-1">
        
        {/* BANNER CENTRAL: NEWSROOM AUTÓNOMO */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-red-950/30 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex-1 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[10px] font-mono font-bold uppercase bg-red-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Cpu className="h-3 w-3" />
                Motor Autónomo 24/7
              </span>
              <span className="text-xs font-bold text-white tracking-wide uppercase font-sans">
                Redacción Autónoma Multitemática
              </span>
              {dailyReport && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  dailyReport.quotaReached 
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800' 
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                }`}>
                  {dailyReport.quotaReached 
                    ? `Cupo de hoy cubierto (${dailyReport.totalToday}/${dailyReport.maxDailyPosts})` 
                    : `${dailyReport.totalToday} de ${dailyReport.maxDailyPosts} publicaciones hoy`}
                </span>
              )}
              {/* Badge de Protocolo de Urgencia Máxima */}
              <span className="text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-rose-400" />
                Protocolo Urgencia Máxima: ACTIVO (≥90% salta límite y jitter)
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              Investiga automáticamente tendencias globales en vivo y rota entre <b>Tecnología &amp; IA</b>, <b>Geopolítica</b>, <b>Economía Global</b> y <b>Defensa</b> espaciadas orgánicamente con Anti-Spam Jitter.
            </p>

            {/* Selector de Cadencia Interactiva y Pilares temáticos */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">Cadencia:</span>
                {[4, 8, 12].map((limit) => (
                  <button
                    key={limit}
                    onClick={() => handleUpdateCadence(limit)}
                    className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded transition-all ${
                      (dailyReport?.maxDailyPosts || dailyLimit) === limit
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {limit} posts/día
                  </button>
                ))}
              </div>
              {[
                { key: 'TECNOLOGÍA & IA' as EditorialCategory, label: 'Tecnología & IA' },
                { key: 'GEOPOLÍTICA' as EditorialCategory, label: 'Geopolítica' },
                { key: 'ECONOMÍA GLOBAL' as EditorialCategory, label: 'Economía' },
                { key: 'SEGURIDAD & DEFENSA' as EditorialCategory, label: 'Defensa' },
                { key: 'PODER & SOCIEDAD' as EditorialCategory, label: 'Sociedad' },
              ].map((item) => {
                const count = dailyReport?.categoryDistribution ? dailyReport.categoryDistribution[item.key] || 0 : 0;
                return (
                  <div
                    key={item.key}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                      count > 0 
                        ? 'bg-slate-800 border-slate-600 text-white' 
                        : 'bg-slate-950/70 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      count > 0 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón de Disparo Autónomo */}
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={handleTriggerAutonomousCycle}
              disabled={isAutonomousRunning}
              className="w-full md:w-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-black text-xs uppercase px-5 py-3.5 rounded-xl transition-all shadow-xl shadow-red-600/30 flex items-center justify-center gap-2"
            >
              <Zap className={`h-4 w-4 ${isAutonomousRunning ? 'animate-spin' : ''}`} />
              {isAutonomousRunning ? 'Investigando y Produciendo...' : 'Ejecutar Ciclo Autónomo Ahora'}
            </button>
          </div>
        </section>

        {/* CONTENEDOR EN 2 COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* =========================================================================
            COLUMNA IZQUIERDA (5 COLS): RADAR DE NOTICIAS + VISOR DE COLA PERSISTENTE
           ========================================================================= */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Tarjeta de Entrada Manual / Link */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-red-400" />
              Noticia Inmediata / Enlace Web
            </h2>
            <form onSubmit={handleProcessCustomTopic} className="flex gap-2">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Ej: Cumbre de seguridad, aranceles, estrecho de Taiwán..."
                className="flex-1 bg-slate-950 border border-slate-800 text-sm rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isProcessing || !customTopic.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20 whitespace-nowrap"
              >
                Analizar
              </button>
            </form>
          </div>

          {/* Agente 1: Radar en Vivo con Deduplicación Semántica */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-red-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Agente 1: Scout Internacional (Reuters / AP / BBC)
                </h2>
              </div>
              <button
                onClick={loadRadar}
                disabled={isLoadingRadar}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingRadar ? 'animate-spin text-red-400' : ''}`} />
                Actualizar
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
              {radarArticles.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  {isLoadingRadar ? 'Scout analizando feeds...' : 'No hay noticias pendientes en el radar.'}
                </div>
              ) : (
                radarArticles.map((article) => (
                  <div
                    key={article.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-950 transition-all group flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {article.sourceName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-900">
                            URG: {article.urgencyScore || 85}%
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(article.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-xs font-bold text-slate-100 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-xs">
                      {article.link ? (
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          Fuente original <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span />}
                      <button
                        onClick={() => handleProcessArticle(article)}
                        disabled={isProcessing}
                        className="bg-slate-800 hover:bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow"
                      >
                        <Zap className="h-3 w-3" />
                        Ejecutar Pipeline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Agente 5: Visor de Cola de Publicaciones con Anti-Spam Jitter */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Agente 5: Gestor de Cola (Jitter 45-75m)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {nextEtaMinutes !== null && (
                  <span className="text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Próxima: {nextEtaMinutes}m
                  </span>
                )}
                <button
                  onClick={handleRunAuditAndHeal}
                  disabled={isAuditing}
                  title="Auditar canales y auto-reparar fallos en cola"
                  className="text-[11px] bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors shadow"
                >
                  <ShieldCheck className={`h-3 w-3 ${isAuditing ? 'animate-spin' : ''}`} />
                  {isAuditing ? 'Sanando...' : 'Auto-Sanar'}
                </button>
                <button
                  onClick={loadQueue}
                  disabled={isLoadingQueue}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingQueue ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {queueItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No hay publicaciones encoladas. El jitter espaciará tus envíos automáticamente.
                </div>
              ) : (
                queueItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        item.status === 'queued' 
                          ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                          : item.status === 'published'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-red-950 text-red-300 border border-red-800'
                      }`}>
                        {item.status === 'queued' ? 'EN ESPERA (JITTER)' : item.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">
                      {item.news.headline || item.news.originalTitle}
                    </h4>

                    {/* Redes destino con estado visual individual */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.channels.facebook && (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] flex items-center gap-1 ${
                            item.results?.facebook?.success 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : item.results?.facebook?.error 
                              ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                              : 'bg-blue-900/60 text-blue-300'
                          }`}>
                            FB {item.results?.facebook?.success ? '✅' : item.results?.facebook?.error ? '❌ Expirado' : ''}
                          </span>
                        )}
                        {item.channels.telegram && (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] flex items-center gap-1 ${
                            item.results?.telegram?.success 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : 'bg-sky-900/60 text-sky-300'
                          }`}>
                            TG {item.results?.telegram?.success ? '✅' : ''}
                          </span>
                        )}
                        {item.channels.bluesky && (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold flex items-center gap-1 ${
                            item.results?.bluesky?.success 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : 'bg-cyan-900/60 text-cyan-300'
                          }`}>
                            BSKY {item.results?.bluesky?.success ? '✅' : ''}
                          </span>
                        )}
                        {item.channels.linkedIn && (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] flex items-center gap-1 ${
                            item.results?.linkedIn?.success 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : item.results?.linkedIn?.error 
                              ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                              : 'bg-indigo-950 text-indigo-200'
                          }`}>
                            LI {item.results?.linkedIn?.success ? '✅' : item.results?.linkedIn?.error ? '❌' : ''}
                          </span>
                        )}
                      </div>

                      {item.status === 'queued' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleForcePublishQueueItem(item.id)}
                            title="Publicar ahora sin esperar el jitter"
                            className="text-amber-400 hover:text-amber-300 p-1 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleCancelQueueItem(item.id)}
                            title="Cancelar y eliminar de la cola"
                            className="text-slate-400 hover:text-red-400 p-1 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {item.error && item.status === 'queued' && (
                      <div className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-900/60 px-2 py-1 rounded">
                        ⚠️ {item.error.includes('Session has expired') ? 'Facebook: Token de sesión expirado. Telegram y Bluesky ya emitidos.' : item.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* =========================================================================
            COLUMNA DERECHA (7 COLS): ESTUDIO EDITORIAL OMNICANAL Y CARD STUDIO
           ========================================================================= */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6 flex-1">
            
            {/* Cabecera del Estudio */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Estudio de Producción Editorial & Omnicanal
                </h2>
              </div>
              {currentNews && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-red-400 bg-red-950/80 border border-red-800 px-2 py-0.5 rounded">
                    {currentNews.category}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                    URGENCIA {currentNews.urgencyScore}%
                  </span>
                </div>
              )}
            </div>

            {currentNews ? (
              <div className="flex flex-col gap-6">
                
                {/* 1. Vista Previa de la Portada Dividida (Foto 100% visible + Texto abajo) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Agente 4: Portada Split-Screen (Playwright & Newsreader)
                    </span>
                    {currentNews.cardImageUrl && (
                      <a
                        href={currentNews.cardImageUrl}
                        download={`portada-${currentNews.id}.jpg`}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                      >
                        <Download className="h-3.5 w-3.5" /> Descargar HD
                      </a>
                    )}
                  </div>

                  <div className="relative aspect-[16/9.3] rounded-xl overflow-hidden border-2 border-slate-700 bg-black shadow-2xl">
                    {currentNews.cardImageUrl ? (
                      <img
                        src={currentNews.cardImageUrl}
                        alt={currentNews.headline}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                        Generando portada split-screen en Playwright...
                      </div>
                    )}
                  </div>

                  {/* Resumen del "Punto Ciego" detectado por el Agente 2 */}
                  {currentNews.blindSpotAngle && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-red-950/80 flex items-start gap-2.5">
                      <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-bold uppercase text-red-400 tracking-wider">
                          El "Punto Ciego" Identificado
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                          {currentNews.blindSpotAngle}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Interruptores de Canales Activos */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                    Redes Activas para este Envío:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    
                    {/* Toggle Facebook */}
                    <button
                      type="button"
                      onClick={() => setChannels((prev) => ({ ...prev, facebook: !prev.facebook }))}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        channels.facebook 
                          ? 'bg-blue-950/80 border-blue-600 text-blue-200' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Facebook</span>
                      <span className={`h-2 w-2 rounded-full ${channels.facebook ? 'bg-blue-400' : 'bg-slate-600'}`} />
                    </button>

                    {/* Toggle Telegram */}
                    <button
                      type="button"
                      onClick={() => setChannels((prev) => ({ ...prev, telegram: !prev.telegram }))}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        channels.telegram 
                          ? 'bg-sky-950/80 border-sky-500 text-sky-200' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Telegram</span>
                      <span className={`h-2 w-2 rounded-full ${channels.telegram ? 'bg-sky-400' : 'bg-slate-600'}`} />
                    </button>

                    {/* Toggle Bluesky */}
                    <button
                      type="button"
                      onClick={() => setChannels((prev) => ({ ...prev, bluesky: !prev.bluesky }))}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        channels.bluesky 
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Bluesky</span>
                      <span className={`h-2 w-2 rounded-full ${channels.bluesky ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                    </button>

                    {/* Toggle LinkedIn */}
                    <button
                      type="button"
                      onClick={() => setChannels((prev) => ({ ...prev, linkedIn: !prev.linkedIn }))}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold transition-all ${
                        channels.linkedIn 
                          ? 'bg-indigo-950/80 border-indigo-600 text-indigo-200' 
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>LinkedIn</span>
                      <span className={`h-2 w-2 rounded-full ${channels.linkedIn ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                    </button>
                  </div>
                </div>

                {/* 3. Agente 3: Pestañas de Redactor Omnicanal Especializado */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Agente 3: Redacción Adaptada con Personalidad Propia
                    </span>
                    <button
                      onClick={() => handleCopyText(
                        activePlatformTab === 'facebook' ? copies.facebook :
                        activePlatformTab === 'telegram' ? copies.telegram :
                        activePlatformTab === 'bluesky' ? copies.bluesky :
                        copies.linkedIn
                      )}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? '¡Copiado!' : 'Copiar Texto de Pestaña'}
                    </button>
                  </div>

                  {/* Tabs de Selección */}
                  <div className="flex border-b border-slate-800 gap-1 pt-1 overflow-x-auto">
                    <button
                      onClick={() => setActivePlatformTab('facebook')}
                      className={`px-3.5 py-2 text-xs font-bold uppercase whitespace-nowrap transition-all border-b-2 ${
                        activePlatformTab === 'facebook'
                          ? 'border-red-500 text-white bg-slate-800/40'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Facebook (Debate & Análisis)
                    </button>
                    <button
                      onClick={() => setActivePlatformTab('telegram')}
                      className={`px-3.5 py-2 text-xs font-bold uppercase whitespace-nowrap transition-all border-b-2 ${
                        activePlatformTab === 'telegram'
                          ? 'border-red-500 text-white bg-slate-800/40'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Telegram (Briefing HTML)
                    </button>
                    <button
                      onClick={() => setActivePlatformTab('bluesky')}
                      className={`px-3.5 py-2 text-xs font-bold uppercase whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5 ${
                        activePlatformTab === 'bluesky'
                          ? 'border-cyan-400 text-cyan-200 bg-cyan-950/30'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Bluesky</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {copies.bluesky.length}/300
                      </span>
                    </button>
                    <button
                      onClick={() => setActivePlatformTab('linkedIn')}
                      className={`px-3.5 py-2 text-xs font-bold uppercase whitespace-nowrap transition-all border-b-2 ${
                        activePlatformTab === 'linkedIn'
                          ? 'border-red-500 text-white bg-slate-800/40'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      LinkedIn (Estratégico)
                    </button>
                  </div>

                  {/* Editor Activo según la pestaña */}
                  <div className="relative mt-2">
                    {activePlatformTab === 'facebook' && (
                      <textarea
                        value={copies.facebook}
                        onChange={(e) => setCopies((prev) => ({ ...prev, facebook: e.target.value }))}
                        rows={7}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 font-sans focus:outline-none focus:border-red-500 transition-colors resize-y leading-relaxed"
                        placeholder="Copy para Facebook con pregunta de debate..."
                      />
                    )}
                    {activePlatformTab === 'telegram' && (
                      <textarea
                        value={copies.telegram}
                        onChange={(e) => setCopies((prev) => ({ ...prev, telegram: e.target.value }))}
                        rows={7}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 font-mono text-xs focus:outline-none focus:border-red-500 transition-colors resize-y leading-relaxed"
                        placeholder="Briefing ejecutivo en formato HTML para Telegram..."
                      />
                    )}
                    {activePlatformTab === 'bluesky' && (
                      <div className="relative">
                        <textarea
                          value={copies.bluesky}
                          onChange={(e) => setCopies((prev) => ({ ...prev, bluesky: e.target.value }))}
                          rows={6}
                          maxLength={300}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 font-sans focus:outline-none focus:border-cyan-500 transition-colors resize-y leading-relaxed"
                          placeholder="Post conciso de alto impacto para Bluesky (<300 caracteres)..."
                        />
                        <div className={`absolute bottom-3 right-3 text-[11px] font-mono px-2 py-0.5 rounded ${
                          copies.bluesky.length > 280 ? 'text-rose-400 bg-rose-950/80 border border-rose-800' : 'text-slate-400 bg-slate-900 border border-slate-800'
                        }`}>
                          {copies.bluesky.length}/300 caracteres
                        </div>
                      </div>
                    )}
                    {activePlatformTab === 'linkedIn' && (
                      <textarea
                        value={copies.linkedIn}
                        onChange={(e) => setCopies((prev) => ({ ...prev, linkedIn: e.target.value }))}
                        rows={7}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 font-sans focus:outline-none focus:border-red-500 transition-colors resize-y leading-relaxed"
                        placeholder="Análisis macroeconómico y estratégico para LinkedIn..."
                      />
                    )}
                  </div>
                </div>

                {/* 4. Botones de Acción de Despacho */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleEnqueueWithJitter}
                    disabled={isEnqueuing || isPublishing}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-white font-bold text-xs uppercase py-3.5 px-5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-amber-400" />
                    {isEnqueuing ? 'Calculando Jitter...' : 'Encolar con Jitter (45-75 min)'}
                  </button>

                  <button
                    onClick={handlePublishImmediate}
                    disabled={isPublishing || isEnqueuing}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xs uppercase py-3.5 px-6 rounded-xl transition-all shadow-xl shadow-red-600/30 flex items-center justify-center gap-2"
                  >
                    <Send className={`h-4 w-4 ${isPublishing ? 'animate-bounce' : ''}`} />
                    {isPublishing ? 'Publicando...' : 'Publicar Ahora en Redes Activas'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <div className="h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 mb-4 border border-slate-800">
                  <Share2 className="h-7 w-7 text-red-500/60" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Estudio Listo para la Próxima Noticia
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-5">
                  Selecciona una noticia del Radar internacional o ingresa un tema manual para ejecutar los 5 agentes.
                </p>
                {radarArticles.length > 0 && (
                  <button
                    onClick={() => handleProcessArticle(radarArticles[0])}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl transition-colors border border-slate-700"
                  >
                    Procesar la Noticia Más Relevante
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
        </div>
      </main>

      {/* 4. MODAL DE CONFIGURACIÓN DE APIS Y CANALES (FACEBOOK, TELEGRAM, BLUESKY, LINKEDIN) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase">Canales, APIs & Parámetros Editoriales</h3>
                <p className="text-xs text-slate-400">Credenciales de Meta Graph API, Telegram Bot y reglas de distribución.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Sección Facebook */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Página de Facebook (Meta Graph API)
                  </h4>
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Graph API Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Guía rápida para evitar errores de token de usuario vs página */}
                <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/60 text-[11px] text-blue-200 leading-relaxed">
                  <p className="font-bold text-white mb-1">💡 ¿Cómo generar el token correcto en Meta?</p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-slate-300">
                    <li>En Graph API Explorer, en el desplegable <b>&quot;User or Page&quot;</b>, selecciona <b>Punto Ciego</b> (Token de Página, no de usuario).</li>
                    <li>Permisos requeridos: <code className="bg-slate-900 px-1 py-0.2 rounded text-blue-300 font-mono">pages_manage_posts</code>, <code className="bg-slate-900 px-1 py-0.2 rounded text-blue-300 font-mono">pages_read_engagement</code>.</li>
                    <li>Copia el token y pulsa <b>Probar Token en Vivo</b>. <i>(Si pegas un Token de Usuario administrador, intentaremos convertirlo a Token de Página automáticamente).</i></li>
                  </ol>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Facebook Page ID (ID de la Página)</label>
                  <input
                    type="text"
                    value={config.facebookPageId || '1418440394683304'}
                    onChange={(e) => setConfig((prev) => ({ ...prev, facebookPageId: e.target.value }))}
                    placeholder="1418440394683304"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Page Access Token</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={config.facebookAccessToken || ''}
                      onChange={(e) => {
                        setConfig((prev) => ({ ...prev, facebookAccessToken: e.target.value }));
                        setFacebookValidationStatus(null);
                      }}
                      placeholder="EAAG... o EAA..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleValidateFacebookToken}
                      disabled={isValidatingFacebook || !config.facebookAccessToken}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shadow flex items-center gap-1.5"
                    >
                      <Zap className={`h-3.5 w-3.5 ${isValidatingFacebook ? 'animate-spin' : ''}`} />
                      {isValidatingFacebook ? 'Verificando...' : 'Probar Token'}
                    </button>
                  </div>

                  {/* Estado de validación en vivo */}
                  {facebookValidationStatus && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs border transition-all ${
                      facebookValidationStatus.valid
                        ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                        : 'bg-rose-950/90 border-rose-600 text-rose-200'
                    }`}>
                      {facebookValidationStatus.valid ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span><b>¡Token verificado con éxito!</b> Conectado con la página <b>{facebookValidationStatus.pageName}</b>. Pulsa &quot;Guardar Parámetros&quot; para activarlo.</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-300">Error devuelto por Meta:</span>
                            <p className="mt-0.5 text-rose-200 leading-snug">{facebookValidationStatus.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Página verificada: Punto Ciego (ID: 1418440394683304).
                  </p>
                </div>
              </div>

              {/* Sección Telegram */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Canal de Telegram (Briefing Ejecutivo)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">100% Gratuito y Sin Límites</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Telegram Bot Token (desde @BotFather)</label>
                  <input
                    type="password"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="7123456789:AAH..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ID o Username del Canal (Ej: @PuntoCiegoNoticias)</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="@PuntoCiegoNoticias o -100123456789"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Sección Bluesky (AT Protocol) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Bluesky Social (AT Protocol)
                  </h4>
                  <span className="text-[10px] text-cyan-400 font-mono">Sin Costos API</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Handle de Bluesky</label>
                  <input
                    type="text"
                    value={blueskyHandle}
                    onChange={(e) => setBlueskyHandle(e.target.value)}
                    placeholder="puntociegoglobal.bsky.social"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Contraseña de Aplicación (App Password)</label>
                  <input
                    type="password"
                    value={blueskyPassword}
                    onChange={(e) => setBlueskyPassword(e.target.value)}
                    placeholder="mkyq-xxxx-xxxx-xxxx"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cuenta: @puntociegoglobal.bsky.social (Publica automáticamente con tarjeta de imagen).
                  </p>
                </div>
              </div>

              {/* Sección LinkedIn (Página de Empresa Oficial) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    LinkedIn Página de Empresa (Punto Ciego)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">Playwright CDP (Puerto 9222)</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Company Page ID (ID de Empresa)</label>
                  <input
                    type="text"
                    value="146916345"
                    readOnly
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Página oficial: <b>Punto Ciego (ID: 146916345)</b>. Publica en modo empresa con copy estratégico e imagen split-screen, manteniendo seguros tus perfiles personales.
                  </p>
                </div>
              </div>

              {/* Marca */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Parámetros Editoriales de Marca
                </h4>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nombre Editorial en Portada</label>
                  <input
                    type="text"
                    value={config.brandName}
                    onChange={(e) => setConfig((prev) => ({ ...prev, brandName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase py-3 rounded-xl transition-all shadow-lg shadow-red-600/30"
                >
                  Guardar Parámetros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
