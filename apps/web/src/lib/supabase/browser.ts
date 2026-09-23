import { createBrowserClient } from '@supabase/ssr';
import { supabaseConfig } from './config';

export function browserClient() {
  const config = supabaseConfig();
  if (!config) throw new Error('Supabase is not configured');
  return createBrowserClient(config.url, config.key);
}
