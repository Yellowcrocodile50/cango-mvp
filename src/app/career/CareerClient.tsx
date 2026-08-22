"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  departments,
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

/* 찜은 사이트 전체 초록톤에서 일부러 벗어난다 — 결과 카드 안에서 같은 초록으로 두면
   설명글과 구분이 안 돼 눌러야 할 것으로 안 읽힌다. 하트와 함께 쓰는 관습색으로 잡았다. */
const WISH_BG = "bg-[#fdf2f6]";
const WISH_BORDER = "border-[#f0cdd9]";
const WISH_TEXT = "text-[#8a4159]";
const WISH_STRONG = "text-[#b03a5b]";

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

/** 결과 카드의 관심 학과 찜 상태와 동작 */
type WishApi = {
  /** 이미 찜한 학과 이름. `undefined`면 아직 조회 중이라 버튼을 내보내지 않는다 */
  wished: Set<string> | undefined;
  /** 지금 서버에 반영 중인 학과 이름 */
  pending: string | null;
  onToggle: (department: string) => void;
};

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
  initialWish,
}: {
  /* 초기값은 서버에서 읽어 내려온다 — 클라이언트에서 읽으면 정적 HTML이 비어버린다(page.tsx 주석) */
  initialTrack: string | null;
  initialInterests: string | null;
  initialShowResults: boolean;
  /** 로그인하러 나갔다 돌아온 사람이 담으려던 학과(`?wish=`) */
  initialWish: string | null;
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

  /* ── 관심 학과 찜 ────────────────────────────────────────────────────
     진로 탐구 학과 99개 중 내신 계산기에 대응 학과가 있는 건 32개뿐이다.
     나머지 67개는 결과 카드까지 온 사람 앞에서 통로가 끊긴다 — 거기에 찜을 둔다.

     📌 **"알림 받기"가 아니라 "찜"으로 만든 이유**: 알림 신청은 누르는 값이 싸서
     학생이 뭔지도 모르고 카드마다 눌러버릴 수 있다. 그러면 "어느 학과부터 만들까"라는
     이 기능의 유일한 산출물이 오염된다. 그래서 ① **자기 관심 학과를 고른다**는 뜻이 드러나는
     말로 바꾸고 ② **찜한 목록을 항상 보이게** 하고 ③ **해제할 수 있게** 했다.

     ⚠️ **개수 제한은 일부러 두지 않는다**(2026-08-22 결정). 막는 것 자체가 거부감을 준다는
     판단으로, 남발은 감수하고 위의 세 장치로만 신호를 지킨다. 되돌릴 땐 이 주석부터 볼 것.

     ⚠️ **결과를 보기 전에는 로그인을 요구하지 않는다.** 이 도구에서 지금 유일하게 잘 도는 지표가
     완주율(2026-08-18~22 실측 18명 중 17명)이라, 그 앞에 벽을 세우면 그것부터 무너진다.
     찜 버튼은 결과 카드를 **펼친 뒤에만** 나온다. */
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  /* undefined = 아직 확인 중. 확인 전에 "찜하기"를 보여주면 이미 찜한 학과에도 그게 떠서
     화면이 거짓말을 하게 된다. */
  const [wishlist, setWishlist] = useState<Set<string> | undefined>(undefined);
  const [wishPending, setWishPending] = useState<string | null>(null);
  const [loginRedirect, setLoginRedirect] = useState<string | null>(null);
  /* `?wish=` 자동 담기는 마운트당 한 번만. dev StrictMode가 effect를 두 번 돌려
     두 번째 INSERT가 유니크 인덱스에 막히는데(409), 유니크 인덱스가 막아주긴 해도
     콘솔에 에러가 남고 토스트 타이밍이 어긋난다. */
  const wishApplied = useRef(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setWishlist(new Set());
        return;
      }
      setUserId(user.id);
      /* 본인 행만 읽는다(RLS 정책 `users can view their own requests`).
         기존 SELECT 정책은 공급자 전용이라 신청자 본인도 자기 찜 목록을 못 읽었다. */
      const { data } = await supabase
        .from("naeshin_requests")
        .select("department")
        .eq("user_id", user.id)
        .not("department", "is", null)
        .order("created_at", { ascending: true });
      const set = new Set((data ?? []).map((r) => r.department as string));

      /* 로그인하러 나갔다 돌아온 경우, 담으려던 학과를 대신 담아준다.
         빈손으로 돌아오면 카드를 다시 찾아 다시 펼쳐 다시 눌러야 하는데,
         이 기능의 목적이 로그인 유도라 **로그인 직후**가 가장 아까운 이탈 지점이다.

         ⚠️ `?wish=`를 그대로 믿지 않는다 — 주소는 누구나 만들 수 있다.
         실제로 있는 학과이면서 아직 계산기에 없는 학과일 때만 담는다. */
      const wishable =
        initialWish &&
        !wishApplied.current &&
        !set.has(initialWish) &&
        departments.some((d) => d.name === initialWish && !d.naeshinDept);

      if (wishable) {
        wishApplied.current = true;
        const { error } = await supabase.from("naeshin_requests").insert({
          user_id: user.id,
          department: initialWish,
          content: `[진로 탐구] ${initialWish} 찜 · 등급컷 준비되면 알림`,
        });
        /* 23505 = 이미 담긴 학과(다른 기기에서 담았을 때). 실패로 알릴 일이 아니다. */
        if (!error || error.code === "23505") {
          set.add(initialWish);
          if (!error) {
            toast.success("찜했어요. 준비되면 알려드릴게요.");
            trackEvent("career_wish_add", {
              department: initialWish,
              track: initialTrack ?? "",
              from: "login_return",
            });
          }
        }
      }

      setWishlist(set);
    })();
  }, [initialWish, initialTrack]);

  async function handleWishToggle(department: string) {
    if (!userId) {
      /* 결과를 잃지 않고 돌아오도록 지금 URL(계열·관심사·결과 표시까지)을 그대로 들려 보내고,
         담으려던 학과를 `wish`로 얹어 돌아온 직후 자동으로 담기게 한다.
         ⚠️ `wish`는 위의 URL 동기화 effect가 만드는 주소에는 절대 들어가지 않는다 —
         결과 링크 공유가 이 도구의 핵심 자산이라, 공유받은 사람 계정에 담기면 안 된다. */
      const sp = new URLSearchParams(window.location.search);
      sp.set("wish", department);
      setLoginRedirect(`/career?${sp.toString()}`);
      /* 이 기능의 목적이 로그인 유도인데, 시도 대비 성공을 못 보면 개선 전후를 비교할 수 없다 */
      trackEvent("career_wish_login_prompt", { department, track: track?.id ?? "" });
      return;
    }
    const already = wishlist?.has(department) ?? false;

    setWishPending(department);
    if (already) {
      const { error } = await supabase
        .from("naeshin_requests")
        .delete()
        .eq("user_id", userId)
        .eq("department", department);
      setWishPending(null);
      if (error) {
        toast.error("찜 해제에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setWishlist((prev) => {
        const next = new Set(prev ?? []);
        next.delete(department);
        return next;
      });
      trackEvent("career_wish_remove", { department, track: track?.id ?? "", from: "career" });
      return;
    }

    /* content를 비울 수 없다 — INSERT 정책이 `char_length(content) > 0`을 검사한다.
       공급자 대시보드에서 자유 문의와 한 표에 섞여 보이므로 사람이 읽을 문장으로 넣는다. */
    const { error } = await supabase.from("naeshin_requests").insert({
      user_id: userId,
      department,
      content: `[진로 탐구] ${department} 찜 · 등급컷 준비되면 알림`,
    });
    setWishPending(null);

    /* 23505 = 부분 유니크 인덱스 충돌 = 이미 찜한 학과. 실패로 알릴 일이 아니다
       (다른 기기에서 담았거나 목록을 읽기 전에 눌렀을 때 난다). */
    if (error && error.code !== "23505") {
      toast.error("찜하기에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setWishlist((prev) => new Set(prev ?? []).add(department));
    if (error) return;
    toast.success("찜했어요. 준비되면 알려드릴게요.");
    trackEvent("career_wish_add", { department, track: track?.id ?? "" });
  }

  /* 카드마다 프롭 3개를 늘리지 않으려고 묶어서 내린다. ResultCard는 memo가 아니라 매번 새로 만들어도 된다. */
  const wishApi: WishApi = {
    wished: wishlist,
    pending: wishPending,
    onToggle: handleWishToggle,
  };

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

      {/* 단계 화면 바깥이라 계열을 다시 고르러 가도 사라지지 않는다.
          찜은 계열과 무관한 계정 단위 목록이므로 항상 같은 자리에 있어야 한다. */}
      <WishPanel wishes={wishApi} />

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
                    wishes={wishApi}
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
                        wishes={wishApi}
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

          {/* 머리말에 있던 고지를 여기로 내렸다. 결과를 다 읽은 뒤에 보는 게 맞고,
              머리말 자리는 찜 패널이 쓰는 게 낫다(careerDepartments.ts: 참고용임을 계속 밝힐 것). */}
          <p className="mt-4 text-xs text-[#8aab82] break-keep">
            학과 소개와 진로는 일반적인 설명이라 참고용으로 봐주세요.
          </p>

          <ToolCrossLinks currentSlug="career" />
        </section>
      )}

      {/* 모달 뼈대는 내신 계산기 요청 폼과 같게 둔다 — 도구마다 생김새가 다르면
          같은 사이트로 안 읽힌다. 문구만 찜에 맞게 따로 쓴다. */}
      {loginRedirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-[#365927] mb-3">로그인이 필요합니다!</h2>
            {/* 알림 수단은 적지 않는다(메일일 수도, 번호일 수도) */}
            <p className="text-[#5a7d50] text-xs mb-6">
              찜한 학과의 업데이트 소식을 알려드릴게요.
            </p>
            <div className="space-y-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
                onClick={() => setLoginRedirect(null)}
                className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
              >
                로그인하기
              </Link>
              <button
                onClick={() => setLoginRedirect(null)}
                className="w-full h-12 border border-[#d6e4d3] text-[#5a7d50] rounded-lg font-medium hover:bg-[#f5f9f4] transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
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
  wishes,
}: {
  dept: CareerDepartment;
  matchedLabels: string[];
  /** 카드 안쪽 실측 폭 — 설명을 문장 단위로 끊어도 줄이 안 늘어나는지 판단하는 데 쓴다 */
  lineWidth: number;
  wishes: WishApi;
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
        {dept.naeshinDept ? (
          <Link
            href={`/naeshin?department=${encodeURIComponent(dept.naeshinDept)}`}
            onClick={() =>
              trackToolEvent("career", "cta_click", {
                department: dept.name,
                target: "naeshin",
              })
            }
            /* 원래는 밑줄 글자였는데 카드 본문에 묻혀 안 눌렸다(tool_cross_link 5일간 6명).
               결과 화면의 다른 주 액션들과 같은 알약 버튼 모양으로 올린다. */
            className="inline-flex items-center min-h-[44px] px-4 py-2.5 rounded-full bg-[#365927] text-white text-sm font-bold shadow-sm hover:bg-[#4a7a38] transition"
          >
            {dept.naeshinDept} 등급컷 보러 가기 →
          </Link>
        ) : (
          /* 대응 학과가 없을 때 자리를 비워두면 "이 학과는 여기서 끝"이 된다.
             링크가 있던 자리에 그대로 두어, 카드마다 마지막 줄의 역할이 같게 유지한다. */
          <WishButton dept={dept.name} wishes={wishes} />
        )}
      </div>
    </details>
  );
}

/**
 * 내신 계산기에 아직 대응 학과가 없을 때, 그 학과를 관심 학과로 담아두는 자리.
 *
 * 📌 여기를 로그인 지점으로 고른 이유: 결과를 이미 본 사람에게만 보이고,
 * 링크 공유로는 대신할 수 없는 일(나중에 연락)이며, 수요가 이미 확인됐다
 * (`naeshin_requests`에 자유 문의로만 32명이 38건을 남겼다).
 *
 * 📌 문구가 "알림 받기"가 아니라 "찜"인 이유는 `handleWishToggle` 주석 참고 —
 * 이 버튼이 만드는 학과별 대기 인원이 "다음에 어느 학과를 넣을까"의 근거가 되므로,
 * 아무 생각 없이 눌러도 되는 버튼으로 보이면 안 된다.
 *
 * ⚠️ 알림 수단을 문구에 적지 않는다. 메일로 보낼 수도, 번호로 보낼 수도 있다.
 */
function WishButton({ dept, wishes }: { dept: string; wishes: WishApi }) {
  const done = wishes.wished?.has(dept) ?? false;
  const busy = wishes.pending === dept;

  return (
    <div className={`rounded-lg border ${WISH_BORDER} ${WISH_BG} px-3 py-2.5`}>
      <p className={`text-[13px] ${WISH_TEXT} break-keep`}>
        이 학과는 아직 내신 계산기에 업데이트가 안 됐어요.
        {/* 찜이 무엇을 하는 일인지 버튼을 누르기 전에 밝힌다 */}
        <span className={`block mt-0.5 ${WISH_STRONG}`}>
          가고 싶은 학과라면 찜해두세요. 준비되면 알려드릴게요.
        </span>
      </p>

      {/* 조회가 끝나기 전에는 버튼을 내보내지 않는다 — 이미 찜한 학과에 "찜하기"가
          떴다가 바뀌면 화면이 거짓말을 한 게 된다. */}
      {wishes.wished === undefined ? null : done ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#c2415f]">
            <Heart className="w-4 h-4 shrink-0 fill-current" aria-hidden />
            찜 완료!
          </span>
          {/* 잘못 담은 걸 되돌릴 수 없으면 "정말 가고 싶은 학과"라는 신호가 오염된다.
              글자 링크로 두면 눌 수 있는 것으로 안 읽혀서 버튼 모양으로 둔다. */}
          <button
            type="button"
            onClick={() => wishes.onToggle(dept)}
            disabled={busy}
            className={`inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full border ${WISH_BORDER} bg-white text-xs font-medium ${WISH_STRONG} hover:border-[#c2415f] disabled:opacity-60 transition cursor-pointer`}
          >
            {busy ? "해제하는 중..." : "찜 해제"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => wishes.onToggle(dept)}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full bg-[#c2415f] text-white text-sm font-bold shadow-sm hover:bg-[#a83552] disabled:opacity-60 transition cursor-pointer"
        >
          <Heart className="w-4 h-4 shrink-0" aria-hidden />
          {busy ? "담는 중..." : "관련 학과 찜하기!"}
        </button>
      )}
    </div>
  );
}

/**
 * 찜한 학과 목록. **단계 화면 바깥**에 두어 계열·관심사를 다시 고르러 가도 남는다.
 *
 * 📌 찜은 계정에 붙고 화면 상태(계열·관심사)는 URL에 붙는다 — 서로 건드리지 않으므로
 * 동기화할 게 없다. 문과에서 담은 학과는 이과 화면에서도 그대로 이 목록에 있다.
 *
 * 📌 평소엔 접힌 한 줄로 둔다. 펼친 채로 두면 1단계 계열 카드를 아래로 밀어내는데,
 * 첫 입력까지의 거리를 늘리는 게 이 도구에서 제일 비싼 실수다.
 */
function WishPanel({ wishes }: { wishes: WishApi }) {
  const names = [...(wishes.wished ?? [])];
  /* 하나도 안 담은 사람에게는 아직 없는 개념이라 줄 자체를 만들지 않는다 */
  if (names.length === 0) return null;

  return (
    <details className={`group mb-4 rounded-lg border ${WISH_BORDER} ${WISH_BG}`}>
      <summary
        className={`flex items-center gap-1.5 min-h-[44px] px-3.5 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-bold ${WISH_STRONG}`}
      >
        <ChevronRight className={`${DETAILS_CHEVRON} text-[#c2415f]`} aria-hidden />
        <Heart className="w-4 h-4 shrink-0 fill-current text-[#c2415f]" aria-hidden />
        찜한 학과 {names.length}개
      </summary>

      <div className="px-3.5 pb-3.5 space-y-2">
        {names.map((name) => {
          /* 찜할 땐 계산기에 없던 학과라도, 나중에 데이터가 채워지면 여기가 저절로
             링크로 바뀐다. 발송 기능이 생기기 전까지 이게 유일한 회수 경로다. */
          const naeshinDept = departments.find((d) => d.name === name)?.naeshinDept;
          const busy = wishes.pending === name;

          return (
            <div
              key={name}
              className={`flex flex-wrap items-center gap-2 rounded-lg border ${WISH_BORDER} bg-white px-3 py-2.5`}
            >
              <span className={`flex-1 min-w-0 text-sm font-medium ${WISH_TEXT} break-keep`}>
                {name}
              </span>

              {naeshinDept ? (
                <Link
                  href={`/naeshin?department=${encodeURIComponent(naeshinDept)}`}
                  onClick={() =>
                    trackToolEvent("career", "cta_click", { department: name, target: "naeshin" })
                  }
                  className="inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full bg-[#365927] text-white text-xs font-bold hover:bg-[#4a7a38] transition"
                >
                  등급컷 보러 가기 →
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() => wishes.onToggle(name)}
                disabled={busy}
                className={`inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full border ${WISH_BORDER} bg-white text-xs font-medium ${WISH_STRONG} hover:border-[#c2415f] disabled:opacity-60 transition cursor-pointer`}
              >
                {busy ? "해제하는 중..." : "찜 해제"}
              </button>
            </div>
          );
        })}
      </div>
    </details>
  );
}
