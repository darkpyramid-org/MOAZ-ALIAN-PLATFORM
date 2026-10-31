import { describe, expect, it } from "vitest";
import { parseChatJson, validateChatRequestBody } from "@/lib/chat/request-validation";

describe("parseChatJson", () => {
  it("rejects invalid JSON", () => {
    expect(parseChatJson("{").ok).toBe(false);
  });

  it("accepts object JSON", () => {
    const r = parseChatJson('{"threadId":"t1"}');
    expect(r.ok).toBe(true);
  });
});

describe("validateChatRequestBody", () => {
  it("requires threadId", () => {
    const r = validateChatRequestBody({ messages: [{ role: "user", parts: [] }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_thread");
  });

  it("requires at least one valid message", () => {
    const r = validateChatRequestBody({ threadId: "t1", messages: [{ foo: 1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_messages");
  });

  it("accepts valid payload and trims message window", () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: String(i) }],
    }));
    const r = validateChatRequestBody({ threadId: "abc", messages });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.threadId).toBe("abc");
      expect(r.messages.length).toBe(40);
    }
  });
});
