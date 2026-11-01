const AI_RUN_ID_HEADER = "X-AI-Run-ID";

export function createAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) {
      runId = nextRunId;
    }
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(AI_RUN_ID_HEADER)) {
        headers.set(AI_RUN_ID_HEADER, runId);
      }

      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(AI_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function getAiGatewayRunId(request: Request) {
  return request.headers.get(AI_RUN_ID_HEADER)?.trim() || undefined;
}

export function getAiGatewayResponseHeaders(
  providerHeaders: HeadersInit | undefined,
  init?: HeadersInit,
) {
  const headers = new Headers(init);
  const upstream = new Headers(providerHeaders);
  const runId = upstream.get(AI_RUN_ID_HEADER);
  if (runId) {
    headers.set(AI_RUN_ID_HEADER, runId);
  }
  return headers;
}

export function withAiGatewayRunIdHeader(
  headers: HeadersInit | undefined,
  runId: string | undefined,
): HeadersInit {
  const merged = new Headers(headers);
  if (runId) {
    merged.set(AI_RUN_ID_HEADER, runId);
  }
  return merged;
}
