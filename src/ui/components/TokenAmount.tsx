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
  type TooltipPosition,
  placeTooltip,
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

const SIDE_STYLES: Record<TokenAmountPlacement, CSSProperties> = {
  above: { paddingBottom: 'var(--fd-space-1)' },
  below: { paddingTop: 'var(--fd-space-1)' },
};

const tooltipFrame: CSSProperties = {
  position: 'fixed',
  zIndex: 20,
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

function anchorOf(tooltip: HTMLElement): HTMLElement | null {
  return tooltip.parentElement;
}

/**
 * The tooltip is `position: fixed` so a scrolling or clipping ancestor (a
 * table wrapper with `overflow-x: auto`, a card) never cuts it off.
 */
function useFixedPosition(
  ref: RefObject<HTMLSpanElement | null>,
  open: boolean,
  placement: TokenAmountPlacement,
  layoutKey: string,
): TooltipPosition | undefined {
  const [position, setPosition] = useState<TooltipPosition>();

  useLayoutEffect(() => {
    const tooltip = ref.current;
    const anchor = tooltip === null ? null : anchorOf(tooltip);
    if (!open || tooltip === null || anchor === null) {
      setPosition(undefined);
      return undefined;
    }
    function measure(): void {
      if (tooltip === null || anchor === null) return;
      setPosition(
        placeTooltip({
          anchor: anchor.getBoundingClientRect(),
          size: { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
          viewport: {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
          },
          preferred: placement,
          margin: edgeMargin(),
        }),
      );
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [ref, open, placement, layoutKey]);

  return position;
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
  const position = useFixedPosition(
    ref,
    open,
    placement,
    JSON.stringify(lines),
  );
  const side = position?.side ?? placement;

  return (
    <span
      ref={ref}
      id={id}
      role="tooltip"
      hidden={!open}
      data-side={side}
      style={{
        ...tooltipFrame,
        ...SIDE_STYLES[side],
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        ...(position === undefined ? { visibility: 'hidden' } : {}),
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
