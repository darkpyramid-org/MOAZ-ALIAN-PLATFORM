import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { redirect?: string | undefined };

function safePath(p?: string) {
  if (!p) return "/dashboard";
  try {
    const u = new URL(p, "http://x");
    return u.pathname.startsWith("/") && !p.startsWith("//") ? u.pathname + u.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "تسجيل الدخول — لوحة إدارة المكتبة" },
      { name: "description", content: "دخول فريق إدارة مكتبة معاذ عليان إلى لوحة التحكم." },
      { property: "og:title", content: "تسجيل الدخول — لوحة إدارة المكتبة" },
      { property: "og:description", content: "دخول فريق إدارة المكتبة إلى لوحة التحكم." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const target = safePath(redirect);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setBusy(true);

    try {
      if (mode === "in") {
        await authClient.login(normalizedEmail, password);
        toast.success("تم تسجيل الدخول بنجاح");
        navigate({ to: target as "/dashboard", replace: true });
      } else if (mode === "up") {
        await authClient.register(normalizedEmail, password);
        toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.info("لإعادة تعيين كلمة المرور، يرجى التواصل مع مسؤول النظام.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    async function checkExistingAuth() {
      const user = await authClient.getMe();
      if (user) {
        navigate({ to: target as "/dashboard", replace: true });
      }
    }
    void checkExistingAuth();
  }, [navigate, target]);

  const titles = { in: "تسجيل الدخول", up: "إنشاء حساب جديد", forgot: "استعادة كلمة المرور" };

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float sm:p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
          ← العودة إلى المكتبة
        </Link>
        <h1 className="mt-4 text-2xl font-bold">{titles[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">لوحة إدارة المكتبة — منصة معاذ عليان.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="pw">كلمة المرور</Label>
              <Input
                id="pw"
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-gold w-full justify-center">
            {busy
              ? "جارٍ المعالجة..."
              : mode === "in"
                ? "دخول"
                : mode === "up"
                  ? "إنشاء الحساب"
                  : "إرسال الطلب"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "in" ? (
            <>
              <button className="text-primary hover:underline" onClick={() => setMode("up")}>
                إنشاء حساب جديد
              </button>
              <button
                className="text-muted-foreground hover:text-primary"
                onClick={() => setMode("forgot")}
              >
                نسيت كلمة المرور؟
              </button>
            </>
          ) : (
            <button className="text-primary hover:underline" onClick={() => setMode("in")}>
              لديك حساب؟ سجّل الدخول
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
