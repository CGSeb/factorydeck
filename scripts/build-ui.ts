import { build } from 'vite';
import { uiBuildConfig } from './vite-config.ts';

await build(uiBuildConfig());
