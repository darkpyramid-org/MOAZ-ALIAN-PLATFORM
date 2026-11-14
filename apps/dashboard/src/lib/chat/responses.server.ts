import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createAiGatewayRunIdFetch, getAiGatewayRunId } from "./run-id";

export function createResponsesCall(
  request: Request,
  config: { apiKey: string; model: string; baseURL?: string },
  messages: ModelMessage[],
  system?: string,
) {
  const runIdFetch = createAiGatewayRunIdFetch(getAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: config.baseURL || process.env["AI_GATEWAY_URL"] || "https://api.openai.com/v1",
    apiKey: config.apiKey,
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.chat(config.model),
    ...(system ? { system } : {}),
    messages,
    abortSignal: request.signal,
  });
  return { result, gateway: runIdFetch };
}
