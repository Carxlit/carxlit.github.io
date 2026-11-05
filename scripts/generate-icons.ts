import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

export function createIcoFromPngs(pngBuffers: { width: number; height: number; buffer: Buffer }[]): Buffer {
  const numImages = pngBuffers.length;
  const headerSize = 6 + 16 * numImages;
  let currentOffset = headerSize;
  const entryBuffers: Buffer[] = [];
  const imageBuffers: Buffer[] = [];

  for (const img of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(currentOffset, 12);

    entryBuffers.push(entry);
    imageBuffers.push(img.buffer);
    currentOffset += img.buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  return Buffer.concat([header, ...entryBuffers, ...imageBuffers]);
}

export async function generateSiteIcons(): Promise<{
  ico: Buffer;
  appleTouch: Buffer;
  logo512: Buffer;
  svg: string;
}> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c0e11"/><circle cx="32" cy="32" r="17" fill="none" stroke="#f6f3ec" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="#d0021b"/></svg>`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // 1. Favicon PNGs 48x48 y 96x96
    const faviconHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden">${svg}</body></html>`;

    const page48 = await browser.newPage({ viewport: { width: 48, height: 48 } });
    await page48.setContent(faviconHtml, { waitUntil: 'load' });
    const buf48 = await page48.screenshot({ type: 'png', omitBackground: true });
    await page48.close();

    const page96 = await browser.newPage({ viewport: { width: 96, height: 96 } });
    await page96.setContent(faviconHtml, { waitUntil: 'load' });
    const buf96 = await page96.screenshot({ type: 'png', omitBackground: true });
    await page96.close();

    const ico = createIcoFromPngs([
      { width: 48, height: 48, buffer: buf48 },
      { width: 96, height: 96, buffer: buf96 },
    ]);

    // 2. Apple Touch Icon 180x180 (fondo opaco sin bordes redondeados para iOS)
    const appleHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0e11;overflow:hidden">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <rect width="180" height="180" fill="#0c0e11"/>
        <circle cx="90" cy="90" r="48" fill="none" stroke="#f6f3ec" stroke-width="14"/>
        <circle cx="90" cy="90" r="20" fill="#d0021b"/>
      </svg>
    </body></html>`;
    const page180 = await browser.newPage({ viewport: { width: 180, height: 180 } });
    await page180.setContent(appleHtml, { waitUntil: 'load' });
    const appleTouch = await page180.screenshot({ type: 'png' });
    await page180.close();

    // 3. Logo 512x512 "PUNTO CIEGO." (fondo oscuro, isotipo y texto blanco con punto rojo)
    const logoHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        width: 512px; height: 512px; background: #0c0e11; color: #ffffff;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: Georgia, "Playfair Display", "Times New Roman", serif; text-align: center; overflow: hidden;
      }
      .symbol { width: 150px; height: 150px; margin-bottom: 28px; }
      .title { font-size: 52px; font-weight: 900; letter-spacing: 0.02em; line-height: 1; text-transform: uppercase; }
      .title b { color: #d0021b; font-weight: 900; }
      .sub { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: #9ba2ac; margin-top: 16px; }
    </style></head><body>
      <svg class="symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#151820" stroke="#252a31" stroke-width="2"/>
        <circle cx="32" cy="32" r="17" fill="none" stroke="#f6f3ec" stroke-width="5"/>
        <circle cx="32" cy="32" r="7" fill="#d0021b"/>
      </svg>
      <div class="title">PUNTO CIEGO<b>.</b></div>
      <div class="sub">Inteligencia Periodística</div>
    </body></html>`;
    const page512 = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await page512.setContent(logoHtml, { waitUntil: 'load' });
    const logo512 = await page512.screenshot({ type: 'png' });
    await page512.close();

    return { ico, appleTouch, logo512, svg };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('[Iconos] Generando favicon.ico, apple-touch-icon.png y logo-512.png...');
  const icons = await generateSiteIcons();

  const publicDir = path.join(process.cwd(), 'public');
  const siteDir = path.join(process.cwd(), 'site');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(siteDir, { recursive: true });

  for (const dir of [publicDir, siteDir]) {
    fs.writeFileSync(path.join(dir, 'favicon.ico'), icons.ico);
    fs.writeFileSync(path.join(dir, 'favicon.svg'), icons.svg);
    fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), icons.appleTouch);
    fs.writeFileSync(path.join(dir, 'logo-512.png'), icons.logo512);
  }

  console.log('[Iconos] Iconos generados con éxito en public/ y site/:');
  console.log(' - favicon.ico (48x48 y 96x96):', icons.ico.length, 'bytes');
  console.log(' - favicon.svg:', icons.svg.length, 'bytes');
  console.log(' - apple-touch-icon.png (180x180):', icons.appleTouch.length, 'bytes');
  console.log(' - logo-512.png (512x512):', icons.logo512.length, 'bytes');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Iconos] Error generando iconos:', err);
    process.exit(1);
  });
}
