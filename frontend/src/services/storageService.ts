/**
 * Media upload service for mission patches and crew portraits.
 * Supports client-side validation, mock data URL generation, backend upload relay,
 * and direct S3-compatible Supabase Storage uploads.
 *
 * @module services/storageService
 */

import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { httpClient } from './httpClient';

// Supabase client for direct uploads to S3-compatible Supabase Storage
const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)
    : null;

export const storageService = {
  /**
   * Validates and uploads an image file (mission patch or portrait) and returns
   * the resulting publicly accessible URL or mock data URL.
   */
  async uploadImage(file: File, folder: 'missions' | 'astronauts'): Promise<string> {
    // 1. Client-side validation (MIME whitelist and 5 MB limit; SVG excluded for security)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Formato de imagen inválido. Solo se admiten JPG, PNG o WEBP.');
    }

    const maxSizeInBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeInBytes) {
      throw new Error('El archivo excede el tamaño máximo permitido de 5 MB.');
    }

    // 2. Mock mode: generate a local data URL for backendless testing
    if (ENV.USE_MOCKS) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }

    // 3. Fallback to backend upload relay (Vercel Blob) when Supabase client credentials are absent
    if (!supabase) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await httpClient.post<{ url: string }>(`/uploads/${folder}`, formData);
      return res.url;
    }

    // 4. Direct upload to Supabase Storage when configured on the client
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

    // 5. Resolve public asset URL
    const { data } = supabase.storage.from(ENV.SUPABASE_BUCKET).getPublicUrl(fileName);

    return data.publicUrl;
  },
};

