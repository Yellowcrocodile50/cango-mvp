"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 아이디 or 이메일 판별
    let loginEmail = identifier;
    if (!identifier.includes("@")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", identifier)
        .maybeSingle();

      if (!profile) {
        setError("존재하지 않는 아이디입니다.");
        setLoading(false);
        return;
      }
      loginEmail = profile.email;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "아이디(이메일) 또는 비밀번호를 확인해주세요."
          : signInError.message
      );
      setLoading(false);
      return;
    }

    const isSupplier = data.user?.user_metadata?.role === "supplier";
    const redirect = searchParams.get("redirect") || (isSupplier ? "/supplier" : "/");
    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8 text-[#365927]">로그인</h1>

      {registered && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
          회원가입이 완료되었습니다. 로그인해주세요.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">아이디 또는 이메일</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => { e.target.setCustomValidity(""); setIdentifier(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("아이디 또는 이메일을 입력해주세요.")}
            placeholder="아이디 또는 이메일 주소"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { e.target.setCustomValidity(""); setPassword(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("비밀번호를 입력해주세요.")}
            placeholder="비밀번호를 입력하세요"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-sm text-center text-[#5a7d50] mt-6">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="text-[#365927] font-medium underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
