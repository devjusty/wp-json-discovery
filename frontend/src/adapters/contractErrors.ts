export class ContractInvalidError extends Error {
  readonly code = 'contract-invalid';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContractInvalidError';
  }
}
