import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 아이디 기반 로그인.
 *
 * 기존에는 클라이언트가 anon 키로 profiles를 직접 조회해 userid → email을 변환했는데,
 * 그러려면 profiles SELECT 정책이 anon에 열려 있어야 해서 회원 전체의 이메일·휴대폰이
 * 노출됐다. 변환과 로그인을 모두 서버에서 처리해 이메일이 클라이언트로 나가지 않게 한다.
 */
export async function POST(req: NextRequest) {
  const { userid, password } = await req.json();

  if (!userid || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  // 아이디 존재 여부를 응답으로 구분하지 않는다 (계정 열거 방지)
  const invalidCredentials = () =>
    NextResponse.json({ error: "아이디 또는 비밀번호를 확인해주세요." }, { status: 401 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await adminClient
    .from("profiles")
    .select("email")
    .eq("userid", userid)
    .maybeSingle();

  if (!profile?.email) return invalidCredentials();

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await anonClient.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error || !data.session) return invalidCredentials();

  // 세션 토큰만 반환 — 이메일은 응답에 포함하지 않는다
  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    role: data.user?.user_metadata?.role ?? null,
  });
}
