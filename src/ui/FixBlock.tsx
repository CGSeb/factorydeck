import type { ReactElement } from 'react';
import type { BugFix } from '../bugs/types.ts';
import { pillStyle } from './components/label-styles.ts';
import { reproducedOf } from './bugs-view.ts';
import './fix-block.css';

export const NO_FIX_TEXT = 'No fix reviewed yet.';

export const NO_ROOT_CAUSE_TEXT = 'Not given';

export function ReproducedValue({ fix }: { fix: BugFix | null }): ReactElement {
  const { text, tone } = reproducedOf(fix);
  return tone === null ? (
    <>{text}</>
  ) : (
    <span data-tone={tone} style={pillStyle(tone)}>
      {text}
    </span>
  );
}

export function FixBlock({ fix }: { fix: BugFix | null }): ReactElement {
  return (
    <div className="fd-fix">
      <p className="fd-summary-label">Fix</p>
      {fix === null ? (
        <p className="fd-fix-none">{NO_FIX_TEXT}</p>
      ) : (
        <dl className="fd-summary-list">
          <dt>Root cause</dt>
          <dd>{fix.rootCause ?? NO_ROOT_CAUSE_TEXT}</dd>
          <dt>Reproduced</dt>
          <dd>
            <ReproducedValue fix={fix} />
          </dd>
          <dt>Pull request</dt>
          <dd>
            <a href={fix.request.url} target="_blank" rel="noreferrer">
              #{fix.request.number}
            </a>
          </dd>
        </dl>
      )}
    </div>
  );
}
