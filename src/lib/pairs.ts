export type ConversionCategory = 'image' | 'audio' | 'document';

export interface ConversionFormat {
  mime: string;
  label: string;
  ext: string;
}

export interface ConversionPair {
  slug: string;
  category: ConversionCategory;
  source: ConversionFormat;
  target: ConversionFormat;
  title: string;
  description: string;
  why: string[];
}

const JPG: ConversionFormat = { mime: 'image/jpeg', label: 'JPG', ext: 'jpg' };
const PNG: ConversionFormat = { mime: 'image/png', label: 'PNG', ext: 'png' };
const WEBP: ConversionFormat = { mime: 'image/webp', label: 'WebP', ext: 'webp' };
const AVIF: ConversionFormat = { mime: 'image/avif', label: 'AVIF', ext: 'avif' };
const HEIC: ConversionFormat = { mime: 'image/heic', label: 'HEIC', ext: 'heic' };
const GIF: ConversionFormat = { mime: 'image/gif', label: 'GIF', ext: 'gif' };
const TIFF: ConversionFormat = { mime: 'image/tiff', label: 'TIFF', ext: 'tiff' };
const SVG: ConversionFormat = { mime: 'image/svg+xml', label: 'SVG', ext: 'svg' };

export const pairs: ConversionPair[] = [
  {
    slug: 'jpg-to-webp',
    category: 'image',
    source: JPG,
    target: WEBP,
    title: 'Convertir JPG a WebP',
    description:
      'Pasa tus JPG a WebP en el navegador, sin subirlos. Más ligeros y con la misma calidad visual.',
    why: [
      'WebP suele pesar entre 25 % y 35 % menos que un JPG con calidad equivalente.',
      'Soporta transparencia, así que sirve también cuando luego cambies el fondo.',
      'Compatible con todos los navegadores modernos (Chrome, Firefox, Safari, Edge).',
      'La conversión ocurre en tu dispositivo: ningún archivo se sube a un servidor.',
    ],
  },
  {
    slug: 'jpg-to-avif',
    category: 'image',
    source: JPG,
    target: AVIF,
    title: 'Convertir JPG a AVIF',
    description:
      'Convierte JPG a AVIF localmente. AVIF comprime hasta un 50 % mejor que JPG manteniendo la calidad.',
    why: [
      'AVIF logra archivos hasta un 50 % más pequeños que JPG con calidad similar.',
      'Mejor preservación de gradientes y zonas planas que con WebP o JPG.',
      'Soporte amplio en navegadores modernos desde 2023.',
      'Procesado en tu navegador con WebAssembly: privado y sin coste.',
    ],
  },
  {
    slug: 'jpg-to-png',
    category: 'image',
    source: JPG,
    target: PNG,
    title: 'Convertir JPG a PNG',
    description:
      'Convierte tus JPG a PNG sin pérdida. Útil cuando necesitas transparencia o ediciones posteriores.',
    why: [
      'PNG es sin pérdida: cada vez que reabres y guardas, no se degrada.',
      'Permite transparencia (canal alfa), algo que JPG no soporta.',
      'Ideal para capturas de pantalla, logotipos y composiciones por capas.',
      'Convertido en local con WebAssembly. Tus archivos no salen del dispositivo.',
    ],
  },
  {
    slug: 'png-to-webp',
    category: 'image',
    source: PNG,
    target: WEBP,
    title: 'Convertir PNG a WebP',
    description:
      'Reduce el peso de tus PNG manteniendo transparencia. Sin servidores, todo en el navegador.',
    why: [
      'WebP conserva la transparencia y reduce el tamaño respecto a PNG, a veces a la mitad.',
      'Modo sin pérdida disponible si no quieres que se pierda calidad.',
      'Cargas más rápidas en webs con muchas imágenes.',
      '100 % en tu navegador: sin subir nada a un servidor.',
    ],
  },
  {
    slug: 'png-to-avif',
    category: 'image',
    source: PNG,
    target: AVIF,
    title: 'Convertir PNG a AVIF',
    description:
      'Convierte PNG a AVIF para web moderna. Tamaño hasta 70 % menor manteniendo calidad y transparencia.',
    why: [
      'AVIF comprime PNG con transparencia mucho mejor que WebP en imágenes complejas.',
      'Reduce tiempos de carga en webs sin perder fidelidad de color.',
      'Modo sin pérdida disponible.',
      'Procesado local con WebAssembly. Privado por diseño.',
    ],
  },
  {
    slug: 'png-to-jpg',
    category: 'image',
    source: PNG,
    target: JPG,
    title: 'Convertir PNG a JPG',
    description:
      'Pasa tus PNG a JPG cuando no necesites transparencia y prefieras archivos más pequeños y compatibles.',
    why: [
      'JPG es el formato más compatible: se abre en cualquier dispositivo o aplicación.',
      'Archivos más pequeños cuando no necesitas transparencia (fondo blanco/sólido).',
      'Ideal para fotografía donde la pérdida no se nota.',
      'Conversión 100 % local: tus archivos no se suben a internet.',
    ],
  },
  {
    slug: 'heic-to-jpg',
    category: 'image',
    source: HEIC,
    target: JPG,
    title: 'Convertir HEIC a JPG',
    description:
      'Pasa las fotos HEIC de tu iPhone a JPG en el navegador. Sin instalar nada, sin subir archivos a un servidor.',
    why: [
      'JPG es el formato más universal: se abre en cualquier dispositivo o aplicación, HEIC todavía no.',
      'Tus fotos no salen del navegador — la conversión corre en tu propio dispositivo.',
      'Sin pérdida visual perceptible en condiciones normales de visualización.',
      'Procesado con WebAssembly localmente: rápido y privado.',
    ],
  },
  {
    slug: 'heic-to-png',
    category: 'image',
    source: HEIC,
    target: PNG,
    title: 'Convertir HEIC a PNG',
    description:
      'Convierte tus fotos HEIC del iPhone a PNG sin pérdida. Útil cuando necesitas calidad máxima o transparencia.',
    why: [
      'PNG es sin pérdida: cada vez que reabres y guardas, no se degrada la imagen.',
      'Compatible con cualquier editor o app de imagen, a diferencia de HEIC.',
      'Conserva todos los detalles del HEIC original sin compresión adicional.',
      'Tus archivos nunca salen del dispositivo.',
    ],
  },
  {
    slug: 'heic-to-webp',
    category: 'image',
    source: HEIC,
    target: WEBP,
    title: 'Convertir HEIC a WebP',
    description:
      'Convierte HEIC del iPhone a WebP para web moderna. Archivos ligeros y compatibles con todos los navegadores.',
    why: [
      'WebP pesa entre 25 % y 35 % menos que JPG con calidad equivalente, y es soportado por todos los navegadores modernos.',
      'A diferencia de HEIC, WebP funciona sin problemas en webs, redes sociales y servicios de mensajería.',
      'Soporta transparencia, lo que permite usar la imagen sin recortes.',
      'Conversión 100 % local con WebAssembly: privado y sin coste.',
    ],
  },
  {
    slug: 'gif-to-png',
    category: 'image',
    source: GIF,
    target: PNG,
    title: 'Convertir GIF a PNG',
    description:
      'Saca un PNG estático del primer fotograma de un GIF. Ideal para recuperar una imagen limpia y editable.',
    why: [
      'PNG es sin pérdida y soporta transparencia, perfecto para conservar el frame tal cual.',
      'GIF está limitado a 256 colores; PNG no tiene esa limitación.',
      'Útil para extraer una imagen de un meme o miniatura sin instalar software.',
      'Procesado en tu navegador: ningún GIF se sube a un servidor.',
    ],
  },
  {
    slug: 'tiff-to-jpg',
    category: 'image',
    source: TIFF,
    target: JPG,
    title: 'Convertir TIFF a JPG',
    description:
      'Pasa tus TIFF (escaneos, fotografía, archivo) a JPG en el navegador. Mucho más ligeros y compatibles con cualquier dispositivo.',
    why: [
      'Un TIFF puede pesar 10-20 veces más que el JPG equivalente — perfecto para compartir o subir a la web.',
      'JPG abre en cualquier visor o editor; muchas apps todavía no soportan TIFF nativamente.',
      'Si tu TIFF está en CMYK (típico en imprenta), lo convertimos a sRGB para que se vea igual en pantalla.',
      'Procesado 100 % en tu dispositivo. Tus archivos no se suben a un servidor.',
    ],
  },
  {
    slug: 'tiff-to-png',
    category: 'image',
    source: TIFF,
    target: PNG,
    title: 'Convertir TIFF a PNG',
    description:
      'Convierte TIFF a PNG sin pérdida. Útil cuando necesitas conservar transparencia o calidad máxima del original.',
    why: [
      'PNG es sin pérdida, igual que TIFF: la imagen se conserva pixel a pixel.',
      'Soporta transparencia, algo que TIFF también permite y queremos preservar.',
      'PNG se abre en cualquier navegador, editor o app móvil. TIFF aún no.',
      'Conversión local con WebAssembly: privada y sin coste por archivo.',
    ],
  },
  {
    slug: 'tiff-to-webp',
    category: 'image',
    source: TIFF,
    target: WEBP,
    title: 'Convertir TIFF a WebP',
    description:
      'Reduce drásticamente el peso de tus TIFF pasándolos a WebP. Perfecto para web sin perder calidad visible.',
    why: [
      'WebP comprime mucho más que JPG y mantiene transparencia: un TIFF de 30 MB puede caber en 1-2 MB.',
      'Soporte universal en navegadores modernos y mucho más rápido de cargar que TIFF.',
      'Modo sin pérdida disponible si necesitas máxima fidelidad.',
      'Procesado en tu navegador: nada se sube a un servidor.',
    ],
  },
  {
    slug: 'png-to-tiff',
    category: 'image',
    source: PNG,
    target: TIFF,
    title: 'Convertir PNG a TIFF',
    description:
      'Pasa tus PNG a TIFF para flujos de imprenta, archivado profesional o entrega a clientes que exigen TIFF.',
    why: [
      'TIFF con compresión LZW conserva la imagen sin pérdida y es el formato estándar en imprenta y archivo fotográfico.',
      'Mantiene transparencia y resolución completa del PNG original.',
      'Compatible con software profesional (Photoshop, InDesign, prensas RIP).',
      'Convertido en tu propio dispositivo: privado y sin envío a servidor.',
    ],
  },
  {
    slug: 'jpg-to-tiff',
    category: 'image',
    source: JPG,
    target: TIFF,
    title: 'Convertir JPG a TIFF',
    description:
      'Convierte JPG a TIFF para archivado o entregas profesionales. Ideal cuando un cliente o flujo de trabajo exige formato sin pérdida.',
    why: [
      'TIFF (LZW) es el estándar para archivado fotográfico y entrega a imprenta.',
      'Aunque el JPG ya tenga pérdida previa, congelar la imagen en TIFF evita degradación al reabrir y reguardar.',
      'Compatible con cualquier software profesional (Photoshop, Lightroom, RIPs de impresión).',
      'Conversión 100 % local con WebAssembly.',
    ],
  },
  {
    slug: 'svg-to-png',
    category: 'image',
    source: SVG,
    target: PNG,
    title: 'Convertir SVG a PNG',
    description:
      'Rasteriza un SVG a PNG en tu navegador. Útil para usar logos vectoriales en apps o redes que no soportan SVG.',
    why: [
      'PNG abre en cualquier dispositivo o servicio; SVG todavía es rechazado por muchas apps móviles y herramientas de oficina.',
      'PNG conserva la transparencia del SVG original.',
      'Si tu SVG usa fuentes web externas no embebidas, pueden caer a una sans-serif por defecto al rasterizar.',
      'Procesado en tu navegador con WebAssembly: privado y sin coste.',
    ],
  },
  {
    slug: 'svg-to-jpg',
    category: 'image',
    source: SVG,
    target: JPG,
    title: 'Convertir SVG a JPG',
    description:
      'Convierte SVG a JPG cuando no necesitas transparencia y quieres un archivo más ligero y compatible.',
    why: [
      'JPG es el formato más universal: cualquier dispositivo o app lo abre sin problemas.',
      'Más ligero que un PNG cuando el SVG no tiene transparencia importante.',
      'Las zonas transparentes del SVG se rellenan con blanco (JPG no soporta alpha).',
      'Conversión 100 % local: tu SVG no sale del dispositivo.',
    ],
  },
  {
    slug: 'svg-to-webp',
    category: 'image',
    source: SVG,
    target: WEBP,
    title: 'Convertir SVG a WebP',
    description:
      'Rasteriza tu SVG a WebP para web moderna. Archivos ligeros, compatibilidad amplia y soporte de transparencia.',
    why: [
      'WebP combina lo mejor de PNG y JPG: pesa poco y conserva transparencia.',
      'Soporte universal en navegadores modernos para integrar el resultado en una web.',
      'Si tu SVG depende de fuentes web no embebidas, usa una sans-serif por defecto al rasterizar.',
      'Procesado en tu navegador con WebAssembly. Sin servidor de por medio.',
    ],
  },
];

export const pairBySlug: ReadonlyMap<string, ConversionPair> = new Map(
  pairs.map((p) => [p.slug, p]),
);

export const popularImagePairs = pairs.filter((p) => p.category === 'image');
