import { requireAuthenticatedUser, supabase } from './supabase';

export interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string | null;
}

export interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  account_status: string;
  is_verified: boolean;
  avatar_url: string | null;
  headline: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileDetails {
  user_id: string;
  phone: string | null;
  registration_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  address: string | null;
  emergency_contact: string | null;
  updated_at: string;
}

export interface AcademicRecord {
  id: string;
  user_id: string;
  department_id: string | null;
  degree: string | null;
  specialization: string | null;
  admission_year: number | null;
  graduation_year: number | null;
  is_current: boolean;
  created_at: string;
  department?: Department | null;
}

export interface FullProfile {
  profile: Profile;
  details: ProfileDetails | null;
  academicRecords: AcademicRecord[];
}

export type ProfileUpdateInput = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'avatar_url'
    | 'headline'
    | 'job_title'
    | 'company'
    | 'bio'
    | 'city'
    | 'country'
    | 'website_url'
    | 'linkedin_url'
  >
>;

export type ProfileDetailsInput = Partial<
  Omit<ProfileDetails, 'user_id' | 'updated_at'>
>;

export interface AcademicRecordInput {
  department_id?: string | null;
  degree?: string | null;
  specialization?: string | null;
  admission_year?: number | null;
  graduation_year?: number | null;
  is_current?: boolean;
}

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function getMyFullProfile(): Promise<FullProfile | null> {
  const user = await requireAuthenticatedUser();

  const [profileRes, detailsRes, recordsRes, departments] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('profile_details')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('academic_records')
      .select('*')
      .eq('user_id', user.id)
      .order('graduation_year', { ascending: false }),
    getDepartments(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (detailsRes.error) throw detailsRes.error;
  if (recordsRes.error) throw recordsRes.error;
  if (!profileRes.data) return null;

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const academicRecords = ((recordsRes.data ?? []) as AcademicRecord[]).map(
    (rec) => ({
      ...rec,
      department: rec.department_id ? deptMap.get(rec.department_id) ?? null : null,
    })
  );

  return {
    profile: profileRes.data as Profile,
    details: (detailsRes.data as ProfileDetails | null) ?? null,
    academicRecords,
  };
}

export async function getProfileById(userId: string): Promise<{
  profile: Profile;
  academicRecords: AcademicRecord[];
} | null> {
  const [profileRes, recordsRes, departments] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('academic_records')
      .select('*')
      .eq('user_id', userId)
      .order('graduation_year', { ascending: false }),
    getDepartments(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (recordsRes.error) throw recordsRes.error;
  if (!profileRes.data) return null;

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const academicRecords = ((recordsRes.data ?? []) as AcademicRecord[]).map(
    (rec) => ({
      ...rec,
      department: rec.department_id ? deptMap.get(rec.department_id) ?? null : null,
    })
  );

  return {
    profile: profileRes.data as Profile,
    academicRecords,
  };
}

export async function updateMyProfile(
  updates: ProfileUpdateInput
): Promise<Profile> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function upsertMyPrivateDetails(
  updates: ProfileDetailsInput
): Promise<ProfileDetails> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('profile_details')
    .upsert(
      {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as ProfileDetails;
}

export async function addAcademicRecord(
  input: AcademicRecordInput
): Promise<AcademicRecord> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('academic_records')
    .insert({
      user_id: user.id,
      department_id: input.department_id ?? null,
      degree: input.degree ?? null,
      specialization: input.specialization ?? null,
      admission_year: input.admission_year ?? null,
      graduation_year: input.graduation_year ?? null,
      is_current: input.is_current ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AcademicRecord;
}

export async function updateAcademicRecord(
  recordId: string,
  updates: AcademicRecordInput
): Promise<AcademicRecord> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('academic_records')
    .update(updates)
    .eq('id', recordId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as AcademicRecord;
}

export async function deleteAcademicRecord(recordId: string): Promise<void> {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase
    .from('academic_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function listAlumniDirectory(filters?: {
  search?: string;
  city?: string;
  departmentId?: string;
  graduationYear?: number;
}): Promise<Array<Profile & { academicRecords: AcademicRecord[] }>> {
  let userIdFilter: string[] | null = null;

  if (filters?.departmentId || filters?.graduationYear) {
    let recQuery = supabase.from('academic_records').select('user_id');
    if (filters.departmentId) {
      recQuery = recQuery.eq('department_id', filters.departmentId);
    }
    if (filters.graduationYear) {
      recQuery = recQuery.eq('graduation_year', filters.graduationYear);
    }
    const { data: matchedRecs, error: recError } = await recQuery;
    if (recError) throw recError;

    userIdFilter = Array.from(
      new Set((matchedRecs ?? []).map((r) => r.user_id as string))
    );
    if (userIdFilter.length === 0) return [];
  }

  let query = supabase
    .from('profiles')
    .select('*')
    .eq('account_status', 'active')
    .order('full_name', { ascending: true });

  if (userIdFilter) {
    query = query.in('user_id', userIdFilter);
  }
  if (filters?.city?.trim()) {
    query = query.ilike('city', `%${filters.city.trim()}%`);
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,company.ilike.%${term}%,job_title.ilike.%${term}%,city.ilike.%${term}%`
    );
  }

  const { data: profiles, error } = await query;
  if (error) throw error;

  const list = (profiles ?? []) as Profile[];
  if (list.length === 0) return [];

  const userIds = list.map((p) => p.user_id);
  const [recordsRes, departments] = await Promise.all([
    supabase.from('academic_records').select('*').in('user_id', userIds),
    getDepartments(),
  ]);

  if (recordsRes.error) throw recordsRes.error;

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const recordsByUser = new Map<string, AcademicRecord[]>();

  for (const rec of (recordsRes.data ?? []) as AcademicRecord[]) {
    const enriched: AcademicRecord = {
      ...rec,
      department: rec.department_id ? deptMap.get(rec.department_id) ?? null : null,
    };
    const existing = recordsByUser.get(rec.user_id) ?? [];
    existing.push(enriched);
    recordsByUser.set(rec.user_id, existing);
  }

  return list.map((profile) => ({
    ...profile,
    academicRecords: recordsByUser.get(profile.user_id) ?? [],
  }));
}