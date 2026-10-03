"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    intro: "가입하신 이메일을 적어주세요.",
    label: "이메일",
    placeholder: "example@email.com",
    inputType: "email",
    endpoint: "/api/auth/find-userid",
    field: "email",
    // 아이디 찾기는 발송 후 /find-id/sent로 넘어가 아래 두 문구는 쓰이지 않는다
    sentTitle: "",
    sentBody: "",
  },
  "find-password": {
    title: "비밀번호 찾기",
    intro: "아이디 또는 이메일을 적어주세요.",
    label: "아이디 또는 이메일",
    placeholder: "아이디 또는 이메일",
    inputType: "text",
    endpoint: "/api/auth/request-password-reset",
    field: "identifier",
    sentTitle: "메일을 보냈어요",
    sentBody: "가입하신 이메일로 비밀번호를 새로 정하는 링크를 보내드렸어요.",
  },
};

export default function AccountRecoveryForm({ mode }: { mode: Mode }) {
  const c = CONFIG[mode];
  const router = useRouter();
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
      // 아이디 찾기는 안내 페이지로 넘어간다(사용자 요청). 비밀번호 찾기는 같은 화면에서 안내한다
      if (mode === "find-id") {
        router.push("/find-id/sent");
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
        </>
      )}
    </div>
  );
}
