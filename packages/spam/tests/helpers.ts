import { expect } from "vitest";

import {
  createSpamFilter,
  type ActorState,
  type SpamFilterConfig,
  type SpamFilterDecision,
  type SpamFilterInput,
  type SpamStateStore,
} from "../src/index.js";

type SequenceStep = SpamFilterInput;

const cloneActorState = (state: ActorState): ActorState => ({
  timestamps: [...state.timestamps],
  lastMessageAt: state.lastMessageAt,
  lastNormalizedText: state.lastNormalizedText,
  lastTextAt: state.lastTextAt,
  recentNormalizedTexts: new Map(state.recentNormalizedTexts),
});

export const createCloningSpamStateStore = (): SpamStateStore => {
  const actors = new Map<string, ActorState>();

  return {
    get size() {
      return actors.size;
    },
    get(actorKey) {
      const actor = actors.get(actorKey);
      return actor === undefined ? undefined : cloneActorState(actor);
    },
    set(actorKey, state) {
      actors.set(actorKey, cloneActorState(state));
    },
    delete(actorKey) {
      return actors.delete(actorKey);
    },
    clear() {
      actors.clear();
    },
    entries() {
      return actors.entries();
    },
  };
};

export const expectDecisions = (
  config: Partial<SpamFilterConfig> | undefined,
  sequence: readonly SequenceStep[],
): SpamFilterDecision[] => {
  const filter = createSpamFilter(config);
  const decisions: SpamFilterDecision[] = [];

  for (const step of sequence) {
    decisions.push(filter.check(step));
  }

  return decisions;
};

export const onlyActorState = (stateStore: SpamStateStore): ActorState => {
  const actors = [...stateStore.entries()];

  expect(actors).toHaveLength(1);

  return actors[0][1];
};
