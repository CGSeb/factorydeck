import type { ReactElement } from 'react';
import { UNASSIGNED_ROLE } from '../../roles/types.ts';
import { dotStyle, tagStyle } from './label-styles.ts';

export function RoleTag({
  role,
  color,
}: {
  role: string;
  color: string;
}): ReactElement {
  const unassigned = role === UNASSIGNED_ROLE;
  return (
    <span
      style={
        unassigned
          ? { ...tagStyle, color: 'var(--fd-muted)', fontStyle: 'italic' }
          : tagStyle
      }
    >
      <span aria-hidden="true" style={dotStyle(9, '3px', color)} />
      {role}
    </span>
  );
}
