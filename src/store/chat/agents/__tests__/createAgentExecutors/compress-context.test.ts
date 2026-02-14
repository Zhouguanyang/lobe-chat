import {
  type AgentInstructionCompressContext,
  type AgentRuntimeContext,
  type GeneralAgentCompressionResultPayload,
} from '@lobechat/agent-runtime';
import { type UIChatMessage } from '@lobechat/types';
import { type Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatService } from '@/services/chat';
import { messageService } from '@/services/message';

import { createAssistantMessage, createMockStore, createUserMessage } from './fixtures';
import { createInitialState, createTestContext, executeWithMockContext } from './helpers';

vi.mock('@/services/chat', () => ({
  chatService: {
    fetchPresetTaskResult: vi.fn(),
  },
}));

vi.mock('@/services/message', () => ({
  messageService: {
    createCompressionGroup: vi.fn(),
    finalizeCompression: vi.fn(),
  },
}));

const mockCreateCompressionGroup = messageService.createCompressionGroup as Mock;
const mockFinalizeCompression = messageService.finalizeCompression as Mock;
const mockFetchPresetTaskResult = chatService.fetchPresetTaskResult as Mock;

describe('compress_context executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exclude latest tail messages from compression and use latest user as next parent', async () => {
    const mockStore = createMockStore({
      replaceMessages: vi.fn(),
    });
    const context = createTestContext();

    const oldUser = createUserMessage({ content: 'Old question', id: 'msg-user-old' });
    const oldAssistant = createAssistantMessage({
      content: 'Old answer',
      id: 'msg-assistant-old',
    });
    const latestUser = createUserMessage({ content: 'Latest question', id: 'msg-user-latest' });
    const latestAssistant = createAssistantMessage({
      content: '',
      id: 'msg-assistant-latest',
      parentId: latestUser.id,
    });
    const dbMessages = [oldUser, oldAssistant, latestUser, latestAssistant];

    mockStore.dbMessagesMap[context.messageKey] = dbMessages as UIChatMessage[];

    // Simulate DB query order by createdAt, where compressedGroup is created later and appears last.
    const initialCompressedMessages = [latestUser, latestAssistant, {
      content: '...',
      createdAt: Date.now(),
      id: 'group-1',
      lastMessageId: 'msg-assistant-old',
      role: 'compressedGroup',
      updatedAt: Date.now(),
    }] as UIChatMessage[];

    const finalizedCompressedMessages = [latestUser, latestAssistant, {
      content: 'history summary',
      createdAt: Date.now(),
      id: 'group-1',
      lastMessageId: 'msg-assistant-old',
      role: 'compressedGroup',
      updatedAt: Date.now(),
    }] as UIChatMessage[];

    mockCreateCompressionGroup.mockResolvedValueOnce({
      messageGroupId: 'group-1',
      messages: initialCompressedMessages,
      messagesToSummarize: [oldUser, oldAssistant],
    });

    mockFetchPresetTaskResult.mockImplementationOnce(async ({ onMessageHandle }: any) => {
      onMessageHandle?.({ text: 'history summary', type: 'text' });
    });

    mockFinalizeCompression.mockResolvedValueOnce({
      messages: finalizedCompressedMessages,
    });

    const instruction: AgentInstructionCompressContext = {
      payload: {
        currentTokenCount: 80_000,
        messages: dbMessages,
        preservedTailMessageIds: [latestUser.id, latestAssistant.id],
        preservedLatestUserMessageId: latestUser.id,
        threshold: 64_000,
      },
      type: 'compress_context',
    };

    const state = createInitialState({
      messages: dbMessages,
      operationId: context.operationId,
    });

    const result = await executeWithMockContext({
      context,
      executor: 'compress_context',
      instruction,
      mockStore,
      state,
    });

    expect(mockCreateCompressionGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        messageIds: ['msg-user-old', 'msg-assistant-old'],
      }),
    );

    const nextContext = result.nextContext as AgentRuntimeContext;
    const payload = nextContext.payload as GeneralAgentCompressionResultPayload;

    expect(nextContext.phase).toBe('compression_result');
    expect(payload.parentMessageId).toBe('msg-user-latest');
    expect(payload.compressedMessages.map((m) => m.id)).toEqual([
      'group-1',
      'msg-user-latest',
      'msg-assistant-latest',
    ]);
    expect(result.newState.messages).toEqual(payload.compressedMessages);
  });

  it('should skip compression when only preserved latest user message remains', async () => {
    const mockStore = createMockStore({
      replaceMessages: vi.fn(),
    });
    const context = createTestContext();

    const latestUser = createUserMessage({ content: 'Only message', id: 'msg-user-latest' });
    const latestAssistant = createAssistantMessage({
      content: '',
      id: 'msg-assistant-latest',
      parentId: latestUser.id,
    });
    const dbMessages = [latestUser, latestAssistant];
    mockStore.dbMessagesMap[context.messageKey] = dbMessages as UIChatMessage[];

    const instruction: AgentInstructionCompressContext = {
      payload: {
        currentTokenCount: 80_000,
        messages: dbMessages,
        preservedTailMessageIds: [latestUser.id, latestAssistant.id],
        preservedLatestUserMessageId: latestUser.id,
        threshold: 64_000,
      },
      type: 'compress_context',
    };

    const state = createInitialState({
      messages: dbMessages,
      operationId: context.operationId,
    });

    const result = await executeWithMockContext({
      context,
      executor: 'compress_context',
      instruction,
      mockStore,
      state,
    });

    expect(mockCreateCompressionGroup).not.toHaveBeenCalled();

    const nextContext = result.nextContext as AgentRuntimeContext;
    const payload = nextContext.payload as GeneralAgentCompressionResultPayload;

    expect(nextContext.phase).toBe('compression_result');
    expect(payload.skipped).toBe(true);
    expect(payload.parentMessageId).toBe('msg-user-latest');
    expect(payload.compressedMessages).toEqual([latestUser, latestAssistant]);
  });
});
