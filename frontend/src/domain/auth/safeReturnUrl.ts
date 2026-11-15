/**
 * Destino después del login. Solo acepta rutas internas para evitar redirecciones
 * abiertas (`//evil.com`, `/\evil.com`, URLs absolutas); cualquier otra cosa vuelve a `/`.
 */
export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
