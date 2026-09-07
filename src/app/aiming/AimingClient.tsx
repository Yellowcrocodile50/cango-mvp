"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  COMMON_RULES,
  ENROLL_WARNING,
  NO_STABLE_WARNING,
  RESULT_DISCLAIMER,
  QUESTIONS,
  STRATEGY_TYPES,
  TIERS,
  TIER_ORDER,
  applyFloorAdjust,
  decideType,
  getType,
  interviewCap,
  type Mix,
  type StrategyType,
  type TierKey,
} from "@/data/aimingStrategy";
import { trackEvent, trackToolEvent } from "@/lib/ga";
import ToolCrossLinks from "@/components/ToolCrossLinks";

/* naeshin·career와 같은 접이식 상자 스타일. 도구끼리 생김새가 다르면 같은 사이트로 안 읽힌다. */
const DETAILS_SUMMARY =
  "flex items-center gap-1.5 text-sm font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden";
const DETAILS_CHEVRON =
  "w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-90";

/* 발사 모션이 끝나고 다음 질문으로 넘어가기까지. globals.css의 aiming-bullet(280ms)과 맞춘다.
   더 길면 답을 고른 뒤 화면이 멈춘 것처럼 느껴지고, 더 짧으면 탄이 날아가는 게 안 보인다. */
const FIRE_MS = 300;

/* 총알자국.
   ⚠️ 스톡 이미지를 쓰지 않고 직접 그린다. 참고로 받은 PNG에는 판매처 워터마크가 박혀 있었고,
   라이선스 없는 이미지를 실서비스에 올리면 저작권 문제가 된다(이 프로젝트의 자료 원칙과도 같다).
   SVG로 그리면 라이선스가 없고, 용량이 0이고, 확대해도 안 깨진다.

   📌 스파이크 길이를 배열로 고정해 두는 이유: 난수를 쓰면 서버 렌더와 클라이언트 렌더의
   모양이 달라져 hydration 불일치가 난다. 고정 배열이면 양쪽이 같은 그림을 그린다. */
const HOLE_SPIKES = [
  1, 0.42, 0.86, 0.5, 0.98, 0.45, 0.78, 0.52, 0.95, 0.4, 0.88, 0.55, 1, 0.46, 0.82, 0.48,
];
const HOLE_PATH =
  HOLE_SPIKES.map((r, i) => {
    const a = (i / HOLE_SPIKES.length) * Math.PI * 2 - Math.PI / 2;
    const x = 16 + Math.cos(a) * 15 * r;
    const y = 16 + Math.sin(a) * 15 * r;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ") + " Z";

function BulletHole({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {/* 갈라진 금속 테두리 */}
      <path d={HOLE_PATH} fill="#7e8c7a" opacity="0.5" />
      <path d={HOLE_PATH} fill="#5c6a58" opacity="0.35" transform="scale(0.72) translate(6.2 6.2)" />
      {/* 뚫린 구멍 */}
      <circle cx="16" cy="16" r="7.2" fill="#232f1f" />
    </svg>
  );
}

/**
 * 결과는 유형 하나로 끝나지 않는다. 같은 유형이라도 하향 수용도(floor)에 따라 배분이 달라지고,
 * 면접 상한은 대학별고사 여력(intv)에서 나온다.
 *
 * ⚠️ 그래서 공유 링크에 세 값을 모두 실어야 한다(`?t=…&f=…&i=…`).
 *    유형만 실으면 공유받은 사람이 **다른 배분을 본다.**
 */
type Result = { type: StrategyType; floor: number; intv: number };

export default function AimingClient({
  initialType,
  initialFloor,
  initialIntv,
}: {
  initialType: string | null;
  initialFloor: number | null;
  initialIntv: number | null;
}) {
  const router = useRouter();
  /* 공유 링크로 들어온 사람은 질문을 건너뛰고 결과부터 본다.
     테스트류 도구는 결과 링크가 퍼져서 들어오는 유입이 큰데, 그 링크가 질문 1번으로
     떨어지면 들어온 사람이 무슨 결과인지 못 본다. */
  const [result, setResult] = useState<Result | null>(() => {
    const type = getType(initialType);
    if (!type) return null;
    return { type, floor: initialFloor ?? 2, intv: initialIntv ?? 1 };
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  /* 방금 쏜 선택지. 모션이 도는 동안 값이 들어 있고, 그 사이 입력을 막는 잠금 역할도 겸한다.
     (연타하면 한 발에 두 문항이 넘어가 답이 하나 비는 채로 결과가 나온다) */
  const [firing, setFiring] = useState<string | null>(null);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = QUESTIONS[index];

  /* 모션 대기 중에 화면을 떠나면 타이머가 죽은 컴포넌트를 건드린다 */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* 공유 링크로 들어와 결과부터 본 사람을 따로 센다.
     ⚠️ start/complete는 문항을 푼 사람에게만 발생한다. 공유 유입은 그 둘 다 안 찍혀서
     "결과를 본 사람"의 상당수가 계측에서 통째로 빠진다 — 이 도구의 핵심 동선인데도.
     이 프로젝트는 같은 종류의 사각지대(성공 경로에만 이벤트를 붙여 실패를 못 본 것)로
     이미 크게 당한 적이 있다. 나중에 붙이면 그 전 데이터는 영영 없다. */
  const sharedViewRef = useRef(false);
  useEffect(() => {
    if (sharedViewRef.current) return;
    if (!initialType || !getType(initialType)) return;
    sharedViewRef.current = true;
    trackToolEvent("aiming", "start", { entry: "shared", type: initialType });
  }, [initialType]);

  function choose(optionId: string) {
    if (firing) return;

    if (!startedRef.current) {
      startedRef.current = true;
      trackToolEvent("aiming", "start", { entry: "quiz" });
    }

    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    setFiring(optionId);

    // 탄이 날아가는 동안 기다렸다가 넘어간다. 즉시 넘기면 모션이 보이지 않는다.
    timerRef.current = setTimeout(() => {
      setFiring(null);

      if (index < QUESTIONS.length - 1) {
        setIndex(index + 1);
        return;
      }

      /* 마지막 문항. setAnswers는 아직 반영 전이라 방금 고른 답이 포함된 next로 다시 센다. */
      let agg = 0;
      let floor = 0;
      let intv = 0;
      let gyo = 0;
      let rec = 0;
      for (const q of QUESTIONS) {
        const opt = q.options.find((o) => o.id === next[q.id]);
        if (!opt) continue;
        agg += opt.agg;
        floor += opt.floor;
        intv += opt.intv;
        gyo += opt.gyo;
        rec += opt.rec;
      }
      const type = decideType(agg, intv, gyo, rec);
      setResult({ type, floor, intv });
      trackToolEvent("aiming", "complete", { type: type.id, agg, floor, intv, gyo, rec });
      /* 결과를 URL에 남겨 공유와 뒤로가기가 되게 한다.
         ⚠️ 이 값은 서버(page.tsx)에서 읽어 props로 내려준다. 클라이언트에서 useSearchParams로
         읽으면 그 아래 전체가 서버 렌더링에서 빠져 검색엔진이 빈 페이지를 본다. */
      router.replace(`/aiming?t=${type.id}&f=${floor}&i=${intv}&r=1`, { scroll: false });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }, FIRE_MS);
  }

  function goBack() {
    if (index === 0 || firing) return;
    setIndex(index - 1);
  }

  function restart() {
    trackEvent("aiming_restart");
    if (timerRef.current) clearTimeout(timerRef.current);
    setResult(null);
    setAnswers({});
    setIndex(0);
    setFiring(null);
    startedRef.current = false;
    router.replace("/aiming", { scroll: false });
  }

  async function share() {
    if (!result) return;
    const { type, floor, intv } = result;
    const url = `https://www.cango.kr/aiming?t=${type.id}&f=${floor}&i=${intv}&r=1`;
    trackToolEvent("aiming", "share", { type: type.id });
    /* 모바일은 OS 공유 시트를 띄운다 — 카카오톡으로 바로 보낼 수 있어야
       "친구도 해보게 만드는" 동선이 끊기지 않는다. 지원 안 하면 링크 복사로 떨어진다. */
    const shareData = {
      title: `${type.name} — 원서 조준 테스트`,
      text: `나는 ${type.name}! 너는 무슨 형이야?`,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우도 여기로 온다. 복사로 떨어지지 않고 조용히 끝낸다.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크를 복사했어요. 친구에게 보내보세요!");
    } catch {
      toast.error("복사가 안 됐어요. 주소창의 링크를 그대로 보내주세요.");
    }
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <ResultView result={result} onRestart={restart} onShare={share} />
      </div>
    );
  }

  /* 탄창은 **지금 몇 번째 문항에 서 있는지**로 채운다.
     ⚠️ 예전엔 답한 문항 수(answeredCount)로 채웠는데, '이전 질문'으로 돌아가면
     답은 그대로 남아 있어서 "2 / 7"인데 3칸이 차 있는 상태가 됐다.
     위의 진행 숫자와 탄창이 다른 걸 가리키던 버그다.
     쏘는 중에는 아직 index가 안 올라갔으니 한 칸을 미리 채워 반동과 박자를 맞춘다. */
  const fired = firing !== null ? index + 1 : index;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* 히어로는 질문 화면에서만 둔다. 결과가 나온 뒤에도 남기면 설명이 결과를 아래로 밀어낸다. */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#5a7d50] mb-2">원서 조준 테스트</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#365927] leading-tight tracking-tight break-keep">
          나의 <span className="text-[#4a7a38]">원서 조준 전략</span>은?
        </h1>
        <p className="mt-2 text-sm sm:text-base font-semibold text-[#4a7a38] break-keep">
          1분만에 알아보는 수시 원서 카드 6장 전략
        </p>
        {/* 네이버는 본문의 서술 문장을 검색결과 설명으로 집어간다.
            /career에서 본문에 서술 문장이 하나도 없어 칩 라벨이 스니펫으로 나간 적이 있다. */}
        <p className="mt-3 text-sm sm:text-base text-[#5a7d50] leading-relaxed break-keep">
          질문 {QUESTIONS.length}개로 내 원서 조준 스타일을 확인해보세요.{" "}
          <br className="sm:hidden" />
          나는 모험을 좋아하는 스나이퍼형일까?{" "}
          <br className="sm:hidden" />
          안전하게 가는 분산형일까?
        </p>
      </div>

      {/* 진행 표시. 몇 개 남았는지 보이면 중간 이탈이 준다 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[#5a7d50]">
            {index + 1} / {QUESTIONS.length}
          </span>
          {index > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5a7d50] hover:text-[#365927] transition"
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
              이전 질문
            </button>
          )}
        </div>
        {/* 진행 막대 대신 탄창. 답한 만큼 채워지고, 방금 쏜 칸은 튀어오르며 들어간다. */}
        <div className="flex gap-1.5" aria-hidden>
          {QUESTIONS.map((_, i) => {
            const loaded = i < fired;
            const justFired = firing !== null && i === fired - 1;
            return (
              <span
                key={i}
                className={`h-2.5 flex-1 rounded-full border transition-colors duration-200 ${
                  loaded
                    ? `bg-[#5a7d50] border-[#5a7d50] ${justFired ? "aiming-hit" : ""}`
                    : "bg-[#eef2ec] border-[#dde6da]"
                }`}
              />
            );
          })}
        </div>
        <p className="sr-only">
          {QUESTIONS.length}개 중 {fired}개 답함
        </p>
      </div>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-[#365927] break-keep">{question.text}</h2>
        {question.hint && (
          <p className="mt-1.5 text-xs sm:text-sm text-[#8aab82] leading-relaxed break-keep">
            {question.hint}
          </p>
        )}

        <div className="mt-4 space-y-2.5">
          {question.options.map((opt) => {
            const active = answers[question.id] === opt.id;
            const isFiring = firing === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.id)}
                disabled={firing !== null}
                /* 터치 타깃 44px. 유입의 84%가 모바일이다.
                   overflow-hidden: 탄이 버튼 밖으로 날아가면 가로 스크롤이 생긴다. */
                className={`relative overflow-hidden w-full text-left rounded-lg border px-4 py-3.5 min-h-[44px] transition disabled:cursor-default ${
                  active
                    ? "border-[#5a7d50] bg-[#eef5ec] ring-2 ring-[#d6e4d3]"
                    : "border-[#d6e4d3] bg-white hover:border-[#8aab82]"
                } ${isFiring ? "aiming-recoil" : ""}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>
                    {/* 라벨의 \n은 **모바일에서만** 줄바꿈이다(sm부터는 공백으로 합쳐진다).
                        좁은 화면에서 어디서 끊길지를 데이터가 정할 수 있게 해둔다. */}
                    <span className="block text-sm font-medium text-[#365927] break-keep whitespace-pre-line sm:whitespace-normal">
                      {opt.label}
                    </span>
                    {opt.note && (
                      <span className="block text-xs text-[#8aab82] mt-0.5 break-keep">
                        {opt.note}
                      </span>
                    )}
                  </span>
                  {/* 답을 고르면 화살표 자리에 총알자국이 뚫린다 */}
                  {isFiring ? (
                    <BulletHole className="aiming-hole w-5 h-5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-[#8aab82]" aria-hidden />
                  )}
                </span>
                {/* 탄. 총알자국에서 출발해 오른쪽 바깥으로 빠져나간다 */}
                {isFiring && (
                  <span
                    aria-hidden
                    className="aiming-bullet pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-[3px] w-3 rounded-full bg-[#365927]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 질문 화면에도 본문을 남겨둔다. 크롤러가 받는 HTML이 이 화면이다. */}
      <section className="mt-8 rounded-lg border border-[#e6ece4] bg-white px-4 py-4">
        <h2 className="text-sm font-bold text-[#365927]">6장을 나누는 기준</h2>
        <dl className="mt-2.5 space-y-2">
          {TIER_ORDER.map((key) => (
            <div key={key} className="flex items-start gap-2">
              <dt
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${TIERS[key].bg} ${TIERS[key].border} ${TIERS[key].text}`}
              >
                {TIERS[key].label}
              </dt>
              <dd className="text-xs text-[#5a7d50] leading-relaxed break-keep">
                <b className={TIERS[key].text}>{TIERS[key].catch}</b> {TIERS[key].desc}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ResultView({
  result,
  onRestart,
  onShare,
}: {
  result: Result;
  onRestart: () => void;
  onShare: () => void;
}) {
  const { type, floor, intv } = result;

  /* 하향 후처리는 여기서 한 번만 계산한다. 화면 여러 곳에서 각자 계산하면 어긋난다. */
  const adjusted = useMemo(() => applyFloorAdjust(type.mix, floor), [type, floor]);
  const mix = adjusted.mix;
  const cap = useMemo(() => interviewCap(intv, type.interviewMax), [intv, type]);
  /* 면접 천장의 근거. 면접이 붙는 자리는 사실상 학생부종합이라 그 장수를 그대로 쓴다. */
  const interviewBasis = useMemo(
    () => type.tracks.find((t) => t.label === "학생부종합")?.count ?? 0,
    [type]
  );

  /* 6칸을 상향 → 적정 → 안정 → 하향 순으로 펼친다. 숫자만 적으면 6장이라는 감이 안 온다. */
  const cards = useMemo<TierKey[]>(
    () => TIER_ORDER.flatMap((key) => Array.from({ length: mix[key] }, () => key)),
    [mix]
  );

  return (
    <section>
      <h1 className="text-lg font-bold text-[#365927] mb-4">원서 조준 테스트</h1>

      <div className="rounded-xl border border-[#d6e4d3] bg-[#f7faf6] px-5 py-5">
        {/* 유형 캐릭터. 파일명은 유형 id와 같아서 유형이 늘어도 코드를 안 고친다.
            ⚠️ 원본이 1200x1200이라 next/image로 리사이즈해 내보낸다 —
            원본을 그대로 서빙하다 트래픽 한도를 넘겨 서비스가 멈춘 적이 있다. */}
        <Image
          src={`/aiming/${type.id}.png`}
          alt={type.name}
          width={200}
          height={200}
          priority
          className="w-32 h-32 sm:w-40 sm:h-40 object-contain -ml-2"
        />
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-[#365927] tracking-tight break-keep">
          {type.name}
        </h2>
        <p className="mt-1 text-sm font-medium text-[#4a7a38] break-keep">{type.tagline}</p>
        <p className="mt-3 text-sm text-[#5a7d50] leading-relaxed break-keep">{type.summary}</p>
      </div>

      {/* ── 6장 배치 ── */}
      <div className="mt-5">
        <h3 className="text-sm font-bold text-[#365927] mb-2">6장 배치</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {cards.map((key, i) => (
            <div
              key={i}
              className={`rounded-lg border px-2 py-3 text-center ${TIERS[key].bg} ${TIERS[key].border}`}
            >
              <p className={`text-xs font-bold ${TIERS[key].text}`}>{TIERS[key].label}</p>
            </div>
          ))}
        </div>
        <dl className="mt-3 space-y-1.5">
          {TIER_ORDER.filter((k) => mix[k] > 0).map((key) => (
            <div key={key} className="flex items-start gap-2">
              <dt className={`shrink-0 text-xs font-bold ${TIERS[key].text}`}>
                {TIERS[key].label} {mix[key]}장
              </dt>
              <dd className="text-xs text-[#5a7d50] leading-relaxed break-keep">
                <b className={TIERS[key].text}>{TIERS[key].catch}</b> {TIERS[key].desc}
              </dd>
            </div>
          ))}
        </dl>
        {/* 안전판이 0장이면 그 사실을 짚어준다. 아무 말 없이 보여주면
            도구가 "안전판 없이 가도 된다"고 권한 것처럼 읽힌다. */}
        {mix.stable === 0 && (
          <p className="mt-2.5 rounded-lg border border-[#f0cdd9] bg-[#fdf2f6] px-3 py-2 text-xs text-[#8a4159] leading-relaxed break-keep">
            {NO_STABLE_WARNING}
          </p>
        )}
        {/* 기본 배분에서 안정을 옮겼으면 왜 옮겼는지 밝힌다. 말없이 숫자만 바뀌면
            "왜 남들과 다르지"가 되고, 도구를 못 믿게 된다. */}
        {adjusted.note && (
          <p className="mt-2.5 rounded-lg border border-[#d6e4d3] bg-[#f7faf6] px-3 py-2 text-xs text-[#4a6b40] leading-relaxed break-keep">
            {adjusted.note}
          </p>
        )}
      </div>

      {/* 🚧 "왜 이 비율인가"와 "전형은 이렇게 나눠보세요"는 화면에서 뺐다.
          전형 배분은 개인의 내신·비교과·최저 충족 가능성에 따라 크게 달라져서
          지금 근거로는 단정해 보여주기 어렵다고 판단했다. 데이터는 남아 있으니
          근거가 생기면 되살린다(aimingStrategy.ts의 tracks). */}

      {/* ── 면접 ──
          ⚠️ 면접 개수는 6장 **안에서** 몇 개냐이지 추가 장수가 아니다.
          배분 카드와 나란히 두면 "6장 + 면접 2장 = 8장"으로 읽혀서 별도 줄로 뺐다. */}
      {type.interviewMax > 0 && (
        <InterviewCard cap={cap} note={type.interviewNote} basis={interviewBasis} />
      )}

      {/* 🚧 "이 조합에서 빗나가는 이유"(cautions)는 화면에서 뺐다.
          데이터는 남아 있으니 되살릴 때는 여기에 다시 붙인다. */}

      {/* ── 전 유형 공통 고정 안내 ──
          유형별 cautions에 섞지 않는다. 섞으면 어떤 유형에서는 빠질 수 있는데,
          이건 어느 유형이든 반드시 봐야 하는 원칙이다. */}
      <div className="mt-3 rounded-lg border-2 border-[#d6e4d3] bg-[#f7faf6] px-4 py-4">
        <h3 className="text-sm font-bold text-[#365927] break-keep">{ENROLL_WARNING.title}</h3>
        <p className="mt-1.5 text-xs text-[#4a6b40] leading-relaxed break-keep">
          {ENROLL_WARNING.body}
        </p>
      </div>

      {/* 다른 유형은 이 조합을 다 읽은 뒤에 둔다. 위에 두면 "내 결과"를 보기도 전에
          "다른 결과"가 먼저 눈에 들어온다. */}
      <OtherTypes current={type} floor={floor} />

      {/* 🚧 "원서 넣기 전에 확인할 것" 체크리스트는 화면에서 뺐다.
          데이터(checklist)는 남아 있으니 되살릴 때는 여기에 다시 붙인다. */}

      {/* 유형과 무관한 공통 규칙은 접어둔다. 결과를 다 읽은 뒤에 볼 내용이다. */}
      <details className="mt-5 group rounded-lg border border-[#e6ece4] bg-white px-4 py-3.5">
        <summary
          className={`${DETAILS_SUMMARY} text-[#365927]`}
          onClick={(e) => {
            if (!(e.currentTarget.parentElement as HTMLDetailsElement).open) {
              trackEvent("aiming_rules_open");
            }
          }}
        >
          <ChevronRight className={DETAILS_CHEVRON} aria-hidden />
          유형과 상관없이 알아둘 것 {COMMON_RULES.length}가지
        </summary>
        <div className="mt-3 space-y-3">
          {COMMON_RULES.map((r) => (
            <div key={r.title}>
              <p className="text-xs font-bold text-[#365927]">{r.title}</p>
              <p className="mt-0.5 text-xs text-[#5a7d50] leading-relaxed break-keep">{r.body}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm font-medium text-[#5a7d50] border border-[#d6e4d3] bg-white hover:border-[#8aab82] rounded-full px-5 py-3 transition"
        >
          다시 해보기
        </button>
        {/* 📌 "링크 복사"는 기능 이름이지 누를 이유가 아니다. 이 도구는 결과 링크가 퍼져서
            들어오는 유입이 큰 만큼, 친구에게 보내고 싶어지는 말로 바꾼다. */}
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#4a7a38] hover:bg-[#365927] rounded-full px-5 py-3 transition"
        >
          <Share2 className="w-4 h-4 shrink-0" aria-hidden />
          내 친구는 무슨 형일까? 공유하기
        </button>
      </div>

      {/* 결과 화면의 주 액션은 자료 CTA 하나로 유지한다(교차링크는 그 아래 약한 링크). */}
      <div className="mt-5 rounded-lg border border-[#e6ece4] border-l-4 border-l-[#5a7d50] bg-white shadow-sm px-4 py-4">
        {/* ⚠️ 자기소개서는 대입 전형에서 폐지됐다. 자소서를 전제한 문구를 쓰지 말 것. */}
        <p className="text-sm font-medium text-[#365927] break-keep">
          6장을 정하고 나면, 그다음은 생기부와 면접이에요.
        </p>
        <p className="text-xs text-[#4a6b40] mt-1 break-keep">
          선배들이 만든 자료 중 <b className="text-[#5a7d50]">무료로 받을 수 있는 것</b>만 모아뒀어요.
          <br className="sm:hidden" />
          부담 없이 둘러보세요.
        </p>
        <Link
          href="/?category=고등"
          onClick={() => trackToolEvent("aiming", "cta_click", { type: type.id, target: "free" })}
          className="inline-block mt-3 text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-5 py-3 transition"
        >
          무료 자료 둘러보기 →
        </Link>
      </div>

      <p className="mt-4 text-xs text-[#8aab82] leading-relaxed break-keep">
        {RESULT_DISCLAIMER}
      </p>

      <ToolCrossLinks currentSlug="aiming" />
    </section>
  );
}

/**
 * 면접 전형 개수.
 *
 * 📌 답을 바로 띄우지 않고 버튼을 눌러야 나오게 했다. 결과 화면이 이미 길어서
 * 그냥 늘어놓으면 지나쳐 읽는데, 질문을 먼저 던지면 "몇 개지?" 하고 한 번 멈춘다.
 * 누른 뒤에는 접지 않는다 — 확인하고 나서 다시 감추는 건 쓰임이 없다.
 */
function InterviewCard({
  cap,
  note,
  basis,
}: {
  cap: { label: string; note: string };
  note: string;
  basis: number;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="mt-5 rounded-lg border border-[#e6ece4] border-l-4 border-l-[#5a7d50] bg-white px-4 py-4">
      <h3 className="text-sm font-bold text-[#365927] break-keep">면접 전형은 몇 개가 좋을까요?</h3>

      {!opened ? (
        <button
          type="button"
          onClick={() => {
            setOpened(true);
            /* 답을 버튼 뒤에 숨긴 결정이 옳았는지 나중에 판단할 근거.
               안 누르면 이 정보는 전달되지 않은 것이라, 여는 비율을 알아야 한다.
               ⚠️ 4단계 규칙(start/complete/cta_click/share)은 깔때기용이라 별도 이름을 쓴다. */
            trackEvent("aiming_interview_open", { cap: cap.label });
          }}
          /* 터치 타깃 44px. 유입의 84%가 모바일이다. */
          className="mt-3 inline-flex items-center min-h-[44px] text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-5 py-3 transition"
        >
          확인하기
        </button>
      ) : (
        <>
          <p className="mt-2 text-lg font-extrabold text-[#4a7a38]">6장 중 {cap.label}</p>
          <p className="mt-0.5 text-xs text-[#8aab82] break-keep">
            면접이 붙는 자리는 이 조합에서 학생부종합 {basis}장이에요.
          </p>
          <p className="mt-2 text-xs text-[#5a7d50] leading-relaxed break-keep">{cap.note}</p>
          <p className="mt-2 text-xs text-[#5a7d50] leading-relaxed break-keep">{note}</p>
        </>
      )}
    </div>
  );
}

/**
 * 다른 조합도 보기.
 *
 * 📌 밑줄 링크 목록이었는데 접이식 카드로 바꿨다. 이름만 나열하면 눌러야 할 이유가 없는데,
 * 펼쳐서 배분(상향 n·적정 n·안정 n)이 바로 보이면 내 결과와 그 자리에서 견줄 수 있다.
 * 링크로 페이지를 옮기지 않고도 비교가 끝나는 게 이 자리의 목적이다.
 */
function OtherTypes({ current, floor }: { current: StrategyType; floor: number }) {
  const others = STRATEGY_TYPES.filter((t) => t.id !== current.id);
  if (others.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-[#365927] mb-2">다른 조합은 뭐가 있을까요?</h3>
      <div className="space-y-1.5">
        {others.map((t) => {
          /* 다른 유형도 같은 안정 후처리를 거친 배분으로 보여준다. 기본 배분을 그대로 띄우면
             "가면 이 배분"이라고 해놓고 실제로 가면 다른 숫자가 나온다. */
          const toMix: Mix = applyFloorAdjust(t.mix, floor).mix;
          return (
            <details
              key={t.id}
              className="group rounded-lg border border-[#e6ece4] bg-white px-4 py-3"
            >
              <summary
                className={`${DETAILS_SUMMARY} text-[#365927]`}
                onClick={(e) => {
                  // 펼칠 때만 센다(접을 때는 이미 open 상태라 제외)
                  if (!(e.currentTarget.parentElement as HTMLDetailsElement).open) {
                    trackEvent("aiming_other_open", { target: t.id });
                  }
                }}
              >
                <ChevronRight className={DETAILS_CHEVRON} aria-hidden />
                <Image
                  src={`/aiming/${t.id}.png`}
                  alt=""
                  width={64}
                  height={64}
                  className="w-7 h-7 shrink-0 object-contain"
                />
                <span className="text-sm font-medium">{t.name}</span>
              </summary>
              <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {TIER_ORDER.filter((k) => toMix[k] > 0).map((k) => (
                  <span
                    key={k}
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${TIERS[k].bg} ${TIERS[k].border} ${TIERS[k].text}`}
                  >
                    {TIERS[k].label} {toMix[k]}장
                  </span>
                ))}
              </p>
              <p className="mt-1.5 text-xs text-[#5a7d50] leading-relaxed break-keep">
                {t.tagline}
              </p>
            </details>
          );
        })}
      </div>
    </div>
  );
}
