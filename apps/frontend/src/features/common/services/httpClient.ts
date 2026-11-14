import { ENV } from '../config/env';
import { authStorage } from './storage';

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, skipAuth = false, headers: customHeaders, body, ...init } = options;
    const url = this.buildUrl(path, params);

    const headers = new Headers(customHeaders);

    // Configurar Content-Type si hay body y no es FormData
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (!isFormData && body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Inyectar Bearer token automáticamente
    if (!skipAuth) {
      const token = authStorage.getToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const config: RequestInit = {
      ...init,
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      throw new ApiError(
        'Connection failure with mission telemetry center (network error).',
        0,
        networkError
      );
    }

    // Manejo de expiración o ausencia de sesión (401)
    if (response.status === 401) {
      authStorage.notifyUnauthorized();
      let errorMsg = 'Sesión no autorizada o expirada. Por favor inicie sesión nuevamente.';
      try {
        const errorData = await response.json();
        if (errorData?.error) errorMsg = errorData.error;
      } catch {
        // Ignorar fallo de parseo JSON en error
      }
      throw new ApiError(errorMsg, 401);
    }

    // Manejo de respuestas 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      let errorMessage = `Error HTTP ${response.status}`;
      if (responseData && typeof responseData === 'object' && 'error' in responseData) {
        errorMessage = String((responseData as { error: string }).error);
      } else if (typeof responseData === 'string' && responseData.length > 0) {
        errorMessage = responseData;
      }

      throw new ApiError(errorMessage, response.status, responseData);
    }

    return responseData as T;
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const httpClient = new HttpClient(ENV.API_HOST);

