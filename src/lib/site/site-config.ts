import path from 'path';
import { readJsonFile } from '@/lib/storage/json-store';

/**
 * Configuración opcional del sitio (storage/site_config.json). Ver storage/site_config.example.json.
 * Todo vacío = sitio sin anuncios, sin analítica y sin banner de cookies.
 */
export interface SiteConfig {
  siteDescription?: string;
  /** Script(s) del proveedor de anuncios para el <head>. Se cargan solo tras aceptar cookies. */
  adHeadHtml?: string;
  /** Bloques de anuncio por posición. Usar códigos asíncronos (sin document.write). */
  adSlots?: {
    articleTop?: string;
    articleMiddle?: string;
    articleBottom?: string;
    indexInline?: string;
    sidebar?: string;
  };
  /** Cada cuántas tarjetas de la portada se inserta indexInline (por defecto 6) */
  adEveryNCards?: number;
  /** Contenido de site/ads.txt (una línea por vendedor autorizado) */
  adsTxt?: string;
  /** Script de analítica (p. ej. Cloudflare Web Analytics). Se carga solo tras aceptar cookies. */
  analyticsHtml?: string;
  /** Enlace de donaciones (Ko-fi, Buy Me a Coffee, PayPal.me...) */
  donationUrl?: string;
  donationLabel?: string;
  contactEmail?: string;
  /** Códigos de verificación de propiedad (no son secretos): Google Search Console y Bing Webmaster */
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  socialLinks?: {
    facebook?: string;
    telegram?: string;
    bluesky?: string;
    linkedin?: string;
    x?: string;
    instagram?: string;
    mastodon?: string;
  };
}

/** Acepta el código solo, la etiqueta <meta ... content="..."> o el formato TXT "google-site-verification=..." */
const verificationCode = (v: unknown) => {
  const s = clean(v);
  const m = s.match(/content=["']([^"']+)["']/i);
  return (m ? m[1] : s).replace(/^[\w.-]*verification=/i, '').replace(/[^A-Za-z0-9_\-]/g, '') || undefined;
};

const CONFIG_PATH = path.join(process.cwd(), 'storage', 'site_config.json');

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function getSiteConfig(): SiteConfig {
  const raw = readJsonFile<SiteConfig>(CONFIG_PATH, {});
  const slots = raw.adSlots || {};
  const social = raw.socialLinks || {};
  return {
    siteDescription: clean(raw.siteDescription) || undefined,
    adHeadHtml: clean(raw.adHeadHtml) || undefined,
    adSlots: {
      articleTop: clean(slots.articleTop) || undefined,
      articleMiddle: clean(slots.articleMiddle) || undefined,
      articleBottom: clean(slots.articleBottom) || undefined,
      indexInline: clean(slots.indexInline) || undefined,
      sidebar: clean(slots.sidebar) || undefined,
    },
    adEveryNCards: Number(raw.adEveryNCards) > 0 ? Math.round(Number(raw.adEveryNCards)) : 6,
    adsTxt: clean(raw.adsTxt) || undefined,
    analyticsHtml: clean(raw.analyticsHtml) || undefined,
    donationUrl: clean(raw.donationUrl) || undefined,
    donationLabel: clean(raw.donationLabel) || undefined,
    contactEmail: clean(raw.contactEmail) || undefined,
    googleSiteVerification: verificationCode(raw.googleSiteVerification),
    bingSiteVerification: verificationCode(raw.bingSiteVerification),
    socialLinks: {
      facebook: clean(social.facebook) || undefined,
      telegram: clean(social.telegram) || undefined,
      bluesky: clean(social.bluesky) || undefined,
      linkedin: clean(social.linkedin) || undefined,
      x: clean(social.x) || undefined,
      instagram: clean(social.instagram) || undefined,
      mastodon: clean(social.mastodon) || undefined,
    },
  };
}

/** ¿Hay scripts de terceros que exijan consentimiento? */
export function needsConsent(config: SiteConfig): boolean {
  const s = config.adSlots || {};
  return Boolean(
    config.adHeadHtml || config.analyticsHtml || s.articleTop || s.articleMiddle || s.articleBottom || s.indexInline || s.sidebar
  );
}
