import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react';
import type {
  FrictionOccurrence,
  FullOutputResponse,
} from '../frictions/occurrence-types.ts';
import { formatDateTime } from './format.ts';
import type { LoadOutput } from './occurrences-api.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import './frictions-page.css';

export const LOG_GONE = 'The session log is no longer on this computer.';
export const NO_OUTPUT = 'No output.';
export const SHOW_FULL_OUTPUT = 'Show full output';
export const HIDE_FULL_OUTPUT = 'Hide full output';

export function fullOutputLabel(open: boolean, at: string): string {
  return `${open ? HIDE_FULL_OUTPUT : SHOW_FULL_OUTPUT} of the occurrence at ${formatDateTime(at)}`;
}

function FullOutputBody({
  response,
}: {
  response: FullOutputResponse | undefined | null;
}): ReactNode {
  if (response === null) return 'Loading…';
  if (response?.status !== 'ok') return UNREACHABLE_MESSAGE;
  return response.gone ? LOG_GONE : response.text;
}

function FullOutput({
  occurrence,
  loadOutput,
}: {
  occurrence: FrictionOccurrence;
  loadOutput: LoadOutput;
}): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState<
    FullOutputResponse | undefined | null
  >(null);
  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    void loadOutput(occurrence.id).then((body) => {
      if (current) setResponse(body);
    });
    return () => {
      current = false;
    };
  }, [open, loadOutput, occurrence.id]);
  const loaded = response?.status === 'ok' && !response.gone;
  return (
    <>
      <button
        type="button"
        className="fd-occurrence-more"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={fullOutputLabel(open, occurrence.at)}
        onClick={() => {
          setResponse(null);
          setOpen(!open);
        }}
      >
        {open ? HIDE_FULL_OUTPUT : SHOW_FULL_OUTPUT}
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label={`Full output of the occurrence at ${formatDateTime(occurrence.at)}`}
          tabIndex={0}
          className={
            loaded
              ? 'fd-occurrence-output'
              : 'fd-occurrence-output fd-occurrence-output-status'
          }
        >
          <FullOutputBody response={response} />
        </div>
      )}
    </>
  );
}

function ToolErrorTexts({
  occurrence,
  input,
  error,
  shell,
}: {
  occurrence: FrictionOccurrence;
  input: string;
  error: string;
  shell: boolean;
}): ReactElement {
  return (
    <>
      <p className="fd-occurrence-text">{input}</p>
      {occurrence.exitCode !== null && (
        <p className="fd-occurrence-exit">Exit code {occurrence.exitCode}</p>
      )}
      {error !== '' ? (
        <p className="fd-occurrence-text fd-occurrence-error">{error}</p>
      ) : (
        shell && <p className="fd-occurrence-no-output">{NO_OUTPUT}</p>
      )}
    </>
  );
}

export function OccurrenceTexts({
  occurrence,
  loadOutput,
}: {
  occurrence: FrictionOccurrence;
  loadOutput: LoadOutput;
}): ReactNode {
  const { texts } = occurrence;
  if (texts === null) {
    return <p className="fd-occurrence-gone">{LOG_GONE}</p>;
  }
  return (
    <>
      {texts.kind === 'stop-blocked' ? (
        <p className="fd-occurrence-text fd-occurrence-message">
          {texts.message}
        </p>
      ) : (
        <ToolErrorTexts
          occurrence={occurrence}
          input={texts.input}
          error={texts.error}
          shell={texts.shell}
        />
      )}
      {occurrence.hasMore && (
        <FullOutput occurrence={occurrence} loadOutput={loadOutput} />
      )}
    </>
  );
}
