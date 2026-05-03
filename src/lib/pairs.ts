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
];

export const pairBySlug: ReadonlyMap<string, ConversionPair> = new Map(
  pairs.map((p) => [p.slug, p]),
);

export const popularImagePairs = pairs.filter((p) => p.category === 'image');
