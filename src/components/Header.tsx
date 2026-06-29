"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type NavChild = {
  name: string;
  href: string;
  children?: { name: string; href: string }[];
};

type NavItem = {
  name: string;
  href: string;
  children?: NavChild[];
};

const categories: NavItem[] = [
  { name: "전체", href: "/" },
  {
    name: "고등학생(대학입시)",
    href: "/?category=고등학생(대학입시)",
    children: [
      { name: "수시", href: "/?category=수시" },
      { name: "정시", href: "/?category=정시" },
    ],
  },
  {
    name: "중학생",
    href: "/?category=중학생",
    children: [
      { name: "공부법", href: "/?category=공부법" },
      { name: "고교입시", href: "/?category=고교입시" },
    ],
  },
  { name: "진로/직업", href: "/?category=진로/직업" },
  { name: "기타", href: "/?category=기타" },
  {
    name: "무료 입시 자료",
    href: "/?category=무료 입시 자료",
    children: [
      {
        name: "고등",
        href: "/?category=고등",
        children: [
          { name: "수시", href: "/?category=무료-수시" },
          { name: "정시", href: "/?category=무료-정시" },
        ],
      },
      {
        name: "중학",
        href: "/?category=중학",
        children: [
          { name: "공부법", href: "/?category=무료-공부법" },
          { name: "고교입시", href: "/?category=무료-고교입시" },
        ],
      },
      { name: "진로/직업", href: "/?category=무료-진로/직업" },
      { name: "기타", href: "/?category=무료-기타" },
    ],
  },
];

export default function Header() {
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openSubCat, setOpenSubCat] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // pathname 변경 시 메뉴 닫기 (렌더 중 처리)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setOpenCat(null);
    setOpenSubCat(null);
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#d6e4d3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/cango-logo.png"
              alt="CANGO"
              width={1731}
              height={909}
              priority
              className="h-16 w-auto"
            />
            <span className="hidden sm:block text-[17px] font-bold text-[#b7beb1] leading-tight">
              선배들이 만든 입시 자료
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            {user ? (
              user.user_metadata?.role === "supplier" ? (
                <>
                  <span className="text-[#365927] font-medium">
                    {user.user_metadata?.userid || user.email}님
                  </span>
                  <Link
                    href="/supplier"
                    className="text-[#365927] hover:text-[#4a7a38] transition font-medium"
                  >
                    대시보드
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-[#5a7d50] hover:text-[#365927] transition font-medium cursor-pointer"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="flex items-center gap-1 text-[#365927] font-medium hover:text-[#4a7a38] transition cursor-pointer"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      <span className="max-w-[72px] sm:max-w-[120px] truncate inline-block">{user.user_metadata?.userid || user.email}님</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          menuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {menuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#d6e4d3] rounded-md shadow-lg py-1 z-50"
                      >
                        <Link
                          href="/mypage"
                          role="menuitem"
                          className="block px-4 py-2 text-sm text-[#365927] hover:bg-[#eef5ec] transition"
                        >
                          마이페이지
                        </Link>
                        <div className="border-t border-[#d6e4d3] my-1" />
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                          }}
                          role="menuitem"
                          className="block w-full text-left px-4 py-2 text-sm text-[#5a7d50] hover:bg-[#eef5ec] hover:text-[#365927] transition cursor-pointer"
                        >
                          로그아웃
                        </button>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/cart"
                    className="relative text-[#365927] hover:text-[#4a7a38] transition font-medium"
                  >
                    장바구니
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-4 bg-[#365927] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </>
              )
            ) : (
              <>
                <Link href="/login" className="text-[#365927] hover:text-[#4a7a38] transition font-medium">
                  로그인
                </Link>
                <Link href="/signup" className="text-[#365927] hover:text-[#4a7a38] transition font-medium">
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Desktop Category Bar */}
        <nav className="hidden [@media(hover:hover)]:flex gap-6 pt-0 pb-2 text-sm font-medium">
          {categories.map((cat) => {
            return (
              <div key={cat.name} className="relative group">
                <Link
                  href={cat.href}
                  className={`whitespace-nowrap transition inline-block py-1 ${
                    cat.name === "무료 입시 자료"
                      ? "text-[#8aab82] hover:text-[#5a7d50]"
                      : "text-[#5a7d50] hover:text-[#365927]"
                  }`}
                >
                  {cat.name}
                </Link>
                {cat.children && (
                  <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
                    <div className="bg-white border border-[#d6e4d3] rounded-md shadow-lg py-1 min-w-[140px]">
                      {cat.children.map((child) =>
                        child.children ? (
                          <div key={child.name} className="relative group/sub">
                            <Link
                              href={child.href}
                              className="flex items-center justify-between px-4 py-2 text-sm text-[#5a7d50] hover:bg-[#eef5ec] hover:text-[#365927] transition whitespace-nowrap"
                            >
                              <span>{child.name}</span>
                              <ChevronRight className="h-3 w-3 ml-4 text-[#8aab82]" />
                            </Link>
                            <div className="absolute left-full top-0 hidden group-hover/sub:block z-50">
                              <div className="ml-0.5 bg-white border border-[#d6e4d3] rounded-md shadow-lg py-1 min-w-[140px]">
                                {child.children.map((grandchild) => (
                                  <Link
                                    key={grandchild.name}
                                    href={grandchild.href}
                                    className="block px-4 py-2 text-sm text-[#5a7d50] hover:bg-[#eef5ec] hover:text-[#365927] transition whitespace-nowrap"
                                  >
                                    {grandchild.name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Link
                            key={child.name}
                            href={child.href}
                            className="block px-4 py-2 text-sm text-[#5a7d50] hover:bg-[#eef5ec] hover:text-[#365927] transition whitespace-nowrap"
                          >
                            {child.name}
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile Category Bar */}
        <div className="[@media(hover:hover)]:hidden">
            <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="flex gap-5 pb-2 text-sm font-medium min-w-max">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => {
                      if (cat.children) {
                        setOpenCat(openCat === cat.name ? null : cat.name);
                        setOpenSubCat(null);
                      } else {
                        router.push(cat.href);
                        setOpenCat(null);
                      }
                    }}
                    className={`whitespace-nowrap py-1 transition flex items-center gap-0.5 ${
                      cat.name === "무료 입시 자료"
                        ? openCat === cat.name ? "text-[#5a7d50] font-semibold" : "text-[#8aab82]"
                        : openCat === cat.name ? "text-[#365927] font-semibold" : "text-[#5a7d50]"
                    }`}
                  >
                    {cat.name}
                    {cat.children && (
                      <ChevronDown className={`h-3 w-3 transition-transform ${openCat === cat.name ? "rotate-180" : ""}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {openCat && (() => {
              const activeCat = categories.find(c => c.name === openCat);
              if (!activeCat?.children) return null;
              return (
                <div className="border-t border-[#d6e4d3] bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 py-1">
                  {activeCat.children.map((child) => (
                    <div key={child.name}>
                      {child.children ? (
                        <>
                          <button
                            onClick={() => setOpenSubCat(openSubCat === child.name ? null : child.name)}
                            className="flex items-center justify-between w-full py-2.5 text-sm text-[#5a7d50] active:bg-[#eef5ec]"
                          >
                            <span>{child.name}</span>
                            <ChevronDown className={`h-3 w-3 transition-transform ${openSubCat === child.name ? "rotate-180" : ""}`} />
                          </button>
                          {openSubCat === child.name && (
                            <div className="bg-[#f5f9f4] -mx-4 sm:-mx-6 px-8 sm:px-10 mb-1 rounded">
                              {child.children.map((grandchild) => (
                                <Link
                                  key={grandchild.name}
                                  href={grandchild.href}
                                  onClick={() => { setOpenCat(null); setOpenSubCat(null); }}
                                  className="block py-2.5 text-sm text-[#5a7d50] active:text-[#365927]"
                                >
                                  {grandchild.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={child.href}
                          onClick={() => { setOpenCat(null); setOpenSubCat(null); }}
                          className="block py-2.5 text-sm text-[#5a7d50] active:text-[#365927]"
                        >
                          {child.name}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>
      </div>
    </header>
  );
}
