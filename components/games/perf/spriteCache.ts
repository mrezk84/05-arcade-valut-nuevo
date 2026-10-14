// Caché de sprites y fondos pre-renderizados (SPEC 12).
// Se dibuja una vez en un canvas offscreen y el juego lo pinta con un
// `drawImage` por frame. Tamaño nativo, sin escalar por devicePixelRatio.

const cache = new Map<string, HTMLCanvasElement>();

export function bakeSprite(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  return canvas;
}

// Clave: "<gameId>:<skin>:<sprite>". Construye en el primer uso; el Map solo
// crece con (skins × sprites distintos), nunca con la duración de la partida.
export function getBaked(
  key: string,
  build: () => HTMLCanvasElement,
): HTMLCanvasElement {
  let baked = cache.get(key);
  if (!baked) {
    baked = build();
    cache.set(key, baked);
  }
  return baked;
}

const layers = new Map<string, HTMLCanvasElement>();

// Lienzo offscreen reutilizable cuyo contenido redibuja el juego solo cuando
// cambia (p. ej. las piezas ya fijadas de un tablero). Hay uno por clave
// ("<gameId>:<capa>") y se reutiliza entre partidas y reinicios, así que no
// crece con la duración de la partida ni con los reinicios.
export function getLayer(key: string, w: number, h: number): HTMLCanvasElement {
  let layer = layers.get(key);
  if (!layer) {
    layer = document.createElement('canvas');
    layers.set(key, layer);
  }
  if (layer.width !== w) layer.width = w;
  if (layer.height !== h) layer.height = h;
  return layer;
}
