import { createFileRoute, Link } from "@tanstack/react-router";
import { LibraryBig } from "lucide-react";

import { ChatPanel, LibraryMark } from "@/components/chat/ChatPanel";
import { useChatSession, useThreadMessages } from "@/hooks/use-chat-threads";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "مساعد المكتبة — مكتبة معاذ عليان" },
      {
        name: "description",
        content: "محادثة مع مساعد المكتبة لاستكشاف فيديوهات وكتب ومقالات وأبحاث مكتبة معاذ عليان.",
      },
      { property: "og:title", content: "مساعد المكتبة — مكتبة معاذ عليان" },
      {
        property: "og:description",
        content: "محادثة مع مساعد المكتبة لاستكشاف محتوى المكتبة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const { loading: sessionLoading, signedIn } = useChatSession();
  const threadMessages = useThreadMessages(threadId, signedIn);

  if (!sessionLoading && !signedIn) {
    return (
      <div className="container-editorial section-y">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-10 text-center">
          <LibraryBig className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">مساعد المكتبة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّل الدخول لعرض محادثاتك المحفوظة في حسابك.
          </p>
          <Button asChild className="mt-6 btn-gold">
            <Link to="/auth">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-editorial section-y-sm">
      <div className="mx-auto flex h-[min(72vh,660px)] max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-3 border-b border-border bg-deep/60 px-5 py-3">
          <LibraryMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">مساعد المكتبة</p>
            <p className="truncate text-[11px] text-muted-foreground">محادثة محفوظة في حسابك</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/chat">كل المحادثات</Link>
          </Button>
        </div>
        {threadMessages.isSuccess ? (
          <ChatPanel key={threadId} threadId={threadId} initialMessages={threadMessages.data} className="h-full" />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Shimmer className="text-sm text-muted-foreground">جارٍ استرجاع المحادثة…</Shimmer>
          </div>
        )}
      </div>
    </div>
  );
}
