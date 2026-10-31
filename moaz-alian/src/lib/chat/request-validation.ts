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

const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessagePart(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "text" || value.type === "reasoning") {
    return typeof value.text === "string";
  }

  if (value.type === "file") {
    return typeof value.mediaType === "string" && typeof value.url === "string";
  }

  return true;
}

function isUIMessage(value: unknown): value is UIMessage {
  if (
    !isRecord(value) ||
    typeof value.role !== "string" ||
    !ALLOWED_MESSAGE_ROLES.has(value.role)
  ) {
    return false;
  }

  return Array.isArray(value.parts) && value.parts.every(isMessagePart);
}

export function validateChatRequestBody(
  body: ChatRequestBody,
): ChatValidationOk | ChatValidationErr {
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId) {
    return { ok: false, error: "missing_thread", status: 400 };
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || !rawMessages.every(isUIMessage)) {
    return { ok: false, error: "missing_messages", status: 400 };
  }

  const messages = (rawMessages as UIMessage[]).slice(-MAX_CHAT_MESSAGES);
  return { ok: true, threadId, messages, trigger: body.trigger };
}
