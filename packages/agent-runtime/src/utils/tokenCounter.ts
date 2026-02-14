import { estimateTokenCount } from 'tokenx';

/**
 * Options for token counting and compression threshold calculation
 */
export interface TokenCountOptions {
  /** Model's max context window token count */
  maxWindowToken?: number;
  /** Threshold ratio for triggering compression, default 0.75 */
  thresholdRatio?: number;
}

/** Default max context window (128k tokens) */
export const DEFAULT_MAX_CONTEXT = 128_000;

/** Default threshold ratio (50% of max context) */
export const DEFAULT_THRESHOLD_RATIO = 0.5;

/**
 * Message interface for token counting
 */
export interface TokenCountMessage {
  content?: string | unknown;
  metadata?: {
    totalOutputTokens?: number;
    usage?: {
      totalOutputTokens?: number;
    };
  } | null;
  role: string;
}

const isServerRuntime = typeof globalThis === 'undefined' || !('window' in globalThis);
const COMPRESSION_LOG_PREFIX = '[compression-token-counter]';

const pickToolPayload = (tool: any) => ({
  apiName: tool?.apiName,
  arguments: tool?.arguments,
  id: tool?.id,
  identifier: tool?.identifier,
  type: tool?.type,
});

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const getAssistantOutputTokenSource = (
  msg: TokenCountMessage,
): 'metadata.totalOutputTokens' | 'metadata.usage.totalOutputTokens' | undefined => {
  const usageOutputTokens = msg.metadata?.usage?.totalOutputTokens;
  if (typeof usageOutputTokens === 'number' && usageOutputTokens > 0) {
    return 'metadata.usage.totalOutputTokens';
  }

  const topLevelOutputTokens = msg.metadata?.totalOutputTokens;
  if (typeof topLevelOutputTokens === 'number' && topLevelOutputTokens > 0) {
    return 'metadata.totalOutputTokens';
  }

  return undefined;
};

const getAssistantOutputTokens = (msg: TokenCountMessage): number | undefined => {
  const tokenSource = getAssistantOutputTokenSource(msg);
  if (!tokenSource) return undefined;

  return tokenSource === 'metadata.usage.totalOutputTokens'
    ? msg.metadata?.usage?.totalOutputTokens
    : msg.metadata?.totalOutputTokens;
};

const estimateMessageTokens = (msg: TokenCountMessage): number => {
  const message = msg as any;

  // Estimate only model-relevant payload, avoid counting UI-only fields
  // (id, createdAt, compressedMessages, etc.) which causes large overestimation.
  switch (msg.role) {
    case 'assistant': {
      if (
        !hasMeaningfulValue(message.content) &&
        !hasMeaningfulValue(message.tool_calls) &&
        !hasMeaningfulValue(message.tools)
      ) {
        return 0;
      }

      return estimateTokens({
        content: message.content,
        role: message.role,
        tool_calls: message.tool_calls,
        tools: Array.isArray(message.tools) ? message.tools.map(pickToolPayload) : undefined,
      });
    }

    case 'tool': {
      if (
        !hasMeaningfulValue(message.content) &&
        !hasMeaningfulValue(message.plugin) &&
        !hasMeaningfulValue(message.pluginState) &&
        !hasMeaningfulValue(message.tool_call_id)
      ) {
        return 0;
      }

      return estimateTokens({
        content: message.content,
        name: message.name,
        plugin: message.plugin,
        pluginState: message.pluginState,
        role: message.role,
        tool_call_id: message.tool_call_id,
      });
    }

    case 'assistantGroup':
    case 'agentCouncil':
    case 'supervisor': {
      if (
        !hasMeaningfulValue(message.content) &&
        !hasMeaningfulValue(message.children) &&
        !hasMeaningfulValue(message.members)
      ) {
        return 0;
      }

      return estimateTokens({
        children: Array.isArray(message.children)
          ? message.children.map((child: any) => ({
              content: child?.content,
              reasoning: child?.reasoning?.content,
              tools: Array.isArray(child?.tools) ? child.tools.map(pickToolPayload) : undefined,
            }))
          : undefined,
        content: message.content,
        members: Array.isArray(message.members)
          ? message.members.map((member: any) => ({
              content: member?.content,
              reasoning: member?.reasoning?.content,
              role: member?.role,
              tools: Array.isArray(member?.tools) ? member.tools.map(pickToolPayload) : undefined,
            }))
          : undefined,
        role: message.role,
      });
    }

    case 'compressedGroup': {
      if (!hasMeaningfulValue(message.content)) return 0;

      return estimateTokens({
        content: message.content,
        role: message.role,
      });
    }

    default: {
      if (!hasMeaningfulValue(message.content)) return 0;

      return estimateTokens({
        content: message.content,
        role: message.role,
      });
    }
  }
};

/**
 * Estimate token count for text content using tokenx
 * @param content - Text content or object to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(content: string | unknown): number {
  // Handle null/undefined early
  if (content === null || content === undefined) return 0;

  const text = typeof content === 'string' ? content : JSON.stringify(content);
  if (!text) return 0;
  return estimateTokenCount(text);
}

const logTokenCounterDebug = (
  messages: TokenCountMessage[],
  currentTokenCount: number,
  threshold: number,
) => {
  if (!isServerRuntime) return;

  let fromAssistantUsage = 0;
  let fromEstimate = 0;
  let assistantCount = 0;
  let assistantWithTopLevelUsageCount = 0;
  let assistantWithUsageCount = 0;
  let assistantWithoutUsageCount = 0;

  messages.forEach((msg: TokenCountMessage) => {
    const assistantOutputTokens = getAssistantOutputTokens(msg);
    const assistantOutputTokenSource = getAssistantOutputTokenSource(msg);

    if (msg.role === 'assistant') {
      assistantCount += 1;
      if (assistantOutputTokenSource === 'metadata.usage.totalOutputTokens') {
        assistantWithUsageCount += 1;
      } else if (assistantOutputTokenSource === 'metadata.totalOutputTokens') {
        assistantWithTopLevelUsageCount += 1;
      } else {
        assistantWithoutUsageCount += 1;
      }
    }

    const chosenByCurrentLogic =
      msg.role === 'assistant' && assistantOutputTokens !== undefined
        ? assistantOutputTokenSource
        : 'estimate(modelPayload)';

    const estimatedTokens = estimateMessageTokens(msg);
    const chosenValue = assistantOutputTokens ?? estimatedTokens;

    if (
      chosenByCurrentLogic === 'metadata.usage.totalOutputTokens' ||
      chosenByCurrentLogic === 'metadata.totalOutputTokens'
    ) {
      fromAssistantUsage += chosenValue;
    } else {
      fromEstimate += chosenValue;
    }
  });

  const roleCount = messages.reduce<Record<string, number>>((acc, msg) => {
    acc[msg.role] = (acc[msg.role] || 0) + 1;
    return acc;
  }, {});

  console.info(
    `${COMPRESSION_LOG_PREFIX} summary`,
    JSON.stringify(
      {
        currentTokenCount,
        fromAssistantUsage,
        fromEstimate,
        messageCount: messages.length,
        needsCompression: currentTokenCount > threshold,
        assistantCount,
        assistantWithTopLevelUsageCount,
        assistantWithUsageCount,
        assistantWithoutUsageCount,
        threshold,
        roleCount,
        note: 'assistant output uses metadata.totalOutputTokens or metadata.usage.totalOutputTokens; others estimate model-relevant payload',
      },
      null,
      2,
    ),
  );
};

/**
 * Calculate total token count for a list of messages
 * - Assistant messages: Prefer metadata.totalOutputTokens / metadata.usage.totalOutputTokens when available (exact value)
 * - Other messages (or assistant without usage): estimate model-relevant payload only
 *
 * @param messages - List of messages to count tokens for
 * @returns Total token count
 */
export function calculateMessageTokens(messages: TokenCountMessage[]): number {
  return messages.reduce((total, msg) => {
    // For assistant messages, prefer the recorded token count from metadata
    if (msg.role === 'assistant') {
      const outputTokens = getAssistantOutputTokens(msg);
      if (outputTokens && outputTokens > 0) {
        return total + outputTokens;
      }
    }

    // For messages without exact output usage data, estimate from model-relevant payload only
    return total + estimateMessageTokens(msg);
  }, 0);
}

/**
 * Calculate the compression threshold based on max context window
 * @param options - Token count options
 * @returns Compression threshold in tokens
 */
export function getCompressionThreshold(options: TokenCountOptions = {}): number {
  const maxContext = options.maxWindowToken ?? DEFAULT_MAX_CONTEXT;
  const ratio = options.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  return Math.floor(maxContext * ratio);
}

/**
 * Result of compression check
 */
export interface CompressionCheckResult {
  /** Current total token count */
  currentTokenCount: number;
  /** Whether compression is needed */
  needsCompression: boolean;
  /** Compression threshold */
  threshold: number;
}

/**
 * Check if messages need compression based on token count
 * @param messages - List of messages to check
 * @param options - Token count options
 * @returns Compression check result
 */
export function shouldCompress(
  messages: TokenCountMessage[],
  options: TokenCountOptions = {},
): CompressionCheckResult {
  const currentTokenCount = calculateMessageTokens(messages);
  const threshold = getCompressionThreshold(options);

  logTokenCounterDebug(messages, currentTokenCount, threshold);

  return {
    currentTokenCount,
    needsCompression: currentTokenCount > threshold,
    threshold,
  };
}
