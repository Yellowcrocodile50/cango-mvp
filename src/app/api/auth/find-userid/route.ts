import { NextRequest, NextResponse, after } from "next/server";
import { adminClient, allowAndRecord, clientIp, looksLikeEmail, normalizeIdentifier } from "@/lib/accountRecovery";
import { sendUserIdEmail } from "@/lib/email/accountRecovery";

/**
 * 아이디 찾기 — 이메일로 가입된 계정이 있으면 그 메일로 아이디를 보내고, 없으면 다시 입력하도록 알린다.
 * 화면에는 아이디를 보여주지 않는다(메일로만).
 *
 * 가입 여부를 알려주는 건 사용자 결정(2026-10-03). 가입 화면의 아이디 중복 확인·"이미 가입된 이메일"
 * 안내가 이미 같은 정보를 주고 있어 새로 드러나는 건 없다. 대신 IP당 횟수 제한으로 대량 조회를 막는다.
 * 메일 발송만 응답 뒤(after)에 해서 화면이 빨리 넘어가게 한다.
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

  const { data: profile, error } = await adminClient()
    .from("profiles")
    .select("userid")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[find-userid] 조회 실패", error);
    return NextResponse.json({ error: "확인 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!profile?.userid) {
    return NextResponse.json(
      { error: "입력하신 이메일로 가입된 계정이 없어요. 이메일을 다시 확인해 주세요." },
      { status: 404 }
    );
  }

  const userid = profile.userid;
  after(async () => {
    try {
      await sendUserIdEmail(email, userid);
    } catch (e) {
      console.error("[find-userid] 아이디 메일 발송 실패", e);
    }
  });

  return NextResponse.json({ ok: true });
}
