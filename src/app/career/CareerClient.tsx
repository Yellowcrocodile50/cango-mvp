"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getTrack,
  interestsForTrack,
  TRACKS,
  TRACK_LABELS,
  type CareerDepartment,
} from "@/data/careerDepartments";
import { decodeInterests, encodeInterests, matchDepartments } from "@/lib/careerMatch";
import { trackEvent, trackToolEvent } from "@/lib/ga";
import ToolCrossLinks from "@/components/ToolCrossLinks";

/* naeshin과 같은 접이식 상자 스타일을 쓴다. 도구끼리 생김새가 다르면 같은 사이트로 안 읽힌다. */
const DETAILS_SUMMARY =
  "flex items-center gap-1.5 text-sm font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden";
const DETAILS_CHEVRON = "w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-90";

/* 기본으로 펴두는 결과 카드 수. 나머지는 지우지 않고 접는다.
   실측(트랙별 600표본): 관심사 3개 선택 시 중앙 16개·5개 선택 시 25개까지 나온다. */
const VISIBLE_LIMIT = 7;

/* 마침표 기준으로 문장을 나눈다.
   ⚠️ 정규식 lookbehind(`(?<=\.)`)를 쓰면 구형 iOS 사파리에서 **파일 파싱 단계에서** 터져
   페이지가 통째로 안 뜬다. 유입의 84%가 모바일이라 문자 순회로 처리한다.
   데이터에 소수점·약어는 없음을 확인했다(마침표 99건 전수 점검). */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?") {
      out.push(buf.trim());
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

/* 글자 폭 추정. 한글·한자는 1em, 라틴/숫자/문장부호는 0.55em, 공백 0.28em으로 잡는다.
   실측 대조: 물리학과 설명 두 문장이 187px·389px로 나왔고 390px 화면 실제 렌더가 1줄·2줄로 일치했다.
   캔버스 measureText는 웹폰트(Pretendard) 로딩 시점에 따라 값이 흔들려 쓰지 않는다. */
function textWidth(text: string, fontSize = 14): number {
  let em = 0;
  for (const ch of text) {
    if (ch === " ") em += 0.28;
    else if (ch === "·") em += 0.5;
    else if (ch.codePointAt(0)! < 0x2000) em += 0.55;
    else em += 1;
  }
  return em * fontSize;
}

/**
 * 문장 단위로 줄을 바꾸되, **줄 수가 늘어나지 않을 때만** 바꾼다.
 *
 * 📌 처음엔 무조건 문장마다 끊었는데, 첫 문장이 한 줄을 넘기면
 * `…해석을 / 배워요. / 로스쿨 진학과…`처럼 '배워요.' 한 조각만 남는 줄이 생겼다.
 * 실측: 두 문장 이상인 설명 85건 중 **47건(55%)이 이 경우**라 오히려 더 지저분해졌다.
 * 그래서 강제로 끊은 줄 수와 그냥 흘렸을 때의 줄 수가 같을 때만 끊는다(공짜일 때만).
 *
 * @param lineWidth 카드 안쪽 실측 폭. 0이면(서버 렌더·측정 전) 끊지 않는다.
 */
function Sentences({ text, lineWidth }: { text: string; lineWidth: number }) {
  const parts = useMemo(() => splitSentences(text), [text]);

  const breakBySentence = useMemo(() => {
    if (parts.length < 2 || lineWidth <= 0) return false;
    const lines = (t: string) => Math.ceil(textWidth(t) / lineWidth);
    const forced = parts.reduce((sum, s) => sum + lines(s), 0);
    return forced === lines(parts.join(" "));
  }, [parts, lineWidth]);

  if (!breakBySentence) return <>{text}</>;

  return (
    <>
      {parts.map((s, i) => (
        <span key={i} className="block">
          {s}
        </span>
      ))}
    </>
  );
}

/** 카드 안 소제목. 본문(14px)보다 작으면 제목으로 안 읽혀서 굵기·색·액센트로 단을 나눈다 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 mb-1.5">
      <span className="w-[3px] h-3.5 rounded-full bg-[#8aab82] shrink-0" aria-hidden />
      <span className="text-[13px] font-bold text-[#365927] tracking-tight">{children}</span>
    </p>
  );
}

export default function CareerClient({
  initialTrack,
  initialInterests,
  initialShowResults,
}: {
  /* 초기값은 서버에서 읽어 내려온다 — 클라이언트에서 읽으면 정적 HTML이 비어버린다(page.tsx 주석) */
  initialTrack: string | null;
  initialInterests: string | null;
  initialShowResults: boolean;
}) {
  const router = useRouter();

  /* 결과가 링크로 남아야 공유가 된다(원본은 상태가 메모리에만 있어 새로고침하면 초기화됐다).
     다만 **URL을 그대로 상태로 쓰면 안 된다** — `router.replace`가 비동기라
     칩을 빠르게 연속으로 누르면 두 번째 클릭이 갱신 전 URL을 읽어 앞선 선택을 덮어쓴다.
     그래서 진실은 React state가 갖고, URL은 아래 effect에서 따라 쓰는 스냅샷으로 둔다. */
  /* useState의 lazy initializer는 첫 렌더에서 한 번만 실행된다.
     공유 링크로 들어온 경우의 초기값만 URL에서 읽고, 이후로는 state가 주인이다. */
  const [trackId, setTrackId] = useState<string | null>(initialTrack);
  const track = getTrack(trackId);
  const [selected, setSelected] = useState<string[]>(() =>
    decodeInterests(initialInterests, getTrack(initialTrack))
  );
  const [showResults, setShowResults] = useState(
    () =>
      initialShowResults &&
      decodeInterests(initialInterests, getTrack(initialTrack)).length > 0
  );

  /* 화면에는 한 단계만 보인다. 결과를 본 뒤에도 계열 카드와 칩 14개가 위에 남아 있으면
     모바일에서 결과를 다시 보려고 그걸 매번 스크롤해 지나야 한다. */
  const step: 1 | 2 | 3 = !track ? 1 : showResults ? 3 : 2;
  const prevStep = useRef(step);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (trackId) sp.set("track", trackId);
    if (selected.length) sp.set("i", encodeInterests(selected));
    if (showResults && selected.length) sp.set("r", "1");
    const qs = sp.toString();
    const url = qs ? `/career?${qs}` : "/career";

    /* 단계가 바뀔 때만 히스토리를 쌓아서 브라우저 뒤로가기가 이전 단계로 가게 한다.
       칩을 켜고 끄는 건 replace라 뒤로가기 한 번에 칩 하나씩 되돌아가는 일이 없다. */
    if (prevStep.current !== step) {
      prevStep.current = step;
      router.push(url, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.replace(url, { scroll: false });
    }
  }, [trackId, selected, showResults, step, router]);

  /* 평소엔 state가 주인이고 URL이 따라가지만, 브라우저 뒤로/앞으로가기는 URL이 먼저 바뀐다.
     그때 state를 URL에 맞춰주지 않으면 주소만 이전 단계로 가고 화면은 그대로 남는다.
     prevStep도 함께 맞춰야 위의 동기화 effect가 push를 한 번 더 해서 히스토리를 꼬지 않는다. */
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("track");
      const nextTrack = getTrack(t);
      const ints = decodeInterests(sp.get("i"), nextTrack);
      const r = sp.get("r") === "1" && ints.length > 0;
      prevStep.current = !nextTrack ? 1 : r ? 3 : 2;
      setTrackId(t);
      setSelected(ints);
      setShowResults(r);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const matches = useMemo(
    () => (track && showResults ? matchDepartments(track, selected) : []),
    [track, selected, showResults]
  );

  /* 카드 안 설명을 문장 단위로 끊을지 판단하려면 한 줄에 몇 글자가 들어가는지 알아야 한다.
     화면 폭을 가정하지 않고 결과 영역을 직접 재서, 320px 기기든 데스크톱이든 같은 규칙이 돌게 한다.
     카드 안쪽 폭 = 결과 영역 폭 − 좌우 패딩(16×2) − 테두리(1×2). */
  const resultsRef = useRef<HTMLElement | null>(null);
  const [cardTextWidth, setCardTextWidth] = useState(0);
  useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) =>
      setCardTextWidth(Math.max(0, entry.contentRect.width - 34))
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  const trackInterests = useMemo(() => (track ? interestsForTrack(track) : []), [track]);

  const selectedLabels = useMemo(() => {
    const byId = new Map(trackInterests.map((i) => [i.id, i.label]));
    return selected.map((id) => byId.get(id)).filter((l): l is string => Boolean(l));
  }, [trackInterests, selected]);

  function selectTrack(id: string) {
    setTrackId(id);
    /* 계열이 바뀌면 관심사 id 체계가 달라지므로 그 계열에 없는 선택은 버린다.
       단계 바를 눌러 1단계로 돌아갔다가 같은 계열을 다시 고른 경우엔 고른 관심사가 그대로 살아남는다
       (단계 바가 눌리게 되면서 실수로 1단계로 가는 일이 생겼는데, 그때마다 처음부터 고르게 할 이유는 없다). */
    setSelected((prev) => decodeInterests(prev.join(","), getTrack(id)));
    setShowResults(false);
    trackToolEvent("career", "start", { track: id });
  }

  function toggleInterest(id: string) {
    // 함수형 업데이트 — 연속 클릭에서도 직전 선택을 잃지 않는다
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  /* 이미 지난 단계로만 이동한다. 앞 단계로 건너뛰면 계열·관심사가 빈 채로 결과가 나온다. */
  function goToStep(n: 1 | 2 | 3) {
    if (n >= step) return;
    if (n === 1) {
      setTrackId(null);
      setShowResults(false);
    } else if (n === 2) {
      setShowResults(false);
    }
  }

  function goBack() {
    goToStep((step - 1) as 1 | 2);
  }

  function seeResults() {
    if (!track) return;
    setShowResults(true);
    trackToolEvent("career", "complete", {
      track: track.id,
      interest_count: selected.length,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* 1단계에서만 전체 히어로를 보여준다. 도구를 쓰는 중에 설명이 화면 위쪽을 계속 차지하면
          정작 결과가 아래로 밀린다(내신 계산기에서 같은 문제를 정리한 적이 있다). */}
      {step === 1 ? (
        <div className="mb-6">
          <p className="text-sm font-semibold text-[#5a7d50] mb-2">진로 탐구</p>
          {/* 어떤 학과가 있는지 모르는 채로 오는 학생이 자기 속말로 읽을 수 있게 의문형으로 둔다 */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#365927] leading-tight tracking-tight break-keep">
            내가 좋아하는 건 이런 건데, <br className="sm:hidden" />
            <span className="text-[#4a7a38]">어떤 학과</span>에 가면 좋을까?
          </h1>
        </div>
      ) : (
        <h1 className="text-lg font-bold text-[#365927] mb-4">진로 탐구</h1>
      )}

      <StepBar step={step} onJump={goToStep} />

      {step > 1 && (
        <button
          type="button"
          onClick={goBack}
          /* 원래는 글자만 있어서 배경에 묻혔다. 테두리+흰 배경으로 버튼임을 드러내고,
             모바일 터치 영역을 44px로 맞춘다(무료 자료 CTA에서 쓴 기준과 같다). */
          className="mb-4 inline-flex items-center gap-1 min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#d6e4d3] bg-white text-sm font-medium text-[#365927] shadow-sm hover:border-[#8aab82] hover:bg-[#f2f7f0] transition"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
          {step === 3 ? "관심사 다시 고르기" : "계열 다시 고르기"}
        </button>
      )}

      {/* ── 1단계: 계열 ── */}
      {step === 1 && (
      <section className="mb-6">
        <p className="text-sm font-medium text-[#365927] mb-2">어느 쪽이 더 끌리나요?</p>
        {/* 예체능이 3번째 계열로 들어오면서 2열 → 3열. 모바일은 세로로 쌓인다 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TRACKS.map((t) => {
            const active = track?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectTrack(t.id)}
                className={`text-left rounded-lg border px-4 py-4 transition ${
                  active
                    ? "border-[#5a7d50] bg-[#eef5ec] ring-2 ring-[#d6e4d3]"
                    : "border-[#d6e4d3] bg-white hover:border-[#8aab82]"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {t.emoji}
                </span>
                <p className="font-semibold text-[#365927] mt-1.5">{t.label}</p>
                <p className="text-xs text-[#5a7d50] mt-0.5 break-keep">{t.keywords}</p>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* ── 2단계: 관심사 ── */}
      {step === 2 && track && (
        <section className="mb-6">
          <p className="text-sm font-medium text-[#365927] mb-1">
            평소에 뭘 좋아해요?
          </p>
          {/* 많이 고를수록 결과가 넓어진다(OR 합집합). 예전 문구는 많이 고르도록 유도해서
              실제 동작과 반대였다 — 실측으로 상위권이 잘 잡히는 3~5개를 권한다. */}
          <p className="text-xs text-[#8aab82] mb-3">3~5개쯤 고르면 결과가 가장 잘 좁혀져요.</p>
          <div className="flex flex-wrap gap-2">
            {trackInterests.map((interest) => {
              const active = selected.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-2 text-sm transition ${
                    active
                      ? "border-[#5a7d50] bg-[#365927] text-white"
                      : "border-[#d6e4d3] bg-white text-[#5a7d50] hover:border-[#8aab82]"
                  }`}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>

          {/* py-3 = 44px. 유입의 84%가 모바일이라 터치 타깃 권장치를 맞춘다. */}
          <button
            onClick={seeResults}
            disabled={selected.length === 0}
            className="mt-5 w-full sm:w-auto text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] disabled:opacity-40 disabled:hover:bg-[#365927] rounded-full px-6 py-3 transition"
          >
            {selected.length === 0 ? "학과 찾아보기 →" : `학과 찾아보기 (${selected.length}개 선택) →`}
          </button>
        </section>
      )}

      {/* ── 3단계: 결과 ── */}
      {step === 3 && track && (
        <section ref={resultsRef}>
          <div className="flex items-center justify-between gap-3 mb-1">
            {/* "잘 맞아요"라고 단정하지 않는다 — 관심사가 겹친다는 것 이상은 말할 수 없다 */}
            <h2 className="text-lg font-bold text-[#365927]">
              관심사가 겹치는 학과예요
            </h2>
            <span className="shrink-0 text-xs text-[#5a7d50] bg-[#eef5ec] border border-[#d6e4d3] rounded-full px-2.5 py-1">
              {matches.length}개
            </span>
          </div>
          <p className="text-xs text-[#8aab82] mb-3 break-keep">
            학과 소개와 진로는 일반적인 설명이라 참고용으로 봐주세요.
          </p>

          {/* 칩 화면을 떠나왔으므로 무엇을 골랐는지 여기서 다시 보여준다 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <span className="text-xs text-[#8aab82]">{TRACK_LABELS[track.id]} ·</span>
            {selectedLabels.map((label) => (
              <span
                key={label}
                className="text-[11px] text-[#4a6b40] bg-[#eef5ec] border border-[#d6e4d3] rounded-full px-2 py-0.5"
              >
                {label}
              </span>
            ))}
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-[#5a7d50] py-8 text-center">
              겹치는 학과를 찾지 못했어요. 관심사를 조금 더 골라보세요.
            </p>
          ) : (
            <>
              <div className="space-y-2.5">
                {matches.slice(0, VISIBLE_LIMIT).map((m) => (
                  <ResultCard
                    key={m.dept.name}
                    dept={m.dept}
                    matchedLabels={m.matched.map((i) => i.label)}
                    lineWidth={cardTextWidth}
                  />
                ))}
              </div>

              {/* 관심사를 여러 개 고르면 겹치는 학과가 20~30개까지 나온다(합집합이라 필연).
                  많이 겹친 순으로 정렬돼 있으니 앞쪽만 펴두고 나머지는 접는다.
                  **지우지 않고 접는 이유**: 이 도구의 목적이 몰랐던 학과를 만나는 것이라
                  꼬리 쪽에 그 사람의 학과가 있을 수 있다.
                  ⚠️ 문구에 "덜 겹치는"이라 쓰지 말 것 — 관심사를 1개만 고르면 결과가 전부
                  matchCount 1이라 접힌 쪽도 똑같이 겹친 것이고, 2순위 정렬(학과 키워드 대비
                  비율)은 사용자의 겹침 정도가 아니라 학과 쪽 키워드 폭을 반영한다. */}
              {matches.length > VISIBLE_LIMIT && (
                <details
                  className="group mt-2.5"
                  onToggle={(e) => {
                    if ((e.currentTarget as HTMLDetailsElement).open) {
                      trackEvent("career_more_open", {
                        hidden_count: matches.length - VISIBLE_LIMIT,
                      });
                    }
                  }}
                >
                  <summary
                    className={`${DETAILS_SUMMARY} justify-center text-[#5a7d50] rounded-lg border border-[#d6e4d3] bg-white px-4 py-3 hover:border-[#8aab82]`}
                  >
                    <ChevronRight className={`${DETAILS_CHEVRON} text-[#8aab82]`} aria-hidden />
                    나머지 학과 {matches.length - VISIBLE_LIMIT}개 더 보기
                  </summary>
                  <div className="space-y-2.5 mt-2.5">
                    {matches.slice(VISIBLE_LIMIT).map((m) => (
                      <ResultCard
                        key={m.dept.name}
                        dept={m.dept}
                        matchedLabels={m.matched.map((i) => i.label)}
                        lineWidth={cardTextWidth}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => setShowResults(false)}
              className="text-sm font-medium text-[#5a7d50] border border-[#d6e4d3] bg-white hover:border-[#8aab82] rounded-full px-5 py-3 transition"
            >
              다시 고르기
            </button>
          </div>

          {/* 결과 화면의 주 액션은 자료 CTA 하나로 유지한다(도구 교차링크는 그 아래 약한 링크). */}
          <div className="mt-5 rounded-lg border border-[#e6ece4] border-l-4 border-l-[#5a7d50] bg-white shadow-sm px-4 py-4">
            <p className="text-sm font-medium text-[#365927] break-keep">
              가고 싶은 학과가 보이면, 준비에 참고할 자료도 있어요.
            </p>
            <p className="text-xs text-[#4a6b40] mt-1 break-keep">
              선배들이 만든 자료 중 <b className="text-[#5a7d50]">무료로 받을 수 있는 것</b>만 모아뒀어요.
              <br className="sm:hidden" />
              부담 없이 둘러보세요.
            </p>
            <Link
              href="/?category=고등"
              onClick={() => trackToolEvent("career", "cta_click", { track: track.id, target: "free" })}
              className="inline-block mt-3 text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-5 py-3 transition"
            >
              무료 자료 둘러보기 →
            </Link>
          </div>

          <ToolCrossLinks currentSlug="career" />
        </section>
      )}
    </div>
  );
}

const STEP_LABELS = ["계열 선택", "관심사 선택", "학과 결과"];

function StepBar({
  step,
  onJump,
}: {
  step: 1 | 2 | 3;
  onJump: (n: 1 | 2 | 3) => void;
}) {
  return (
    <ol className="flex items-center gap-2 mb-5" aria-label="진행 단계">
      {STEP_LABELS.map((label, idx) => {
        const n = (idx + 1) as 1 | 2 | 3;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        /* 지나온 단계만 누를 수 있다. 아직 안 지난 단계는 누를 게 없으므로 버튼으로 만들지 않는다
           — 눌러도 아무 일이 없는 버튼이 있으면 고장으로 읽힌다. */
        const clickable = state === "done";

        const inner = (
          <>
            <span
              className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[10px] font-semibold transition ${
                state === "current"
                  ? "border-[#365927] bg-[#365927] text-white"
                  : state === "done"
                    ? "border-[#8aab82] bg-[#eef5ec] text-[#5a7d50] group-hover:border-[#365927] group-hover:bg-[#d6e4d3] group-hover:text-[#365927]"
                    : "border-[#d6e4d3] bg-white text-[#b7c9b2]"
              }`}
            >
              {state === "done" ? "✓" : n}
            </span>
            {/* 단계 이름은 모바일에서 현재 단계만 보여준다. 3개를 다 쓰면 390px에서 줄이 넘친다.
                단 지나온 단계는 눌러서 돌아갈 수 있으니 좁은 화면에서도 이름을 남긴다. */}
            <span className={state === "todo" ? "hidden sm:inline" : ""}>{label}</span>
          </>
        );

        const base = `flex items-center gap-1.5 text-xs whitespace-nowrap ${
          state === "current"
            ? "text-[#365927] font-semibold"
            : state === "done"
              ? "text-[#5a7d50]"
              : "text-[#b7c9b2]"
        }`;

        return (
          <li key={label} className="flex items-center gap-2">
            {clickable ? (
              <button
                type="button"
                onClick={() => onJump(n)}
                aria-label={`${label} 단계로 돌아가기`}
                className={`${base} group -mx-1 px-1 py-1.5 rounded-md hover:text-[#365927] hover:bg-[#eef5ec] transition cursor-pointer`}
              >
                {inner}
              </button>
            ) : (
              <span
                className={`${base} py-1.5`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {inner}
              </span>
            )}
            {n < STEP_LABELS.length && (
              <span className="w-4 h-px bg-[#d6e4d3] shrink-0" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultCard({
  dept,
  matchedLabels,
  lineWidth,
}: {
  dept: CareerDepartment;
  matchedLabels: string[];
  /** 카드 안쪽 실측 폭 — 설명을 문장 단위로 끊어도 줄이 안 늘어나는지 판단하는 데 쓴다 */
  lineWidth: number;
}) {
  const [opened, setOpened] = useState(false);

  return (
    /* 원본은 모달을 썼지만 인라인 확장으로 바꿨다. 모바일에서 모달은 스크롤이 잠기고
       뒤로가기 동작이 어긋나는데, 사용자의 84%가 모바일이다. */
    <details
      className="group rounded-lg border border-[#d6e4d3] bg-white px-4 py-3.5"
      onToggle={(e) => {
        const open = (e.currentTarget as HTMLDetailsElement).open;
        if (open && !opened) {
          setOpened(true);
          // 4단계 규칙(start/complete/cta_click/share)은 깔때기용이라 상세 열람은 별도 이름으로 둔다
          trackEvent("career_detail_open", { department: dept.name });
        }
      }}
    >
      <summary className={DETAILS_SUMMARY}>
        <ChevronRight className={`${DETAILS_CHEVRON} text-[#8aab82]`} aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg" aria-hidden>
              {dept.emoji}
            </span>
            <span className="font-semibold text-[#365927]">{dept.name}</span>
          </span>
          {/* 왜 이 학과가 나왔는지를 숫자가 아니라 겹친 관심사로 그대로 보여준다 */}
          <span className="mt-1.5 flex flex-wrap gap-1">
            {matchedLabels.map((label) => (
              <span
                key={label}
                className="text-[11px] text-[#4a6b40] bg-[#f5f9f4] border border-[#e6ece4] rounded-full px-2 py-0.5"
              >
                {label}
              </span>
            ))}
          </span>
        </span>
      </summary>

      <div className="mt-3 pt-3 border-t border-[#e6ece4] space-y-3">
        <p className="text-sm text-[#4a6b40] leading-relaxed break-keep">
          <Sentences text={dept.desc} lineWidth={lineWidth} />
        </p>

        <div>
          <SectionLabel>졸업 후 진로</SectionLabel>
          <ul className="space-y-0.5">
            {dept.jobs.map((job) => (
              <li key={job} className="text-sm text-[#4a6b40] flex gap-1.5">
                <span className="text-[#8aab82]" aria-hidden>
                  •
                </span>
                <span className="break-keep">{job}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 진로 목록 바로 아래에 조건을 한 번만 붙인다. 항목마다 "(면허 필요)"를 달면
            의료 계열은 괄호투성이가 되고, 중학생이 읽기 어려워진다.
            주의를 끌어야 하는 정보라 주의색(앰버)을 쓰되, 결과 카드 자체는 초록 톤을 유지한다. */}
        {dept.license && (
          <div className="rounded-lg border border-[#f0dca0] bg-[#fff8e6] px-3 py-2.5">
            <p className="text-[13px] text-[#7a5c1e] leading-relaxed break-keep">
              {dept.license}
            </p>
          </div>
        )}

        <div>
          <SectionLabel>이런 학생에게 맞아요</SectionLabel>
          <ul className="space-y-0.5">
            {dept.fit.map((f) => (
              <li key={f} className="text-sm text-[#4a6b40] flex gap-1.5">
                <span className="text-[#8aab82]" aria-hidden>
                  •
                </span>
                <span className="break-keep">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-1">
          {dept.tags.map((t) => (
            <span
              key={t}
              className="text-[11px] text-[#5a7d50] bg-[#f5f9f4] border border-[#e6ece4] rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>

        {/* 내신 계산기에 대응 학과가 있을 때만. 문구에는 넘어갈 학과 이름을 그대로 써서
            (생명공학 → 생명과학처럼) 같은 학과인 것처럼 읽히지 않게 한다. */}
        {dept.naeshinDept && (
          <Link
            href={`/naeshin?department=${encodeURIComponent(dept.naeshinDept)}`}
            onClick={() =>
              trackToolEvent("career", "cta_click", {
                department: dept.name,
                target: "naeshin",
              })
            }
            className="inline-block text-sm font-medium text-[#365927] underline underline-offset-2 hover:text-[#4a7a38]"
          >
            {dept.naeshinDept} 등급컷 보러 가기 →
          </Link>
        )}
      </div>
    </details>
  );
}
