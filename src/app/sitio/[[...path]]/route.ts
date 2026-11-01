import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SITE_DIR } from '@/lib/site/static-site';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * Vista previa local del sitio de artículos en http://localhost:3000/sitio/
 * (el sitio público se sirve desde el hosting configurado, no desde aquí)
 */
export async function GET(req: NextRequest, { params }: { params: { path?: string[] } }) {
  const parts = params.path || [];
  // /sitio sin barra final rompería los enlaces relativos
  if (parts.length === 0 && !req.nextUrl.pathname.endsWith('/')) {
    return NextResponse.redirect(new URL('/sitio/', req.url));
  }

  let filePath = path.resolve(SITE_DIR, ...parts);
  if (!filePath.startsWith(path.resolve(SITE_DIR))) {
    return new NextResponse('No encontrado', { status: 404 });
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    if (!req.nextUrl.pathname.endsWith('/')) {
      return NextResponse.redirect(new URL(`${req.nextUrl.pathname}/`, req.url));
    }
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    return new NextResponse('No encontrado', { status: 404 });
  }

  return new NextResponse(fs.readFileSync(filePath), {
    headers: { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' },
  });
}
