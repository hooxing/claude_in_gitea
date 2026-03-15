import { z } from "zod";

/**
 * Runtime validation schema for action context inputs.
 * Catches mis-configured workflows early with clear error messages.
 */
export const ActionInputsSchema = z.object({
  prompt: z.string(),
  triggerPhrase: z
    .string()
    .min(1, "trigger_phrase must not be empty")
    .max(100, "trigger_phrase must be 100 characters or fewer"),
  assigneeTrigger: z.string(),
  labelTrigger: z.string(),
  baseBranch: z.string().optional(),
  branchPrefix: z
    .string()
    .max(50, "branch_prefix must be 50 characters or fewer"),
  branchNameTemplate: z.string().optional(),
  useStickyComment: z.boolean(),
  useCommitSigning: z.boolean(),
  sshSigningKey: z.string(),
  botId: z.string(),
  botName: z
    .string()
    .min(1, "bot_name must not be empty")
    .max(100, "bot_name must be 100 characters or fewer"),
  allowedBots: z.string(),
  allowedNonWriteUsers: z.string(),
  trackProgress: z.boolean(),
  includeFixLinks: z.boolean(),
  includeCommentsByActor: z.string(),
  excludeCommentsByActor: z.string(),
});

export type ValidatedActionInputs = z.infer<typeof ActionInputsSchema>;

/**
 * Validate action inputs at runtime, throwing a descriptive error
 * if any field fails validation.
 *
 * @throws {Error} with a human-readable message listing all validation failures
 */
export function validateActionInputs(
  inputs: unknown,
): ValidatedActionInputs {
  const result = ActionInputsSchema.safeParse(inputs);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid action inputs:\n${messages}`);
  }
  return result.data;
}
