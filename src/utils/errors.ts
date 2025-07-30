export class CategoryExtractionError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly element?: string
  ) {
    super(message);
    this.name = 'CategoryExtractionError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}