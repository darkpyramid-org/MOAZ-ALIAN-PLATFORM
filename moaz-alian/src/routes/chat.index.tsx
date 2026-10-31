import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LibraryBig } from "lucide-react";

import { useChatSession, useChatThreads } from "@/hooks/use-chat-threads";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat/")({
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
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const { loading: sessionLoading, signedIn } = useChatSession();
  const threads = useChatThreads(signedIn);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (sessionLoading || !signedIn || !threads.isSuccess) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = threads.data?.[0];
        const thread = existing ?? (await threads.createThread());
        if (!cancelled)
          void navigate({ to: "/chat/$threadId", params: { threadId: thread.id }, replace: true });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, signedIn, threads.isSuccess, threads.data, threads, navigate]);

  if (!sessionLoading && !signedIn) {
    return (
      <div className="container-editorial section-y">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-10 text-center">
          <LibraryBig className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">مساعد المكتبة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّل الدخول لبدء محادثة مع مساعد المكتبة وحفظ محادثاتك في حسابك.
          </p>
          <Button asChild className="mt-6 btn-gold">
            <Link to="/auth">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-editorial section-y">
      <p className="text-center text-sm text-muted-foreground">
        {failed ? "تعذّر إنشاء المحادثة — أعد المحاولة بعد قليل." : "جارٍ تحضير محادثتك…"}
      </p>
    </div>
  );
}
