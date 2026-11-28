import { PARSER_VERSION } from '../../src/cli-ingest/batch.ts';
import packageJson from '../package.json' with { type: 'json' };

export const VERSION_LINES = [
  `factorydeck ${packageJson.version}`,
  `parser ${PARSER_VERSION}`,
];
