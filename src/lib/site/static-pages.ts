import { SiteConfig, needsConsent } from './site-config';
import { SITE_NAME, esc } from './templates';

export interface StaticPage {
  rel: string;
  title: string;
  description: string;
  bodyHtml: string;
  updated?: string;
}

const UPDATED = '1 de noviembre de 2026';

function contactLine(config: SiteConfig): string {
  if (config.contactEmail) {
    return `<a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>`;
  }
  const social = Object.entries(config.socialLinks || {}).filter(([, url]) => url);
  if (social.length) {
    return `nuestros canales oficiales: ${social
      .map(([name, url]) => `<a href="${esc(url)}" rel="noopener" target="_blank">${esc(name.charAt(0).toUpperCase() + name.slice(1))}</a>`)
      .join(', ')}`;
  }
  return 'los mensajes directos de nuestras páginas oficiales en redes sociales';
}

export function getStaticPages(config: SiteConfig): StaticPage[] {
  const contact = contactLine(config);
  const thirdParty = needsConsent(config);

  return [
    {
      rel: 'quienes-somos/',
      title: 'Quiénes somos',
      description: `${SITE_NAME}: análisis independiente de geopolítica, economía, seguridad, tecnología y poder, con fuentes citadas.`,
      bodyHtml: `
<p><strong>${SITE_NAME}</strong> es un proyecto editorial independiente de análisis de actualidad internacional. Nuestro foco son cinco áreas: geopolítica, economía global, tecnología e inteligencia artificial, seguridad y defensa, y poder y sociedad.</p>
<h2>Nuestro ángulo: el punto ciego</h2>
<p>La mayoría de medios cuentan <em>qué</em> pasó. Nosotros intentamos explicar lo que suele quedar fuera de foco: las consecuencias de segundo orden, quién gana y quién pierde, y qué conviene vigilar después. Cada artículo incluye una sección dedicada a ese "punto ciego".</p>
<h2>Cómo elaboramos los artículos</h2>
<p>Somos transparentes con nuestro método:</p>
<ul>
<li>Monitorizamos de forma continua las fuentes de medios de referencia nacionales e internacionales.</li>
<li>Cada pieza se redacta <strong>con asistencia de inteligencia artificial</strong> a partir de esas fuentes, bajo una línea editorial definida: hechos verificables, contexto y análisis diferenciado de la opinión.</li>
<li>Todas las fuentes consultadas se citan con enlace al final de cada artículo para que puedas contrastarlas.</li>
<li>No inventamos citas, cifras ni declaraciones. Si un dato no está en las fuentes, no lo publicamos.</li>
</ul>
<h2>Correcciones</h2>
<p>Si detectas un error factual, escríbenos a ${contact}. Revisamos cada aviso y corregimos el artículo indicando el cambio cuando proceda.</p>
<h2>Independencia y financiación</h2>
<p>${SITE_NAME} es gratuito para sus lectores.${
        thirdParty ? ' Se financia mediante publicidad, que no influye en la selección ni en el enfoque de los temas.' : ''
      }${config.donationUrl ? ` También puedes <a href="${esc(config.donationUrl)}" rel="noopener" target="_blank">apoyarnos con un aporte voluntario</a>.` : ''}</p>`,
    },
    {
      rel: 'contacto/',
      title: 'Contacto',
      description: `Cómo contactar con ${SITE_NAME}: correcciones, sugerencias y consultas.`,
      bodyHtml: `
<p>Para correcciones, sugerencias de temas, consultas de prensa o cualquier otra cuestión, puedes escribirnos a ${contact}.</p>
<h2>Correcciones</h2>
<p>Si encuentras un error en un artículo, indícanos el enlace y el dato concreto. Agradecemos que adjuntes una fuente que respalde la corrección.</p>
<h2>Derechos sobre contenidos</h2>
<p>Si consideras que algún contenido vulnera tus derechos, contáctanos con los detalles y lo revisaremos con prioridad.</p>`,
    },
    {
      rel: 'aviso-legal/',
      title: 'Aviso legal',
      description: `Condiciones de uso del sitio web de ${SITE_NAME}.`,
      updated: UPDATED,
      bodyHtml: `
<h2>Titularidad</h2>
<p>Este sitio web es operado por el proyecto editorial ${SITE_NAME}. Contacto: ${contact}.</p>
<h2>Objeto</h2>
<p>El sitio ofrece artículos de análisis de actualidad con fines informativos. Su contenido no constituye asesoramiento financiero, legal ni de inversión.</p>
<h2>Contenido elaborado con IA</h2>
<p>Los artículos se elaboran con asistencia de herramientas de inteligencia artificial a partir de las fuentes que se citan en cada pieza. Aunque aplicamos criterios para evitar errores, recomendamos contrastar la información con las fuentes originales enlazadas.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos de análisis y el diseño del sitio pertenecen a ${SITE_NAME}. Se permite citar fragmentos breves con enlace al artículo original. Las marcas, nombres y contenidos de terceros citados pertenecen a sus respectivos titulares.</p>
<h2>Enlaces externos</h2>
<p>Los artículos enlazan a fuentes externas. ${SITE_NAME} no se responsabiliza del contenido ni de las políticas de privacidad de esos sitios.</p>
<h2>Responsabilidad</h2>
<p>${SITE_NAME} no se hace responsable de las decisiones tomadas a partir de la información publicada ni de interrupciones temporales del servicio.</p>`,
    },
    {
      rel: 'privacidad/',
      title: 'Política de privacidad',
      description: `Qué datos trata ${SITE_NAME} y cómo ejercer tus derechos.`,
      updated: UPDATED,
      bodyHtml: `
<p>En ${SITE_NAME} respetamos tu privacidad. Este sitio no tiene registro de usuarios, comentarios ni formularios, por lo que <strong>no recogemos directamente datos personales</strong> de nuestros lectores.</p>
<h2>Datos técnicos de navegación</h2>
<p>El sitio se aloja en Cloudflare Pages. Como cualquier servidor web, nuestro proveedor procesa datos técnicos como la dirección IP o el tipo de navegador para servir las páginas y protegerlas frente a ataques. Puedes consultar la <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener" target="_blank">política de privacidad de Cloudflare</a>.</p>
<h2>Servicios de terceros</h2>
${
  thirdParty
    ? `<p>Con tu consentimiento, cargamos servicios de terceros de publicidad y/o medición de audiencia que pueden usar cookies e identificadores para mostrar anuncios y obtener estadísticas. Estos servicios solo se activan si pulsas "Aceptar" en el aviso de cookies. Más detalles en nuestra <a href="../cookies/">política de cookies</a>.</p>`
    : `<p>Actualmente no cargamos servicios de publicidad ni de analítica de terceros. Si en el futuro lo hacemos, solo se activarán con tu consentimiento previo y actualizaremos esta política.</p>`
}
<h2>Contacto por correo o redes</h2>
<p>Si nos escribes, usaremos tus datos únicamente para responderte y no los cederemos a terceros.</p>
<h2>Tus derechos</h2>
<p>Puedes solicitar el acceso, rectificación o supresión de cualquier dato que conservemos sobre ti, así como oponerte a su tratamiento, escribiendo a ${contact}. También puedes presentar una reclamación ante la autoridad de protección de datos de tu país.</p>
<h2>Menores</h2>
<p>Este sitio no está dirigido a menores de 14 años.</p>`,
    },
    {
      rel: 'cookies/',
      title: 'Política de cookies',
      description: `Uso de cookies y almacenamiento local en ${SITE_NAME}.`,
      updated: UPDATED,
      bodyHtml: `
<h2>¿Qué son las cookies?</h2>
<p>Son pequeños archivos que los sitios web guardan en tu navegador. Sirven para recordar preferencias o, en el caso de terceros, para publicidad y estadísticas.</p>
<h2>Cookies propias</h2>
<p>${SITE_NAME} no instala cookies propias. Solo guardamos en el almacenamiento local de tu navegador tu elección sobre el aviso de cookies, para no volver a preguntarte.</p>
<h2>Cookies de terceros</h2>
${
  thirdParty
    ? `<p>Si aceptas, se cargan servicios de terceros de publicidad y/o analítica que pueden instalar sus propias cookies. Si rechazas, no se carga ninguno de ellos y puedes seguir leyendo con normalidad.</p>`
    : `<p>Actualmente no se cargan servicios de terceros que instalen cookies.</p>`
}
<h2>Cambiar tu elección</h2>
<p>Puedes revocar o modificar tu consentimiento en cualquier momento:</p>
<p><button type="button" onclick="try{localStorage.removeItem('pc-consent-v1')}catch(e){}location.reload()">Cambiar preferencias de cookies</button></p>
<p>También puedes borrar o bloquear las cookies desde la configuración de tu navegador.</p>`,
    },
  ];
}
