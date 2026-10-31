import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardShellSkeleton } from "@/components/skeletons";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useStaff } from "@/hooks/use-staff";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "لوحة التحكم — مكتبة معاذ عليان" },
      {
        name: "description",
        content: "إدارة محتوى مكتبة معاذ عليان: الفيديوهات والكتب والمقالات والأبحاث.",
      },
      { property: "og:title", content: "لوحة التحكم — مكتبة معاذ عليان" },
      { property: "og:description", content: "إدارة محتوى المكتبة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data, isLoading } = useStaff();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.removeQueries({ queryKey: ["me"] });
    qc.removeQueries({ queryKey: ["admin"] });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <DashboardShellSkeleton />;

  if (!data?.roles.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deep px-4">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 text-xl font-bold">لا تملك صلاحية الدخول بعد</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            حسابك ({data?.user?.email}) مسجّل، لكن يلزم أن يمنحك أحد المشرفين صلاحية من صفحة
            المستخدمين.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/" className="btn-outline">
              المكتبة
            </Link>
            <button onClick={signOut} className="btn-gold">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = data.roles.includes("admin");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar isAdmin={isAdmin} />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 bg-background px-3 pb-1 pt-3 sm:px-5">
            <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
              <SidebarTrigger aria-label="فتح/إغلاق القائمة" />
              <span className="h-5 w-px bg-border" />
              <span className="truncate text-sm text-muted-foreground">{data.user?.email}</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs">
                {isAdmin ? "مشرف" : "محرّر"}
              </span>
              <button onClick={signOut} className="btn-outline ms-auto !px-3.5 !py-1.5 text-sm">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </header>
          <div className="mx-auto w-full max-w-6xl p-3 sm:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
