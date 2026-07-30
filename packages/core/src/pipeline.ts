import type {
  TextCensor,
  TextGuard,
  TextGuardInput,
  TextGuardResult,
  TextPipeline,
  TextPipelineProcessResult,
} from "./contracts.js";

/**
 * Builds a small in-order moderation pipeline: guards can block the original
 * input before registered censors transform the text.
 */
export function createTextPipeline(): TextPipeline {
  const censors: TextCensor[] = [];
  const guards: TextGuard[] = [];

  const pipeline: TextPipeline = {
    use(censor) {
      censors.push(censor);
      return pipeline;
    },

    guard(guard) {
      guards.push(guard);
      return pipeline;
    },

    censor(text) {
      return censors.reduce((current, censor) => censor.censor(current), text);
    },

    check(input: TextGuardInput): TextGuardResult {
      for (const guard of guards) {
        const result = guard.check(input);
        if (!result.allowed) return result;
      }
      return { allowed: true };
    },

    process(input: TextGuardInput): TextPipelineProcessResult {
      const result = pipeline.check(input);
      if (!result.allowed) return result;
      return {
        allowed: true,
        text: pipeline.censor(input.text),
      };
    },
  };

  return pipeline;
}
