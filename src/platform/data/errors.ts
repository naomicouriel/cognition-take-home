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

export class PiiFieldForbiddenError extends Error {
  constructor(model: string, fields: string[]) {
    super(
      `This role may not read ${fields.map((f) => `${model}.${f}`).join(", ")}, ` +
        `and the query selected nothing else.`,
    );
    this.name = "PiiFieldForbiddenError";
  }
}

export class SnapshotUnavailableError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Write blocked: ${model}.${operation} cannot produce a before/after ` +
        `snapshot, so it would be audited without one. Target the rows with a ` +
        `\`where\` clause.`,
    );
    this.name = "SnapshotUnavailableError";
  }
}

export class UnsnapshottedWriteError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Write blocked: ${model}.${operation} did not go through the snapshotting ` +
        `client provided by mutate().`,
    );
    this.name = "UnsnapshottedWriteError";
  }
}

export class EmptyMutationError extends Error {
  constructor(action: string) {
    super(`Mutation "${action}" performed no writes, so there is nothing to audit.`);
    this.name = "EmptyMutationError";
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
