/** Copy authored by the app for the user, rather than a relayed provider error. */
export class UserCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserCopyError';
  }
}
