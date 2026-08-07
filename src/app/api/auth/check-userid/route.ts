import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 회원가입 아이디 중복 검사.
 *
 * 기존에는 클라이언트가 anon 키로 profiles를 직접 조회했다(profiles 전체 공개의 원인 중 하나).
 * 서버에서 확인하고 사용 가능 여부(boolean)만 돌려준다.
 *
 * 참고: profiles.userid에는 UNIQUE 인덱스(profiles_username_unique)가 걸려 있어
 * 이 검사를 우회하더라도 중복 계정이 실제로 생성되지는 않는다. 여기는 UX용 사전 검사다.
 */
export async function POST(req: NextRequest) {
  const { userid } = await req.json();

  // 회원가입 폼(signup/page.tsx validateUserid)과 동일한 규칙
  if (!userid || !/^[a-z0-9]{6,16}$/.test(userid)) {
    return NextResponse.json({ error: "올바른 아이디 형식이 아닙니다." }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminClient
    .from("profiles")
    .select("userid")
    .eq("userid", userid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "확인 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
