export class AuditBypassError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Write blocked: ${model}.${operation} was attempted outside mutate(). ` +
        `Every write must go through the audited data access layer.`,
    );
    this.name = "AuditBypassError";
  }
}

export class RawQueryBlockedError extends Error {
  constructor(method: string) {
    super(
      `${method} is disabled: raw SQL would bypass the audit and PII guarantees.`,
    );
    this.name = "RawQueryBlockedError";
  }
}

export class AuditForgeryError extends Error {
  constructor() {
    super("Audit records can only be written by the data access layer.");
    this.name = "AuditForgeryError";
  }
}

export class MissingActorError extends Error {
  constructor(model: string, operation: string) {
    super(
      `No actor in scope for ${model}.${operation}. ` +
        `Wrap data access in runWithActor() or runAsSystem().`,
    );
    this.name = "MissingActorError";
  }
}
