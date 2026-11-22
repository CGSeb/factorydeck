import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

type KeyAction =
  | { kind: 'open'; index: number | undefined }
  | { kind: 'move'; index: number }
  | { kind: 'choose'; keepDefault: boolean }
  | { kind: 'close' };

const OPENING_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

function keyAction(
  key: string,
  open: boolean,
  active: number,
  length: number,
): KeyAction | undefined {
  if (!open) {
    if (OPENING_KEYS.has(key)) return { kind: 'open', index: undefined };
    if (key === 'Home') return { kind: 'open', index: 0 };
    if (key === 'End') return { kind: 'open', index: length - 1 };
    return undefined;
  }
  const moves: Record<string, number> = {
    ArrowDown: active + 1,
    ArrowUp: active - 1,
    Home: 0,
    End: length - 1,
    PageDown: active + 10,
    PageUp: active - 10,
  };
  const move = moves[key];
  if (move !== undefined) return { kind: 'move', index: move };
  if (key === 'Enter' || key === ' ') {
    return { kind: 'choose', keepDefault: false };
  }
  if (key === 'Tab') return { kind: 'choose', keepDefault: true };
  if (key === 'Escape') return { kind: 'close' };
  return undefined;
}

function useCloseOnOutsidePointer(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent): void {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) !== true) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [rootRef, open, close]);
}

export interface SelectState {
  rootRef: RefObject<HTMLDivElement | null>;
  listId: string;
  optionId: (index: number) => string;
  open: boolean;
  active: number;
  setActive: (index: number) => void;
  selectedIndex: number;
  show: (index?: number) => void;
  choose: (index: number) => void;
  close: () => void;
  toggle: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function useSelect<T extends string>(
  options: readonly SelectOption<T>[],
  value: T,
  onChange: (value: T) => void,
): SelectState {
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionIdPrefix = useId();
  const [open, setOpen] = useState(false);
  useCloseOnOutsidePointer(rootRef, open, () => {
    setOpen(false);
  });
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const [active, setActive] = useState(selectedIndex);

  function show(index = selectedIndex): void {
    setActive(clamp(index, options.length));
    setOpen(true);
  }

  function choose(index: number): void {
    const option = options[index];
    setOpen(false);
    if (option !== undefined && option.value !== value) onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (options.length === 0) return;
    const action = keyAction(event.key, open, active, options.length);
    if (action === undefined) return;
    if (action.kind !== 'choose' || !action.keepDefault) event.preventDefault();
    if (action.kind === 'open') show(action.index);
    else if (action.kind === 'move')
      setActive(clamp(action.index, options.length));
    else if (action.kind === 'choose') choose(active);
    else setOpen(false);
  }

  return {
    rootRef,
    listId,
    optionId: (index: number): string => `${optionIdPrefix}-${String(index)}`,
    open,
    active,
    setActive,
    selectedIndex,
    show,
    choose,
    close: (): void => {
      setOpen(false);
    },
    toggle: (): void => {
      if (open) setOpen(false);
      else show();
    },
    onKeyDown,
  };
}
