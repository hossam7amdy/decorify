/** Machine-readable identifier for every problem the module system can report. */
export type DecorifyErrorCode =
  | "DECORIFY_E_MODULE_CYCLE"
  | "DECORIFY_E_DUPLICATE_TOKEN"
  | "DECORIFY_E_UNKNOWN_TOKEN"
  | "DECORIFY_E_NOT_VISIBLE"
  | "DECORIFY_E_INVALID_EXPORT"
  | "DECORIFY_E_CONTROLLER_INJECTED"
  | "DECORIFY_E_DYNAMIC_CONFLICT"
  | "DECORIFY_E_CAPTIVE_DEPENDENCY"
  | "DECORIFY_E_ASYNC_FACTORY";

/** A single problem found in the module graph. */
export interface DecorifyError {
  code: DecorifyErrorCode;
  message: string;
  /** Name of the module the problem was found in. */
  module?: string;
  /** Rendered name of the token the problem concerns. */
  token?: string;
  /** Module names forming a path, root-to-leaf. Set for cycles. */
  path?: readonly string[];
}

/**
 * Thrown when graph validation finds one or more problems.
 *
 * Validation never fails fast, so `errors` holds every problem found in the run.
 */
export class DecorifyValidationError extends Error {
  override readonly name = "DecorifyValidationError";
  readonly errors: readonly DecorifyError[];

  constructor(errors: readonly DecorifyError[]) {
    super(render(errors));
    this.errors = errors;
  }
}

/**
 * Thrown during eager instantiation, when a problem is only observable once a
 * provider has been resolved.
 */
export class DecorifyBootstrapError extends Error {
  override readonly name = "DecorifyBootstrapError";
  readonly error: DecorifyError;

  constructor(error: DecorifyError) {
    super(`${error.code} ${error.message}`);
    this.error = error;
  }
}

function render(errors: readonly DecorifyError[]): string {
  const body = errors
    .map((error) => {
      const where = error.module === undefined ? "" : ` [${error.module}]`;
      return `  ${error.code}${where}\n    ${error.message}`;
    })
    .join("\n\n");
  return `Module graph validation failed with ${errors.length} error(s):\n\n${body}`;
}
