import {
  type CSSProperties,
  Fragment,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { formatTokens } from '../format.ts';
import {
  type TokenCounts,
  type TooltipLine,
  shiftIntoView,
  tooltipLines,
  totalTokens,
} from './token-amount.ts';

export type TokenAmountSize = 'inline' | 'strong' | 'figure';
export type TokenAmountPlacement = 'above' | 'below';

export interface TokenAmountProps {
  counts: TokenCounts;
  costUsd: number | null;
  unknownPriceCalls?: number;
  size?: TokenAmountSize;
  placement?: TokenAmountPlacement;
}

const EDGE_MARGIN_TOKEN = '--fd-space-2';

const anchor: CSSProperties = { position: 'relative' };

const NUMBER_STYLES: Record<TokenAmountSize, CSSProperties> = {
  inline: {},
  strong: { fontWeight: 700 },
  figure: {
    fontFamily: 'var(--fd-font-display)',
    fontSize: 'var(--fd-figure)',
    fontWeight: 600,
    color: 'var(--fd-accent)',
  },
};

const number: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: 'currentColor',
  textUnderlineOffset: 'var(--fd-space-1)',
  cursor: 'default',
};

const PLACEMENT_STYLES: Record<TokenAmountPlacement, CSSProperties> = {
  above: { bottom: '100%', right: 0, paddingBottom: 'var(--fd-space-1)' },
  below: { top: '100%', left: 0, paddingTop: 'var(--fd-space-1)' },
};

const tooltipFrame: CSSProperties = {
  position: 'absolute',
  zIndex: 1,
  fontFamily: 'var(--fd-font-body)',
  fontSize: 'var(--fd-text-sm)',
  fontWeight: 400,
  fontStyle: 'normal',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  textAlign: 'left',
};

const tooltipBox: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--fd-space-1)',
  background: 'var(--fd-tooltip-bg)',
  color: 'var(--fd-tooltip-ink)',
  borderRadius: 'var(--fd-radius-card)',
  padding: 'var(--fd-space-2) var(--fd-space-3)',
};

const line: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 'var(--fd-space-4)',
};

const value: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
};

const costBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--fd-space-1)',
  paddingBottom: 'var(--fd-space-2)',
  marginBottom: 'var(--fd-space-1)',
  borderBottom: '1px solid var(--fd-tooltip-line)',
};

const muted: CSSProperties = { color: 'var(--fd-tooltip-muted)' };

function edgeMargin(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    EDGE_MARGIN_TOKEN,
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Line({ line: item }: { line: TooltipLine }): ReactElement {
  if (item.kind === 'note') {
    return <span style={muted}>{item.text}</span>;
  }
  const bold = item.kind === 'cost';
  return (
    <span style={bold ? { ...line, fontWeight: 700 } : line}>
      <span style={bold ? undefined : muted}>{item.label}</span>{' '}
      <span style={value}>{item.value}</span>
    </span>
  );
}

function TooltipContent({ lines }: { lines: TooltipLine[] }): ReactElement {
  const costLines = lines.filter((item) => item.kind !== 'count');
  const countLines = lines.filter((item) => item.kind === 'count');
  return (
    <span style={tooltipBox}>
      <span style={costBlock}>
        {costLines.map((item) => (
          <Fragment key={item.kind}>
            <Line line={item} />{' '}
          </Fragment>
        ))}
      </span>{' '}
      {countLines.map((item) => (
        <Fragment key={item.label}>
          <Line line={item} />{' '}
        </Fragment>
      ))}
    </span>
  );
}

function useHoverFocusDisclosure() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return {
    open,
    pointerHandlers: {
      onPointerEnter: () => {
        setHovered(true);
      },
      onPointerLeave: () => {
        setHovered(false);
        setDismissed(false);
      },
    },
    focusHandlers: {
      onFocus: () => {
        setFocused(true);
        setDismissed(false);
      },
      onBlur: () => {
        setFocused(false);
        setDismissed(false);
      },
    },
  };
}

function useShiftIntoView(
  ref: RefObject<HTMLSpanElement | null>,
  open: boolean,
  layoutKey: string,
): number {
  const [shift, setShift] = useState(0);
  const applied = useRef(0);
  applied.current = shift;

  useLayoutEffect(() => {
    const tooltip = ref.current;
    if (!open || tooltip === null) {
      setShift(0);
      return undefined;
    }
    function measure(): void {
      if (tooltip === null) return;
      const box = tooltip.getBoundingClientRect();
      setShift(
        shiftIntoView(
          {
            left: box.left - applied.current,
            right: box.right - applied.current,
          },
          document.documentElement.clientWidth,
          edgeMargin(),
        ),
      );
    }
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(tooltip);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref, open, layoutKey]);

  return shift;
}

function Tooltip({
  id,
  open,
  placement,
  lines,
}: {
  id: string;
  open: boolean;
  placement: TokenAmountPlacement;
  lines: TooltipLine[];
}): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const shift = useShiftIntoView(
    ref,
    open,
    `${placement} ${JSON.stringify(lines)}`,
  );

  return (
    <span
      ref={ref}
      id={id}
      role="tooltip"
      hidden={!open}
      style={{
        ...tooltipFrame,
        ...PLACEMENT_STYLES[placement],
        ...(shift === 0 ? {} : { transform: `translateX(${String(shift)}px)` }),
      }}
    >
      <TooltipContent lines={lines} />
    </span>
  );
}

export function TokenAmount({
  counts,
  costUsd,
  unknownPriceCalls = 0,
  size = 'inline',
  placement = 'above',
}: TokenAmountProps): ReactElement {
  const tooltipId = useId();
  const { open, pointerHandlers, focusHandlers } = useHoverFocusDisclosure();

  return (
    <span style={anchor} {...pointerHandlers}>
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        style={{ ...number, ...NUMBER_STYLES[size] }}
        {...focusHandlers}
      >
        {formatTokens(totalTokens(counts))}
      </span>
      <Tooltip
        id={tooltipId}
        open={open}
        placement={placement}
        lines={tooltipLines(counts, costUsd, unknownPriceCalls)}
      />
    </span>
  );
}
