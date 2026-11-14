/**
 * Role resolution from a verified platform JWT — one-to-one port of
 * ClaimsCurrentUser.ReadRoles().
 *
 * Roles arrive through three channels in one token (all issued by AuthService):
 *   1. the plain GoTrue-style "role" claim ("authenticated");
 *   2. "app_metadata" — a claim holding a JSON object string, whose "roles"
 *      property carries the platform roles;
 *   3. one "roles" claim per platform role (the .NET JWT handler expands a
 *      JSON array claim into repeated claims; jsonwebtoken hands us the array —
 *      both shapes converge here).
 *
 * A malformed claim must never become a privilege: parse failures simply
 * contribute no roles, exactly like the C# catch (JsonException).
 */
export interface TokenPayload {
  sub?: string;
  email?: string;
  role?: string | string[];
  app_metadata?: string;
  roles?: string | string[];
}

function appendFromJson(roles: string[], raw: string): void {
  try {
    const parsed: unknown = JSON.parse(raw);
    // Accepts both shapes: a bare array and the real app_metadata object,
    // whose roles live under a "roles" property ({"roles":["admin"], …}).
    let array: unknown;
    if (Array.isArray(parsed)) {
      array = parsed;
    } else if (parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { roles?: unknown }).roles)) {
      array = (parsed as { roles: unknown[] }).roles;
    }
    if (!Array.isArray(array)) return;
    for (const entry of array) {
      if (typeof entry === 'string' && entry.length > 0) {
        roles.push(entry);
      }
    }
  } catch {
    // A malformed claim must never become a privilege. Treat it as "no extra roles".
  }
}

export function readRoles(payload: TokenPayload): string[] {
  const roles: string[] = [];

  // The plain GoTrue role ("authenticated", "anon", "service_role") is a claim
  // in its own right.
  if (payload.role !== undefined) {
    if (Array.isArray(payload.role)) {
      roles.push(...payload.role);
    } else {
      roles.push(payload.role);
    }
  }

  const metadata = payload.app_metadata;
  if (typeof metadata === 'string' && metadata.trim() !== '') {
    appendFromJson(roles, metadata);
  }

  // Flat "roles" claim for deployments that put the array at the token root.
  const flat = payload.roles;
  if (flat !== undefined) {
    if (Array.isArray(flat)) {
      appendFromJson(roles, JSON.stringify(flat));
    } else if (typeof flat === 'string') {
      if (flat.trimStart().startsWith('[')) {
        appendFromJson(roles, flat);
      } else {
        roles.push(flat);
      }
    }
  }

  return roles;
}

function containsRole(roles: string[], target: string): boolean {
  // StringComparer.OrdinalIgnoreCase, as ClaimsCurrentUser uses throughout.
  const needle = target.toLowerCase();
  return roles.some((role) => role.toLowerCase() === needle);
}

export interface RolePermissions {
  isAdmin: boolean;
  canEditContent: boolean;
}

export function resolvePermissions(
  roles: string[],
  isAuthenticated: boolean,
  options: { adminRole: string; editorRole: string; serviceRole: string },
): RolePermissions {
  const isAdmin = isAuthenticated && (containsRole(roles, options.adminRole) || containsRole(roles, options.serviceRole));
  const canEditContent = isAdmin || (isAuthenticated && containsRole(roles, options.editorRole));
  return { isAdmin, canEditContent };
}
