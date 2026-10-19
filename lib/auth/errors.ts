const GENERIC_MESSAGE = 'Algo salió mal. Inténtalo de nuevo en unos minutos.';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos',
  email_not_confirmed:
    'Debes verificar tu correo antes de entrar. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese correo',
  email_exists: 'Ya existe una cuenta con ese correo',
  weak_password:
    'La contraseña es demasiado débil. Usa al menos 8 caracteres, mezclando letras y números.',
  same_password: 'La contraseña nueva debe ser distinta de la anterior',
  email_address_invalid: 'El correo no es válido',
  validation_failed: 'Revisa los datos e inténtalo de nuevo',
  signup_disabled: 'El registro está desactivado por ahora',
  over_email_send_rate_limit:
    'Se enviaron demasiados correos. Espera un poco antes de volver a intentarlo.',
  over_request_rate_limit:
    'Demasiados intentos. Espera un poco antes de volver a intentarlo.',
  otp_expired: 'El enlace ha caducado. Solicita uno nuevo.',
  flow_state_expired: 'El enlace ha caducado. Solicita uno nuevo.',
  flow_state_not_found: 'El enlace no es válido. Solicita uno nuevo.',
  bad_code_verifier: 'El enlace no es válido. Solicita uno nuevo.',
  pkce_code_verifier_not_found:
    'No se pudo completar la verificación en este navegador. Inicia sesión o solicita un enlace nuevo.',
  bad_oauth_callback: 'No se pudo completar el acceso con el proveedor',
  bad_oauth_state: 'No se pudo completar el acceso con el proveedor',
  oauth_provider_not_supported: 'Ese proveedor de acceso no está disponible',
  provider_disabled: 'Ese proveedor de acceso no está disponible',
  access_denied: 'Cancelaste el acceso con el proveedor',
  user_banned: 'Esta cuenta está suspendida',
  reset_no_session:
    'Abre el enlace de recuperación de tu correo para fijar una contraseña nueva.',
  session_expired: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  session_not_found: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
};

type AuthErrorLike = { code?: string | null } | null | undefined;

/** Traduce un error de Supabase Auth a un mensaje en español usando `error.code`. */
export const translateAuthError = (error: AuthErrorLike): string => {
  const code = error?.code;
  return (code && MESSAGES[code]) || GENERIC_MESSAGE;
};

/** Traduce un código suelto (p. ej. `error_code` de la URL del callback). */
export const translateAuthErrorCode = (code: string | null | undefined) =>
  translateAuthError({ code });
