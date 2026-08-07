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

    // 아이디 → 이메일 변환과 로그인을 모두 서버에서 처리한다.
    // (클라이언트가 anon 키로 profiles를 읽지 않게 하기 위함 — /api/auth/login 주석 참고)
    let result: { access_token?: string; refresh_token?: string; role?: string | null; error?: string };
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: identifier, password }),
      });
      result = await res.json();

      if (!res.ok || !result.access_token || !result.refresh_token) {
        setError(result.error ?? "로그인에 실패했습니다.");
        setLoading(false);
        return;
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    // 서버에서 받은 토큰으로 브라우저 세션을 설정
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });

    if (sessionError) {
      setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    const isSupplier = result.role === "supplier";
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
          <label className="block text-sm font-medium mb-1 text-[#365927]">아이디</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => { e.target.setCustomValidity(""); setIdentifier(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("아이디를 입력해주세요.")}
            placeholder="아이디를 입력해주세요"
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
            placeholder="비밀번호를 입력해주세요"
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
