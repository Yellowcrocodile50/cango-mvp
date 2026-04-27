"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSupplier = pathname.startsWith("/supplier");

  if (isSupplier) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
