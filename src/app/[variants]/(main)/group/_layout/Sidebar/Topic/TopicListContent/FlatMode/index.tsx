'use client';

import { Flexbox } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import React, { memo } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

import TopicItem from '../../List/Item';

const FlatMode = memo(() => {
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

  const { sentinelRef } = useInfiniteScroll(hasMore, loadMoreTopics);

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
