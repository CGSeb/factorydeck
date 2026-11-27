import {
  type ButtonHTMLAttributes,
  type ReactElement,
  useEffect,
  useId,
  useState,
} from 'react';
import './frictions-page.css';

export const COPY_REPORT = 'Copy friction report';
export const COPY_AND_MARK = 'Copy and mark as reported';
export const COPYING = 'Copying…';
export const COPIED = 'Copied';
export const COPY_FAILED = 'Could not copy';
export const ALL_PROJECTS_TIP = 'Select one project to copy a friction report.';
export const COPIED_MS = 2000;
export const FAILED_MS = 4000;

export type ReportBlock = 'loading' | 'empty' | 'all-projects' | null;

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

const STATE_LABELS: Record<Exclude<CopyState, 'idle'>, string> = {
  copying: COPYING,
  copied: COPIED,
  failed: COPY_FAILED,
};

export interface FrictionReportButtonProps {
  blocked: ReportBlock;
  onCopy: () => Promise<void>;
  label?: string | undefined;
}

function useCopyState(): [CopyState, (state: CopyState) => void] {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state !== 'copied' && state !== 'failed') return undefined;
    const timer = setTimeout(
      () => {
        setState('idle');
      },
      state === 'copied' ? COPIED_MS : FAILED_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [state]);
  return [state, setState];
}

function useTip(): [
  boolean,
  Pick<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onMouseEnter' | 'onMouseLeave' | 'onFocus' | 'onBlur' | 'onKeyDown'
  >,
] {
  const [tip, setTip] = useState(false);
  const show = (): void => {
    setTip(true);
  };
  const hide = (): void => {
    setTip(false);
  };
  return [
    tip,
    {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onKeyDown: (event) => {
        if (event.key === 'Escape') hide();
      },
    },
  ];
}

function Labels({
  idle,
  label,
}: {
  idle: string;
  label: string;
}): ReactElement {
  return (
    <span className="fd-friction-report-labels">
      {[idle, ...Object.values(STATE_LABELS)].map((text) => (
        <span
          key={text}
          className="fd-friction-report-label"
          data-current={text === label}
          aria-hidden={text === label ? undefined : true}
        >
          {text}
        </span>
      ))}
    </span>
  );
}

export function FrictionReportButton({
  blocked,
  onCopy,
  label: idle = COPY_REPORT,
}: FrictionReportButtonProps): ReactElement {
  const tipId = useId();
  const [state, setState] = useCopyState();
  const [tip, tipTriggers] = useTip();
  const label = state === 'idle' ? idle : STATE_LABELS[state];
  const disabled = blocked !== null || state === 'copying';
  const withTip = blocked === 'all-projects';
  const copy = async (): Promise<void> => {
    setState('copying');
    try {
      await onCopy();
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <div className="fd-friction-report">
      <button
        type="button"
        className="fd-control fd-friction-report-button"
        aria-disabled={disabled}
        aria-describedby={withTip ? tipId : undefined}
        onClick={() => {
          if (!disabled) void copy();
        }}
        {...tipTriggers}
      >
        <Labels idle={idle} label={label} />
      </button>
      {withTip && (
        <span
          id={tipId}
          role="tooltip"
          className="fd-friction-report-tip"
          hidden={!tip}
        >
          {ALL_PROJECTS_TIP}
        </span>
      )}
      <span className="fd-visually-hidden" role="status">
        {state === 'copied' || state === 'failed' ? label : ''}
      </span>
    </div>
  );
}
