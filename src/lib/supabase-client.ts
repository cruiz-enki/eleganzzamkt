import { createClient } from '@supabase/supabase-js';

// Estas variables se configurarán manualmente con tus keys de Supabase
// Puedes añadirlas a un archivo .env o configurarlas directamente aquí
const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] || 'https://eqshiiiekxbpsdilckuv.supabase.co';
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxc2hpaWlla3hicHNkaWxja3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDI1NTAsImV4cCI6MjEwMTAxODU1MH0.Prq76bjv4UimUHThnweMZtUsI8bdNb-KAKSDXGSS9OQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
