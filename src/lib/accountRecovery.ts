import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* 아이디·비밀번호 찾기 서버 공용. 라우트(/api/auth/find-userid, /api/auth/request-password-reset)에서만 쓴다. */

export const RESET_REDIRECT_URL = "https://www.cango.kr/reset-password";

/** 최근 1시간 허용 횟수. 대상(이메일·아이디)당은 남의 메일함 폭탄을, IP당은 무작위 대량 요청을 막는다. */
const LIMIT_PER_TARGET = 3;
const LIMIT_PER_IP = 10;
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
 * 횟수를 넘었으면 false. 넘지 않았으면 이번 요청을 기록하고 true.
 * 가입 여부와 상관없이 같은 기준으로 센다 — 응답만 보고 가입 여부를 알 수 없게.
 */
export async function allowAndRecord(
  kind: "find_userid" | "reset_password",
  target: string,
  ip: string
): Promise<boolean> {
  const db = adminClient();
  const targetHash = hmac(`${kind}:${target}`);
  const ipHash = hmac(`ip:${ip}`);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [byTarget, byIp] = await Promise.all([
    db.from("auth_recovery_requests").select("id", { count: "exact", head: true })
      .eq("target_hash", targetHash).gte("created_at", since),
    db.from("auth_recovery_requests").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", since),
  ]);
  // 횟수 확인이 실패하면 막는다(메일 남발 방지가 목적이라 열어두지 않는다)
  if (byTarget.error || byIp.error) return false;
  if ((byTarget.count ?? 0) >= LIMIT_PER_TARGET || (byIp.count ?? 0) >= LIMIT_PER_IP) return false;

  const { error } = await db.from("auth_recovery_requests").insert({ kind, target_hash: targetHash, ip_hash: ipHash });
  return !error;
}

/** 로그인과 같은 정규화 — 아이폰 자동 대문자·앞뒤 공백 때문에 못 찾는 일이 없게(a0e5bb2와 같은 규칙) */
export function normalizeIdentifier(raw: unknown) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
