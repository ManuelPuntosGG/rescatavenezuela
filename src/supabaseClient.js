import { createClient } from '@supabase/supabase-js';

// Se utilizan variables de entorno de Vite para proteger las llaves en producción
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan las variables de entorno de Supabase. Verifica tu archivo .env");
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);