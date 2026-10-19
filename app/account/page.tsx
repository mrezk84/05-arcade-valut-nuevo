'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import AvatarPicker from '@/components/AvatarPicker';
import { isAvatarId, type AvatarId } from '@/lib/auth/avatars';
import { translateAuthError } from '@/lib/auth/errors';
import { USERNAME_MAX, normalizeUsername } from '@/lib/auth/username';
import { createClient } from '@/lib/supabase/client';

const PASSWORD_MIN = 8;

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const avatarIdFromSrc = (src: string | null): AvatarId | null => {
  const id = src?.match(/^\/avatars\/(\w+)\.svg$/)?.[1];
  return isAvatarId(id) ? id : null;
};

function AccountForms({
  name,
  email,
  avatarSrc,
}: {
  name: string;
  email: string | null;
  avatarSrc: string | null;
}) {
  const [supabase] = useState(createClient);
  const [busy, setBusy] = useState(false);

  // Con foto de Google o GitHub, esa foto tiene prioridad: no se ofrece elegir.
  const hasProviderPhoto = !!avatarSrc && !avatarSrc.startsWith('/');

  const [username, setUsername] = useState(name);
  const [avatar, setAvatar] = useState<AvatarId | null>(
    avatarIdFromSrc(avatarSrc),
  );
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);

  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passErrors, setPassErrors] = useState<{
    pass?: string;
    confirm?: string;
  }>({});
  const [passNotice, setPassNotice] = useState<Notice>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setProfileNotice(null);
    const trimmed = username.trim();
    const error =
      trimmed.length < 1
        ? 'Escribe un nombre de usuario'
        : trimmed.length > USERNAME_MAX
          ? `Máximo ${USERNAME_MAX} caracteres`
          : null;
    setUsernameError(error);
    if (error) return;

    setBusy(true);
    try {
      // Solo se envían las claves que cambian; `avatar: null` borra la clave.
      const data: { username: string; avatar?: AvatarId | null } = {
        username: normalizeUsername(trimmed),
      };
      if (!hasProviderPhoto) data.avatar = avatar;
      const { error: updateError } = await supabase.auth.updateUser({ data });
      if (updateError) {
        setProfileNotice({
          kind: 'error',
          text: translateAuthError(updateError),
        });
        return;
      }
      setProfileNotice({ kind: 'ok', text: 'Datos guardados' });
    } catch {
      setProfileNotice({ kind: 'error', text: translateAuthError(null) });
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setPassNotice(null);
    const found: { pass?: string; confirm?: string } = {};
    if (pass.length < PASSWORD_MIN)
      found.pass = `Mínimo ${PASSWORD_MIN} caracteres`;
    if (confirm !== pass) found.confirm = 'Las contraseñas no coinciden';
    setPassErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) {
        setPassNotice({ kind: 'error', text: translateAuthError(error) });
        return;
      }
      setPass('');
      setConfirm('');
      setPassNotice({ kind: 'ok', text: 'Contraseña actualizada' });
    } catch {
      setPassNotice({ kind: 'error', text: translateAuthError(null) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">MI CUENTA</h2>
        </div>

        <div className="auth-divider">PERFIL</div>
        <form onSubmit={saveProfile} noValidate>
          <div className="field">
            <label htmlFor="account-email">Correo electrónico</label>
            <input
              id="account-email"
              type="email"
              value={email ?? ''}
              readOnly
              aria-readonly="true"
            />
          </div>
          <div className="field">
            <label htmlFor="account-username">Usuario</label>
            <input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="nickname"
              aria-invalid={!!usernameError}
              aria-describedby={
                usernameError ? 'account-username-err' : undefined
              }
            />
            {usernameError && (
              <span
                className="field-error"
                id="account-username-err"
                role="alert"
              >
                {usernameError}
              </span>
            )}
          </div>
          {!hasProviderPhoto && (
            <AvatarPicker value={avatar} onChange={setAvatar} disabled={busy} />
          )}

          {profileNotice && (
            <div
              className={`auth-alert${profileNotice.kind === 'ok' ? ' ok' : ''}`}
              role={profileNotice.kind === 'ok' ? 'status' : 'alert'}
            >
              {profileNotice.text}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: '100%', marginTop: 8 }}
          >
            {busy ? 'GUARDANDO…' : 'GUARDAR PERFIL'}
          </button>
        </form>

        <div className="auth-divider">CONTRASEÑA</div>
        <form onSubmit={savePassword} noValidate>
          <div className="field">
            <label htmlFor="account-pass">Contraseña nueva</label>
            <input
              id="account-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!passErrors.pass}
              aria-describedby={
                passErrors.pass ? 'account-pass-err' : undefined
              }
            />
            {passErrors.pass && (
              <span className="field-error" id="account-pass-err" role="alert">
                {passErrors.pass}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="account-confirm">Repite la contraseña</label>
            <input
              id="account-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!passErrors.confirm}
              aria-describedby={
                passErrors.confirm ? 'account-confirm-err' : undefined
              }
            />
            {passErrors.confirm && (
              <span
                className="field-error"
                id="account-confirm-err"
                role="alert"
              >
                {passErrors.confirm}
              </span>
            )}
          </div>

          {passNotice && (
            <div
              className={`auth-alert${passNotice.kind === 'ok' ? ' ok' : ''}`}
              role={passNotice.kind === 'ok' ? 'status' : 'alert'}
            >
              {passNotice.text}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: '100%', marginTop: 8 }}
          >
            {busy ? 'GUARDANDO…' : 'CAMBIAR CONTRASEÑA'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Account() {
  const { user, email, avatar, loading } = useUser();
  const router = useRouter();

  // Sin sesión no hay nada que editar.
  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return <AccountForms name={user} email={email} avatarSrc={avatar} />;
}
