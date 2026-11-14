/**
 * Configuración centralizada de variables de entorno para el cliente frontend.
 */
export const ENV = {
  API_HOST: process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:4000/api',
  USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === 'true',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'artemis-assets',
} as const;

