/** The caller identity the use cases see — no HTTP types. Middleware/auth's
 * AuthContext satisfies this structurally, keeping the dependency direction
 * services ← routes, never the reverse. */
export interface Caller {
  userId: string | null;
  isAdmin: boolean;
  canEditContent: boolean;
}
