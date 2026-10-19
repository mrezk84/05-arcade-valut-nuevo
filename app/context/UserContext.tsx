'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { getDisplayName } from '@/lib/auth/username';
import { createClient } from '@/lib/supabase/client';

interface UserContextValue {
  user: string | null;
  email: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  email: null,
  loading: true,
  signOut: async () => {},
});

const nameFromSession = (session: Session | null) =>
  session ? getDisplayName(session.user) : null;

const emailFromSession = (session: Session | null) =>
  session?.user.email ?? null;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(createClient);
  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(nameFromSession(data.session));
      setEmail(emailFromSession(data.session));
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(nameFromSession(session));
      setEmail(emailFromSession(session));
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setEmail(null);
  }

  return (
    <UserContext.Provider value={{ user, email, loading, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
