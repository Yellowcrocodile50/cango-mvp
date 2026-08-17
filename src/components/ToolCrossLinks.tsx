"use client";

import Link from "next/link";
import { otherLiveTools } from "@/data/tools";
import { trackToolCrossLink } from "@/lib/ga";

/**
 * 도구 결과 화면 하단의 "다른 도구" 링크.
 *
 * 📌 위계를 일부러 낮췄다. 결과 화면의 주(主) 액션은 무료 자료 CTA 하나이고
 * (자료가 유일한 매출 동선이다), 이걸 버튼으로 만들면 CTA가 둘이 되어
 * "결과 CTA는 1개로 통합" 결정을 되돌리는 셈이 된다. 그래서 버튼이 아니라
 * 약한 텍스트 링크로, 자료 CTA **아래**에 둔다.
 *
 * 📌 이 자리에 두는 이유: GA 실측상 사용자 참여 시간의 대부분이 도구 안에 있다
 * (/naeshin 평균 3분 47초 · 전체 이벤트의 77% vs 홈 54초). 두 번째 도구의 발견은
 * 헤더보다 여기가 훨씬 효율이 좋다.
 */
export default function ToolCrossLinks({ currentSlug }: { currentSlug: string }) {
  const others = otherLiveTools(currentSlug);
  if (others.length === 0) return null;

  return (
    <div className="mt-4 px-1">
      <p className="text-xs text-[#8aab82] break-keep">
        이런 것도 있어요
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {others.map((tool) => (
          <Link
            key={tool.slug}
            href={`/${tool.slug}`}
            onClick={() => trackToolCrossLink(`/${tool.slug}`, `/${currentSlug}`)}
            className="text-xs text-[#5a7d50] underline underline-offset-2 hover:text-[#365927] transition"
          >
            {tool.emoji} {tool.name} →
          </Link>
        ))}
      </div>
    </div>
  );
}
