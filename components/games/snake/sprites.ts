import { CELL } from './constants';

export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FruitName =
  | 'banana'
  | 'orange'
  | 'grape'
  | 'garlic'
  | 'eggplant'
  | 'strawberry'
  | 'cherry'
  | 'carrot'
  | 'mushroom'
  | 'broccoli'
  | 'watermelon'
  | 'pepper'
  | 'kiwi'
  | 'lemon'
  | 'peach'
  | 'peanut'
  | 'apple'
  | 'tomato'
  | 'berries'
  | 'grapes2'
  | 'pineapple'
  | 'melon';

const FRUIT_URL = '/games/snake/fruits.png';
const FRUIT_SIZE = 36; // px dentro de la celda de 40
const ROW_Y = 136;
const ROW_H = 160;

// Fila pixel art de fruits.png, portada de references/source-assets/snake-assets/sprites.js.
export const FRUITS: Record<FruitName, FruitSprite> = {
  banana: { x: 34, y: ROW_Y, w: 110, h: ROW_H },
  orange: { x: 186, y: ROW_Y, w: 150, h: ROW_H },
  grape: { x: 378, y: ROW_Y, w: 110, h: ROW_H },
  garlic: { x: 540, y: ROW_Y, w: 130, h: ROW_H },
  eggplant: { x: 712, y: ROW_Y, w: 130, h: ROW_H },
  strawberry: { x: 894, y: ROW_Y, w: 110, h: ROW_H },
  cherry: { x: 1066, y: ROW_Y, w: 110, h: ROW_H },
  carrot: { x: 1228, y: ROW_Y, w: 130, h: ROW_H },
  mushroom: { x: 1400, y: ROW_Y, w: 130, h: ROW_H },
  broccoli: { x: 1582, y: ROW_Y, w: 110, h: ROW_H },
  watermelon: { x: 1734, y: ROW_Y, w: 150, h: ROW_H },
  pepper: { x: 1906, y: ROW_Y, w: 150, h: ROW_H },
  kiwi: { x: 2068, y: ROW_Y, w: 170, h: ROW_H },
  lemon: { x: 2250, y: ROW_Y, w: 140, h: ROW_H },
  peach: { x: 2432, y: ROW_Y, w: 130, h: ROW_H },
  peanut: { x: 2604, y: ROW_Y, w: 130, h: ROW_H },
  apple: { x: 2786, y: ROW_Y, w: 110, h: ROW_H },
  tomato: { x: 2948, y: ROW_Y, w: 130, h: ROW_H },
  berries: { x: 3110, y: ROW_Y, w: 150, h: ROW_H },
  grapes2: { x: 3302, y: ROW_Y, w: 110, h: ROW_H },
  pineapple: { x: 3454, y: ROW_Y, w: 150, h: ROW_H },
  melon: { x: 3637, y: ROW_Y, w: 130, h: ROW_H },
};

export const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];

let image: HTMLImageElement | null = null;
let pending: Promise<HTMLImageElement> | null = null;

export function loadFruits(): Promise<HTMLImageElement> {
  if (image) return Promise.resolve(image);
  if (pending) return pending;

  pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      image = img;
      resolve(img);
    };
    img.onerror = () => {
      pending = null;
      reject(new Error(`No se pudo cargar ${FRUIT_URL}`));
    };
    img.src = FRUIT_URL;
  });
  return pending;
}

// Escala el recorte para caber en 36×36 sin deformar y lo centra en la celda (col, row).
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  name: FruitName,
  col: number,
  row: number,
) {
  const s = FRUITS[name];
  const scale = Math.min(FRUIT_SIZE / s.w, FRUIT_SIZE / s.h);
  const dw = s.w * scale;
  const dh = s.h * scale;
  const dx = col * CELL + (CELL - dw) / 2;
  const dy = row * CELL + (CELL - dh) / 2;
  ctx.drawImage(img, s.x, s.y, s.w, s.h, dx, dy, dw, dh);
}
