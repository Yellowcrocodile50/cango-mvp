import type { Metadata } from "next";
import Link from "next/link";
import { tools, TOOLS_NAV_LABEL } from "@/data/tools";

const TOOLS_URL = "https://www.cango.kr/tools";
const TOOLS_TITLE = "무료 입시 도구 — 내신 계산기 · 진로 탐구 · 원서 조준 테스트";
/* ⚠️ "가입 없이 바로 쓰는" 같은 문구는 영업 멘트로 읽힌다(2026-09-08 사용자 교정).
   혜택을 파는 대신 **상황을 먼저 알아주고** 무엇을 찾을 수 있는지만 적는다. */
const TOOLS_DESCRIPTION =
  "입시가 막막한 수험생을 위한 무료 입시 도구. 내신 계산기로 목표 대학에 필요한 등급을, 진로 탐구로 나에게 맞는 학과를, 원서 조준 테스트로 수시 6장 배분을 찾아볼 수 있어요.";

export const metadata: Metadata = {
  title: TOOLS_TITLE,
  description: TOOLS_DESCRIPTION,
  keywords: [
    "무료 입시 도구",
    "내신 계산기",
    "학과 추천",
    "진로 탐구",
    "고등학생 진로",
    "중학생 진로",
    "선배들이 만든 입시자료",
  ],
  alternates: { canonical: TOOLS_URL },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: TOOLS_URL,
    siteName: "선배들이 만든 입시자료",
    title: TOOLS_TITLE,
    description: TOOLS_DESCRIPTION,
  },
};

export default function ToolsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold text-[#5a7d50] mb-2">{TOOLS_NAV_LABEL}</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#365927] leading-tight tracking-tight break-keep">
          입시가 막막한 수험생을 위한 <br className="sm:hidden" />
          <span className="text-[#4a7a38]">무료 입시 도구</span>
        </h1>
        {/* 선배들도 똑같았다 → 그러니 부담 없이 봐도 된다. 혜택을 파는 문장을 앞에 두지 않는다. */}
        <p className="text-sm text-[#5a7d50] mt-3 break-keep">
          선배들도 똑같았어요. 나한테 맞는 입시 전략과 대학, 학과까지 전부 무료로 찾아볼 수 있어요.
        </p>
      </div>

      <div className="grid gap-3">
        {tools.map((tool) => {
          const isLive = tool.status === "live";

          const inner = (
            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                  isLive ? "bg-[#eef5ec] border-[#d6e4d3]" : "bg-[#f5f9f4] border-[#e6ece4]"
                }`}
                aria-hidden
              >
                {tool.emoji}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#365927] flex flex-wrap items-center gap-1.5">
                  {tool.name}
                  {tool.badge && (
                    <span
                      className={`align-middle text-[10px] font-semibold rounded-full px-1.5 py-0.5 border ${
                        isLive
                          ? "text-[#5a7d50] bg-[#eaf2e8] border-[#d6e4d3]"
                          : "text-[#8aab82] bg-white border-[#e6ece4]"
                      }`}
                    >
                      {tool.badge}
                    </span>
                  )}
                </p>
                <p className="text-sm text-[#5a7d50] mt-1 leading-relaxed break-keep">
                  {tool.description}
                </p>
                {isLive && (
                  <p className="text-xs text-[#8aab82] mt-2">써보기 →</p>
                )}
              </div>
            </div>
          );

          /* 준비 중인 도구는 링크가 아니라 안내 카드로 둔다.
             빈 페이지로 보내는 것보다 "곧 나온다"를 보여주는 편이 이탈이 덜하다. */
          return isLive ? (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              className="block rounded-lg border border-[#d6e4d3] bg-white px-4 py-4 shadow-sm transition hover:border-[#8aab82] hover:shadow"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={tool.slug}
              className="rounded-lg border border-dashed border-[#e6ece4] bg-[#fbfdfa] px-4 py-4"
            >
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-[#e6ece4] border-l-4 border-l-[#5a7d50] bg-white shadow-sm px-4 py-4">
        <p className="text-sm font-medium text-[#365927] break-keep">
          도구를 써봤다면, 선배들이 만든 자료도 둘러보세요.
        </p>
        <p className="text-xs text-[#4a6b40] mt-1 break-keep">
          무료로 받을 수 있는 것만 모아둔 칸이 따로 있어요.
        </p>
        <Link
          href="/?category=고등"
          className="inline-block mt-3 text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-5 py-3 transition"
        >
          무료 자료 둘러보기 →
        </Link>
      </div>
    </div>
  );
}
