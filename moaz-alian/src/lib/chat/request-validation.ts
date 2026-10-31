import type { UIMessage } from "ai";

export const MAX_CHAT_MESSAGES = 40;

export type ChatRequestBody = {
  threadId?: unknown;
  messages?: unknown;
  trigger?: unknown;
};

export type ChatValidationOk = {
  ok: true;
  threadId: string;
  messages: UIMessage[];
  trigger: unknown;
};

export type ChatValidationErr = {
  ok: false;
  error: "invalid_json" | "missing_thread" | "missing_messages";
  status: 400;
};

export function parseChatJson(text: string): { ok: true; body: ChatRequestBody } | { ok: false } {
  try {
    return { ok: true, body: JSON.parse(text) as ChatRequestBody };
  } catch {
    return { ok: false };
  }
}

export function validateChatRequestBody(body: ChatRequestBody): ChatValidationOk | ChatValidationErr {
  const threadId = typeof body.threadId === "string" ? body.threadId : undefined;
  if (!threadId) {
    return { ok: false, error: "missing_thread", status: 400 };
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .filter((m): m is UIMessage => !!m && typeof m === "object" && "role" in m && "parts" in m)
    .slice(-MAX_CHAT_MESSAGES);

  if (messages.length === 0) {
    return { ok: false, error: "missing_messages", status: 400 };
  }

  return { ok: true, threadId, messages, trigger: body.trigger };
}
