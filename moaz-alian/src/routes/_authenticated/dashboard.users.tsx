import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient, type AppRole } from "@/lib/auth";
import { useStaff } from "@/hooks/use-staff";
import { RowsSkeleton } from "@/components/skeletons";

const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ??
  import.meta.env["VITE_API_URL"] ??
  "http://localhost:5199";
const BASE = RAW_BASE.replace(/\/+$/, "");

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والصلاحيات — لوحة مكتبة معاذ عليان" },
      { name: "description", content: "المستخدمون والصلاحيات في مكتبة معاذ عليان." },
      { property: "og:title", content: "المستخدمون والصلاحيات — مكتبة معاذ عليان" },
      { property: "og:description", content: "المستخدمون والصلاحيات في لوحة إدارة المكتبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersPage,
});

const ROLES: { role: AppRole; label: string; hint: string }[] = [
  { role: "admin", label: "مشرف", hint: "كل الصلاحيات بما فيها إدارة المستخدمين" },
  { role: "editor", label: "محرّر", hint: "إدارة المحتوى والتصنيفات" },
];

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  roles: AppRole[];
};

function UsersPage() {
  const { data: me } = useStaff();
  const qc = useQueryClient();
  const isAdmin = me?.roles.includes("admin");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const token = authClient.getAccessToken();
      const res = await fetch(`${BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("تعذر جلب المستخدمين");
      return (await res.json()) as UserRow[];
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">هذه الصفحة للمشرفين فقط.</p>;

  async function toggle(userId: string, role: AppRole, has: boolean) {
    const token = authClient.getAccessToken();
    try {
      const res = await fetch(`${BASE}/api/users/${userId}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role, has }),
      });
      if (!res.ok) {
        toast.error("فشل تحديث الصلاحيات");
        return;
      }
      toast.success("تم تحديث الصلاحيات");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">المستخدمون والصلاحيات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          يُنشئ أعضاء الفريق حساباتهم من صفحة الدخول، ثم تمنحهم الصلاحية هنا. الحسابات بلا صلاحية لا
          ترى اللوحة.
        </p>
      </div>

      {isLoading ? (
        <RowsSkeleton rows={4} className="h-16" />
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">لا يوجد مستخدمون مسجلون بعد.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{u.display_name || u.email}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {u.email}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {ROLES.map(({ role, label, hint }) => {
                  const has = u.roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      title={hint}
                      onClick={() => toggle(u.id, role, has)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        has
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label} {has ? "✓" : "+"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
