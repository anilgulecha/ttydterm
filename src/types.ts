/* Domain types keep config, layout, and runtime branches checked offline. */

export type Appearance = 'dark' | 'light';

export interface ThemeUiTokens {
  canvas: string;
  sidebar: string;
  raised: string;
  field: string;
  hover: string;
  active: string;
  edge: string;
  text: string;
  muted: string;
  focus: string;
  danger: string;
  warning: string;
  success: string;
}

export interface Theme {
  label: string;
  appearance: Appearance;
  bg: string;
  fg: string;
  dim: string;
  cursor: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  ui: ThemeUiTokens;
}

export interface PaneNode {
  type: 'pane';
  id: string;
  command: string;
  persist: boolean;
  /* Documentation configs use this field. Restored user configs drop it. */
  docSection?: number;
}
export type SplitAxis = 'columns' | 'rows';
export interface SplitNode {
  type: 'split';
  axis: SplitAxis;
  sizes: number[];
  children: LayoutNode[];
}
export type LayoutNode = PaneNode | SplitNode;

export type PatternName = 'plain' | 'dots' | 'grid' | 'diagonal' | 'cross' | 'waves' | 'bricks';

export interface Folder {
  id: string;
  name: string;
  cwd: string;
  theme: string;
  icon: string | null;
  pattern: PatternName;
  layout: LayoutNode | null;
  /* Documentation configs use this page id. Restored user configs drop it. */
  doc?: string;
}

export type FontWeight = 'regular' | 'semibold' | 'bold';

export interface UiState {
  railWidth: number;
  railOpen: boolean;
  fontSize: number;
  fontWeight: FontWeight;
  notifyOnCommandFinish: boolean;
}

export interface Config {
  version: number;
  ui: UiState;
  folders: Folder[];
}

export type ValidationResult =
  | { ok: true; config: Config }
  | { ok: false; error: string };

export interface TtydEndpoints {
  token: string;
  ws: string;
}

export type Runtime =
  | { mode: 'probing' }
  | { mode: 'mock'; reason: string }
  | { mode: 'file'; reason: string }
  | { mode: 'demo'; reason: string }
  | { mode: 'ttyd'; token: string; endpoints: TtydEndpoints };

export type Capabilities =
  | { state: 'unknown' | 'probing'; tmux: boolean; home: string; cwd: string; shell?: string; writable?: boolean; error?: string }
  | { state: 'ready'; tmux: boolean; home: string; cwd: string; shell: string; writable: boolean; error?: string }
  | { state: 'error'; tmux: boolean; home: string; cwd: string; error: string };

export type TmuxState =
  | { state: 'probing' }
  | { state: 'present'; version: string }
  | { state: 'absent' };

export interface PaneLaunchOptions {
  cwd: string;
  command: string;
  persist: boolean;
  folderLabel: string;
  paneId: string;
  shellIntegration?: boolean;
}
