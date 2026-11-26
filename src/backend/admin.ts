import { requireAuthenticatedUser, supabase } from './supabase';
import type { AlumniVerification } from './auth';

export interface PendingVerificationItem extends AlumniVerification {
  applicant: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
}

export interface AdminStats {
  totalUsers: number;
  verifiedAlumni: number;
  pendingVerifications: number;
  publishedPosts: number;
  publishedOpportunities: number;
  publishedEvents: number;
}

export async function uploadVerificationProof(
  file: File,
  bucket = 'verification-proofs'
): Promise<string> {
  const user = await requireAuthenticatedUser();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${user.id}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: false });

  if (error) throw error;
  return filePath;
}

export async function getPendingVerifications(): Promise<
  PendingVerificationItem[]
> {
  const { data, error } = await supabase
    .from('alumni_verifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const items = (data ?? []) as AlumniVerification[];
  if (items.length === 0) return [];

  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url, role')
    .in('user_id', userIds);

  if (profError) throw profError;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.user_id as string,
      p as PendingVerificationItem['applicant'],
    ])
  );

  return items.map((item) => ({
    ...item,
    applicant: profileMap.get(item.user_id) ?? null,
  }));
}

export async function reviewVerification(
  verificationId: string,
  decision: 'approved' | 'rejected',
  adminNotes?: string
): Promise<AlumniVerification> {
  const admin = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('alumni_verifications')
    .update({
      status: decision,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes?.trim() ?? null,
    })
    .eq('id', verificationId)
    .select()
    .single();

  if (error) throw error;
  return data as AlumniVerification;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, verified, pending, posts, opportunities, events] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true),
      supabase
        .from('alumni_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
    ]);

  return {
    totalUsers: users.count ?? 0,
    verifiedAlumni: verified.count ?? 0,
    pendingVerifications: pending.count ?? 0,
    publishedPosts: posts.count ?? 0,
    publishedOpportunities: opportunities.count ?? 0,
    publishedEvents: events.count ?? 0,
  };
}