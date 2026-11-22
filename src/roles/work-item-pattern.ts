export const MARKER_ROLE_GROUP = 'role';

export function captureGroups(pattern: RegExp): number {
  return (new RegExp(`${pattern.source}|`).exec('')?.length ?? 1) - 1;
}

export function captureProblem(pattern: RegExp): string | undefined {
  const groups = captureGroups(pattern);
  return groups === 1
    ? undefined
    : `needs exactly one capture group, found ${String(groups)}`;
}

interface Group {
  name: string | undefined;
}

function groupAt(source: string, index: number): Group | undefined {
  if (source[index + 1] !== '?') return { name: undefined };
  const named = /^\?<([A-Za-z_$][\w$]*)>/.exec(source.slice(index + 1));
  return named === null ? undefined : { name: named[1] };
}

function groupsOf(source: string): Group[] {
  const groups: Group[] = [];
  let inClass = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') index += 1;
    else if (inClass) inClass = char !== ']';
    else if (char === '[') inClass = true;
    else if (char === '(') {
      const group = groupAt(source, index);
      if (group !== undefined) groups.push(group);
    }
  }
  return groups;
}

export function markerProblem(pattern: RegExp): string | undefined {
  const groups = groupsOf(pattern.source);
  if (groups.length !== captureGroups(pattern)) {
    return 'its capture groups could not be read';
  }
  const unnamed = groups.filter((group) => group.name === undefined).length;
  if (unnamed !== 1) {
    return `needs exactly one unnamed capture group, found ${String(unnamed)}`;
  }
  const other = groups.find(
    (group) => group.name !== undefined && group.name !== MARKER_ROLE_GROUP,
  );
  return other === undefined
    ? undefined
    : `the only named group allowed is "${MARKER_ROLE_GROUP}", found "${String(other.name)}"`;
}

export function markerCapture(pattern: RegExp): number {
  return (
    groupsOf(pattern.source).findIndex((group) => group.name === undefined) + 1
  );
}
