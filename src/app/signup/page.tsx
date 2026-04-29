"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function validateUsername(v: string) {
  if (!v) return "";
  if (!/^[a-z0-9]{6,16}$/.test(v)) return "6~16자, 영문 소문자·숫자만 사용 가능합니다.";
  return "";
}

function validateEmail(v: string) {
  if (!v) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "올바른 이메일 형식으로 입력해주세요.";
  return "";
}

function validatePassword(v: string) {
  if (!v) return "";
  if (v.length < 8 || v.length > 16) return "8~16자로 입력해주세요.";
  if (!/[a-zA-Z]/.test(v)) return "문자를 포함해야 합니다.";
  if (!/[0-9]/.test(v)) return "숫자를 포함해야 합니다.";
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(v)) return "특수문자를 포함해야 합니다.";
  return "";
}

function validateConfirm(password: string, confirm: string) {
  if (!confirm) return "";
  if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
  return "";
}

function validatePhone(v: string) {
  if (!v) return "";
  if (!/^010-?[0-9]{4}-?[0-9]{4}$/.test(v)) return "올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)";
  return "";
}

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // 제출 시 전체 재검증
    const uErr = validateUsername(username) || (!username ? "아이디를 입력해주세요." : "");
    const eErr = validateEmail(email) || (!email ? "이메일을 입력해주세요." : "");
    const pErr = validatePassword(password) || (!password ? "비밀번호를 입력해주세요." : "");
    const cErr = validateConfirm(password, confirmPassword) || (!confirmPassword ? "비밀번호를 다시 입력해 주세요." : "");
    const phErr = validatePhone(phone) || (!phone ? "전화번호를 입력해주세요." : "");

    setUsernameError(uErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmError(cErr);
    setPhoneError(phErr);

    if (uErr || eErr || pErr || cErr || phErr) return;
    if (!privacyAgreed) {
      setServerError("개인정보 처리방침에 동의해주세요.");
      return;
    }

    setLoading(true);
    setServerError("");

    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      setUsernameError("이미 사용 중인 아이디입니다.");
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: username, username, role: "buyer", phone, privacy_agreed: true, marketing_agreed: marketingAgreed },
      },
    });

    if (signUpError) {
      const msg = signUpError.message;
      setServerError(
        msg.includes("already registered") ? "이미 가입된 이메일입니다." :
        "회원가입 중 오류가 발생했습니다."
      );
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8 text-[#365927]">회원가입</h1>

      {serverError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">

        {/* 아이디 */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">아이디</label>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameError(validateUsername(e.target.value));
            }}
            placeholder="6~16자, 영문 소문자·숫자 사용 가능"
            className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white ${usernameError ? "border-red-400" : "border-[#d6e4d3]"}`}
          />
          {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">이메일</label>
          <input
            type="text"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(validateEmail(e.target.value));
            }}
            placeholder="example@email.com"
            className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white ${emailError ? "border-red-400" : "border-[#d6e4d3]"}`}
          />
          {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(validatePassword(e.target.value));
              if (confirmPassword) setConfirmError(validateConfirm(e.target.value, confirmPassword));
            }}
            placeholder="8~16자, 문자·숫자·특수문자 모두 혼용"
            className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white ${passwordError ? "border-red-400" : "border-[#d6e4d3]"}`}
          />
          {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
        </div>

        {/* 비밀번호 확인 */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmError(validateConfirm(password, e.target.value));
            }}
            placeholder="비밀번호를 다시 입력해 주세요"
            className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white ${confirmError ? "border-red-400" : "border-[#d6e4d3]"}`}
          />
          {confirmError && <p className="text-red-500 text-xs mt-1">{confirmError}</p>}
        </div>

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#365927]">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(validatePhone(e.target.value));
            }}
            placeholder="010-1234-5678"
            className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white ${phoneError ? "border-red-400" : "border-[#d6e4d3]"}`}
          />
          {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
        </div>

        {/* 동의 */}
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
