"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, apiRequest } from "@/lib/patients/api-client";

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
};

type Cache<T> = {
  path: string;
  reloadKey: number;
  data: T | null;
  error: string | null;
  notFound: boolean;
};

/**
 * Loads one API path. `loading` is derived from whether the latest request has
 * settled, so the effect only writes state when the response arrives.
 * Detail views drop the previous payload when the path changes. Lists can pass
 * `keepPrevious` so a new search does not blank the table.
 */
export function useApi<T>(
  path: string | null,
  options?: { keepPrevious?: boolean },
): ApiState<T> {
  const keepPrevious = options?.keepPrevious ?? false;
  const [reloadKey, setReloadKey] = useState(0);
  const [cache, setCache] = useState<Cache<T> | null>(null);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!path) {
      return;
    }

    const controller = new AbortController();
    const requestedKey = reloadKey;

    apiRequest<T>(path, { signal: controller.signal })
      .then((payload) => {
        setCache({
          path,
          reloadKey: requestedKey,
          data: payload,
          error: null,
          notFound: false,
        });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (caught instanceof ApiRequestError && caught.status === 404) {
          setCache({
            path,
            reloadKey: requestedKey,
            data: null,
            error: null,
            notFound: true,
          });
          return;
        }
        setCache((current) => ({
          path,
          reloadKey: requestedKey,
          data:
            current && (current.path === path || keepPrevious)
              ? current.data
              : null,
          error: "Could not load this page. Try again.",
          notFound: false,
        }));
      });

    return () => controller.abort();
  }, [path, reloadKey, keepPrevious]);

  const settled = cache !== null && cache.path === path && cache.reloadKey === reloadKey;
  const showPrevious = keepPrevious || (cache !== null && cache.path === path);

  return {
    data: showPrevious ? (cache?.data ?? null) : null,
    loading: path !== null && !settled,
    notFound: settled && cache.notFound,
    error: settled ? cache.error : null,
    reload,
  };
}
