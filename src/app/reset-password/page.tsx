"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { validatePassword, validateConfirm } from "@/lib/password";

/**
 * 비밀번호 재설정 — 메일의 링크(/api/auth/request-password-reset이 만든 recovery 링크)로 들어온다.
 *
 * 링크를 열면 Supabase가 #access_token…&type=recovery를 붙여 이 주소로 보내고,
 * 공용 supabase 클라이언트(detectSessionInUrl)가 그 토큰으로 세션을 잡는다.
 * 만료·이미 쓴 링크면 #error=…가 붙어 온다. 해시에 error가 있거나 세션이 없으면 "새 링크 받기"를 보여준다.
 *
 * 저장이 끝나면 모든 기기에서 로그아웃(scope: global)하고 로그인 화면으로 보낸다.
 */
type Status = "checking" | "ready" | "invalid" | "saving";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // 만료·이미 쓴 링크면 해시에 error가 붙어 온다. 서버 렌더와 첫 화면을 맞추려고 effect에서 읽는다
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const linkError = !!(params.get("error") || params.get("error_code"));
    let cancelled = false;
    // getSession()은 클라이언트가 URL의 토큰을 처리할 때까지 기다린 뒤 결과를 준다
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setStatus(!linkError && session ? "ready" : "invalid");
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pErr = validatePassword(password) || (!password ? "새 비밀번호를 입력해주세요." : "");
    const cErr = validateConfirm(password, confirm) || (!confirm ? "새 비밀번호를 한 번 더 입력해주세요." : "");
    if (pErr || cErr) {
      setError(pErr || cErr);
      return;
    }
    setError("");
    setStatus("saving");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus("ready");
      setError(
        updateError.message.includes("different from the old")
          ? "지금 쓰던 비밀번호와 다른 비밀번호로 정해주세요."
          : "비밀번호를 바꾸지 못했어요. 링크를 다시 요청해 주시면 금방 해결돼요."
      );
      return;
    }
    // 다른 기기에 남아 있을 수 있는 로그인까지 모두 끊는다(분실·도용 대비)
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login?reset=done");
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8 text-[#365927]">새 비밀번호 정하기</h1>

      {status === "checking" && (
        <p className="text-sm text-center text-[#5a7d50]">링크를 확인하고 있어요...</p>
      )}

      {status === "invalid" && (
        <div>
          <div className="p-4 bg-[#f3f8f1] border border-[#d6e4d3] rounded-lg text-sm text-[#365927] leading-relaxed">
            이 링크는 시간이 지났거나 이미 한 번 쓰였어요. 새 링크를 받으면 바로 다시 정할 수 있어요.
          </div>
          <Link
            href="/find-password"
            className="mt-6 flex items-center justify-center w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition"
          >
            새 링크 받기
          </Link>
        </div>
      )}

      {(status === "ready" || status === "saving") && (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#365927]">새 비밀번호</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8~16자, 문자·숫자·특수문자 포함"
                className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#365927]">새 비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="한 번 더 입력해주세요"
                className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "저장하는 중..." : "새 비밀번호 저장"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
