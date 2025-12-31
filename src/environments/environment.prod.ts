export const environment = {
  production: true,
  supabaseUrl: (window as any).__env?.SUPABASE_URL,
  supabaseAnonKey: (window as any).__env?.SUPABASE_ANON_KEY
};
