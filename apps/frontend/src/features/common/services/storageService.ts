import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// Cliente Supabase para subida de archivos a Supabase Storage (S3-compatible)
const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)
    : null;

export const storageService = {
  /**
   * Sube un archivo de imagen (parche o foto) a Supabase Storage (bucket S3).
   * Devuelve la URL pública accesible resultante.
   */
  async uploadImage(file: File, folder: 'missions' | 'astronauts'): Promise<string> {
    // 1. Validaciones de cliente (tipo y tamaño máximo de 5MB)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Formato de imagen inválido. Solo se admiten JPG, PNG, WEBP o SVG.');
    }

    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeInBytes) {
      throw new Error('El archivo excede el tamaño máximo permitido de 5 MB.');
    }

    // 2. Si no hay credenciales de Supabase configuradas o estamos en modo mock
    if (!supabase || ENV.USE_MOCKS) {
      // Simular almacenamiento en mock generando un data URL persistente
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }

    // 3. Subida real a Supabase Storage
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(ENV.SUPABASE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error en el almacenamiento de archivos: ${uploadError.message}`);
    }

    // 4. Obtener URL pública
    const { data } = supabase.storage.from(ENV.SUPABASE_BUCKET).getPublicUrl(fileName);

    return data.publicUrl;
  },
};

