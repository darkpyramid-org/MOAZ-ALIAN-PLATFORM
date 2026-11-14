import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import { useStaff } from "@/hooks/use-staff";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/media/ImageUpload";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const staff = useStaff();
  const user = staff.data?.user ?? null;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [busy, setBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await authClient.updateProfile(displayName, avatarUrl);
      if (u) toast.success("تم حفظ الملف الشخصي");
      else toast.error("فشل حفظ الملف الشخصي");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await authClient.changePassword(currentPw, newPw);
      if (ok) {
        toast.success("تم تغيير كلمة المرور");
        setCurrentPw("");
        setNewPw("");
      } else toast.error("فشل تغيير كلمة المرور");
    } finally {
      setBusy(false);
    }
  }

  const initials = (user?.displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName ?? user?.email} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">الملف الشخصي</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">المعلومات الشخصية</h2>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">اسم العرض</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="avatarUrl">رابط الصورة (Avatar URL)</Label>
          <ImageUpload
            value={avatarUrl || null}
            onChange={(v) => setAvatarUrl(v ?? "")}
            aspect="1/1"
            maxSizeMb={2}
            previewAlt="معاينة الصورة"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "جارٍ الحفظ..." : "حفظ"}
        </Button>
      </form>

      <form
        onSubmit={savePassword}
        className="space-y-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">تغيير كلمة المرور</h2>
        <div className="space-y-1.5">
          <Label htmlFor="currentPw">كلمة المرور الحالية</Label>
          <Input
            id="currentPw"
            type="password"
            dir="ltr"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPw">كلمة المرور الجديدة</Label>
          <Input
            id="newPw"
            type="password"
            dir="ltr"
            minLength={8}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || !currentPw || !newPw}>
          {busy ? "جارٍ..." : "تغيير كلمة المرور"}
        </Button>
      </form>
    </div>
  );
}
