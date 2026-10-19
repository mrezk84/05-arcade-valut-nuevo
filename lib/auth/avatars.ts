export const AVATARS = [
  'ship',
  'alien',
  'ghost',
  'joystick',
  'coin',
  'cartridge',
  'star',
  'heart',
] as const;

export type AvatarId = (typeof AVATARS)[number];

export const AVATAR_LABELS: Record<AvatarId, string> = {
  ship: 'Nave espacial',
  alien: 'Invasor alienígena',
  ghost: 'Fantasma',
  joystick: 'Palanca de mando',
  coin: 'Moneda',
  cartridge: 'Cartucho',
  star: 'Estrella',
  heart: 'Corazón',
};

/** `user_metadata` lo puede editar el usuario: solo se aceptan ids de la lista. */
export const isAvatarId = (value: unknown): value is AvatarId =>
  typeof value === 'string' && (AVATARS as readonly string[]).includes(value);

export const avatarSrc = (id: AvatarId) => `/avatars/${id}.svg`;
