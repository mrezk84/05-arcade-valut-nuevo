'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { translateAuthError, translateAuthErrorCode } from '@/lib/auth/errors';
import { USERNAME_MAX, normalizeUsername } from '@/lib/auth/username';
import AvatarPicker from '@/components/AvatarPicker';
import type { AvatarId } from '@/lib/auth/avatars';
import { createClient } from '@/lib/supabase/client';

type Tab = 'in' | 'up';
type FieldErrors = { username?: string; email?: string; pass?: string };

const PASSWORD_MIN = 8;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function AuthForm() {
  const params = useSearchParams();
  const callbackError = params.get('error');

  const [tab, setTab] = useState<Tab>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    callbackError ? translateAuthErrorCode(callbackError) : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabase] = useState(createClient);
  const { user, email: sessionEmail, signOut } = useUser();
  const router = useRouter();

  // Al volver con "atrás" desde el proveedor, la página puede restaurarse en estado de carga.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    setErrors({});
    setFormError(null);
    setInfo(null);
    setUnverified(false);
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (tab === 'up') {
      const name = username.trim();
      if (name.length < 1) found.username = 'Escribe un nombre de usuario';
      else if (name.length > USERNAME_MAX)
        found.username = `Máximo ${USERNAME_MAX} caracteres`;
    }
    if (!email.trim()) found.email = 'Escribe tu correo';
    else if (!EMAIL_RE.test(email.trim()))
      found.email = 'El correo no es válido';
    if (!pass) found.pass = 'Escribe tu contraseña';
    else if (tab === 'up' && pass.length < PASSWORD_MIN)
      found.pass = `Mínimo ${PASSWORD_MIN} caracteres`;
    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError(null);
    setInfo(null);
    setUnverified(false);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    const mail = email.trim();
    try {
      if (tab === 'in') {
        const { error } = await supabase.auth.signInWithPassword({
          email: mail,
          password: pass,
        });
        if (error) {
          if (error.code === 'email_not_confirmed') setUnverified(true);
          setFormError(translateAuthError(error));
          return;
        }
        router.push('/');
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password: pass,
        options: {
          data: {
            username: normalizeUsername(username),
            ...(avatar ? { avatar } : {}),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setFormError(translateAuthError(error));
        return;
      }
      // Con la confirmación de correo activa, Supabase no devuelve error si el
      // correo ya existe: responde con un usuario sin identidades.
      if (data.user && data.user.identities?.length === 0) {
        setFormError(translateAuthErrorCode('user_already_exists'));
        return;
      }
      setSentTo(mail);
      setPass('');
    } catch {
      setFormError(translateAuthError(null));
    } finally {
      setLoading(false);
    }
  }

  async function resend(target: string) {
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setFormError(translateAuthError(error));
      else setInfo('Te enviamos el correo de nuevo');
    } catch {
      setFormError(translateAuthError(null));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithProvider(provider: 'google' | 'github') {
    if (loading) return;
    setFormError(null);
    setInfo(null);
    setUnverified(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // Si no hay error, el navegador está saliendo hacia el proveedor.
      if (error) {
        setFormError(translateAuthError(error));
        setLoading(false);
      }
    } catch {
      setFormError(translateAuthError(null));
      setLoading(false);
    }
  }

  async function playAsGuest() {
    await signOut();
    router.push('/');
  }

  function backToLogin() {
    setSentTo(null);
    setForgot(false);
    setResetSent(false);
    setErrors({});
    setInfo(null);
    setFormError(null);
    setTab('in');
  }

  function openForgot() {
    setErrors({});
    setFormError(null);
    setInfo(null);
    setUnverified(false);
    setResetSent(false);
    setForgot(true);
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError(null);
    const mail = email.trim();
    if (!mail) return setErrors({ email: 'Escribe tu correo' });
    if (!EMAIL_RE.test(mail))
      return setErrors({ email: 'El correo no es válido' });
    setErrors({});

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      if (error) setFormError(translateAuthError(error));
      // Mismo mensaje exista o no el correo, para no revelar qué cuentas existen.
      else setResetSent(true);
    } catch {
      setFormError(translateAuthError(null));
    } finally {
      setLoading(false);
    }
  }

  const header = (
    <div className="auth-header">
      <div className="mark" />
      <h2 className="neon-cyan">ARCADE VAULT</h2>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-faint)',
          letterSpacing: '0.16em',
          marginTop: 6,
        }}
      >
        ACCESO AL SISTEMA · v2.6
      </div>
    </div>
  );

  if (user && !callbackError) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-alert ok" role="status">
            <strong>Ya iniciaste sesión</strong>
            Estás dentro como {user}
            {sessionEmail ? ` (${sessionEmail})` : ''}.
          </div>
          <button
            className="btn lg"
            type="button"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => router.push('/')}
          >
            IR AL VAULT
          </button>
          <button
            className="btn ghost"
            type="button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={signOut}
          >
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          <div className="auth-alert ok" role="status">
            <strong>Revisa tu correo</strong>
            Enviamos un enlace de verificación a {sentTo}. Ábrelo para activar
            tu cuenta y entrar al Vault.
          </div>
          {formError && (
            <div className="auth-alert" role="alert">
              {formError}
            </div>
          )}
          {info && (
            <div className="auth-alert ok" role="status">
              {info}
            </div>
          )}
          <button
            className="btn"
            type="button"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
            onClick={() => resend(sentTo)}
          >
            {loading ? 'ENVIANDO…' : 'REENVIAR CORREO'}
          </button>
          <button
            className="btn ghost"
            type="button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={backToLogin}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  if (forgot) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          {header}
          {resetSent ? (
            <div className="auth-alert ok" role="status">
              <strong>Revisa tu correo</strong>
              Si existe una cuenta con ese correo, te enviamos un enlace para
              fijar una contraseña nueva.
            </div>
          ) : (
            <form onSubmit={sendReset} noValidate>
              <div className="mono auth-hint">
                Escribe tu correo y te enviaremos un enlace para recuperar tu
                contraseña.
              </div>
              <div className="field">
                <label htmlFor="auth-forgot-email">Correo electrónico</label>
                <input
                  id="auth-forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? 'auth-forgot-email-err' : undefined
                  }
                />
                {errors.email && (
                  <span
                    className="field-error"
                    id="auth-forgot-email-err"
                    role="alert"
                  >
                    {errors.email}
                  </span>
                )}
              </div>
              {formError && (
                <div className="auth-alert" role="alert">
                  {formError}
                </div>
              )}
              <button
                className="btn lg"
                type="submit"
                disabled={loading}
                style={{ width: '100%', marginTop: 8 }}
              >
                {loading ? 'ENVIANDO…' : 'ENVIAR ENLACE'}
              </button>
            </form>
          )}
          <button
            className="btn ghost"
            type="button"
            style={{ width: '100%', marginTop: 10 }}
            onClick={backToLogin}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        {header}

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === 'in' ? 'on' : ''}
            onClick={() => switchTab('in')}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === 'up' ? 'on' : ''}
            onClick={() => switchTab('up')}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {tab === 'up' && (
            <div className="field slide-in">
              <label htmlFor="auth-username">Usuario</label>
              <input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                autoComplete="nickname"
                aria-invalid={!!errors.username}
                aria-describedby={
                  errors.username ? 'auth-username-err' : undefined
                }
              />
              {errors.username && (
                <span
                  className="field-error"
                  id="auth-username-err"
                  role="alert"
                >
                  {errors.username}
                </span>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'auth-email-err' : undefined}
            />
            {errors.email && (
              <span className="field-error" id="auth-email-err" role="alert">
                {errors.email}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
              aria-invalid={!!errors.pass}
              aria-describedby={errors.pass ? 'auth-pass-err' : undefined}
            />
            {errors.pass && (
              <span className="field-error" id="auth-pass-err" role="alert">
                {errors.pass}
              </span>
            )}
          </div>

          {tab === 'up' && (
            <AvatarPicker
              value={avatar}
              onChange={setAvatar}
              disabled={loading}
            />
          )}

          {tab === 'in' && (
            <button
              type="button"
              className="auth-link auth-forgot"
              onClick={openForgot}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {formError && (
            <div className="auth-alert" role="alert">
              {formError}
              {unverified && (
                <button
                  type="button"
                  className="auth-link"
                  disabled={loading}
                  onClick={() => resend(email.trim())}
                >
                  Reenviar correo
                </button>
              )}
            </div>
          )}
          {info && (
            <div className="auth-alert ok" role="status">
              {info}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading
              ? 'CARGANDO…'
              : tab === 'in'
                ? 'ENTRAR AL VAULT'
                : 'CREAR Y JUGAR'}
          </button>
        </form>

        <button
          type="button"
          className="btn ghost"
          style={{ width: '100%', marginTop: 10 }}
          disabled={loading}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => signInWithProvider('google')}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => signInWithProvider('github')}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

export default function Auth() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
