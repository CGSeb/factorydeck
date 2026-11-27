import {
  type MouseEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { TeamAccountRow } from '../team/types.ts';
import { Icon } from './components/Icon.tsx';
import type { WriteClipboard } from './frictions-api.ts';
import {
  type CreateResetLink,
  type CreatedResetLink,
  resetLink,
} from './reset-api.ts';
import {
  COPY_LABELS,
  type CopyState,
  useCopyState,
} from './invite-dialog-state.ts';
import { useResetLinks } from './reset-links.ts';
import type { RowMessage } from './team-changes.ts';
import type { RunChange } from './team-status-actions.ts';
import type { TeamAction, TeamTableProps } from './TeamTable.tsx';
import './team.css';

export const RESET_ACTION = 'Reset password link';
export const VALID_FOR = 'Valid for 24 hours';
export const DONE = 'Done';

export interface ResetLinkPanelProps {
  account: TeamAccountRow;
  link: CreatedResetLink;
  origin: string;
  copy: WriteClipboard;
  onDone: () => void;
}

function focusRowActions(event: MouseEvent<HTMLElement>): void {
  let row = event.currentTarget.closest('tr')?.previousElementSibling;
  while (row?.classList.contains('fd-team-message-row') === true) {
    row = row.previousElementSibling;
  }
  row?.querySelector<HTMLButtonElement>('.fd-team-actions-button')?.focus();
}

function useCopyLink(
  url: string,
  copy: WriteClipboard,
): {
  state: CopyState;
  input: RefObject<HTMLInputElement | null>;
  copyLink: () => Promise<void>;
} {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useCopyState();
  async function copyLink(): Promise<void> {
    try {
      await copy(url);
      setState('copied');
    } catch {
      setState('failed');
      input.current?.focus();
      input.current?.select();
    }
  }
  return { state, input, copyLink };
}

function CopyButton({
  token,
  state,
  onCopy,
}: {
  token: string;
  state: CopyState;
  onCopy: () => Promise<void>;
}): ReactElement {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
  }, [token]);
  return (
    <button
      ref={button}
      type="button"
      className="fd-control fd-reset-link-button fd-reset-link-copy"
      onClick={() => void onCopy()}
    >
      <Icon name="copy" size={16} />
      {COPY_LABELS[state]}
    </button>
  );
}

export function ResetLinkPanel({
  account,
  link,
  origin,
  copy,
  onDone,
}: ResetLinkPanelProps): ReactElement {
  const url = resetLink(origin, link.token);
  const { state, input, copyLink } = useCopyLink(url, copy);
  return (
    <div
      className="fd-reset-link"
      role="group"
      aria-label={`${RESET_ACTION} for ${account.name}`}
    >
      <input
        ref={input}
        className="fd-reset-link-input"
        type="text"
        readOnly
        value={url}
        aria-label={RESET_ACTION}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
      />
      <span className="fd-reset-link-valid">{VALID_FOR}</span>
      <span className="fd-reset-link-buttons">
        <CopyButton token={link.token} state={state} onCopy={copyLink} />
        <button
          type="button"
          className="fd-control fd-reset-link-button"
          onClick={(event) => {
            focusRowActions(event);
            onDone();
          }}
        >
          {DONE}
        </button>
      </span>
      <span className="fd-visually-hidden" role="status">
        {state === 'idle' ? '' : COPY_LABELS[state]}
      </span>
    </div>
  );
}

export interface TeamResetRows {
  actionsOf: (account: TeamAccountRow) => TeamAction[];
  below: NonNullable<TeamTableProps['below']>;
  busy: ReadonlySet<number>;
  message: RowMessage | undefined;
  teamStarted: () => void;
  run: RunChange;
}

export function useTeamResetRows({
  createResetLink,
  origin,
  copy,
  team,
}: {
  createResetLink: CreateResetLink | undefined;
  origin: string;
  copy: WriteClipboard;
  team: {
    busy: ReadonlySet<number>;
    message: RowMessage | undefined;
    run: RunChange;
  };
}): TeamResetRows {
  const { links, busy, message, create, close } =
    useResetLinks(createResetLink);
  const [last, setLast] = useState<'team' | 'reset'>('team');
  return {
    actionsOf: (account) =>
      createResetLink === undefined || !account.active
        ? []
        : [
            {
              label: RESET_ACTION,
              onSelect: ({ id }) => {
                setLast('reset');
                create(id);
              },
            },
          ],
    below: (account): ReactElement | undefined => {
      const link = links.get(account.id);
      if (link === undefined) return undefined;
      return (
        <ResetLinkPanel
          account={account}
          link={link}
          origin={origin}
          copy={copy}
          onDone={() => {
            close(account.id);
          }}
        />
      );
    },
    busy: busy.size === 0 ? team.busy : new Set([...team.busy, ...busy]),
    message: last === 'reset' ? message : team.message,
    teamStarted: () => {
      setLast('team');
    },
    run: (id, send) => {
      setLast('team');
      team.run(id, send);
    },
  };
}
