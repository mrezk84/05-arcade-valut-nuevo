import { createHmac } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const CONTACT_LIMITS = {
  perIp: 3,
  ipWindow: '1 hour',
  global: 30, // por día
} as const;

export type RateLimitResult = 'ok' | 'ip_limit' | 'global_limit';

const RETRY_AFTER_SECONDS = { ip_limit: 60 * 60, global_limit: 24 * 60 * 60 };

// Aproximado: la función SQL no devuelve cuándo expira la ventana.
export const retryAfterSeconds = (
  result: Exclude<RateLimitResult, 'ok'>,
): number => RETRY_AFTER_SECONDS[result];

export const getClientIp = (request: Request): string => {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
};

// La IP no se guarda en claro: HMAC-SHA256 con una sal secreta.
export const hashIp = (ip: string): string => {
  const salt = process.env.CONTACT_IP_SALT;
  if (!salt) throw new Error('Falta CONTACT_IP_SALT');
  return createHmac('sha256', salt).update(ip).digest('hex');
};

// Cuenta e inserta el intento de forma atómica. Lanza si Supabase falla:
// la ruta debe fallar cerrada.
export const checkContactRateLimit = async (
  request: Request,
): Promise<RateLimitResult> => {
  const { data, error } = await createAdminClient().rpc(
    'contact_rate_limit_check',
    {
      p_ip_hash: hashIp(getClientIp(request)),
      p_ip_limit: CONTACT_LIMITS.perIp,
      p_ip_window: CONTACT_LIMITS.ipWindow,
      p_global_limit: CONTACT_LIMITS.global,
    },
  );

  if (error) throw error;
  if (data !== 'ok' && data !== 'ip_limit' && data !== 'global_limit') {
    throw new Error(`Respuesta inesperada del límite: ${String(data)}`);
  }
  return data;
};
