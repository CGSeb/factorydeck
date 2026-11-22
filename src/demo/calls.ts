export interface Call {
  model: string | undefined;
  tokens: [number, number, number, number];
  skill?: string;
  text?: string;
}

export function replying(call: Call, text: string): Call {
  return { ...call, text };
}

export function launching(call: Call, skill: string): Call {
  return { ...call, skill };
}

export const opus: Call = {
  model: 'claude-opus-demo',
  tokens: [800, 12_000, 90_000, 2_500],
};
export const sonnet: Call = {
  model: 'claude-sonnet-demo',
  tokens: [600, 8_000, 60_000, 1_800],
};
export const haiku: Call = {
  model: 'claude-haiku-demo',
  tokens: [400, 3_000, 20_000, 900],
};
export const unknownPrice: Call = {
  model: 'example-model-x',
  tokens: [300, 2_000, 10_000, 700],
};
export const noModel: Call = {
  model: undefined,
  tokens: [200, 1_000, 5_000, 300],
};

export interface DemoSession {
  id: string;
  folder: string;
  project: string | undefined;
  gitBranch: string;
  startsAgo: number;
  prompt: string;
  calls: readonly Call[];
  subAgents?: readonly DemoSubAgent[];
}

export interface DemoSubAgent {
  id: string;
  agentType: string;
  description: string;
  calls: readonly Call[];
}

type Line = Record<string, unknown>;

export function callLines(
  calls: readonly Call[],
  prefix: string,
  context: (step: number) => Line,
): Line[] {
  return calls.map((call, index) => {
    const [input, cacheWrite, cacheRead, output] = call.tokens;
    const requestId = `${prefix}-req-${String(index)}`;
    return {
      type: 'assistant',
      ...context(index + 1),
      requestId,
      message: {
        id: `msg_${requestId}`,
        role: 'assistant',
        ...(call.model === undefined ? {} : { model: call.model }),
        stop_reason: 'end_turn',
        content:
          call.skill === undefined
            ? [{ type: 'text', text: call.text ?? 'Done.' }]
            : [
                {
                  type: 'tool_use',
                  id: `toolu_${requestId}`,
                  name: 'Skill',
                  input: { skill: call.skill },
                },
              ],
        usage: {
          input_tokens: input,
          cache_creation_input_tokens: cacheWrite,
          cache_read_input_tokens: cacheRead,
          output_tokens: output,
        },
      },
    };
  });
}
