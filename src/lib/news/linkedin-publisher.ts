import path from 'path';
import fs from 'fs';
import { ProcessedNews } from '@/types/news';

export interface LinkedInPublishResult {
  success: boolean;
  postId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * LinkedIn desde la nube: LinkedIn no permite publicar en páginas de empresa sin una app aprobada,
 * así que se delega en un escenario gratuito de Make (Webhook → LinkedIn "Create a Company Image Post").
 * Si LINKEDIN_WEBHOOK_URL está definido se usa este camino en vez del navegador por CDP.
 */
async function publishToLinkedInViaWebhook(news: ProcessedNews, text: string): Promise<LinkedInPublishResult> {
  const webhook = (process.env.LINKEDIN_WEBHOOK_URL || '').trim();
  const siteUrl = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const slug = news.article?.slug;
  const imageUrl = siteUrl && slug ? `${siteUrl}/img/${slug}.jpg` : undefined;
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        imageUrl,
        articleUrl: news.articleUrl,
        headline: news.headline,
        category: news.category,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { success: false, error: `Webhook de LinkedIn respondió ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { success: true, postId: 'make-webhook' };
  } catch (err: any) {
    return { success: false, error: `Webhook de LinkedIn: ${err?.message}` };
  }
}

const PUNTO_CIEGO_COMPANY_ID = '146916345';
const COMPANY_ADMIN_URL = `https://www.linkedin.com/company/${PUNTO_CIEGO_COMPANY_ID}/admin/page-posts/published/`;

/** Cierra modales de sugerencias o publicaciones a medias que interceptan los clics */
async function dismissLinkedInOverlays(page: any) {
  for (let i = 0; i < 3; i++) {
    const overlay = page.locator('.artdeco-modal-overlay--is-top-layer');
    if (!(await overlay.count().catch(() => 0))) return;
    const close = page.locator(
      '.artdeco-modal-overlay--is-top-layer button[aria-label*="Descartar"], .artdeco-modal-overlay--is-top-layer button[aria-label*="Cerrar"], .artdeco-modal-overlay--is-top-layer button[aria-label*="Dismiss"], .artdeco-modal-overlay--is-top-layer button.artdeco-modal__dismiss'
    ).first();
    if (await close.isVisible({ timeout: 1000 }).catch(() => false)) await close.click({ timeout: 3000 }).catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
    // "¿Descartar publicación?" → confirmar descarte del borrador abandonado
    const discard = page.locator('button:has-text("Descartar"), button:has-text("Discard")').last();
    if (await discard.isVisible({ timeout: 800 }).catch(() => false)) await discard.click({ timeout: 3000 }).catch(() => {});
  }
}

/**
 * Publica una noticia con texto e imagen en la Página de Empresa oficial de Punto Ciego
 * en LinkedIn mediante Playwright CDP sobre el navegador en ejecución (puerto 9222).
 * 
 * GARANTÍA DE PRIVACIDAD Y SEGURIDAD:
 * - Valida de manera estricta que la URL contenga `/company/${PUNTO_CIEGO_COMPANY_ID}/`
 * - NUNCA publica en perfiles personales ni toca el feed privado.
 */
export async function publishToLinkedInCompany(
  news: ProcessedNews,
  cdpUrl: string = 'http://127.0.0.1:9222'
): Promise<LinkedInPublishResult> {
  const textCopy = news.linkedInPost || 
    (news.facebookPost 
      ? `${news.headline}\n\n${news.subHeadline}\n\n${news.facebookPost}\n\n#PuntoCiego #Geopolitica #Seguridad` 
      : `${news.headline}\n\n${news.subHeadline}\n\n#PuntoCiego #Analisis`);

  if (process.env.LINKEDIN_WEBHOOK_URL) return publishToLinkedInViaWebhook(news, textCopy);

  let browser: any = null;

  try {
    const { chromium } = await import('playwright');
    
    // Conectar a la instancia de navegador activa
    browser = await chromium.connectOverCDP(cdpUrl, { timeout: 5000 });
    const contexts = browser.contexts();
    if (!contexts || contexts.length === 0) {
      throw new Error('No hay contextos de navegador disponibles en el puerto 9222.');
    }

    const context = contexts[0];
    let page = context.pages().find((p: any) => p.url().includes('linkedin.com/company/' + PUNTO_CIEGO_COMPANY_ID));

    if (!page) {
      // Pestaña de LinkedIn existente o una nueva (nunca secuestrar la pestaña que el usuario esté usando)
      page = context.pages().find((p: any) => p.url().includes('linkedin.com')) || (await context.newPage());
      await page.goto(COMPANY_ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);
    } else {
      if (!page.url().includes('/admin/page-posts/published/')) {
        await page.goto(COMPANY_ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    }

    // Doble verificación de seguridad de URL: SOLO publicar en la página de empresa
    if (!page.url().includes(PUNTO_CIEGO_COMPANY_ID)) {
      throw new Error(`[Seguridad] La página actual (${page.url()}) no pertenece a la empresa Punto Ciego (${PUNTO_CIEGO_COMPANY_ID}). Operación abortada.`);
    }

    // Ruta de la imagen de portada
    const imageRelPath = news.cardImageUrl ? news.cardImageUrl.replace(/^\//, '') : null;
    const fullImagePath = imageRelPath ? path.join(process.cwd(), 'public', imageRelPath) : null;
    const hasImage = Boolean(fullImagePath && fs.existsSync(fullImagePath));

    let imageUploaded = false;

    await dismissLinkedInOverlays(page);

    if (hasImage && fullImagePath) {
      try {
        console.log(`[LinkedIn] Subiendo imagen periodística: ${fullImagePath}`);
        const fotoBtn = page.locator('button:has-text("Foto"), span:has-text("Foto")').first();
        if (await fotoBtn.isVisible({ timeout: 3000 })) {
          await fotoBtn.click();
          await page.waitForTimeout(1500);

          const fileInput = page.locator('input[type="file"]').first();
          await fileInput.setInputFiles(fullImagePath);
          await page.waitForTimeout(2000);

          // Hacer clic en 'Siguiente' en el modal de previsualización de foto
          const nextBtn = page.locator('button:has-text("Siguiente"), button:has-text("Next")').last();
          if (await nextBtn.isVisible({ timeout: 4000 })) {
            await nextBtn.click();
            await page.waitForTimeout(1500);
            imageUploaded = true;
          }
        }
      } catch (imgErr: any) {
        console.warn('[LinkedIn] Advertencia al adjuntar imagen, procediendo con texto:', imgErr?.message);
      }
    }

    if (!imageUploaded) {
      // Un modal de sugerencias ("share-box-next-best-action") o uno de foto a medias tapa el botón
      await dismissLinkedInOverlays(page);
      // Si no hay imagen o falló el modal de foto, abrir modal regular de publicación
      const createBtn = page.locator('button:has-text("Crear"), button:has-text("Crea una publicación"), div[role="button"]:has-text("Crear publicación")').first();
      if (await createBtn.isVisible({ timeout: 3000 })) {
        try {
          await createBtn.click({ timeout: 8000 });
        } catch {
          await dismissLinkedInOverlays(page);
          await createBtn.click({ timeout: 8000, force: true });
        }
        await page.waitForTimeout(1500);
      }
    }

    // Escribir el copy en el editor de texto (dentro del modal de publicación)
    const editor = page.locator('[role="dialog"] div[contenteditable="true"], [role="dialog"] .ql-editor, div[contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 8000 });
    await editor.click();
    await editor.fill(textCopy);
    await page.waitForTimeout(1500);

    // Hacer clic en el botón Publicar
    const publishBtn = page.locator('button.share-actions__primary-action, button:has-text("Publicar")').last();
    await publishBtn.waitFor({ state: 'visible', timeout: 5000 });
    if (await publishBtn.isDisabled()) {
      throw new Error('El botón "Publicar" está deshabilitado (el texto o la imagen no se cargaron).');
    }
    await publishBtn.click();

    // Verificación real: si el editor sigue abierto a los 15 s, la publicación no salió
    try {
      await editor.waitFor({ state: 'hidden', timeout: 15000 });
    } catch {
      throw new Error('El editor de LinkedIn siguió abierto tras pulsar "Publicar"; no se confirma la publicación.');
    }

    console.log('[LinkedIn] Noticia publicada con éxito en la Página de Empresa Punto Ciego.');

    return {
      success: true,
      postId: `li-live-${Date.now()}`,
      simulated: false,
    };
  } catch (error: any) {
    console.error('[LinkedIn] Error en publicación vía CDP:', error?.message);
    
    // Si no hay navegador conectado, reportar error claro o simulación si aplica
    return {
      success: false,
      error: error?.message || 'Error desconocido al publicar en LinkedIn vía CDP',
    };
  }
}

