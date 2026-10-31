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

export type BoundedBodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "invalid_encoding" };

const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant"]);

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyReadResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer");
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: "invalid_encoding" };
  }
}

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
