import { supabase } from './supabase';
import type { User } from '../types';

export async function fetchUserProfileByAuthId(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return data as User;
}

export async function fetchUserProfileByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as User;
}
