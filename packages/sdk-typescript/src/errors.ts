export class TollgateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TollgateError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TollgateConnectionError extends TollgateError {
  constructor(message: string) {
    super(message);
    this.name = "TollgateConnectionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TollgateAuthError extends TollgateError {
  constructor(message: string) {
    super(message);
    this.name = "TollgateAuthError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ActionDenied extends TollgateError {
  constructor(public readonly reason?: string) {
    super(reason ?? "Action denied by policy");
    this.name = "ActionDenied";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ActionPending extends TollgateError {
  constructor(public readonly actionId: string) {
    super(`Action ${actionId} still pending after poll timeout`);
    this.name = "ActionPending";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
