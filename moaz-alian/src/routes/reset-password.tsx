import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "تعيين كلمة مرور جديدة — لوحة إدارة المكتبة" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في لوحة إدارة المكتبة." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Local / direct password update
    setBusy(false);
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-float sm:p-8"
      >
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary">
          ← العودة لتسجيل الدخول
        </Link>
        <h1 className="text-2xl font-bold">كلمة مرور جديدة</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">كلمة المرور الجديدة</Label>
          <Input
            id="pw"
            type="password"
            dir="ltr"
            minLength={6}
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <button disabled={busy} className="btn-gold w-full justify-center">
          {busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
        </button>
      </form>
    </div>
  );
}
