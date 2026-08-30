/* Local declarations for the xterm.js globals bundled into index.html. */

interface XtermThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  brightBlack: string;
  white: string;
  brightWhite: string;
  red: string;
  brightRed: string;
  green: string;
  brightGreen: string;
  yellow: string;
  brightYellow: string;
  blue: string;
  brightBlue: string;
  magenta: string;
  brightMagenta: string;
  cyan: string;
  brightCyan: string;
}

interface XtermDisposable {
  dispose(): void;
}

interface XtermOptions {
  cursorBlink?: boolean;
  allowTransparency?: boolean;
  scrollback?: number;
  fontSize?: number;
  fontWeight?: number | string;
  fontFamily?: string;
  convertEol?: boolean;
  theme?: XtermThemeColors;
}

interface XtermTerminal {
  readonly cols: number;
  readonly rows: number;
  options: XtermOptions;
  parser: {
    registerOscHandler(identifier: number, handler: (data: string) => boolean | Promise<boolean>): XtermDisposable;
  };
  open(host: HTMLElement): void;
  write(data: string | Uint8Array): void;
  loadAddon(addon: unknown): void;
  getSelection(): string;
  paste(data:string):void;
  focus():void;
  attachCustomKeyEventHandler(handler:(event:KeyboardEvent)=>boolean):void;
  onData(handler: (data: string) => void): XtermDisposable;
  onResize(handler: (size: { cols: number; rows: number }) => void): XtermDisposable;
  onSelectionChange(handler: () => void): XtermDisposable;
  dispose(): void;
}

interface XtermFitAddon {
  fit(): void;
}

declare var Terminal: { new (options?: XtermOptions): XtermTerminal };
declare var FitAddon: { FitAddon: { new (): XtermFitAddon } };
declare var WebLinksAddon: { WebLinksAddon: { new (): unknown } } | undefined;

interface Window {
  __contrastAudit?: () => Array<{ theme: string; key: string; kind: string; ratio: number; min: number }>;
  __terminalAtmosphere?: {
    seededPane: (index: number, salt?: number) => number;
    softHorizonBackground: (index: number, active?: boolean) => string;
    paneGridIndex: (layout: import('../types').LayoutNode | null, paneId: string) => number;
    sidebarAtmosphereVars: () => string;
  };
  __shellCwd?: (value: string) => string;
  __tmuxLaunchCommand?: (cwd: string, session: string, command?:string, shellIntegration?:boolean) => string;
  __xtermAppearance?: (element: HTMLElement) => { fontSize: number; fontWeight:number; theme: XtermThemeColors };
  __parseCompletionStatus?: (data: string) => number | null;
  __reportCommandCompletion?: (event: { folderId:string; paneId:string; exitStatus:number; duration:number }) => void;
}
