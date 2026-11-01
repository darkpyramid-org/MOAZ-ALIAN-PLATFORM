/**
 * Application error reporting utility for React and TanStack ErrorBoundary components.
 */
export type ErrorBoundaryOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react-error-boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[ErrorBoundary]", {
    message: describeThrown(error),
    stack,
    route: window.location.pathname,
    ...context,
  });
}

const MAX_SERIALIZED_LENGTH = 2000;

function describeThrown(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) {
    return error.stack ? `${error.name}: ${error.message}\n${error.stack}` : `${error.name}: ${error.message}`;
  }
  if (typeof error === "string") return error;
  if (error != null && typeof error === "object") {
    try {
      const json = JSON.stringify(error);
      return json.length > MAX_SERIALIZED_LENGTH ? `${json.slice(0, MAX_SERIALIZED_LENGTH)}...` : json;
    } catch {
      // circular or non-serializable
    }
  }
  return String(error);
}
