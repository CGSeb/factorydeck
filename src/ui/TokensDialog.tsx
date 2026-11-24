import type { ReactElement } from 'react';
import type { UsageOverview } from '../overview/types.ts';
import type { RoleList } from '../roles/types.ts';
import { DayBars } from './components/DayBars.tsx';
import { Dialog } from './components/Dialog.tsx';
import { type RenderLink, renderAnchor } from './components/link.ts';
import { SplitBar } from './components/SplitBar.tsx';
import { SplitLegend } from './components/SplitLegend.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { roleSegments, tokenBuckets } from './overview-board.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import './overview-page.css';

export const TOKENS_TITLE = 'Where the tokens went';

export type Block<T> = T | 'loading' | 'unreachable';

export interface TokensDialogProps {
  overview: Block<UsageOverview>;
  roles: Block<RoleList>;
  rolesHref: string;
  onClose: () => void;
  renderLink?: RenderLink;
}

function TokensSplit({
  overview,
  roles,
}: {
  overview: UsageOverview;
  roles: RoleList;
}): ReactElement {
  const segments = roleSegments(roles);
  const chartTitle =
    overview.bucket === 'hour' ? 'Tokens per hour' : 'Tokens per day';
  return (
    <div className="fd-overview-tokens">
      <div className="fd-overview-roles">
        <SplitBar label="Tokens by role" height="medium" segments={segments} />
        <SplitLegend segments={segments} />
      </div>
      <div className="fd-overview-days">
        <span className="fd-overview-days-title">{chartTitle}</span>
        <DayBars
          label={chartTitle}
          buckets={tokenBuckets(overview.series)}
          color="var(--fd-chart-bar)"
          height={56}
        />
      </div>
    </div>
  );
}

function Content({
  overview,
  roles,
}: Pick<TokensDialogProps, 'overview' | 'roles'>): ReactElement {
  if (overview === 'unreachable' || roles === 'unreachable') {
    return <StatusLine>{UNREACHABLE_MESSAGE}</StatusLine>;
  }
  if (overview === 'loading' || roles === 'loading') {
    return <StatusLine>Loading…</StatusLine>;
  }
  return <TokensSplit overview={overview} roles={roles} />;
}

export function TokensDialog({
  overview,
  roles,
  rolesHref,
  onClose,
  renderLink = renderAnchor,
}: TokensDialogProps): ReactElement {
  return (
    <Dialog
      title={TOKENS_TITLE}
      text="The tokens of the period, by role and over time."
      cancelLabel="Close"
      onCancel={onClose}
      withLinks
    >
      <div className="fd-overview-dialog">
        <Content overview={overview} roles={roles} />
        {renderLink({
          href: rolesHref,
          className: 'fd-panel-link',
          children: 'Roles',
        })}
      </div>
    </Dialog>
  );
}
