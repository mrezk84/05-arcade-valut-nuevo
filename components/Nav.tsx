'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@/app/context/UserContext';

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="av-avatar" aria-hidden="true">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, email, avatar, loading, signOut } = useUser();

  const isLibrary = pathname.startsWith('/games');
  const isHall = pathname === '/hall-of-fame';
  const isAbout = pathname === '/about';

  function close() {
    setOpen(false);
  }

  async function handleSignOut() {
    close();
    await signOut();
    router.push('/');
  }

  return (
    <>
      <nav className={`av-nav${user ? ' signed-in' : ''}`}>
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/games" className={isLibrary ? 'active' : ''}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isHall ? 'active' : ''}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAbout ? 'active' : ''}>
            Sobre Nosotros
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>

        {loading ? (
          <span
            className="btn ghost auth-btn"
            aria-hidden="true"
            style={{ visibility: 'hidden' }}
          >
            Iniciar Sesión
          </span>
        ) : user ? (
          <>
            <Link
              href="/account"
              className="av-user-chip"
              title={email ?? undefined}
            >
              <Avatar name={user} src={avatar} />
              <span className="name">{user}</span>
            </Link>
            <button
              type="button"
              className="btn ghost signout-btn"
              onClick={handleSignOut}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={`av-mobile-backdrop${open ? ' open' : ''}`}
        onClick={close}
      />
      <aside className={`av-mobile-panel${open ? ' open' : ''}`}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/games"
          className={isLibrary ? 'active' : ''}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/hall-of-fame"
          className={isHall ? 'active' : ''}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAbout ? 'active' : ''} onClick={close}>
          Sobre Nosotros
        </Link>
        {user ? (
          <>
            <Link
              href="/account"
              className={`who${pathname === '/account' ? ' active' : ''}`}
              onClick={close}
            >
              <Avatar name={user} src={avatar} />
              <div className="text">
                <span className="name">{user}</span>
                {email && <span className="mail">{email}</span>}
              </div>
            </Link>
            <button type="button" className="signout" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            href="/auth"
            className={pathname === '/auth' ? 'active' : ''}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: 'var(--ink-faint)',
            letterSpacing: '0.16em',
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
