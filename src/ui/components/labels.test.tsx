// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoundsBadge } from './RoundsBadge.tsx';
import { SerenityBadge } from './SerenityBadge.tsx';
import { StageBadge } from './StageBadge.tsx';

afterEach(cleanup);

describe('labels', () => {
  it('draws a stage badge as a 12 px, 600 weight pill that does not wrap', () => {
    render(<StageBadge stage="needs-spec" />);
    const { style } = screen.getByText('Needs spec');
    expect({
      borderRadius: style.borderRadius,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      padding: style.padding,
      whiteSpace: style.whiteSpace,
      background: style.background,
      color: style.color,
    }).toEqual({
      borderRadius: 'var(--fd-radius-pill)',
      fontSize: 'var(--fd-text-xs)',
      fontWeight: '600',
      padding: '3px 9px',
      whiteSpace: 'nowrap',
      background: 'var(--fd-warning-bg)',
      color: 'var(--fd-warning)',
    });
  });

  it('renders no serenity badge without a report', () => {
    const { container } = render(<SerenityBadge report={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('counts a score equal to its threshold as passing', () => {
    render(<SerenityBadge report={{ score: 80, threshold: 80 }} />);
    expect(screen.getByText('serenity 80').dataset['tone']).toBe('success');
  });

  it('renders no rounds badge with no rounds known, in review or not', () => {
    const { container } = render(
      <>
        <RoundsBadge rounds={null} />
        <RoundsBadge rounds={null} inReview />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });
});
