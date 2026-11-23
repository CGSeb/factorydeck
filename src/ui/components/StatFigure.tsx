import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { visuallyHidden } from './chart-math.ts';
import { chartTooltip } from './chart-tooltip.ts';
import {
  HELP_GAP,
  HELP_WIDTH,
  VIEWPORT_MARGIN,
  helpLeft,
} from './figure-help.ts';
import { Icon } from './Icon.tsx';
import {
  type BetterDirection,
  type Change,
  type FigureKind,
  type Noun,
  changeText,
  countText,
  isEnough,
} from './stats-math.ts';
import './stat-figure.css';

export interface StatFigureProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
  kind: FigureKind;
  n: number;
  noun: Noun;
  previous?: number | null | undefined;
  previousN?: number | undefined;
  comparison?: string;
  better?: BetterDirection;
  note?: string;
  help?: string;
}

const figure: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '13px',
  color: 'var(--fd-muted)',
};

const helpTooltip: CSSProperties = {
  ...chartTooltip,
  position: 'fixed',
  display: 'block',
  boxSizing: 'border-box',
  width: 'max-content',
  maxWidth: `min(${String(HELP_WIDTH)}px, calc(100vw - ${String(2 * VIEWPORT_MARGIN)}px))`,
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
};

function usePlacement(
  open: boolean,
  button: RefObject<HTMLButtonElement | null>,
  tooltip: RefObject<HTMLSpanElement | null>,
): void {
  useLayoutEffect(() => {
    if (!open) return undefined;
    function place(): void {
      const anchor = button.current?.getBoundingClientRect();
      const tip = tooltip.current;
      if (anchor === undefined || tip === null) return;
      tip.style.top = `${String(anchor.bottom + HELP_GAP)}px`;
      tip.style.left = `${String(helpLeft(anchor, tip.offsetWidth, document.documentElement.clientWidth))}px`;
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, button, tooltip]);
}

function useDismiss(open: boolean, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);
}

function useTriggers(
  setOpen: (open: boolean | ((shown: boolean) => boolean)) => void,
): ButtonHTMLAttributes<HTMLButtonElement> {
  const pointer = useRef<string | null>(null);
  return {
    onPointerEnter: (event) => {
      if (event.pointerType === 'mouse') setOpen(true);
    },
    onPointerLeave: (event) => {
      if (event.pointerType === 'mouse') setOpen(false);
    },
    onPointerDown: (event) => {
      pointer.current = event.pointerType;
    },
    onFocus: () => {
      if (pointer.current === null) setOpen(true);
    },
    onBlur: () => {
      pointer.current = null;
      setOpen(false);
    },
    onClick: () => {
      const source = pointer.current;
      pointer.current = null;
      if (source === 'mouse') setOpen(true);
      else if (source !== null) setOpen((shown) => !shown);
    },
  };
}

function FigureHelp({
  label,
  text,
}: {
  label: string;
  text: string;
}): ReactElement {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  usePlacement(open, button, tooltip);
  useDismiss(open, setOpen);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="fd-figure-help"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        {...useTriggers(setOpen)}
      >
        <Icon name="info" size={14} />
      </button>
      {open ? (
        <span
          ref={tooltip}
          id={id}
          role="tooltip"
          data-help=""
          style={helpTooltip}
        >
          {text}
        </span>
      ) : null}
    </>
  );
}

const valueStyle: CSSProperties = {
  fontFamily: 'var(--fd-font-display)',
  fontSize: 'var(--fd-title-md)',
  fontWeight: 600,
  lineHeight: 1.2,
  color: 'var(--fd-ink)',
  fontVariantNumeric: 'tabular-nums',
};

const small: CSSProperties = {
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
};

const TONE_COLOR: Record<Change['tone'], string> = {
  better: 'var(--fd-success)',
  worse: 'var(--fd-danger)',
  none: 'var(--fd-muted)',
};

function ChangeLine({ change }: { change: Change }): ReactElement {
  const style = { ...small, color: TONE_COLOR[change.tone] };
  if (change.direction === null) {
    return (
      <span data-change="" style={style}>
        {change.text}
      </span>
    );
  }
  return (
    <span data-change="" style={style}>
      <span aria-hidden="true">{change.direction === 'up' ? '▲' : '▼'}</span>
      <span style={visuallyHidden}>{change.direction}</span> {change.detail}
    </span>
  );
}

export function StatFigure({
  label,
  value,
  format,
  kind,
  n,
  noun,
  previous,
  previousN,
  comparison = '',
  better = 'higher',
  note,
  help,
}: StatFigureProps): ReactElement {
  const shown = value !== null && isEnough(n) ? value : null;
  const change =
    shown === null
      ? null
      : changeText({
          kind,
          value: shown,
          n,
          previous,
          previousN,
          comparison,
          better,
        });
  return (
    <div style={figure}>
      <span style={labelStyle}>
        {label}
        {help === undefined ? null : <FigureHelp label={label} text={help} />}
      </span>
      <span data-value="" style={valueStyle}>
        {shown === null ? '—' : format(shown)}
      </span>
      <span data-sample="" style={{ ...small, color: 'var(--fd-muted)' }}>
        {shown === null ? 'Not enough data' : `n = ${countText(n, noun)}`}
      </span>
      {change === null ? null : <ChangeLine change={change} />}
      {note === undefined ? null : (
        <span data-note="" style={{ ...small, color: 'var(--fd-ink-2)' }}>
          {note}
        </span>
      )}
    </div>
  );
}
