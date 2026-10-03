import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* 아이디·비밀번호 찾기 서버 공용. 라우트(/api/auth/find-userid, /api/auth/request-password-reset)에서만 쓴다. */

export const RESET_REDIRECT_URL = "https://www.cango.kr/reset-password";

/** 최근 1시간 허용 횟수. 대상(이메일·아이디)당은 남의 메일함 폭탄을, IP당은 무작위 대량 요청을 막는다.
 *  IP 한도는 넉넉히 둔다 — 국내 모바일 통신사는 여러 사용자가 공인 IP 하나를 나눠 써서(CGNAT),
 *  가입 파도 때 같은 IP 뒤의 정상 사용자끼리 한도를 깎아먹을 수 있다. 기능별로 따로 센다. */
const LIMIT_PER_TARGET = 3;
const LIMIT_PER_IP = 30;
const WINDOW_MS = 60 * 60 * 1000;

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** 원문을 저장하지 않으려고 서버 비밀값으로 HMAC을 만든다(같은 값은 같은 해시라 횟수는 셀 수 있다). */
function hmac(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest("hex");
}

export function clientIp(req: NextRequest) {
  // Vercel은 x-forwarded-for 맨 앞에 실제 클라이언트 IP를 둔다
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * 이번 요청을 먼저 기록한 뒤, 기록을 포함해 최근 1시간 횟수를 세서 한도를 넘었으면 false.
 * "세고 나서 기록"하면 동시에 들어온 요청이 전부 같은 개수를 보고 통과해 한도가 뚫린다(배포 전 리뷰).
 * 먼저 기록하면 동시 요청끼리 서로를 세게 된다. 거절된 요청도 기록에 남아 한도에 포함된다.
 * 가입 여부와 상관없이 같은 기준으로 센다 — 응답만 보고 가입 여부를 알 수 없게.
 */
export async function allowAndRecord(
  kind: "find_userid" | "reset_password",
  target: string,
  ip: string
): Promise<boolean> {
  const db = adminClient();
  const targetHash = hmac(`${kind}:${target}`);
  const ipHash = hmac(`ip:${kind}:${ip}`);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { error: insertError } = await db
    .from("auth_recovery_requests")
    .insert({ kind, target_hash: targetHash, ip_hash: ipHash });
  // 기록·확인이 실패하면 막는다(메일 남발 방지가 목적이라 열어두지 않는다)
  if (insertError) return false;

  const [byTarget, byIp] = await Promise.all([
    db.from("auth_recovery_requests").select("id", { count: "exact", head: true })
      .eq("target_hash", targetHash).gte("created_at", since),
    db.from("auth_recovery_requests").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", since),
  ]);
  if (byTarget.error || byIp.error) return false;
  // 방금 넣은 기록을 포함한 개수라 "초과"로 비교한다
  return (byTarget.count ?? 0) <= LIMIT_PER_TARGET && (byIp.count ?? 0) <= LIMIT_PER_IP;
}

/** 로그인과 같은 정규화 — 아이폰 자동 대문자·앞뒤 공백 때문에 못 찾는 일이 없게(a0e5bb2와 같은 규칙) */
export function normalizeIdentifier(raw: unknown) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
