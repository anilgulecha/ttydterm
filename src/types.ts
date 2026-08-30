/* The app's domain, as types. These exist so the compiler — not a browser
   assertion — rejects the mistakes this codebase actually made: reading
   `children` off a pane, `token` off a runtime that has no socket, or a route
   segment that is not there. */

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

/* A layout node is a discriminated union, so `node.children` is a compile
   error on a pane and `node.command` is one on a split. */
export interface PaneNode {
  type: 'pane';
  id: string;
  command: string;
  persist: boolean;
  /* Documentation workspaces only: which section of the page this pane shows.
   * Absent on every real pane, and deliberately dropped by validateConfig —
   * documentation is never restored from untrusted JSON. */
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
  /* Documentation workspaces only: the id of the page this workspace renders
   * (see docs.ts). Absent on every real workspace. */
  doc?: string;
}

export type FontWeight = 'regular' | 'semibold' | 'bold';

export interface UiState {
  railWidth: number;
  railOpen: boolean;
  fontSize: number;
  fontWeight: FontWeight;
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

/* Runtime is a union on `mode`: `runtime.token` is unreachable unless the
   probe actually found ttyd. */
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
}
