import { readFile } from 'node:fs/promises';
import { type Document, parseDocument } from 'yaml';
import { FACTORY_FILE, factoryFile } from '../ingest/factory.ts';

export class FactorySettingsError extends Error {}

export interface FactorySettings {
  text(key: string): string | undefined;
  requireText(key: string): string;
  flag(key: string): boolean | undefined;
  requireFlag(key: string): boolean;
}

function valueAt(document: Document, key: string): unknown {
  return document.getIn(key.split('.'));
}

function missing(key: string): FactorySettingsError {
  return new FactorySettingsError(`${FACTORY_FILE} has no ${key}`);
}

function settingsOf(document: Document): FactorySettings {
  const text = (key: string): string | undefined => {
    const value = valueAt(document, key);
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    return value.trim();
  };
  const flag = (key: string): boolean | undefined => {
    const value = valueAt(document, key);
    return typeof value === 'boolean' ? value : undefined;
  };
  return {
    text,
    requireText: (key) => {
      const value = text(key);
      if (value === undefined) throw missing(key);
      return value;
    },
    flag,
    requireFlag: (key) => {
      const value = flag(key);
      if (value === undefined) throw missing(key);
      return value;
    },
  };
}

export async function readFactorySettings(
  root: string,
): Promise<FactorySettings> {
  let source: string;
  try {
    source = await readFile(factoryFile(root), 'utf8');
  } catch {
    throw new FactorySettingsError(`${FACTORY_FILE} not found`);
  }
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    throw new FactorySettingsError(`${FACTORY_FILE} is not valid YAML`);
  }
  return settingsOf(document);
}
