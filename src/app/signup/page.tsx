"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^[a-z0-9]{6,16}$/.test(username)) {
      setError("아이디는 6~16자, 영문 소문자와 숫자만 사용 가능합니다.");
      return;
    }
    if (password.length < 8 || password.length > 16) {
      setError("비밀번호는 8~16자로 입력해주세요.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(password)) {
      setError("비밀번호는 문자, 숫자, 특수문자를 모두 포함해야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!privacyAgreed) {
      setError("개인정보 처리방침에 동의해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    // 아이디 중복 확인
    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      setError("이미 사용 중인 아이디입니다.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: username, role: "buyer", phone, privacy_agreed: true, marketing_agreed: marketingAgreed },
      },
    });

    if (signUpError) {
      const msg = signUpError.message;
      setError(
        msg.includes("already registered") ? "이미 가입된 이메일입니다." :
        msg.includes("Password should be") ? "비밀번호는 8자 이상 입력해주세요." :
        "회원가입 중 오류가 발생했습니다."
      );
      setLoading(false);
      return;
    }

    // profiles 테이블에 아이디 저장
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        email,
      });
    }

    router.push("/login?registered=true");
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8 text-[#365927]">회원가입</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">아이디</label>
          <input
            type="text"
            value={username}
            onChange={(e) => { e.target.setCustomValidity(""); setUsername(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("아이디를 입력해주세요.")}
            placeholder="6~16자, 영문 소문자·숫자 사용 가능"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { e.target.setCustomValidity(""); setEmail(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(
              (e.target as HTMLInputElement).validity.valueMissing ? "이메일을 입력해주세요." : "올바른 이메일 형식으로 입력해주세요."
            )}
            placeholder="example@email.com"
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
            placeholder="8~16자, 문자·숫자·특수문자 모두 혼용"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => { e.target.setCustomValidity(""); setConfirmPassword(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("비밀번호를 다시 입력해 주세요.")}
            placeholder="비밀번호를 다시 입력해 주세요"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { e.target.setCustomValidity(""); setPhone(e.target.value); }}
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("전화번호를 입력해주세요.")}
            placeholder="010-1234-5678"
            required
            className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d6e4d3] accent-[#365927] cursor-pointer"
            />
            <span className="text-sm text-[#365927]">
              <span className="font-medium">[필수]</span> 개인정보 처리방침에 동의합니다
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingAgreed}
              onChange={(e) => setMarketingAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d6e4d3] accent-[#365927] cursor-pointer"
            />
            <span className="text-sm text-[#5a7d50]">
              <span className="font-medium">[선택]</span> 마케팅 정보 수신에 동의합니다
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <p className="text-sm text-center text-[#5a7d50] mt-6">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-[#365927] font-medium underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
