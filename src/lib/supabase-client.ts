import { createClient } from '@supabase/supabase-js';

// Estas variables se configurarán manualmente con tus keys de Supabase
// Puedes añadirlas a un archivo .env o configurarlas directamente aquí
const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] || 'https://eqshiiiekxbpsdilckuv.supabase.co';
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] || 'tu-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
