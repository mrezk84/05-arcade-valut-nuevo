import { Resend } from 'resend';
import {
  checkContactRateLimit,
  retryAfterSeconds,
  type RateLimitResult,
} from '@/lib/contact/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

const LIMITS = { name: 80, email: 254, msg: 2000 } as const;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Quita saltos de línea para que no se cuelen en el asunto del correo.
const singleLine = (value: string) => value.replace(/[\r\n]+/g, ' ');

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Solicitud no válida.');
  }

  const { name, email, msg, website } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof msg !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    !msg.trim()
  ) {
    return badRequest('Todos los campos son requeridos.');
  }

  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    msg.length > LIMITS.msg
  ) {
    return badRequest('Algún campo supera la longitud máxima.');
  }

  if (!EMAIL_RE.test(email.trim())) {
    return badRequest('El correo no es válido.');
  }

  // Honeypot: solo los bots rellenan `website`. Se responde ok para no darles pistas,
  // sin enviar correo ni consumir el límite.
  if (typeof website === 'string' && website.trim() !== '') {
    return Response.json({ ok: true });
  }

  // El intento cuenta aunque Resend falle después, para que reintentar en bucle no evite el límite.
  let limit: RateLimitResult;
  try {
    limit = await checkContactRateLimit(request);
  } catch (err) {
    // Falla cerrada: si no se puede comprobar el límite, no se envía.
    console.error('[contact] error al comprobar el límite', err);
    return Response.json(
      { error: 'El servicio no está disponible. Inténtalo más tarde.' },
      { status: 503 },
    );
  }

  if (limit !== 'ok') {
    return Response.json(
      {
        error: 'Has enviado demasiados mensajes. Inténtalo de nuevo más tarde.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds(limit)) },
      },
    );
  }

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'mrezk84@gmail.com',
      replyTo: email.trim(),
      subject: `[Arcade Vault] Mensaje de ${singleLine(name.trim())}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name.trim())}</p>
        <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${escapeHtml(msg.trim()).replace(/\n/g, '<br />')}</p>
      `,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[contact] error al enviar el correo', err);
    return Response.json(
      { error: 'No se pudo enviar el mensaje. Inténtalo más tarde.' },
      { status: 500 },
    );
  }
}
