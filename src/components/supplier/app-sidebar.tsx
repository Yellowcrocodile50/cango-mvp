"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  Package,
  ClipboardList,
  BarChart3,
  LogOut,
  ArrowLeft,
  Users,
  HelpCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabase";

// exact: true인 항목은 정확 일치할 때만 활성 (하위 경로에서 활성되면 안 되는 메뉴)
const navItems = [
  {
    title: "돌아가기",
    url: "/",
    icon: ArrowLeft,
    exact: true,
  },
  {
    title: "판매 현황",
    url: "/supplier",
    icon: TrendingUp,
    exact: true,
  },
  {
    title: "주문 내역",
    url: "/supplier/orders",
    icon: ClipboardList,
  },
  {
    title: "주문 통계",
    url: "/supplier/stats",
    icon: BarChart3,
  },
  {
    title: "내 자료 관리",
    url: "/supplier/materials",
    icon: Package,
  },
  {
    title: "계정 관리",
    url: "/supplier/accounts",
    icon: Users,
  },
  {
    title: "내신 계산기 추가 문의",
    url: "/supplier/naeshin-requests",
    icon: HelpCircle,
  },
];

export function AppSidebar({ user }: { user: { email: string; userid?: string } }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/supplier" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#365927] text-white font-bold text-sm">
                C
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">CANGO</span>
                <span className="truncate text-xs text-muted-foreground">
                  공급자 대시보드
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              // exact 메뉴는 정확 일치만, 그 외는 하위 경로(/supplier/orders/[id] 등)도 활성
              const isActive = item.exact
                ? pathname === item.url
                : pathname === item.url || pathname.startsWith(item.url + "/");
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={item.title}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-[#365927] text-white text-xs font-bold">
                {(user.userid || user.email)[0].toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user.userid || "공급자"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="로그아웃">
              <LogOut />
              <span>로그아웃</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
