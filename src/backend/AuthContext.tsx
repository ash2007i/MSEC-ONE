import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSession, onAuthStateChange } from './auth';
import {
  getMyFullProfile,
  type AcademicRecord,
  type FullProfile,
  type Profile,
  type ProfileDetails,
} from './profile';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  fullProfile: FullProfile | null;
  profile: Profile | null;
  details: ProfileDetails | null;
  academicRecords: AcademicRecord[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await getMyFullProfile();
      setFullProfile(data);
    } catch (err) {
      console.error('Failed to load alumni profile:', err);
      setFullProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getSession()
      .then((initialSession) => {
        if (!active) return;
        setSession(initialSession);
        setAuthLoading(false);
      })
      .catch((err) => {
        console.error('Failed to restore session:', err);
        if (active) setAuthLoading(false);
      });

    const unsubscribe = onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setFullProfile(null);
      setProfileLoading(false);
      return;
    }

    void loadProfile();
  }, [session?.user?.id, loadProfile]);

  const profile = fullProfile?.profile ?? null;

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    fullProfile,
    profile,
    details: fullProfile?.details ?? null,
    academicRecords: fullProfile?.academicRecords ?? [],
    isAuthenticated: Boolean(session?.user),
    isAdmin: profile?.role === 'admin',
    loading: authLoading || profileLoading,
    refreshProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}