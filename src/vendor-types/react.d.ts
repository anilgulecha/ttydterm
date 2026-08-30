/* Local declarations keep strict type checks offline. */

declare namespace React {
  type Key = string | number;
  type ReactNode =
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  interface ReactElement {
    type: unknown;
    props: unknown;
    key: Key | null;
  }


  interface CSSProperties {
    [property: string]: string | number | undefined;
  }

  interface RefObject<T> {
    current: T;
  }
  type Ref<T> = RefObject<T | null> | ((instance: T | null) => void) | null;

  interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => ReactElement;
    Consumer: (props: { children: (value: T) => ReactNode }) => ReactElement;
  }

  interface SyntheticEvent<T = Element> {
    currentTarget: T;
    target: EventTarget & T;
    preventDefault(): void;
    stopPropagation(): void;
    defaultPrevented: boolean;
    bubbles: boolean;
    type: string;
  }
  interface ChangeEvent<T = Element> extends SyntheticEvent<T> {}
  interface FocusEvent<T = Element> extends SyntheticEvent<T> {
    relatedTarget: EventTarget | null;
  }
  interface MouseEvent<T = Element> extends SyntheticEvent<T> {
    clientX: number;
    clientY: number;
    button: number;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }
  interface PointerEvent<T = Element> extends MouseEvent<T> {
    pointerId: number;
    pointerType: string;
  }
  interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }

  type EventHandler<E> = (event: E) => void;


  /* Known handlers keep their element types. Other DOM attributes stay open. */
  interface HTMLProps<T> {
    key?: Key | null | undefined;
    ref?: Ref<T> | undefined;
    className?: string | undefined;
    style?: CSSProperties | undefined;
    children?: ReactNode;
    id?: string | undefined;
    title?: string | undefined;
    hidden?: boolean | undefined;
    tabIndex?: number | undefined;
    onClick?: EventHandler<MouseEvent<T>> | undefined;
    onDoubleClick?: EventHandler<MouseEvent<T>> | undefined;
    onContextMenu?: EventHandler<MouseEvent<T>> | undefined;
    onPointerDown?: EventHandler<PointerEvent<T>> | undefined;
    onPointerDownCapture?: EventHandler<PointerEvent<T>> | undefined;
    onPointerMove?: EventHandler<PointerEvent<T>> | undefined;
    onPointerUp?: EventHandler<PointerEvent<T>> | undefined;
    onKeyDown?: EventHandler<KeyboardEvent<T>> | undefined;
    onChange?: EventHandler<ChangeEvent<T>> | undefined;
    onBlur?: EventHandler<FocusEvent<T>> | undefined;
    onFocus?: EventHandler<FocusEvent<T>> | undefined;
    onMouseEnter?: EventHandler<MouseEvent<T>> | undefined;
    onCancel?: EventHandler<SyntheticEvent<T>> | undefined;

    [attribute: string]: any;
  }


  const Fragment: (props: { key?: Key | null; children?: ReactNode }) => ReactElement;

  function createElement(type: unknown, props?: unknown, ...children: unknown[]): ReactElement;

  function createContext<T>(defaultValue: T): Context<T>;
  function useContext<T>(context: Context<T>): T;
  function useState<S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  function useCallback<T>(fn: T, deps: readonly unknown[]): T;
  function useRef<T>(initial: T): RefObject<T>;
  function useId(): string;
}

declare module 'react' {
  export = React;
}

declare module 'react-dom/client' {
  interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare namespace JSX {
  type Element = React.ReactElement;
  interface ElementChildrenAttribute {
    children: Record<string, never>;
  }
  interface IntrinsicAttributes { key?: React.Key; }
  interface IntrinsicElements {
    a: React.HTMLProps<HTMLAnchorElement>;
    button: React.HTMLProps<HTMLButtonElement>;
    code: React.HTMLProps<HTMLElement>;
    dialog: React.HTMLProps<HTMLDialogElement>;
    div: React.HTMLProps<HTMLDivElement>;
    form: React.HTMLProps<HTMLFormElement>;
    h2: React.HTMLProps<HTMLHeadingElement>;
    i: React.HTMLProps<HTMLElement>;
    input: React.HTMLProps<HTMLInputElement>;
    kbd: React.HTMLProps<HTMLElement>;
    label: React.HTMLProps<HTMLLabelElement>;
    main: React.HTMLProps<HTMLElement>;
    nav: React.HTMLProps<HTMLElement>;
    p: React.HTMLProps<HTMLParagraphElement>;
    span: React.HTMLProps<HTMLSpanElement>;
    strong: React.HTMLProps<HTMLElement>;
    textarea: React.HTMLProps<HTMLTextAreaElement>;

    [element: string]: any;
  }
}
