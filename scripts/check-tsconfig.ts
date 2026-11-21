import { execFileSync } from 'node:child_process';
import { z } from 'zod';

const REQUIRED_TRUE = [
  'strict',
  'noUncheckedIndexedAccess',
  'noImplicitOverride',
  'noFallthroughCasesInSwitch',
  'noImplicitReturns',
  'exactOptionalPropertyTypes',
  'useUnknownInCatchVariables',
  'forceConsistentCasingInFileNames',
  'isolatedModules',
  'erasableSyntaxOnly',
  'noEmit',
] as const;

const STRICT_FAMILY = [
  'noImplicitAny',
  'noImplicitThis',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'strictBuiltinIteratorReturn',
  'alwaysStrict',
] as const;

const REQUIRED_INCLUDES = ['src/**/*.ts', 'scripts/**/*.ts'] as const;
const GUARDED_FOLDERS = ['src', 'scripts'] as const;

const ResolvedTsconfigSchema = z.object({
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

/** The resolved configuration, as `tsc --showConfig` prints it. */
export type ResolvedTsconfig = z.infer<typeof ResolvedTsconfigSchema>;

function optionViolations(options: Record<string, unknown>): string[] {
  return [
    ...REQUIRED_TRUE.filter((flag) => options[flag] !== true).map(
      (flag) => `compilerOptions.${flag} must be true`,
    ),
    ...STRICT_FAMILY.filter((flag) => options[flag] === false).map(
      (flag) => `compilerOptions.${flag} must not be false`,
    ),
    ...(options['skipDefaultLibCheck'] === true
      ? ['compilerOptions.skipDefaultLibCheck must not be true']
      : []),
  ];
}

function isGuarded(pattern: string): boolean {
  const path = pattern.replace(/^\.\//, '');
  return GUARDED_FOLDERS.some(
    (folder) => path === folder || path.startsWith(`${folder}/`),
  );
}

function fileViolations(include: string[], exclude: string[]): string[] {
  return [
    ...REQUIRED_INCLUDES.filter((pattern) => !include.includes(pattern)).map(
      (pattern) => `include must contain ${pattern}`,
    ),
    ...exclude
      .filter(isGuarded)
      .map(
        (pattern) => `exclude must not take ${pattern} out of the type check`,
      ),
  ];
}

/**
 * Lists every way the configuration loosens type checking. Adding options is allowed;
 * turning off a strictness flag, or taking source files out of the check, is not.
 */
export function tsconfigViolations(config: ResolvedTsconfig): string[] {
  return [
    ...optionViolations(config.compilerOptions ?? {}),
    ...fileViolations(config.include ?? [], config.exclude ?? []),
  ];
}

if (import.meta.main) {
  const output = execFileSync('tsc', ['--showConfig'], { encoding: 'utf8' });
  const violations = tsconfigViolations(
    ResolvedTsconfigSchema.parse(JSON.parse(output)),
  );
  if (violations.length > 0) {
    process.stderr.write(
      `tsconfig.json loosens type checking:\n${violations.map((v) => `- ${v}`).join('\n')}\n`,
    );
    process.exit(1);
  }
}
