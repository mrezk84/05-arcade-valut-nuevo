// Regla de contraseña (SPEC 14). La regex es solo UX: la protección real son
// los "Password requirements" de Supabase (Auth → Providers → Email), que deben
// mantener el mismo conjunto: mínimo 8, minúsculas, mayúsculas, dígitos y símbolos.
export const PASSWORD_MIN = 8;

// Símbolos = los que documenta Supabase. Espacios y letras con acento (ñ, é) no cuentan.
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]).{8,}$/;

export const PASSWORD_RULES_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, con minúsculas, mayúsculas, números y símbolos.';

export const validatePassword = (pass: string): string | null =>
  PASSWORD_REGEX.test(pass) ? null : PASSWORD_RULES_MESSAGE;
