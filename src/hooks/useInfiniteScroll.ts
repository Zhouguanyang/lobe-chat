import { useCallback, useEffect, useRef } from 'react';

export const useInfiniteScroll = (
  hasMore: boolean,
  loadMoreTopics: () => Promise<void>,
) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Use IntersectionObserver to detect when sentinel is visible
  const handleIntersection = useCallback(
    async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasMore && !loadingRef.current) {
        loadingRef.current = true;
        try {
          await loadMoreTopics();
        } finally {
          loadingRef.current = false;
        }
      }
    },
    [hasMore, loadMoreTopics],
  );

  // Set up IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: null, // Use viewport as root, will work with any scrollable parent
      rootMargin: '200px', // Trigger 200px before sentinel is visible
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersection]);

  return { sentinelRef };
};
