import { useCallback, useEffect, useRef, useState } from 'react';

import type { PageCursor } from '@/services/pagination';
import { errorMessage } from '@/utils/authErrors';

export type Page<T> = { items: T[]; cursor: PageCursor };

export type PaginatedResult<T> = {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
};

/**
 * Owns `limit` + `startAfter` paging state for a feed. The *query* stays in the
 * service layer — this hook only knows how to ask for the next page, so all four
 * components can share it without sharing each other's Firestore logic.
 *
 * `fetchPage` must be memoised by the caller (`useCallback`); it is the trigger
 * for reloading from the first page.
 */
export function usePaginatedQuery<T>(
  fetchPage: (cursor: PageCursor) => Promise<Page<T>>
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PageCursor>(null);
  const [hasMore, setHasMore] = useState(true);

  // Guards against a stale page landing after the filters changed.
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', from: PageCursor) => {
      const id = ++requestId.current;

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError(null);

      try {
        const page = await fetchPage(from);
        if (id !== requestId.current) return;

        setItems((previous) => (mode === 'more' ? [...previous, ...page.items] : page.items));
        setCursor(page.cursor);
        setHasMore(page.cursor !== null);
      } catch (loadError) {
        if (id !== requestId.current) return;
        setError(errorMessage(loadError));
        if (mode !== 'more') setItems([]);
        setHasMore(false);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    void load('initial', null);
  }, [load]);

  const refresh = useCallback(() => {
    setHasMore(true);
    void load('refresh', null);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore || !cursor) return;
    void load('more', cursor);
  }, [load, loading, refreshing, loadingMore, hasMore, cursor]);

  return { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore };
}
