// Regenera todas las páginas del sitio con el PUBLIC_SITE_URL actual. Uso: npm run site:rebuild
import { rebuildAllSitePages, getPublicSiteUrl } from '../src/lib/site/static-site';

const count = rebuildAllSitePages();
console.log(`[EditorWeb] ${count} artículo(s) regenerados con base ${getPublicSiteUrl() || '(sin PUBLIC_SITE_URL)'}`);
