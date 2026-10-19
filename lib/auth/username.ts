import type { User } from '@supabase/supabase-js';

export const USERNAME_MAX = 10;
export const DEFAULT_USERNAME = 'JUGADOR';

export const normalizeUsername = (raw: string) =>
  raw.trim().toUpperCase().slice(0, USERNAME_MAX).trim();

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

export const getDisplayName = (user: User): string => {
  const meta = user.user_metadata ?? {};
  const candidates = [
    asString(meta.username),
    asString(meta.user_name),
    asString(meta.name),
    asString(user.email).split('@')[0],
  ];

  for (const candidate of candidates) {
    const name = normalizeUsername(candidate);
    if (name) return name;
  }
  return DEFAULT_USERNAME;
};
