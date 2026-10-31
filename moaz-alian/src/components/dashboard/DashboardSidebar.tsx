import { Link, useRouterState } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { BookOpen, FileText, FlaskConical, FolderTree, LayoutDashboard, Users, Video, ExternalLink, PanelsTopLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const MAIN = [{ title: "نظرة عامة", to: "/dashboard", icon: LayoutDashboard, type: undefined }] as const;
const CONTENT = [
  { title: "الفيديوهات", type: "video", icon: Video },
  { title: "الكتب", type: "book", icon: BookOpen },
  { title: "المقالات", type: "article", icon: FileText },
  { title: "الأبحاث", type: "research", icon: FlaskConical },
] as const;

export function DashboardSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const loc = useRouterState({ select: (s) => s.location });
  const currentType = (loc.search as { type?: string }).type;
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar side="right" collapsible="icon" variant="floating">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" onClick={close} className="flex items-center gap-2 px-1 py-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">م</span>
          {!collapsed && (
            <span className="leading-tight">
              <span className="block text-sm font-bold">لوحة المكتبة</span>
              <span className="block text-xs text-muted-foreground">معاذ عليان</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN.map((i) => (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={loc.pathname === "/dashboard"} tooltip={i.title}>
                    <Link to={i.to} onClick={close}><i.icon /><span>{i.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={loc.pathname === "/dashboard/pages"} tooltip="الصفحات والبانر">
                  <Link to="/dashboard/pages" onClick={close}><PanelsTopLeft /><span>الصفحات والبانر</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>المحتوى</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONTENT.map((i) => (
                <SidebarMenuItem key={i.type}>
                  <SidebarMenuButton asChild tooltip={i.title} isActive={loc.pathname === "/dashboard/content" && currentType === i.type}>
                    <Link to="/dashboard/content" search={{ type: i.type }} onClick={close}><i.icon /><span>{i.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="سجل المحاورين" isActive={loc.pathname === "/dashboard/debates"}>
                  <Link to="/dashboard/debates" onClick={close}><MessagesSquare /><span>سجل المحاورين</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="التصنيفات" isActive={loc.pathname === "/dashboard/categories"}>
                  <Link to="/dashboard/categories" onClick={close}><FolderTree /><span>التصنيفات</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="المستخدمون والصلاحيات" isActive={loc.pathname === "/dashboard/users"}>
                    <Link to="/dashboard/users" onClick={close}><Users /><span>المستخدمون والصلاحيات</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="عرض الموقع">
              <a href="/" target="_blank" rel="noreferrer"><ExternalLink /><span>عرض الموقع</span></a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
