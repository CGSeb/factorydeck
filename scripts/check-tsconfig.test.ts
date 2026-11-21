import { describe, expect, it } from 'vitest';
import { type ResolvedTsconfig, tsconfigViolations } from './check-tsconfig.ts';

const strictConfig: ResolvedTsconfig = {
  compilerOptions: {
    strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noImplicitReturns: true,
    exactOptionalPropertyTypes: true,
    useUnknownInCatchVariables: true,
    forceConsistentCasingInFileNames: true,
    isolatedModules: true,
    erasableSyntaxOnly: true,
    noEmit: true,
  },
  include: ['src/**/*.ts', 'scripts/**/*.ts'],
};

function withOptions(options: Record<string, unknown>): ResolvedTsconfig {
  return {
    ...strictConfig,
    compilerOptions: { ...strictConfig.compilerOptions, ...options },
  };
}

describe('tsconfigViolations', () => {
  it('accepts the strict configuration', () => {
    expect(tsconfigViolations(strictConfig)).toEqual([]);
  });

  it('accepts added options and includes', () => {
    const config = withOptions({ jsx: 'react-jsx', lib: ['ES2023', 'DOM'] });
    config.include = [...(config.include ?? []), 'src/**/*.tsx'];
    config.exclude = ['dist'];
    expect(tsconfigViolations(config)).toEqual([]);
  });

  it('rejects a required flag turned off or removed', () => {
    const config = withOptions({ noUncheckedIndexedAccess: false });
    delete config.compilerOptions?.['strict'];
    expect(tsconfigViolations(config)).toEqual([
      'compilerOptions.strict must be true',
      'compilerOptions.noUncheckedIndexedAccess must be true',
    ]);
  });

  it('rejects a strict-family flag turned off under strict', () => {
    expect(
      tsconfigViolations(withOptions({ strictNullChecks: false })),
    ).toEqual(['compilerOptions.strictNullChecks must not be false']);
  });

  it('rejects skipping the default library check', () => {
    expect(
      tsconfigViolations(withOptions({ skipDefaultLibCheck: true })),
    ).toEqual(['compilerOptions.skipDefaultLibCheck must not be true']);
  });

  it('rejects source files taken out of the check', () => {
    const config: ResolvedTsconfig = {
      ...strictConfig,
      include: ['src/**/*.ts'],
      exclude: ['./src/ingest/**', 'scripts'],
    };
    expect(tsconfigViolations(config)).toEqual([
      'include must contain scripts/**/*.ts',
      'exclude must not take ./src/ingest/** out of the type check',
      'exclude must not take scripts out of the type check',
    ]);
  });
});
