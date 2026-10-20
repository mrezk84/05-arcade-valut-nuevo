'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { translateAuthError } from '@/lib/auth/errors';
import { validatePassword } from '@/lib/auth/password';
import { createClient } from '@/lib/supabase/client';

type FieldErrors = { pass?: string; confirm?: string };

export default function ResetPassword() {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supabase] = useState(createClient);
  const { user, loading: sessionLoading } = useUser();
  const router = useRouter();

  // Sin la sesión de recuperación (enlace del correo) esta pantalla no sirve.
  useEffect(() => {
    if (!sessionLoading && !user)
      router.replace('/auth?error=reset_no_session');
  }, [sessionLoading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError(null);
    const found: FieldErrors = {};
    const passError = validatePassword(pass);
    if (passError) found.pass = passError;
    if (confirm !== pass) found.confirm = 'Las contraseñas no coinciden';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) {
        setFormError(translateAuthError(error));
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setFormError(translateAuthError(null));
    } finally {
      setLoading(false);
    }
  }

  if (sessionLoading || !user) return null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
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
            CONTRASEÑA NUEVA
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="reset-pass">Contraseña nueva</label>
            <input
              id="reset-pass"
              type="password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                if (errors.pass)
                  setErrors((prev) => ({ ...prev, pass: undefined }));
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.pass}
              aria-describedby={errors.pass ? 'reset-pass-err' : undefined}
            />
            {errors.pass && (
              <span className="field-error" id="reset-pass-err" role="alert">
                {errors.pass}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">Repite la contraseña</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={
                errors.confirm ? 'reset-confirm-err' : undefined
              }
            />
            {errors.confirm && (
              <span className="field-error" id="reset-confirm-err" role="alert">
                {errors.confirm}
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
            {loading ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
          </button>
        </form>
      </div>
    </div>
  );
}
