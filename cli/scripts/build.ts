import { build } from 'vite';
import { cliBuildConfig } from './build-config.ts';

await build(cliBuildConfig());
