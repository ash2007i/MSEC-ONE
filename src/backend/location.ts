import { requireAuthenticatedUser, supabase } from './supabase';

export interface LiveLocationProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  company: string | null;
  city: string | null;
  is_verified: boolean;
}

export interface LiveLocationRecord {
  user_id: string;
  latitude: number;
  longitude: number;
  location_label: string | null;
  is_sharing: boolean;
  updated_at: string;
  profile?: LiveLocationProfile | null;
}

export function getDeviceCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message || 'Location permission denied.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

export async function updateLiveLocation(input: {
  latitude: number;
  longitude: number;
  isSharing: boolean;
  locationLabel?: string | null;
}): Promise<LiveLocationRecord> {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('live_locations')
    .upsert(
      {
        user_id: user.id,
        latitude: input.latitude,
        longitude: input.longitude,
        location_label: input.locationLabel ?? null,
        is_sharing: input.isSharing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as LiveLocationRecord;
}

export async function setLocationSharing(isSharing: boolean): Promise<void> {
  const user = await requireAuthenticatedUser();

  if (isSharing) {
    const coords = await getDeviceCoordinates();
    await updateLiveLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      isSharing: true,
    });
    return;
  }

  const { error } = await supabase
    .from('live_locations')
    .update({ is_sharing: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function fetchActiveLocations(): Promise<LiveLocationRecord[]> {
  const { data, error } = await supabase
    .from('live_locations')
    .select('*')
    .eq('is_sharing', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const locations = (data ?? []) as LiveLocationRecord[];
  if (locations.length === 0) return [];

  const userIds = locations.map((l) => l.user_id);
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url, headline, company, city, is_verified')
    .in('user_id', userIds);

  if (profError) throw profError;

  const profileMap = new Map(
    ((profiles ?? []) as LiveLocationProfile[]).map((p) => [p.user_id, p])
  );

  return locations.map((loc) => ({
    ...loc,
    profile: profileMap.get(loc.user_id) ?? null,
  }));
}

export function subscribeToLiveLocations(
  onChange: () => void
): () => void {
  const channel = supabase
    .channel('live-locations-feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_locations' },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}