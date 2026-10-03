"use client";

import { useState } from "react";
import Link from "next/link";

/* 아이디 찾기·비밀번호 찾기 공용 폼. 두 화면은 입력칸 하나 + 메일 발송 안내로 모양이 같다. */

type Mode = "find-id" | "find-password";

const CONFIG: Record<Mode, {
  title: string;
  intro: string;
  label: string;
  placeholder: string;
  inputType: "email" | "text";
  endpoint: string;
  field: "email" | "identifier";
  sentTitle: string;
  sentBody: string;
}> = {
  "find-id": {
    title: "아이디 찾기",
    intro: "가입할 때 적은 이메일을 알려주시면, 그 메일로 아이디를 보내드려요.",
    label: "이메일",
    placeholder: "example@email.com",
    inputType: "email",
    endpoint: "/api/auth/find-userid",
    field: "email",
    sentTitle: "메일을 보냈어요",
    sentBody: "가입된 이메일이라면 곧 아이디가 담긴 메일이 도착해요.",
  },
  "find-password": {
    title: "비밀번호 찾기",
    intro: "아이디나 이메일 중 기억나는 것 하나만 적어주시면, 가입한 이메일로 새 비밀번호를 정하는 링크를 보내드려요.",
    label: "아이디 또는 이메일",
    placeholder: "아이디 또는 이메일",
    inputType: "text",
    endpoint: "/api/auth/request-password-reset",
    field: "identifier",
    sentTitle: "메일을 보냈어요",
    sentBody: "가입된 계정이라면 곧 비밀번호를 새로 정하는 링크가 담긴 메일이 도착해요.",
  },
};

export default function AccountRecoveryForm({ mode }: { mode: Mode }) {
  const c = CONFIG[mode];
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(c.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [c.field]: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "잠시 후 다시 시도해주세요.");
        return;
      }
      setSent(true);
    } catch {
      setError("연결이 잠깐 끊겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-3 text-[#365927]">{c.title}</h1>

      {sent ? (
        <div className="mt-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 leading-relaxed">
            <p className="font-medium">{c.sentTitle}</p>
            <p className="mt-1">{c.sentBody}</p>
            {/* 네이버·iCloud에서 "메일이 안 왔다" 문의가 실제로 있었다 — 스팸함·프로모션 탭 안내 */}
            <p className="mt-2 text-green-600">
              몇 분이 지나도 안 보이면 스팸함이나 프로모션 탭도 한번 확인해 주세요.
            </p>
          </div>
          <p className="text-sm text-center text-[#5a7d50] mt-6">
            가입한 이메일이 기억나지 않으면{" "}
            <a
              href="https://pf.kakao.com/_xnANbX/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#365927] font-medium underline"
            >
              카카오톡 채널
            </a>
            로 편하게 물어봐 주셔도 괜찮아요.
          </p>
          <Link
            href="/login"
            className="mt-6 flex items-center justify-center w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-center text-[#5a7d50] mb-8 leading-relaxed">{c.intro}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#365927]">{c.label}</label>
              <input
                type={c.inputType}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete={mode === "find-id" ? "email" : "username"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={c.placeholder}
                required
                className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "보내는 중..." : "메일 보내기"}
            </button>
          </form>

          <p className="text-sm text-center text-[#5a7d50] mt-6">
            {mode === "find-id" ? (
              <>비밀번호가 기억나지 않으면 <Link href="/find-password" className="text-[#365927] font-medium underline">비밀번호 찾기</Link></>
            ) : (
              <>아이디가 기억나지 않으면 <Link href="/find-id" className="text-[#365927] font-medium underline">아이디 찾기</Link></>
            )}
          </p>
        </>
      )}
    </div>
  );
}
