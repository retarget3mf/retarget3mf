export type ConversionErrorCode =
  | 'not-a-zip'
  | 'not-a-project'
  | 'unsupported-source'
  | 'unknown-printer'
  | 'unsupported-slicer'
  | 'invalid-filament-map'
  | 'invalid-project';

/** `message` is written for end users: what happened and what to do next. */
export class ConversionError extends Error {
  readonly code: ConversionErrorCode;

  constructor(code: ConversionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConversionError';
    this.code = code;
  }
}
