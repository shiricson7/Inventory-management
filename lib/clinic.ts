import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export async function ensureCurrentClinicId(supabase: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('current_clinic_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.current_clinic_id) return profile.current_clinic_id as string;

  const { data: memberships, error: membershipError } = await supabase
    .from('clinic_members')
    .select('clinic_id')
    .eq('user_id', userId)
    .limit(1);

  if (membershipError) throw membershipError;
  const clinicId = memberships?.[0]?.clinic_id as string | undefined;
  if (!clinicId) redirect('/setup');

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, current_clinic_id: clinicId }, { onConflict: 'user_id' });
  if (upsertError) throw upsertError;

  return clinicId;
}

