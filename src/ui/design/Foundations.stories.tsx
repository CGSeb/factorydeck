/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { card, code, grid, heading, page, rows } from './foundation-styles.ts';
import {
  ORCHESTRATION_COLOR,
  UNASSIGNED_COLOR,
  categoryColor,
  projectColor,
} from './palette.ts';
import css from './tokens.css?raw';
import { type DesignToken, colorTokens, parseTokens } from './tokens.ts';

const tokens = parseTokens(css);
const SAMPLE = 'Factory cost per issue: 1,284,560 tokens, $42.18';
const FIRST_TEN = Array.from({ length: 10 }, (_, index) => index);

function byPrefix(prefix: string): DesignToken[] {
  return tokens.filter(({ name }) => name.startsWith(prefix));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      style={{ display: 'grid', gap: 'var(--fd-space-3)' }}
    >
      <h2 style={heading}>{title}</h2>
      {children}
    </section>
  );
}

function Swatch({
  name,
  color,
  value,
}: {
  name: string;
  color: string;
  value: string;
}) {
  return (
    <li style={card}>
      <span
        aria-hidden="true"
        style={{
          background: color,
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-sm)',
          flex: 'none',
          height: 'var(--fd-control-height)',
          width: 'var(--fd-control-height)',
        }}
      />
      <span style={{ display: 'grid', gap: 'var(--fd-space-1)' }}>
        <strong style={{ fontWeight: 600 }}>{name}</strong>
        <code style={code}>{value}</code>
      </span>
    </li>
  );
}

function ColoursSheet() {
  return (
    <main style={page}>
      <Section title="Colour tokens">
        <ul style={grid}>
          {colorTokens(tokens).map(({ name, value }) => (
            <Swatch
              key={name}
              name={name}
              color={`var(${name})`}
              value={value}
            />
          ))}
        </ul>
      </Section>
    </main>
  );
}

function TokenRow({
  token,
  children,
}: {
  token: DesignToken;
  children: ReactNode;
}) {
  return (
    <li style={{ ...card, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span
        style={{
          flex: '0 0 340px',
          display: 'grid',
          gap: 'var(--fd-space-1)',
        }}
      >
        <strong style={{ fontWeight: 600 }}>{token.name}</strong>
        <code style={code}>{token.value}</code>
      </span>
      {children}
    </li>
  );
}

function TypeSheet() {
  return (
    <main style={page}>
      <Section title="Fonts">
        <ul style={rows}>
          {byPrefix('--fd-font-').map((token) => (
            <TokenRow key={token.name} token={token}>
              <span
                style={{
                  fontFamily: `var(${token.name})`,
                  fontSize: 'var(--fd-text-lg)',
                }}
              >
                {SAMPLE}
              </span>
            </TokenRow>
          ))}
        </ul>
      </Section>
      <Section title="Sizes">
        <ul style={rows}>
          {[
            ...byPrefix('--fd-text-'),
            ...byPrefix('--fd-title-'),
            ...byPrefix('--fd-figure'),
          ].map((token) => (
            <TokenRow key={token.name} token={token}>
              <span
                style={{
                  fontFamily: token.name.startsWith('--fd-text-')
                    ? 'var(--fd-font-body)'
                    : 'var(--fd-font-display)',
                  fontSize: `var(${token.name})`,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: token.name.startsWith('--fd-text-') ? 400 : 600,
                }}
              >
                {SAMPLE}
              </span>
            </TokenRow>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function SpacingAndRadiiSheet() {
  return (
    <main style={page}>
      <Section title="Spacing">
        <ul style={rows}>
          {byPrefix('--fd-space-').map((token) => (
            <TokenRow key={token.name} token={token}>
              <span
                aria-hidden="true"
                style={{
                  background: 'var(--fd-accent)',
                  borderRadius: 'var(--fd-radius-sm)',
                  height: 'var(--fd-space-4)',
                  width: `var(${token.name})`,
                }}
              />
            </TokenRow>
          ))}
        </ul>
      </Section>
      <Section title="Radii">
        <ul style={grid}>
          {byPrefix('--fd-radius-').map((token) => (
            <TokenRow key={token.name} token={token}>
              <span
                aria-hidden="true"
                style={{
                  background: 'var(--fd-accent-soft)',
                  border: '1px solid var(--fd-accent)',
                  borderRadius: `var(${token.name})`,
                  height: '56px',
                  width: '96px',
                }}
              />
            </TokenRow>
          ))}
        </ul>
      </Section>
      <Section title="Layout">
        <ul style={rows}>
          {[
            ...byPrefix('--fd-page-max'),
            ...byPrefix('--fd-gutter'),
            ...byPrefix('--fd-topbar-height'),
            ...byPrefix('--fd-sidebar'),
            ...byPrefix('--fd-control-height'),
          ].map((token) => (
            <TokenRow key={token.name} token={token}>
              {null}
            </TokenRow>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function PalettesSheet() {
  return (
    <main style={page}>
      <Section title="categoryColor">
        <ul style={grid}>
          {FIRST_TEN.map((index) => (
            <Swatch
              key={index}
              name={`categoryColor(${index})`}
              color={categoryColor(index)}
              value={categoryColor(index)}
            />
          ))}
        </ul>
      </Section>
      <Section title="projectColor">
        <ul style={grid}>
          {FIRST_TEN.map((index) => (
            <Swatch
              key={index}
              name={`projectColor(${index})`}
              color={projectColor(index)}
              value={projectColor(index)}
            />
          ))}
        </ul>
      </Section>
      <Section title="Fixed colours">
        <ul style={grid}>
          <Swatch
            name="ORCHESTRATION_COLOR"
            color={ORCHESTRATION_COLOR}
            value={ORCHESTRATION_COLOR}
          />
          <Swatch
            name="UNASSIGNED_COLOR"
            color={UNASSIGNED_COLOR}
            value={UNASSIGNED_COLOR}
          />
        </ul>
      </Section>
    </main>
  );
}

const meta = {
  title: 'Design/Foundations',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Colours: Story = {
  name: 'Colours',
  render: () => <ColoursSheet />,
};

export const Type: Story = { name: 'Type', render: () => <TypeSheet /> };

export const SpacingAndRadii: Story = {
  name: 'Spacing and radii',
  render: () => <SpacingAndRadiiSheet />,
};

export const Palettes: Story = {
  name: 'Palettes',
  render: () => <PalettesSheet />,
};
