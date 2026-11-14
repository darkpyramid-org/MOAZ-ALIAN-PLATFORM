import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { token?: string | undefined };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s["token"] === "string" ? s["token"] : undefined,
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("رمز إعادة التعيين مفقود");
      return;
    }
    setBusy(true);
    try {
      const ok = await authClient.resetPassword(token, pw);
      if (ok) {
        toast.success("تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.");
        navigate({ to: "/auth", replace: true });
      } else {
        toast.error("فشل إعادة تعيين كلمة المرور (الرمز غير صالح أو منتهي).");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-float sm:p-8"
      >
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary">
          ← العودة إلى تسجيل الدخول
        </Link>
        <h1 className="text-2xl font-bold">إعادة تعيين كلمة المرور</h1>
        {!token && <p className="text-sm text-destructive">رمز إعادة التعيين مفقود.</p>}
        <div className="space-y-1.5">
          <Label htmlFor="pw">كلمة المرور الجديدة</Label>
          <Input
            id="pw"
            type="password"
            dir="ltr"
            minLength={8}
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <button disabled={busy || !token} className="btn-gold w-full justify-center">
          {busy ? "جارٍ..." : "إعادة تعيين"}
        </button>
      </form>
    </div>
  );
}
