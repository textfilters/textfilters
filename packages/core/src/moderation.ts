import { combineFilters } from "./combine.js";
import type {
  ModerationInput,
  ModerationPipeline,
  ModerationPipelineOptions,
} from "./contracts.js";

export function createModerationPipeline(
  options: ModerationPipelineOptions = {},
): ModerationPipeline {
  const guards = Object.freeze([...(options.guards ?? [])]);
  const filters = combineFilters(...(options.filters ?? []));

  const pipeline: ModerationPipeline = {
    process(input, mask) {
      requireModerationInput(input);

      for (const guard of guards) {
        const decision = guard.check(input);
        if (!decision.allowed) {
          return {
            allowed: false,
            guard: guard.name,
            reason: decision.reason,
          };
        }
      }

      const result = filters.process(input.text, mask);
      return {
        allowed: true,
        text: result.censored,
        matches: result.matches,
      };
    },
  };

  return Object.freeze(pipeline);
}

function requireModerationInput(input: ModerationInput): void {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }
  if (
    typeof input.actorKey !== "string" ||
    input.actorKey.trim().length === 0
  ) {
    throw new TypeError("actorKey must be a non-empty string");
  }
  if (typeof input.text !== "string") {
    throw new TypeError("text must be a string");
  }
  if (
    input.nowMs !== undefined &&
    (typeof input.nowMs !== "number" || !Number.isFinite(input.nowMs))
  ) {
    throw new TypeError("nowMs must be a finite number");
  }
}
