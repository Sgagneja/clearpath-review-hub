/**
 * Errors whose message is safe to show the user. Anything else that escapes a
 * server action is logged and replaced with a generic message, so stack
 * traces and SQL never reach the browser.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    /** Optional form field the message belongs to. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(message = "That submission doesn't exist or you can't see it.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The record changed underneath the user (another tab, another reviewer). */
export class ConflictError extends UserFacingError {
  constructor(
    message = "This submission changed while you were looking at it. Reload to see where it stands.",
  ) {
    super(message);
    this.name = "ConflictError";
  }
}
