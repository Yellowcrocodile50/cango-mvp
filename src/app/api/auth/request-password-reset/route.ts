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
 * 비밀번호 찾기 — 아이디 또는 이메일 한 칸을 받아, 가입된 계정이면 그 계정 이메일로 재설정 링크를 보낸다.
 *
 * 링크는 Supabase admin generate_link(type=recovery)로 만들고 메일은 Resend로 직접 보낸다
 * (Supabase 기본 메일 발송 설정과 무관). 링크를 열면 /reset-password#access_token…&type=recovery로 도착한다.
 *
 * 응답은 가입 여부와 상관없이 같고, 조회·발송은 after()에서 한다(계정 열거·응답 시간 차이 방지).
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

  after(async () => {
    try {
      const db = adminClient();
      const { data: profile } = await db
        .from("profiles")
        .select("email, userid")
        .eq(looksLikeEmail(identifier) ? "email" : "userid", identifier)
        .maybeSingle();
      if (!profile?.email || !profile.userid) return;

      const { data, error } = await db.auth.admin.generateLink({
        type: "recovery",
        email: profile.email,
        options: { redirectTo: RESET_REDIRECT_URL },
      });
      if (error || !data?.properties?.action_link) {
        console.error("[request-password-reset] 재설정 링크 생성 실패", error);
        return;
      }
      await sendPasswordResetEmail(profile.email, profile.userid, data.properties.action_link);
    } catch (e) {
      console.error("[request-password-reset] 재설정 메일 발송 실패", e);
    }
  });

  return NextResponse.json({ ok: true });
}
