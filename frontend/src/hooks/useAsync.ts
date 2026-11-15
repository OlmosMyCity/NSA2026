'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Ejecuta `fn` cuando cambian `deps` y expone datos, error y carga.
 * Descarta respuestas de peticiones anteriores (evita mostrar datos de otro astronauta
 * si se cambia rápido). Con `fn = null` no hace nada y devuelve `data` indefinido.
 */
export function useAsync<T>(fn: (() => Promise<T>) | null, deps: DependencyList, fallbackError = 'Unable to load data.'): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(fn !== null);
  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    const current = fnRef.current;
    if (!current) {
      setData(undefined);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await current();
      if (id === requestId.current) setData(result);
    } catch (err: unknown) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, isLoading, refetch: run };
}
