'use client';

import { Flexbox } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import React, { memo, useCallback, useEffect, useRef } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';

import TopicItem from '../../List/Item';

const FlatMode = memo(() => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const [activeTopicId, activeThreadId, hasMore, isLoadingMore, loadMoreTopics] = useChatStore(
    (s) => [
      s.activeTopicId,
      s.activeThreadId,
      topicSelectors.hasMoreTopics(s),
      topicSelectors.isLoadingMoreTopics(s),
      s.loadMoreTopics,
    ],
  );

  const activeTopicList = useChatStore(topicSelectors.displayTopics, isEqual);

  // Use IntersectionObserver to detect when sentinel is visible
  const handleIntersection = useCallback(
    async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasMore && !loadingRef.current) {
        loadingRef.current = true;
        await loadMoreTopics();
        loadingRef.current = false;
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

  return (
    <Flexbox gap={1}>
      {activeTopicList?.map((topic) => (
        <TopicItem
          active={activeTopicId === topic.id}
          fav={topic.favorite}
          id={topic.id}
          key={topic.id}
          threadId={activeThreadId}
          title={topic.title}
        />
      ))}
      {isLoadingMore && (
        <Flexbox paddingBlock={1}>
          <SkeletonList rows={3} />
        </Flexbox>
      )}
      {/* Sentinel element for intersection observer */}
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </Flexbox>
  );
});

FlatMode.displayName = 'FlatMode';

export default FlatMode;
