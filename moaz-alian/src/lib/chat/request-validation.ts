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

function isSafeFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function isMessagePart(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "text" || value.type === "reasoning") {
    return typeof value.text === "string";
  }

  if (value.type === "file") {
    return (
      typeof value.mediaType === "string" &&
      value.mediaType.length > 0 &&
      value.mediaType.length <= 255 &&
      typeof value.url === "string" &&
      isSafeFileUrl(value.url)
    );
  }

  // This endpoint has no tools or source-part contract. Reject unknown part
  // types instead of forwarding arbitrary client-controlled objects to the SDK.
  return false;
}

function isUIMessage(value: unknown): value is UIMessage {
  if (
    !isRecord(value) ||
    typeof value.role !== "string" ||
    !ALLOWED_MESSAGE_ROLES.has(value.role)
  ) {
    return false;
  }

  return (
    Array.isArray(value.parts) &&
    value.parts.length > 0 &&
    value.parts.every(isMessagePart)
  );
}

export function validateChatRequestBody(
  body: ChatRequestBody,
): ChatValidationOk | ChatValidationErr {
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId) {
    return { ok: false, error: "missing_thread", status: 400 };
  }

  const rawMessages = body.messages;
  if (
    !Array.isArray(rawMessages) ||
    rawMessages.length === 0 ||
    !rawMessages.every(isUIMessage) ||
    rawMessages[rawMessages.length - 1]?.role !== "user"
  ) {
    return { ok: false, error: "missing_messages", status: 400 };
  }

  const messages = (rawMessages as UIMessage[]).slice(-MAX_CHAT_MESSAGES);
  return { ok: true, threadId, messages, trigger: body.trigger };
}
