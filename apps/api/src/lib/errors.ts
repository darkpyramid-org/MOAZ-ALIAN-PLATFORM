/**
 * Use-case failure signals. They carry no HTTP vocabulary — the error handler
 * alone decides which status code each one becomes, so the use cases stay
 * transport-agnostic. One-to-one port of ApiServer.Application's
 * UseCaseExceptions.cs and ApiServer.Domain's DomainException.
 */

/** The addressed record does not exist (or is not visible to this caller). */
export class NotFoundError extends Error {
  constructor(
    public readonly resourceName: string,
    public readonly key: string,
  ) {
    super(`${resourceName} '${key}' was not found.`);
    this.name = 'NotFoundError';
  }
}

/**
 * The write is well formed but collides with an existing uniqueness constraint
 * (duplicate slug, duplicate id). Surfaces as 409 so a client can retry with a
 * new value.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** The caller is authenticated but lacks the role the use case demands. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * A broken aggregate invariant: semantically invalid input. 422 distinguishes
 * it from a merely malformed request (400).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * Field-level request validation failure (FluentValidation's role). Collected
 * as { field: [messages] } and returned as one 400 with an errors dictionary.
 */
export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super('The request is not valid.');
    this.name = 'ValidationError';
  }
}
