import { describe, expect, it, vi } from 'vitest';

import { ToolExecutionService } from './index';

describe('ToolExecutionService', () => {
  it('should execute builtin runtime when payload type is default but manifest type is builtin', async () => {
    const builtinToolsExecutor = {
      execute: vi.fn().mockResolvedValue({ content: 'builtin-result', success: true }),
    };
    const mcpService = {
      callTool: vi.fn(),
    };
    const pluginGatewayService = {
      execute: vi.fn().mockResolvedValue({ content: 'plugin-result', success: true }),
    };

    const service = new ToolExecutionService({
      builtinToolsExecutor: builtinToolsExecutor as any,
      mcpService: mcpService as any,
      pluginGatewayService: pluginGatewayService as any,
    });

    const result = await service.executeTool(
      {
        apiName: 'search',
        arguments: '{}',
        id: 'call_1',
        identifier: 'lobe-web-browsing',
        type: 'default',
      } as any,
      {
        toolManifestMap: {
          'lobe-web-browsing': {
            api: [],
            identifier: 'lobe-web-browsing',
            meta: {},
            type: 'builtin',
          },
        },
      } as any,
    );

    expect(builtinToolsExecutor.execute).toHaveBeenCalledOnce();
    expect(pluginGatewayService.execute).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.content).toBe('builtin-result');
  });

  it('should execute plugin runtime when payload type is builtin but manifest type is default', async () => {
    const builtinToolsExecutor = {
      execute: vi.fn().mockResolvedValue({ content: 'builtin-result', success: true }),
    };
    const mcpService = {
      callTool: vi.fn(),
    };
    const pluginGatewayService = {
      execute: vi.fn().mockResolvedValue({ content: 'plugin-result', success: true }),
    };

    const service = new ToolExecutionService({
      builtinToolsExecutor: builtinToolsExecutor as any,
      mcpService: mcpService as any,
      pluginGatewayService: pluginGatewayService as any,
    });

    const result = await service.executeTool(
      {
        apiName: 'search',
        arguments: '{}',
        id: 'call_1',
        identifier: 'custom-plugin',
        type: 'builtin',
      } as any,
      {
        toolManifestMap: {
          'custom-plugin': {
            api: [],
            identifier: 'custom-plugin',
            meta: {},
            type: 'default',
          },
        },
      } as any,
    );

    expect(pluginGatewayService.execute).toHaveBeenCalledOnce();
    expect(builtinToolsExecutor.execute).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.content).toBe('plugin-result');
  });
});

