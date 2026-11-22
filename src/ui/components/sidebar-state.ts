import {
  type FocusEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

export const SIDEBAR_KEY = 'factorydeck.sidebar';
export const NARROW_QUERY = '(max-width: 767.98px)';

export type Fold = 'expanded' | 'collapsed';

export function readFold(): Fold {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
      ? 'collapsed'
      : 'expanded';
  } catch {
    return 'expanded';
  }
}

function writeFold(fold: Fold): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, fold);
  } catch {
    return;
  }
}

export function useFold(): [boolean, () => void] {
  const [folded, setFolded] = useState(() => readFold() === 'collapsed');
  function toggle(): void {
    const next = !folded;
    writeFold(next ? 'collapsed' : 'expanded');
    setFolded(next);
  }
  return [folded, toggle];
}

function narrowQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(NARROW_QUERY)
    : undefined;
}

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => narrowQuery()?.matches === true);
  useEffect(() => {
    const query = narrowQuery();
    if (query === undefined) return undefined;
    function update(): void {
      setNarrow(query?.matches === true);
    }
    update();
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return narrow;
}

export interface Tip {
  text: string;
  top: number;
  left: number;
}

export interface TipHandlers {
  onMouseEnter: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
}

const TIP_GAP = 8;

export function useTip(): {
  tip: Tip | undefined;
  tipFor: (text: string) => TipHandlers;
} {
  const [tip, setTip] = useState<Tip>();
  useEffect(() => {
    if (tip === undefined) return undefined;
    function hide(event: KeyboardEvent | Event): void {
      if (!(event instanceof KeyboardEvent) || event.key === 'Escape') {
        setTip(undefined);
      }
    }
    document.addEventListener('keydown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('keydown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, [tip]);
  function show(text: string, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    setTip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + TIP_GAP,
    });
  }
  function hide(): void {
    setTip(undefined);
  }
  return {
    tip,
    tipFor: (text) => ({
      onMouseEnter: (event) => {
        show(text, event.currentTarget);
      },
      onMouseLeave: hide,
      onFocus: (event) => {
        show(text, event.currentTarget);
      },
      onBlur: hide,
    }),
  };
}

export const CLICK_FALLBACK_MS = 600;

const UNTIL_CLICK = ['click', 'pointercancel'] as const;

function waitForClick(action: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function stop(): void {
    clearTimeout(timer);
    for (const type of UNTIL_CLICK) document.removeEventListener(type, finish);
    document.removeEventListener('pointerup', fallback);
  }
  function finish(): void {
    stop();
    setTimeout(action, 0);
  }
  function fallback(): void {
    timer = setTimeout(finish, CLICK_FALLBACK_MS);
  }
  for (const type of UNTIL_CLICK) document.addEventListener(type, finish);
  document.addEventListener('pointerup', fallback);
  return stop;
}

export function useAfterPointer(): (action: () => void) => void {
  const pressed = useRef(false);
  const pending = useRef<() => void>(undefined);
  useEffect(() => {
    function down(): void {
      pressed.current = true;
    }
    function up(): void {
      pressed.current = false;
    }
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      pending.current?.();
    };
  }, []);
  return (action) => {
    pending.current?.();
    pending.current = undefined;
    if (!pressed.current) {
      action();
      return;
    }
    pending.current = waitForClick(() => {
      pending.current = undefined;
      action();
    });
  };
}

export function useScrollLock(): void {
  useEffect(() => {
    const { style } = document.body;
    const previous = style.overflow;
    style.overflow = 'hidden';
    return () => {
      style.overflow = previous;
    };
  }, []);
}
