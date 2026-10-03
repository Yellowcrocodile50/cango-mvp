import { NextRequest, NextResponse, after } from "next/server";
import { adminClient, allowAndRecord, clientIp, looksLikeEmail, normalizeIdentifier } from "@/lib/accountRecovery";
import { sendUserIdEmail } from "@/lib/email/accountRecovery";

/**
 * 아이디 찾기 — 가입된 이메일이면 그 메일로 아이디를 보낸다. 화면에는 아이디를 보여주지 않는다.
 *
 * 응답은 가입 여부와 상관없이 같다(계정 열거 방지, 로그인 API와 같은 원칙).
 * 조회·발송은 응답을 보낸 뒤 after()에서 해서, 응답 시간으로도 가입 여부를 알 수 없게 한다.
 */
export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = normalizeIdentifier(rawEmail);

  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "이메일 형식을 확인해주세요." }, { status: 400 });
  }

  if (!(await allowAndRecord("find_userid", email, clientIp(req)))) {
    return NextResponse.json(
      { error: "요청이 많아 잠시 멈췄어요. 조금 뒤에 다시 시도해주세요." },
      { status: 429 }
    );
  }

  after(async () => {
    try {
      const { data: profile } = await adminClient()
        .from("profiles")
        .select("userid")
        .eq("email", email)
        .maybeSingle();
      if (profile?.userid) await sendUserIdEmail(email, profile.userid);
    } catch (e) {
      console.error("[find-userid] 아이디 메일 발송 실패", e);
    }
  });

  return NextResponse.json({ ok: true });
}
