import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages } from "ai";

import { createResponsesCall } from "@/lib/chat/responses.server";
import {
  buildSystemPrompt,
  persistAssistantMessage,
  persistUserMessage,
  requireRouteUser,
  verifyThreadOwnership,
} from "@/lib/chat/chat.server";
import { withLovableAiGatewayRunIdHeader } from "@/lib/chat/run-id";
import { readBoundedRequestBody, validateChatRequestBody } from "@/lib/chat/request-validation";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "chat" }),
      POST: async ({ request }) => {
        const user = await requireRouteUser(request);
        if (user instanceof Response) return user;

        const MAX_REQUEST_BYTES = 1_000_000;
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_REQUEST_BYTES) {
          return Response.json({ error: "request_too_large" }, { status: 413 });
        }

        let body: unknown;
        try {
          const bodyRead = await readBoundedRequestBody(request, MAX_REQUEST_BYTES);
          if (!bodyRead.ok) {
            if (bodyRead.reason === "too_large") {
              return Response.json({ error: "request_too_large" }, { status: 413 });
            }
            return Response.json({ error: "invalid_json" }, { status: 400 });
          }
          body = JSON.parse(bodyRead.text);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const validated = validateChatRequestBody(
          body && typeof body === "object"
            ? (body as { threadId?: unknown; messages?: unknown; trigger?: unknown })
            : {},
        );
        if (!validated.ok) {
          return Response.json({ error: validated.error }, { status: validated.status });
        }
        const { threadId, messages, trigger } = validated;

        if (!(await verifyThreadOwnership(user.supabase, threadId))) {
          return Response.json({ error: "thread_not_found" }, { status: 404 });
        }

        // Save the user's turn (only on a fresh send, not a regenerate).
        if (trigger !== "regenerate-message") {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          if (lastUser) {
            await persistUserMessage(user.supabase, threadId, lastUser);
          }
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          console.error("[chat] LOVABLE_API_KEY missing");
          return Response.json({ error: "ai_unavailable" }, { status: 503 });
        }

        try {
          const { result, gateway } = createResponsesCall(
            request,
            { apiKey, model: "openai/gpt-6-astra" },
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
                await persistAssistantMessage(user.supabase, threadId, last);
              }
            },
          });

          return withLovableAiGatewayRunIdHeader(stream, gateway);
        } catch (error) {
          console.error("[chat] failed to start stream", error);
          return Response.json({ error: "ai_unavailable" }, { status: 502 });
        }
      },
    },
  },
});
