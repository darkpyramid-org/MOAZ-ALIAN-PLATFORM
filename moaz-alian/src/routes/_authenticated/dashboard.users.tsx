import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, type AppRole } from "@/hooks/use-staff";
import { RowsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  head: () => ({ meta: [
    { title: "المستخدمون والصلاحيات — لوحة مكتبة معاذ عليان" },
    { name: "description", content: "المستخدمون والصلاحيات في مكتبة معاذ عليان." },
    { property: "og:title", content: "المستخدمون والصلاحيات — مكتبة معاذ عليان" },
    { property: "og:description", content: "المستخدمون والصلاحيات في لوحة إدارة المكتبة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: UsersPage,
});

const ROLES: { role: AppRole; label: string; hint: string }[] = [
  { role: "admin", label: "مشرف", hint: "كل الصلاحيات بما فيها إدارة المستخدمين" },
  { role: "editor", label: "محرّر", hint: "إدارة المحتوى والتصنيفات" },
];

function UsersPage() {
  const { data: me } = useStaff();
  const qc = useQueryClient();
  const isAdmin = me?.roles.includes("admin");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name,created_at").order("created_at"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (p.error) throw p.error;
      return (p.data ?? []).map((u) => ({ ...u, roles: (r.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.role as AppRole) }));
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">هذه الصفحة للمشرفين فقط.</p>;

  async function toggle(userId: string, role: AppRole, has: boolean) {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث الصلاحيات");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">المستخدمون والصلاحيات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          يُنشئ أعضاء الفريق حساباتهم من صفحة الدخول، ثم تمنحهم الصلاحية هنا. الحسابات بلا صلاحية لا ترى اللوحة.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {isLoading ? <RowsSkeleton rows={5} chips={3} /> : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.display_name ?? u.email}</div>
                  <div className="truncate text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(({ role, label, hint }) => {
                    const has = u.roles.includes(role);
                    const self = u.id === me?.user?.id && role === "admin";
                    return (
                      <button key={role} title={self ? "لا يمكنك إزالة صلاحيتك" : hint} disabled={self}
                        onClick={() => toggle(u.id, role, has)}
                        className={`rounded-full border px-3 py-1 text-sm transition disabled:opacity-60 ${has ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
                        {has ? "✓ " : ""}{label}
                      </button>
                    );
                  })}
                  {u.roles.length === 0 && <span className="self-center text-xs text-muted-foreground">بدون صلاحية</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
