export interface Call {
  model: string | undefined;
  tokens: [number, number, number, number];
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
