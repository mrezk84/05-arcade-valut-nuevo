'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/app/context/UserContext';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ open: boolean; path: string }>({
    open: false,
    path: '',
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, email, loading, signOut } = useUser();

  // El menú se cierra solo al cambiar de ruta (estado derivado, sin efecto).
  const menuOpen = menu.open && menu.path === pathname;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node))
        setMenu({ open: false, path: '' });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu({ open: false, path: '' });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const isLibrary = pathname.startsWith('/games');
  const isHall = pathname === '/hall-of-fame';
  const isAbout = pathname === '/about';

  function close() {
    setOpen(false);
  }

  async function handleSignOut() {
    close();
    setMenu({ open: false, path: '' });
    await signOut();
    router.push('/');
  }

  return (
    <>
      <nav className="av-nav">
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
          <div className="av-user-wrap" ref={menuRef}>
            <button
              type="button"
              className="btn ghost auth-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenu({ open: !menuOpen, path: pathname })}
            >
              {user} ▾
            </button>
            {menuOpen && (
              <div className="av-user-menu" role="menu">
                <div className="who">
                  <span className="name">{user}</span>
                  {email && <span className="mail">{email}</span>}
                </div>
                <button type="button" role="menuitem" onClick={handleSignOut}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
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
            <div className="who">
              <span className="name">{user}</span>
              {email && <span className="mail">{email}</span>}
            </div>
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
