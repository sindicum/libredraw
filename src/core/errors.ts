/**
 * Base error class for all LibreDraw errors.
 */
export class LibreDrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibreDrawError';
  }
}
