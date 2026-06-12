import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/format";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True only on the first load, so views can show skeletons vs. a quiet refresh. */
  initial: boolean;
  reload: () => Promise<void>;
}

/**
 * Generic async data hook. `fetcher` should be referentially stable
 * (wrap in useCallback) or omit deps that change every render.
 */
export function useResource<T>(fetcher: () => Promise<T>): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState(true);
  const alive = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (alive.current) setData(result);
    } catch (err) {
      if (alive.current) setError(errorMessage(err));
    } finally {
      if (alive.current) {
        setLoading(false);
        setInitial(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, initial, reload };
}
