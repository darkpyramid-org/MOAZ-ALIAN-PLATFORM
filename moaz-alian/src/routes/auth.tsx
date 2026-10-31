import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);
  const target = safePath(redirect);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      setResent(true);
      toast.success("أعدنا إرسال رابط التأكيد إلى بريدك.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.code === "email_not_confirmed" || /not (yet )?confirmed/i.test(error.message)) setUnconfirmed(true);
          throw error;
        }
        setUnconfirmed(false);
        navigate({ to: target as "/dashboard" });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else {
          setUnconfirmed(true);
          setResent(false);
          toast.success("تم إنشاء الحساب. راجع بريدك لتأكيد العنوان ثم سجّل الدخول.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    sessionStorage.setItem("post_auth", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("تعذّر الدخول عبر Google"); return; }
    if (r.redirected) return;
    navigate({ to: target as "/dashboard" });
  }

  // Returning from Google: session exists → continue
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const saved = sessionStorage.getItem("post_auth");
      if (data.session && saved) {
        sessionStorage.removeItem("post_auth");
        navigate({ to: safePath(saved) as "/dashboard" });
      }
    });
  }, [navigate]);

  const titles = { in: "تسجيل الدخول", up: "إنشاء حساب", forgot: "استعادة كلمة المرور" };

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float sm:p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← العودة إلى المكتبة</Link>
        <h1 className="mt-4 text-2xl font-bold">{titles[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">لوحة إدارة المكتبة — للفريق فقط.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="pw">كلمة المرور</Label>
              <Input id="pw" type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-gold w-full justify-center">
            {busy ? "جارٍ..." : mode === "in" ? "دخول" : mode === "up" ? "إنشاء الحساب" : "إرسال الرابط"}
          </button>
        </form>

        {unconfirmed && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium">لم يصلك رابط التأكيد؟</p>
            <p className="mt-1 text-muted-foreground">تفقّد مجلد الرسائل غير المرغوبة (Spam)، ثم أعد الإرسال من هنا.</p>
            <button type="button" onClick={resend} disabled={busy || !email || resent} className="btn-outline mt-3 px-4 py-1.5 text-sm">
              {resent ? "تم الإرسال ✓" : busy ? "جارٍ الإرسال…" : "إعادة إرسال رابط التأكيد"}
            </button>
          </div>
        )}

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" />
            </div>
            <button type="button" onClick={google} className="btn-outline w-full justify-center">
              المتابعة عبر Google
            </button>
          </>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "in" ? (
            <>
              <button className="text-primary hover:underline" onClick={() => setMode("up")}>إنشاء حساب</button>
              <button className="text-muted-foreground hover:text-primary" onClick={() => setMode("forgot")}>نسيت كلمة المرور؟</button>
            </>
          ) : (
            <button className="text-primary hover:underline" onClick={() => setMode("in")}>لديك حساب؟ سجّل الدخول</button>
          )}
        </div>
      </div>
    </div>
  );
}
