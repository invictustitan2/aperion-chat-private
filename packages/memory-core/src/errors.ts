export class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class ImmutableError extends MemoryError {
  constructor(message: string = 'Episodic memory is immutable and cannot be updated.') {
    super(message);
    this.name = 'ImmutableError';
  }
}

export class ValidationError extends MemoryError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
