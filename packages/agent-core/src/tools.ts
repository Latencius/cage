import type { ExecutionMode, McpToolInfo, RiskLevel, ToolCategory } from './types.ts';

export interface ToolSpec {
  name: string;
  category: ToolCategory;
  risk: RiskLevel;
  mode: ExecutionMode;
  description: string;
  parameters: Record<string, unknown>;
  mcpServerId?: string;
  mcpToolName?: string;
}

export const LOCAL_TOOLS: ToolSpec[] = [
  {
    name: 'list_dir',
    category: 'fs_read',
    risk: 'low',
    mode: 'local',
    description: 'List files and folders inside an allowed workspace directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute path inside an allowed folder (default ".").' },
      },
      required: [],
    },
  },
  {
    name: 'read_file',
    category: 'fs_read',
    risk: 'low',
    mode: 'local',
    description: 'Read UTF-8 text contents of a file inside an allowed folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    category: 'fs_write',
    risk: 'medium',
    mode: 'local',
    description: 'Create or overwrite a text file inside an allowed folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Destination path inside an allowed folder.' },
        content: { type: 'string', description: 'Full text content to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'move_file',
    category: 'fs_write',
    risk: 'medium',
    mode: 'local',
    description: 'Move or rename a file within allowed folders.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source file path.' },
        to: { type: 'string', description: 'Target file path.' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'delete_file',
    category: 'fs_delete',
    risk: 'high',
    mode: 'local',
    description: 'Permanently delete a file or folder inside an allowed folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_shell',
    category: 'shell_exec',
    risk: 'high',
    mode: 'local',
    description: 'Run a shell command inside the allowed workspace directory (30s timeout).',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute.' },
        cwd: { type: 'string', description: 'Working directory inside an allowed folder (default ".").' },
      },
      required: ['command'],
    },
  },
  {
    name: 'fetch_url',
    category: 'web_fetch',
    risk: 'low',
    mode: 'local',
    description: 'Fetch text or HTML from an HTTP/HTTPS URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The http(s) URL to retrieve.' },
      },
      required: ['url'],
    },
  },
];

export const VM_TOOLS: ToolSpec[] = [
  {
    name: 'vm_screenshot',
    category: 'vm_control',
    risk: 'low',
    mode: 'isolated_vm',
    description: 'Capture a screenshot of the isolated cloud desktop VM.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'vm_launch_app',
    category: 'vm_control',
    risk: 'medium',
    mode: 'isolated_vm',
    description: 'Launch an application in the isolated VM (e.g. google-chrome, firefox, xfce4-terminal).',
    parameters: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Application executable name or URL to open.' },
      },
      required: ['app'],
    },
  },
  {
    name: 'vm_click',
    category: 'vm_control',
    risk: 'medium',
    mode: 'isolated_vm',
    description: 'Left-click at pixel coordinates (x, y) inside the isolated cloud desktop VM.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Horizontal pixel coordinate.' },
        y: { type: 'number', description: 'Vertical pixel coordinate.' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'vm_type',
    category: 'vm_control',
    risk: 'medium',
    mode: 'isolated_vm',
    description: 'Type text into the currently focused window inside the isolated VM.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Literal text to type.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'vm_press_key',
    category: 'vm_control',
    risk: 'medium',
    mode: 'isolated_vm',
    description: 'Press a keyboard key inside the isolated VM (e.g. Return, Tab, Escape).',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key name to press.' },
      },
      required: ['key'],
    },
  },
  {
    name: 'vm_bash',
    category: 'vm_control',
    risk: 'high',
    mode: 'isolated_vm',
    description: 'Run a bash command safely inside the isolated cloud VM.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Bash command to execute in the sandbox VM.' },
      },
      required: ['command'],
    },
  },
];

export const ALL_TOOLS: ToolSpec[] = [...LOCAL_TOOLS, ...VM_TOOLS];

export function mcpToolQualifiedName(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`;
}

export function mcpToolsToSpecs(mcpTools: McpToolInfo[], mode: ExecutionMode): ToolSpec[] {
  return mcpTools.map((mt) => ({
    name: mcpToolQualifiedName(mt.serverId, mt.name),
    category: 'mcp_tool',
    risk: 'high',
    mode,
    description: `[MCP:${mt.serverName}] ${mt.description || mt.name}`,
    parameters:
      mt.inputSchema && typeof mt.inputSchema === 'object'
        ? mt.inputSchema
        : { type: 'object', properties: {} },
    mcpServerId: mt.serverId,
    mcpToolName: mt.name,
  }));
}

export function getToolsForMode(mode: ExecutionMode, mcpTools: McpToolInfo[] = []): ToolSpec[] {
  const base = mode === 'isolated_vm' ? VM_TOOLS : LOCAL_TOOLS;
  return [...base, ...mcpToolsToSpecs(mcpTools, mode)];
}

export function findToolSpec(name: string, dynamicTools: ToolSpec[] = []): ToolSpec | undefined {
  return dynamicTools.find((t) => t.name === name) ?? ALL_TOOLS.find((t) => t.name === name);
}

export function toOpenAiTools(tools: ToolSpec[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function describeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'list_dir':
      return `List directory: ${String(args.path ?? '.')}`;
    case 'read_file':
      return `Read file: ${String(args.path ?? '')}`;
    case 'write_file':
      return `Write file: ${String(args.path ?? '')} (${String(args.content ?? '').length} chars)`;
    case 'move_file':
      return `Move file: ${String(args.from ?? '')} → ${String(args.to ?? '')}`;
    case 'delete_file':
      return `Delete file: ${String(args.path ?? '')}`;
    case 'run_shell':
      return `Run shell command: ${String(args.command ?? '')}`;
    case 'fetch_url':
      return `Fetch URL: ${String(args.url ?? '')}`;
    case 'vm_screenshot':
      return 'Capture isolated VM screenshot';
    case 'vm_launch_app':
      return `Launch app in isolated VM: ${String(args.app ?? '')}`;
    case 'vm_click':
      return `Click in isolated VM: (${String(args.x ?? 0)}, ${String(args.y ?? 0)})`;
    case 'vm_type':
      return `Type in isolated VM: "${String(args.text ?? '').slice(0, 60)}"`;
    case 'vm_press_key':
      return `Press key in isolated VM: ${String(args.key ?? '')}`;
    case 'vm_bash':
      return `Run Bash in isolated VM: ${String(args.command ?? '')}`;
    default:
      if (name.startsWith('mcp__')) {
        const parts = name.split('__');
        const server = parts[1] ?? 'mcp';
        const tool = parts.slice(2).join('__') || name;
        return `MCP [${server}] → ${tool}(${JSON.stringify(args).slice(0, 120)})`;
      }
      return `${name}(${JSON.stringify(args)})`;
  }
}
