"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Category = {
  name: string;
  href: string;
  children?: { name: string; href: string }[];
};

const categories: Category[] = [
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
];

export default function Header() {
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-extrabold tracking-tight text-[#365927]">
              CANGO
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            {user ? (
              user.user_metadata?.role === "supplier" ? (
                <>
                  <span className="text-[#365927] font-medium">
                    {user.user_metadata?.name || user.email}님
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
                      <span>{user.user_metadata?.name || user.email}님</span>
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
                          구매 내역
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
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="relative text-[#365927] hover:text-[#4a7a38] transition font-medium cursor-pointer"
                >
                  장바구니
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Category bar */}
        <nav className="flex gap-6 py-3 text-sm font-medium">
          {categories.map((cat) => (
            <div key={cat.name} className="relative group">
              <Link
                href={cat.href}
                className="whitespace-nowrap text-[#5a7d50] hover:text-[#365927] transition inline-block py-1"
              >
                {cat.name}
              </Link>
              {cat.children && (
                <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
                  <div className="bg-white border border-[#d6e4d3] rounded-md shadow-lg py-1 min-w-[140px]">
                    {cat.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className="block px-4 py-2 text-sm text-[#5a7d50] hover:bg-[#eef5ec] hover:text-[#365927] transition whitespace-nowrap"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
      {/* Login modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-[#365927] mb-3">잠깐, 로그인은 하셨나요?</h2>
            <p className="text-[#5a7d50] text-xs mb-6">
              장바구니는 로그인 후 이용할 수 있어요.
            </p>
            <div className="space-y-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(pathname)}`}
                onClick={() => setShowLoginModal(false)}
                className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
              >
                로그인하기
              </Link>
              <button
                onClick={() => { setShowLoginModal(false); router.push("/"); }}
                className="w-full h-12 border border-[#d6e4d3] text-[#5a7d50] rounded-lg font-medium hover:bg-[#f5f9f4] transition cursor-pointer"
              >
                둘러볼게요
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
