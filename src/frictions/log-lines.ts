import { createReadStream } from 'node:fs';

export interface LogLine {
  offset: number;
  text: string;
}

const NEWLINE = 0x0a;

export async function* logLines(path: string): AsyncGenerator<LogLine> {
  let pending: Buffer = Buffer.alloc(0);
  let pendingOffset = 0;
  for await (const chunk of createReadStream(path)) {
    if (!Buffer.isBuffer(chunk)) continue;
    const data: Buffer =
      pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
    let start = 0;
    let end = data.indexOf(NEWLINE, start);
    while (end !== -1) {
      yield {
        offset: pendingOffset + start,
        text: data.toString('utf8', start, end),
      };
      start = end + 1;
      end = data.indexOf(NEWLINE, start);
    }
    pending = data.subarray(start);
    pendingOffset += start;
  }
  if (pending.length > 0) {
    yield { offset: pendingOffset, text: pending.toString('utf8') };
  }
}
