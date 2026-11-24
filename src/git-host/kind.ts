export type IssueKind = 'feature' | 'bug';

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function bugLabelOf(
  label: string | undefined,
  reserved: readonly (string | undefined)[],
): string | null {
  if (label === undefined || label.trim() === '') return null;
  const taken = reserved.some(
    (other) => other !== undefined && sameLabel(other, label),
  );
  return taken ? null : label.trim();
}

export function issueKind(
  labels: readonly string[],
  bugLabel: string | null,
): IssueKind {
  if (bugLabel === null) return 'feature';
  return labels.some((label) => sameLabel(label, bugLabel)) ? 'bug' : 'feature';
}

export function kindOf(
  issue: { labels: readonly { name: string }[] },
  bugLabel: string | null,
): IssueKind {
  return issueKind(
    issue.labels.map((label) => label.name),
    bugLabel,
  );
}
