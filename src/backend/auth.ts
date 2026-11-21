import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { requireAuthenticatedUser, supabase } from './supabase';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role?: 'alumni' | 'student' | 'admin';
  graduationYear?: number;
  departmentId?: string;
}

export interface AlumniVerification {
  id: string;
  user_id: string;
  institution_email: string | null;
  graduation_year: number | null;
  proof_path: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(input: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        role: input.role ?? 'alumni',
        graduation_year: input.graduationYear ?? null,
        department_id: input.departmentId ?? null,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function resetPassword(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectTo ?? `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function submitAlumniVerification(input: {
  institutionEmail?: string;
  graduationYear?: number;
  proofPath?: string;
}): Promise<AlumniVerification> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('alumni_verifications')
    .insert({
      user_id: user.id,
      institution_email: input.institutionEmail?.trim() ?? null,
      graduation_year: input.graduationYear ?? null,
      proof_path: input.proofPath ?? null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AlumniVerification;
}

export async function getMyVerificationStatus(): Promise<AlumniVerification | null> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('alumni_verifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as AlumniVerification | null;
}