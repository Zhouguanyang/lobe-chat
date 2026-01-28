'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import GroupItem from './GroupItem';

const ByTimeMode = memo(() => {
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
  const groupTopics = useChatStore(topicSelectors.groupedTopicsSelector, isEqual);

  const [topicGroupKeys, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.topicGroupKeys(s),
    s.updateSystemStatus,
  ]);

  const expandedKeys = useMemo(() => {
    return topicGroupKeys || groupTopics.map((group) => group.id);
  }, [topicGroupKeys, groupTopics]);

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
    <Flexbox gap={2}>
      {/* Grouped topics */}
      <Accordion
        expandedKeys={expandedKeys}
        gap={2}
        onExpandedChange={(keys) => updateSystemStatus({ expandTopicGroupKeys: keys as any })}
      >
        {groupTopics.map((group) => (
          <GroupItem
            activeThreadId={activeThreadId}
            activeTopicId={activeTopicId}
            group={group}
            key={group.id}
          />
        ))}
      </Accordion>
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

ByTimeMode.displayName = 'ByTimeMode';

export default ByTimeMode;
