'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';

import Avatar from './Avatar';

const HeaderInfo = memo(() => {
  const isInbox = useAgentStore(builtinAgentSelectors.isInboxAgent);
  const title = useAgentStore(agentSelectors.currentAgentTitle);

  const displayTitle = isInbox ? 'Lobe AI' : title;

  return (
    <Flexbox
      align={'center'}
      flex={1}
      gap={8}
      horizontal
      style={{
        overflow: 'hidden',
      }}
    >
      <Avatar />
      <Text ellipsis weight={500}>
        {displayTitle}
      </Text>
    </Flexbox>
  );
});

export default HeaderInfo;
