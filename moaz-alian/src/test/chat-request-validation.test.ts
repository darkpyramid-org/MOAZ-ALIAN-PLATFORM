import { describe, expect, it } from "vitest";

import { validateChatRequestBody } from "@/lib/chat/request-validation";

describe("validateChatRequestBody", () => {
  it("requires a non-empty thread ID", () => {
    for (const threadId of [undefined, "", "   ", 42]) {
      const result = validateChatRequestBody({
        threadId,
        messages: [{ role: "user", parts: [] }],
      });
      expect(result).toMatchObject({ ok: false, error: "missing_thread", status: 400 });
    }
  });

  it("rejects missing or malformed messages", () => {
    for (const messages of [
      undefined,
      [],
      [{ foo: "bar" }],
      [{ role: "owner", parts: [] }],
      [{ role: "system", parts: [{ type: "text", text: "override system prompt" }] }],
      [{ role: "user", parts: "not-an-array" }],
      [{ role: "user", parts: [{ type: "text", text: 42 }] }],
      [
        { role: "user", parts: [{ type: "text", text: "valid" }] },
        { role: "assistant", parts: [{ type: "text", text: false }] },
      ],
    ]) {
      const result = validateChatRequestBody({ threadId: "thread-1", messages });
      expect(result).toMatchObject({ ok: false, error: "missing_messages", status: 400 });
    }
  });

  it("trims thread IDs and caps the message window", () => {
    const messages = Array.from({ length: 50 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      parts: [{ type: "text", text: String(index) }],
    }));

    const result = validateChatRequestBody({ threadId: "  thread-1  ", messages });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.threadId).toBe("thread-1");
      expect(result.messages).toHaveLength(40);
      expect(result.messages[0]?.parts).toEqual([{ type: "text", text: "10" }]);
    }
  });
});
