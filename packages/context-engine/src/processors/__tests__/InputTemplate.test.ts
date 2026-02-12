import { describe, expect, it, vi } from 'vitest';

import { InputTemplateProcessor } from '../InputTemplate';

describe('InputTemplateProcessor', () => {
  it('should apply template only to the last user message', async () => {
    const processor = new InputTemplateProcessor({
      inputTemplate: 'Template: {{text}} - End',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Original user message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Assistant response',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    expect(result.messages[0].content).toBe('Template: Original user message - End');
    expect(result.messages[1].content).toBe('Assistant response'); // Assistant message unchanged
    expect(result.metadata.inputTemplateProcessed).toBe(1);
  });

  it('should skip processing when no template is configured', async () => {
    const processor = new InputTemplateProcessor({});

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'User message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    expect(result.messages[0].content).toBe('User message'); // Unchanged
    expect(result.metadata.inputTemplateProcessed).toBeUndefined();
  });

  it('should handle template without {{text}} placeholder', async () => {
    const processor = new InputTemplateProcessor({
      inputTemplate: 'Static template content',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Original message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    expect(result.messages[0].content).toBe('Static template content');
    expect(result.metadata.inputTemplateProcessed).toBe(1);
  });

  it('should handle template compilation errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const processor = new InputTemplateProcessor({
      inputTemplate: '<%- invalid javascript code %>',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'User message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    // Should skip processing due to compilation error
    expect(result.messages[0].content).toBe('User message'); // Original content preserved
    expect(result.metadata.inputTemplateProcessed).toBe(0);

    consoleSpy.mockRestore();
  });

  it('should handle template application errors gracefully', async () => {
    const processor = new InputTemplateProcessor({
      inputTemplate: '{{text}} <%- throw new Error("Application error") %>',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'User message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    // Should keep original message when template application fails
    expect(result.messages[0].content).toBe('User message');
    expect(result.metadata.inputTemplateProcessed).toBe(0);
  });

  it('should only process the last user message, not historical messages or assistant messages', async () => {
    const processor = new InputTemplateProcessor({
      inputTemplate: 'Processed: {{text}}',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'First user message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Assistant message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '3',
          role: 'user',
          content: 'Second user message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '4',
          role: 'system',
          content: 'System message',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    expect(result.messages[0].content).toBe('First user message'); // Historical user message - unchanged
    expect(result.messages[1].content).toBe('Assistant message'); // Unchanged
    expect(result.messages[2].content).toBe('Processed: Second user message'); // Last user message - processed
    expect(result.messages[3].content).toBe('System message'); // Unchanged
    expect(result.metadata.inputTemplateProcessed).toBe(1);
  });

  it('should handle multi-turn conversation correctly', async () => {
    const processor = new InputTemplateProcessor({
      inputTemplate: '[{{text}}]',
    });

    const context = {
      initialState: {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
        systemRole: '',
        tools: [],
      },
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi!',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '3',
          role: 'user',
          content: 'What time is it?',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      metadata: {
        model: 'gpt-4',
        maxTokens: 4096,
      },
      isAborted: false,
    };

    const result = await processor.process(context);

    expect(result.messages[0].content).toBe('Hello'); // Historical - unchanged
    expect(result.messages[1].content).toBe('Hi!'); // Historical - unchanged
    expect(result.messages[2].content).toBe('[What time is it?]'); // Latest - processed
    expect(result.metadata.inputTemplateProcessed).toBe(1);
  });
});
