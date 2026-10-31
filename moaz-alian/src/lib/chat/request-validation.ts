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
  error: "missing_thread" | "missing_messages";
  status: 400;
};

const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant", "system"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUIMessage(value: unknown): value is UIMessage {
  if (!isRecord(value) || typeof value.role !== "string" || !ALLOWED_MESSAGE_ROLES.has(value.role)) {
    return false;
  }

  if (!Array.isArray(value.parts)) {
    return false;
  }

  return value.parts.every((part) => isRecord(part) && typeof part.type === "string");
}

export function validateChatRequestBody(body: ChatRequestBody): ChatValidationOk | ChatValidationErr {
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId) {
    return { ok: false, error: "missing_thread", status: 400 };
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.filter(isUIMessage).slice(-MAX_CHAT_MESSAGES);

  if (messages.length === 0) {
    return { ok: false, error: "missing_messages", status: 400 };
  }

  return { ok: true, threadId, messages, trigger: body.trigger };
}
