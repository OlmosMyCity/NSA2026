import { httpClient } from './httpClient';

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, igual que el backend

export const storageService = {
  /**
   * Sube un parche o una foto mediante el backend (`POST /api/uploads/{folder}`, solo ADMIN),
   * que lo guarda en Vercel Blob o Supabase Storage con credenciales de servidor, y devuelve
   * la URL pública. El navegador nunca recibe claves de almacenamiento.
   */
  async uploadImage(file: File, folder: 'missions' | 'astronauts'): Promise<string> {
    // Validación previa en cliente (sin SVG por seguridad); el backend vuelve a validar.
    if (!VALID_TYPES.includes(file.type)) {
      throw new Error('Invalid image format. Only JPG, PNG or WEBP are allowed.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('The file exceeds the 5 MB maximum size.');
    }

    const formData = new FormData();
    formData.append('file', file);
    const res = await httpClient.post<{ url: string }>(`/uploads/${folder}`, formData);
    return res.url;
  },
};
