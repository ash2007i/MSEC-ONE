import { requireAuthenticatedUser, supabase } from './supabase';

export interface Opportunity {
  id: string;
  author_id: string;
  title: string;
  company_name: string | null;
  description: string;
  opportunity_type: string;
  location: string | null;
  work_mode: string | null;
  application_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityResponse {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  resume_path: string | null;
  cover_letter: string | null;
  status: string;
  created_at: string;
}

export interface AlumniEvent {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  venue: string | null;
  is_online: boolean;
  meeting_url: string | null;
  start_time: string;
  end_time: string | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  registration_status: string;
  registered_at: string;
}

export interface MentorshipRequest {
  id: string;
  student_id: string;
  mentor_id: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getOpportunities(filters?: {
  type?: string;
  workMode?: string;
  search?: string;
}): Promise<Opportunity[]> {
  let query = supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (filters?.type && filters.type !== 'All') {
    query = query.eq('opportunity_type', filters.type);
  }
  if (filters?.workMode && filters.workMode !== 'All') {
    query = query.eq('work_mode', filters.workMode);
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `title.ilike.%${term}%,company_name.ilike.%${term}%,location.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Opportunity[];
}

export async function createOpportunity(input: {
  title: string;
  description: string;
  opportunity_type: string;
  company_name?: string | null;
  location?: string | null;
  work_mode?: string | null;
  application_url?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  deadline?: string | null;
}): Promise<Opportunity> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      author_id: user.id,
      ...input,
      status: 'published',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Opportunity;
}

export async function applyToOpportunity(input: {
  opportunityId: string;
  coverLetter?: string | null;
  resumePath?: string | null;
}): Promise<OpportunityResponse> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('opportunity_responses')
    .insert({
      opportunity_id: input.opportunityId,
      applicant_id: user.id,
      cover_letter: input.coverLetter?.trim() ?? null,
      resume_path: input.resumePath ?? null,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) throw error;
  return data as OpportunityResponse;
}

export async function getEvents(upcomingOnly = false): Promise<AlumniEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('start_time', { ascending: true });

  if (upcomingOnly) {
    query = query.gte('start_time', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AlumniEvent[];
}

export async function registerForEvent(
  eventId: string
): Promise<EventRegistration> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('event_registrations')
    .insert({
      event_id: eventId,
      user_id: user.id,
      registration_status: 'registered',
    })
    .select()
    .single();

  if (error) throw error;
  return data as EventRegistration;
}

export async function cancelEventRegistration(eventId: string): Promise<void> {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase
    .from('event_registrations')
    .update({ registration_status: 'cancelled' })
    .eq('event_id', eventId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getMyEventRegistrations(): Promise<EventRegistration[]> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('registration_status', 'registered');

  if (error) throw error;
  return (data ?? []) as EventRegistration[];
}

export async function createMentorshipRequest(
  mentorId: string,
  message?: string
): Promise<MentorshipRequest> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('mentorship_requests')
    .insert({
      student_id: user.id,
      mentor_id: mentorId,
      message: message?.trim() ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as MentorshipRequest;
}

export async function updateMentorshipStatus(
  requestId: string,
  status: 'accepted' | 'declined' | 'cancelled'
): Promise<MentorshipRequest> {
  const { data, error } = await supabase
    .from('mentorship_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data as MentorshipRequest;
}