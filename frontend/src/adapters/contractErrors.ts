export class ContractInvalidError extends Error {
  readonly code = 'contract-invalid';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContractInvalidError';
  }
}

export class AuthenticationRequiredError extends Error {
  readonly code = 'auth-required';

  constructor(message = 'Authenticated session required', readonly cause?: unknown) {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}
