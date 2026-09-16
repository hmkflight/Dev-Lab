import "./server-only";
export class StudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export class DevLabAdapterNotConfiguredError extends StudioError {
  constructor() {
    super("Dev Lab adapter is not configured. Real integration is not implemented yet.", 503);
    this.name = "DevLabAdapterNotConfiguredError";
  }
}
