"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 로그인한 사용자의 Supabase id를 GA4에 `user_id`로 넘긴다.
 *
 * 이걸 안 넘기면 GA는 익명 클라이언트 ID만 갖는다. 그러면 "장바구니에 담은 사람이
 * 우리 회원 중 누구인지" 같은 질문에 답할 수 없다 — 실제로 2026-08-19에
 * 다건 주문 실패자를 추적하려다 여기서 막혔다. GA는 소급 적용이 안 되므로
 * 지금부터 쌓이는 데이터에만 적용된다.
 *
 * 넘기는 값은 Supabase UUID다. 이메일·전화번호 같은 PII는 GA 정책상 금지이므로
 * 절대 넣지 말 것.
 *
 * 루트 레이아웃(서버 컴포넌트)이 직접 supabase 세션을 읽을 수 없어 클라이언트
 * 컴포넌트로 분리했다. Next.js 문서가 권장하는 방식이기도 하다
 * (`01-app/02-guides/analytics.md` — 클라이언트 경계를 이 컴포넌트로 한정).
 */
export default function GaUserId() {
  useEffect(() => {
    const apply = (userId: string | null) => {
      // gtag 스크립트가 afterInteractive라 아직 안 붙었을 수 있다
      window.gtag?.("set", { user_id: userId });
    };

    supabase.auth.getUser().then(({ data: { user } }) => apply(user?.id ?? null));

    // 로그인/로그아웃 시 갱신 — 로그아웃하면 null로 지워야 다음 사용자와 안 섞인다
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
