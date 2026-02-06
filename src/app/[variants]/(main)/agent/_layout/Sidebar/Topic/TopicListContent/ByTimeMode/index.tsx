'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import React, { memo, useMemo } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

import GroupItem from './GroupItem';

const ByTimeMode = memo(() => {
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

  const { sentinelRef } = useInfiniteScroll(hasMore, loadMoreTopics);

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
