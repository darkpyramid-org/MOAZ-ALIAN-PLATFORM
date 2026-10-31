import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Landmark, LibraryBig, ScrollText, Video } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

const QUICK_LINKS = [
  { to: "/videos", label: "الفيديوهات", icon: Video },
  { to: "/books", label: "الكتب", icon: BookOpen },
  { to: "/articles", label: "المقالات", icon: ScrollText },
  { to: "/research", label: "الأبحاث", icon: GraduationCap },
  { to: "/categories", label: "الأقسام", icon: Landmark },
] as const;

export type ChatPanelProps = {
  threadId: string;
  initialMessages: UIMessage[];
  className?: string;
  autoFocus?: boolean;
};

export function LibraryMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-gold",
        className,
      )}
      aria-hidden="true"
    >
      <LibraryBig className="size-4" />
    </span>
  );
}

export function ChatPanel({ threadId, initialMessages, className, autoFocus }: ChatPanelProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(input, { ...init, headers });
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
  });

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 p-4 chat-msg-stagger">
          {messages.length === 0 && status !== "submitted" ? (
            <ConversationEmptyState
              className="mx-auto max-w-[16rem] py-10 text-center"
              icon={<LibraryMark className="size-12" />}
              title="مساعد المكتبة"
              description="اسأل عن الفيديوهات أو الكتب أو المقالات أو الأبحاث، أو عن أي سؤال في مقارنة الأديان."
            >
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-3.5 text-primary" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </div>
            </ConversationEmptyState>
          ) : null}

          {messages.map((message, index) => (
            <Message
              key={message.id ?? index}
              from={message.role}
              className="chat-msg-in"
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:rounded-2xl group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : "group-[.is-assistant]:text-foreground"
                }
              >
                <MessageResponse>
                  {message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => ("text" in part ? part.text : ""))
                    .join("")}
                </MessageResponse>
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LibraryMark className="size-6" />
              <Shimmer className="text-sm">مساعد المكتبة يفكر…</Shimmer>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error.message.includes("unauthorized") || error.message.includes("401")
                ? "انتهت الجلسة — سجّل الدخول من جديد ثم تابع المحادثة."
                : "تعذّر إكمال الرد. حاول إرسال الرسالة مرة أخرى."}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton variant="outline" className="rounded-full shadow-float" />
      </Conversation>

      <div className="border-t border-border bg-popover/60 p-3">
        <PromptInput
          onSubmit={({ text }) => {
            const value = text?.trim();
            if (!value || busy) return;
            sendMessage({ text: value });
          }}
          className="rounded-2xl border-input bg-input/40 chat-pop-in"
        >
          <PromptInputTextarea
            placeholder="اكتب سؤالك…"
            autoFocus={autoFocus}
            className="min-h-9 resize-none"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && false} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
