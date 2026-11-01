/** Secciones fijas del menú (mismas categorías que usa el Director Editorial) */
export const SITE_CATEGORIES = [
  'GEOPOLÍTICA',
  'ECONOMÍA GLOBAL',
  'TECNOLOGÍA & IA',
  'SEGURIDAD & DEFENSA',
  'PODER & SOCIEDAD',
] as const;

export function categorySlug(category: string): string {
  return (
    String(category || 'general')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'
  );
}

export function categoryPath(category: string): string {
  return `categoria/${categorySlug(category)}/`;
}

const WORD_START = new RegExp('(^|\\s)(\\p{L})', 'gu');

/** Título de sección legible: "TECNOLOGÍA & IA" -> "Tecnología & IA" */
export function categoryLabel(category: string): string {
  return String(category || 'General')
    .toLowerCase()
    .replace(WORD_START, (_m, sp: string, ch: string) => sp + ch.toUpperCase())
    .replace(/\bIa\b/g, 'IA');
}
