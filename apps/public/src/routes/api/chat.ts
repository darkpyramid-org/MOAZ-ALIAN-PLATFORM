import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";

import { createResponsesCall } from "@/lib/chat/responses.server";
import {
  buildSystemPrompt,
  persistAssistantMessage,
  persistUserMessage,
  requireRouteUser,
  verifyThreadOwnership,
} from "@/lib/chat/chat.server";
import { withAiGatewayRunIdHeader } from "@/lib/chat/run-id";

const MAX_MESSAGES = 40;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "chat" }),
      POST: async ({ request }) => {
        const user = await requireRouteUser(request);
        if (user instanceof Response) return user;

        let body: { threadId?: unknown; messages?: unknown; trigger?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const threadId = typeof body.threadId === "string" ? body.threadId : undefined;
        if (!threadId) {
          return Response.json({ error: "missing_thread" }, { status: 400 });
        }
        if (!(await verifyThreadOwnership(user, threadId))) {
          return Response.json({ error: "thread_not_found" }, { status: 404 });
        }

        const rawMessages = Array.isArray(body.messages) ? body.messages : [];
        const messages = rawMessages
          .filter(
            (m): m is UIMessage => !!m && typeof m === "object" && "role" in m && "parts" in m,
          )
          .slice(-MAX_MESSAGES);
        if (messages.length === 0) {
          return Response.json({ error: "missing_messages" }, { status: 400 });
        }

        // Save the user's turn (only on a fresh send, not a regenerate).
        if (body.trigger !== "regenerate-message") {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          if (lastUser) {
            await persistUserMessage(user, threadId, lastUser);
          }
        }

        const apiKey = process.env["OPENAI_API_KEY"] ?? process.env["AI_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "ai_unavailable" }, { status: 503 });
        }

        try {
          const { result, gateway } = createResponsesCall(
            request,
            { apiKey, model: process.env["AI_MODEL"] ?? "gpt-4o" },
            await convertToModelMessages(messages),
            buildSystemPrompt(),
          );

          const stream = result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: true,
            onError: (error) => {
              console.error("[chat] stream error", error);
              return "تعذّر إكمال الرد الآن. حاول مرة أخرى بعد قليل.";
            },
            onFinish: async ({ messages: completed }) => {
              const last = completed[completed.length - 1];
              if (last?.role === "assistant") {
                await persistAssistantMessage(user, threadId, last);
              }
            },
          });

          return stream;
        } catch (error) {
          console.error("[chat] failed to start stream", error);
          return Response.json({ error: "ai_unavailable" }, { status: 502 });
        }
      },
    },
  },
});
