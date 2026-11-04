import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://uxcoyxjykkwdihmasnfj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_54gY5lO9-_cHjy2IQns0cA_P5YrOGPn';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('seu-projeto')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
