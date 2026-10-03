import { NextRequest, NextResponse, after } from "next/server";
import {
  RESET_REDIRECT_URL,
  adminClient,
  allowAndRecord,
  clientIp,
  looksLikeEmail,
  normalizeIdentifier,
} from "@/lib/accountRecovery";
import { sendPasswordResetEmail } from "@/lib/email/accountRecovery";

/**
 * 비밀번호 찾기 — 아이디 또는 이메일 한 칸을 받아, 가입된 계정이면 그 계정 이메일로 재설정 링크를 보내고,
 * 없으면 다시 입력하도록 알린다.
 *
 * 링크는 Supabase admin generate_link(type=recovery)로 만들고 메일은 Resend로 직접 보낸다
 * (Supabase 기본 메일 발송 설정과 무관). 링크를 열면 /reset-password#access_token…&type=recovery로 도착한다.
 *
 * 가입 여부를 알려주는 건 사용자 결정(2026-10-03) — find-userid 주석 참고. 링크 생성·발송만 응답 뒤(after)에 한다.
 */
export async function POST(req: NextRequest) {
  const { identifier: raw } = await req.json().catch(() => ({}));
  const identifier = normalizeIdentifier(raw);

  if (!identifier) {
    return NextResponse.json({ error: "아이디 또는 이메일을 입력해주세요." }, { status: 400 });
  }

  if (!(await allowAndRecord("reset_password", identifier, clientIp(req)))) {
    return NextResponse.json(
      { error: "요청이 많아 잠시 멈췄어요. 조금 뒤에 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const byEmail = looksLikeEmail(identifier);
  const db = adminClient();
  const { data: profile, error } = await db
    .from("profiles")
    .select("email, userid, role")
    .eq(byEmail ? "email" : "userid", identifier)
    .maybeSingle();

  if (error) {
    console.error("[request-password-reset] 조회 실패", error);
    return NextResponse.json({ error: "확인 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!profile?.email || !profile.userid) {
    return NextResponse.json(
      {
        error: byEmail
          ? "입력하신 이메일로 가입된 계정이 없어요. 다시 확인해 주세요."
          : "입력하신 아이디로 가입된 계정이 없어요. 다시 확인해 주세요.",
      },
      { status: 404 }
    );
  }

  // 공급자 계정은 자가 재설정에서 뺀다(사용자 결정 2026-10-03). 가입 이메일이 검증된 적이 없어,
  // 이메일 주인이 링크로 계정을 가져가면 전체 회원 개인정보·주문 관리가 넘어간다.
  // 공급자 비밀번호는 Supabase 대시보드에서 직접 바꾼다.
  if (profile.role === "supplier") {
    return NextResponse.json(
      { error: "이 계정은 이메일로 비밀번호를 바꿀 수 없어요. 카카오톡 채널로 문의해 주세요." },
      { status: 403 }
    );
  }

  const { email, userid } = profile;
  after(async () => {
    try {
      const { data, error: linkError } = await db.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: RESET_REDIRECT_URL },
      });
      if (linkError || !data?.properties?.action_link) {
        console.error("[request-password-reset] 재설정 링크 생성 실패", linkError);
        return;
      }
      await sendPasswordResetEmail(email, userid, data.properties.action_link);
    } catch (e) {
      console.error("[request-password-reset] 재설정 메일 발송 실패", e);
    }
  });

  return NextResponse.json({ ok: true });
}
