"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/ga";
import ToolCrossLinks from "@/components/ToolCrossLinks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  naeshinCutoffs,
  type AltCutoff,
  type DeptCutoff,
  type NaeshinDepartment,
  type UniversityCutoffs,
} from "@/data/naeshinCutoffs";
import {
  calculateNaeshinResultFromCutoff,
  type GradeSystem,
  type NaeshinResult,
} from "@/lib/naeshinCalculator";
import { convertGrade9to5, convertGrade5to9 } from "@/lib/gradeConversion";

const TRACKS: { label: string; departments: NaeshinDepartment[] }[] = [
  { label: "메디컬", departments: ["의예과", "치의예과", "한의예과", "약학과", "수의예과"] },
  { label: "보건", departments: ["간호학과", "보건계열"] },
  { label: "공대", departments: ["컴퓨터공학과", "전자전기공학과", "기계공학과"] },
  { label: "건축", departments: ["건축계열"] },
  { label: "자연", departments: ["화학과", "생명과학과"] },
  { label: "상경", departments: ["경영학과"] },
  { label: "사회", departments: ["미디어커뮤니케이션학과", "정치외교학과", "심리학과", "행정학과"] },
  { label: "법학", departments: ["법학과"] },
  { label: "사범대", departments: ["교육학과", "국어교육과", "영어교육과", "사회·윤리교육과"] },
  { label: "인문/어문", departments: ["국어국문학과", "영어영문학과", "중어중문학과", "일어일문학과"] },
];

const SEMESTER_LABELS = ["1학년 1학기", "1학년 2학기", "2학년 1학기", "2학년 2학기", "3학년 1학기"];

/* 접이식 안내 상자 공통 스타일.
   접힌 설명끼리는 색으로 구분할 이유가 없어 흰 바탕으로 통일하고(페이지 바탕 #f5f9f4보다
   밝아서 면으로 떠오른다), 확인이 필요한 '예측 기준'만 주의색을 남긴다.
   브라우저 기본 ▶ 마커는 숨기고 직접 그린 화살표를 열림 상태에 맞춰 회전시킨다. */
const DETAILS_BOX = "rounded-lg border border-[#e6ece4] bg-white px-4 py-3";
const DETAILS_BOX_CAUTION = "rounded-lg border border-[#f0dca0] bg-[#fff8e6] px-4 py-3";
const DETAILS_BOX_INFO = "rounded-lg border border-[#c9d9f5] bg-[#f2f6fd] px-4 py-3";
const DETAILS_SUMMARY =
  "flex items-center gap-1.5 text-sm font-medium cursor-pointer list-none [&::-webkit-details-marker]:hidden";
const DETAILS_CHEVRON = "w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-90";

const TIERS = Array.from(new Set(naeshinCutoffs.map((u) => u.tier)));

const TIER_LABELS: Record<string, string> = {
  서연고: "서울/연세/고려",
  서성한: "서강/성균관/한양",
  중경외시이: "중앙/경희/외국어대학/서울시립/이화여자대학",
  건동홍숙: "건국/동국/홍익/숙명여자대학",
  국숭세단: "국민/숭실/세종/단국",
  광명상가과기대: "광운/명지/상명/가톨릭/과기대",
  인하아주: "인하/아주",
  인천가천경기: "인천/가천/경기",
  지거국: "지거국",
};

const UNAVAILABLE_MESSAGES: Record<Exclude<DeptCutoff["status"], "data">, string> = {
  no_department: "이 대학엔 해당 학과가 없어요.",
  no_quant_track: "이 학과는 학생부종합전형(학종)으로만 선발해서 교과 기준 예측이 어려워요.",
  merged_no_data: "학부 통합모집이라 학과별 데이터가 없어요.",
  no_data: "학과는 있지만 대학이 등급컷을 공개하지 않아 예측할 수 없어요.",
};

type CutoffRaw = {
  avg?: number;
  cut50?: number;
  cut70?: number;
  actualName?: string;
  admissionType?: "comprehensive";
  admissionName?: string;
  mergedUnit?: boolean;
  branchCampus?: string;
  /** 결과 카드에 노출되는 짧은 안내(지원자격 제한 등) — note는 내부 문서용이라 렌더링되지 않는다 */
  notice?: string;
  year?: 2025 | 2026;
  note?: string;
};

type UniversityResult =
  | { kind: "excluded"; university: string; reason: string }
  | { kind: "unavailable"; university: string; status: Exclude<DeptCutoff["status"], "data">; note?: string }
  | { kind: "result"; university: string; result: NaeshinResult; cutoffRaw: CutoffRaw };

/**
 * `?department=심리학과` 로 들어오면 그 학과가 선택된 상태로 연다.
 * 진로 탐구(/career) 결과에서 "○○학과 등급컷 보러 가기"로 넘어오는 경로가 이걸 쓴다.
 * 없거나 모르는 학과면 기본값을 그대로 쓴다.
 */
function resolveInitialSelection(raw: string | null): { track: string; department: NaeshinDepartment } {
  const fallback = { track: TRACKS[0].label, department: TRACKS[0].departments[0] };
  if (!raw) return fallback;
  const found = TRACKS.find((t) => t.departments.includes(raw as NaeshinDepartment));
  if (!found) return fallback;
  return { track: found.label, department: raw as NaeshinDepartment };
}

export default function NaeshinClient({
  initialDepartment,
}: {
  /** `?department=`로 미리 선택할 학과. 서버 페이지에서 읽어 넘겨준다 */
  initialDepartment: string | null;
}) {
  const [initial] = useState(() => resolveInitialSelection(initialDepartment));
  const [track, setTrack] = useState(initial.track);
  const [department, setDepartment] = useState<NaeshinDepartment>(initial.department);
  const [tier, setTier] = useState(TIERS[0]);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>("5");
  const [lastSemesterIndex, setLastSemesterIndex] = useState(1);
  const [grades, setGrades] = useState<string[]>(["", ""]);
  const [results, setResults] = useState<UniversityResult[] | null>(null);
  // 결과보기를 누른 시점의 입력 성적 스냅샷 (이후 입력이 바뀌어도 결과와 어긋나지 않도록 고정)
  const [enteredSummary, setEnteredSummary] = useState<{
    avg: number;
    converted: number;
    count: number;
    system: GradeSystem;
  } | null>(null);
  const [requestText, setRequestText] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [requestUser, setRequestUser] = useState<{
    id: string;
    userid: string;
    grade: string | null;
    marketingAgreed: boolean;
  } | null | undefined>(undefined); // undefined = 확인 중, null = 로그인 안 함

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setRequestUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("userid, grade, marketing_agreed")
        .eq("id", user.id)
        .single();
      setRequestUser({
        id: user.id,
        userid: profile?.userid ?? user.email ?? "",
        grade: profile?.grade ?? null,
        marketingAgreed: profile?.marketing_agreed ?? false,
      });
    })();
  }, []);

  async function handleRequestSubmit() {
    if (!requestUser) {
      setShowLoginModal(true);
      return;
    }
    const content = requestText.trim();
    if (!content) {
      toast.error("어떤 학교/학과가 궁금한지 적어주세요.");
      return;
    }
    setRequestSubmitting(true);
    const { error } = await supabase.from("naeshin_requests").insert({ content, user_id: requestUser.id });
    setRequestSubmitting(false);
    if (error) {
      toast.error("요청 접수에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setRequestText("");
    toast.success("요청 접수됐어요. 다음 업데이트 때 참고할게요.");
    trackEvent("naeshin_request_submit", { track, department, tier });
  }

  const scaleMax = gradeSystem === "9" ? 9 : 5;

  function handleGradeSystemChange(system: GradeSystem) {
    setGradeSystem(system);
    setGrades((prev) => prev.map(() => ""));
    setResults(null);
    setEnteredSummary(null);
  }

  const currentTrack = TRACKS.find((t) => t.label === track) ?? TRACKS[0];

  function handleTrackChange(label: string) {
    const next = TRACKS.find((t) => t.label === label);
    setTrack(label);
    if (next) setDepartment(next.departments[0]);
    setResults(null);
    setEnteredSummary(null);
  }

  function handleSemesterChange(index: number) {
    setLastSemesterIndex(index);
    setGrades((prev) => {
      const next = prev.slice(0, index + 1);
      while (next.length < index + 1) next.push("");
      return next;
    });
    setResults(null);
    setEnteredSummary(null);
  }

  function handleGradeChange(index: number, value: string) {
    setGrades((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit() {
    const parsedGrades = grades.map((g) => Number(g));
    if (parsedGrades.some((g) => !Number.isFinite(g) || g < 1 || g > scaleMax)) {
      alert(`모든 학기 성적을 1.0~${scaleMax}.0 사이 숫자로 입력해주세요.`);
      return;
    }

    function buildResultEntry(university: string, c: CutoffRaw & { cut80?: number }): UniversityResult {
      const result = calculateNaeshinResultFromCutoff(
        parsedGrades,
        { status: "data", year: 2026, confidence: "official", avg: c.avg, cut50: c.cut50, cut70: c.cut70, cut80: c.cut80 },
        gradeSystem
      );
      return {
        kind: "result",
        university,
        result,
        cutoffRaw: {
          avg: c.avg,
          cut50: c.cut50,
          cut70: c.cut70,
          actualName: c.actualName,
          admissionType: c.admissionType,
          admissionName: c.admissionName,
          mergedUnit: c.mergedUnit,
          branchCampus: c.branchCampus,
          notice: c.notice,
          year: c.year,
        },
      };
    }

    const universities: UniversityCutoffs[] = naeshinCutoffs.filter((u) => u.tier === tier);
    const computed: UniversityResult[] = universities.flatMap((u) => {
      // excludedReason은 대학 전체 기본값 — 해당 학과에 개별 항목이 있으면 그쪽이 우선
      // (서울대·한국외대는 교과전형이 없어 대학 단위로 제외돼 있지만, 학종 수치가 있는 학과는 개별 표시)
      const own = u.departments[department];
      if (u.excludedReason && !own) {
        return [{ kind: "excluded", university: u.university, reason: u.excludedReason }];
      }
      const cutoff = own ?? { status: "no_data" as const };
      if (cutoff.status !== "data") {
        return [{ kind: "unavailable", university: u.university, status: cutoff.status, note: cutoff.note }];
      }
      const primary = buildResultEntry(u.university, cutoff);
      const altEntries = (cutoff.alt ?? []).map((a: AltCutoff) => buildResultEntry(u.university, a));
      return [primary, ...altEntries];
    });

    const enteredAvg = parsedGrades.reduce((sum, g) => sum + g, 0) / parsedGrades.length;
    const convertToOther = gradeSystem === "9" ? convertGrade9to5 : convertGrade5to9;
    setEnteredSummary({
      avg: Math.round(enteredAvg * 100) / 100,
      converted: Math.round(convertToOther(enteredAvg) * 100) / 100,
      count: parsedGrades.length,
      system: gradeSystem,
    });

    setResults(computed);
    trackEvent("naeshin_calculate", {
      track,
      department,
      tier,
      grade_system: gradeSystem,
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#5a7d50] mb-2">내신 계산기</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#365927] leading-tight tracking-tight">
          가고 싶은 대학, <br className="sm:hidden" />
          <span className="text-[#4a7a38]">지금부터 몇 등급</span>이 필요할까?
        </h1>
        {/* break-keep: 한국어는 기본 줄바꿈이 단어 중간을 끊는다("계/산해드려요"). */}
        {/* "무엇이 아닌지"를 먼저 말해야 역산이 왜 다른지 전달된다 — 이 대비 문장은
            역산 컨셉을 차별점으로 잡은 기존 결정의 일부다. AI 티가 났던 건 문장이
            아니라 세 줄 연속 볼드였으므로, 문장은 두고 볼드만 하나로 줄인다. */}
        <p className="mt-3 text-base sm:text-lg text-[#4a6b40] leading-relaxed break-keep">
          내 성적을 매겨주는 계산기가 아니에요.
          <br />
          목표 대학에 맞춰
          <br className="sm:hidden" />{" "}
          <b className="text-[#365927]">남은 학기에 받아야 할 등급을 거꾸로</b> 계산해드려요.
        </p>
        <p className="mt-3 text-xs text-[#8aab82]">
          {TRACKS.reduce((n, t) => n + t.departments.length, 0)}개 학과 × {naeshinCutoffs.length}개 대학
          학생부교과전형 등급컷 기준 · 공개 자료를 바탕으로 한 예측이라 실제 입결과 다를 수 있어요.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">계열</label>
          <div className="flex flex-wrap gap-2">
            {TRACKS.map((t) => (
              <button
                key={t.label}
                onClick={() => handleTrackChange(t.label)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  track === t.label
                    ? "bg-[#365927] text-white border-[#365927]"
                    : "border-[#d6e4d3] text-[#5a7d50] hover:bg-[#eef5ec]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">학과</label>
          <div className="flex flex-wrap gap-2">
            {currentTrack.departments.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDepartment(d);
                  setResults(null);
                  setEnteredSummary(null);
                }}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  department === d
                    ? "bg-[#365927] text-white border-[#365927]"
                    : "border-[#d6e4d3] text-[#5a7d50] hover:bg-[#eef5ec]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">목표 대학 라인</label>
          <Select
            value={tier}
            onValueChange={(value) => {
              setTier(value as string);
              setResults(null);
              setEnteredSummary(null);
            }}
          >
            <SelectTrigger>
              <SelectValue>{(value: string) => TIER_LABELS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">
            성적이 있는 마지막 학기
          </label>
          <Select
            value={lastSemesterIndex}
            onValueChange={(value) => handleSemesterChange(value as number)}
          >
            <SelectTrigger>
              <SelectValue>{(value: number) => SEMESTER_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SEMESTER_LABELS.map((label, i) => (
                <SelectItem key={label} value={i}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">등급제</label>
          <div className="flex flex-wrap gap-2">
            {(["5", "9"] as GradeSystem[]).map((system) => (
              <button
                key={system}
                onClick={() => handleGradeSystemChange(system)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  gradeSystem === system
                    ? "bg-[#365927] text-white border-[#365927]"
                    : "border-[#d6e4d3] text-[#5a7d50] hover:bg-[#eef5ec]"
                }`}
              >
                {system}등급제
              </button>
            ))}
          </div>
          <p className="text-xs text-[#8aab82] mt-1.5">
            09년생(현재 고2)부터 5등급제, 08년생(현재 고3)은 9등급제예요.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#365927] mb-2">
            학기별 내신 ({gradeSystem}등급제)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {grades.map((g, i) => (
              <div key={i}>
                <span className="block text-xs text-[#8aab82] mb-1">{SEMESTER_LABELS[i]}</span>
                <input
                  type="number"
                  min={1}
                  max={scaleMax}
                  step={0.01}
                  value={g}
                  onChange={(e) => handleGradeChange(i, e.target.value)}
                  placeholder={gradeSystem === "9" ? "예: 2.5" : "예: 1.5"}
                  className="w-full border border-[#d6e4d3] rounded-lg px-3 py-2 text-sm text-[#365927]"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-[#365927] hover:bg-[#4a7a38] text-white font-medium rounded-lg py-3 transition"
        >
          결과 보기
        </button>
      </div>

      {results && (
        <div className="mt-10 space-y-3">
          <h2 className="text-lg font-bold text-[#365927] mb-1">
            {TIER_LABELS[tier] ?? tier} · {department} 예측 결과
          </h2>
          {enteredSummary && (
            <div className="rounded-lg border border-[#d6e4d3] bg-[#eef5ec] px-4 py-3">
              <p className="text-sm text-[#4a6b40]">
                입력한 {enteredSummary.count}개 학기 기준 현재 평균 내신은{" "}
                <b className="text-[#365927]">{enteredSummary.avg}등급</b>({enteredSummary.system}등급제)이에요.
              </p>
              <p className="text-xs text-[#8aab82] mt-0.5">
                {enteredSummary.system === "9" ? "5" : "9"}등급제로 환산하면 약 {enteredSummary.converted}등급
              </p>
            </div>
          )}
          {results.map((r, i) => (
            <ResultCard key={`${r.university}-${i}`} entry={r} />
          ))}
          {/* 대안(정시・논술・학종) 안내는 카드마다 반복하지 않고 여기서 한 번만 한다.
              ⚠️ ResultCta에 맡기면 안 된다 — tone은 achievable > safe > hard 우선순위라
              가능한 대학이 하나라도 섞이면 tone이 achievable이 되어 이 안내를 하지 않는다. */}
          {results.some((r) => r.kind === "result" && r.result.verdict === "impossible") && (
            <p className="text-xs text-[#8aab82] px-1 break-keep">
              교과전형으로 어려운 곳은 정시・논술이나 정성평가인 학종도 함께 보시면 좋아요.
            </p>
          )}
          <ResultCta
            results={results}
            enteredAvg={enteredSummary?.avg ?? null}
            department={department}
            tier={tier}
          />
          <ToolCrossLinks currentSlug="naeshin" />
        </div>
      )}

      {/* 설명은 지우지 않고 계산기 아래로 내려 접어둔다. 계산기를 쓰러 온 사람이
          계산기보다 안내문을 먼저 만나면 도구가 아니라 설명서처럼 읽힌다.
          면책 문구는 신뢰・법적 목적이 있으므로 요약 한 줄을 히어로에 남겨두고
          전문은 여기 유지한다. */}
      <div className="mt-10 space-y-2">
        <details className={`group ${DETAILS_BOX}`}>
          <summary className={`${DETAILS_SUMMARY} text-[#365927]`}>
            <ChevronRight className={DETAILS_CHEVRON} aria-hidden />
            교과전형과 학종, 뭐가 다른가요?
          </summary>
          <div className="mt-3 space-y-2 text-sm text-[#4a6b40]">
            <p>
              <b className="text-[#365927]">교과전형(정량평가)</b>은 내신 등급을 정해진 공식으로 계산해 점수가 높은 순으로 뽑아요. 숫자로 딱 떨어져서 예측이 가능하고, 이 계산기가 바로 이 기준이에요.
            </p>
            <p>
              <b className="text-[#365927]">학종・학생부종합전형(정성평가)</b>은 내신뿐 아니라 생활기록부・면접까지 종합적으로 평가해요. 학교별 환산점수・반영 과목, 특목고・자사고 내신 반영 방식까지 달라서 변수가 훨씬 많아 예측이 어려워요.
            </p>
          </div>
        </details>

        <details className={`group ${DETAILS_BOX_CAUTION}`}>
          <summary className={`${DETAILS_SUMMARY} text-[#8a6d1f]`}>
            <ChevronRight className={DETAILS_CHEVRON} aria-hidden />
            예측 기준과 배지 표시 안내
          </summary>
          <div className="mt-3 space-y-2 text-sm text-[#8a6d1f]">
            <p>
              이 계산기는 공개된 교과전형 등급컷을 바탕으로 한 단순 예측이며, 실제 입결과 다를 수 있습니다. 반드시 참고용으로 활용해주세요.
            </p>
            <p>
              <ComprehensiveBadge /> 표시가 있는 학교는 그 학과의 교과전형 등급컷이 공개되지 않아 학종(학생부종합전형) 수치로 대체한 거예요(대학에 교과전형이 없다는 뜻은 아니에요). 학종은 정성평가라 내신만으로 정해지지 않으니, 다른 학교의 교과 컷과 숫자를 그대로 비교하지 말고 참고만 해주세요.
            </p>
            <p>
              <MergedBadge /> 표시는 개별 학과가 아니라 계열・학부 통합모집 수치라, 실제 학과 컷과 다를 수 있어요.
            </p>
            <p>
              <BranchCampusBadge name="○○캠" /> 표시는 본교가 아닌 분교・제2캠퍼스 소속 학과예요. 위치도 모집도 본교와 완전히 다르니 꼭 확인하고 지원해주세요.
            </p>
          </div>
        </details>

        {/* 업데이트 내역은 갈아치우지 않고 누적하기로 한 기존 결정을 유지한다.
            첫 화면에서만 빼고 기록 자체는 그대로 둔다. */}
        <details className={`group ${DETAILS_BOX_INFO}`}>
          <summary className={`${DETAILS_SUMMARY} text-[#3a5a8f]`}>
            <ChevronRight className={DETAILS_CHEVRON} aria-hidden />
            업데이트 내역 (v3.6)
          </summary>
          <div className="mt-3 space-y-1.5 text-sm text-[#3a5a8f] leading-relaxed">
            <p>계열 2개가 새로 생겼어요.</p>
            <p>
              <b className="font-semibold">보건</b> 간호학과, 보건계열(임상병리・방사선・물리치료・치위생・작업치료・응급구조)
            </p>
            <p>
              <b className="font-semibold">건축</b> 건축계열(건축학 5년제·건축공학 4년제·도시건축을 대학별 모집단위 그대로)
            </p>
            <p>그리고 사회 계열에 심리학과가 추가됐어요.</p>
            <p>여기에 행정학과도 사회 계열에 들어왔어요. 38개 대학을 모두 확인했어요.</p>
            <p>인문/어문 계열에 일어일문학과가 새로 들어왔어요. 38개 대학을 모두 확인했어요.</p>
          </div>
        </details>
      </div>

      <div className="mt-12 border-t border-[#d6e4d3] pt-6">
        <h2 className="text-base font-bold text-[#365927] mb-1">이 학교/학과도 보고 싶어요</h2>
        <p className="text-xs text-[#8aab82] mb-3 break-keep">
          보건(간호・임상병리 등)과 건축, 심리학과, 행정학과, 일어일문학과를 새로 넣었어요.
          <br className="sm:hidden" />
          아직 없는 학교나 학과를 알려주시면 다음 업데이트 때 반영할게요.
        </p>
        {requestUser && (
          <>
            <p className="text-xs text-[#5a7a4e] mb-1.5">
              {requestUser.userid}
              {requestUser.grade ? ` · ${requestUser.grade}` : ""}(으)로 문의를 남겨요.
            </p>
            {/* 요청한 학과가 반영돼도 알려줄 방법이 마케팅 수신 동의뿐이라, 여기서 상태를 알려준다 */}
            {requestUser.marketingAgreed ? (
              <p className="text-xs text-[#5a7a4e] mb-1.5">
                마케팅 정보 수신에 동의해두셔서, 요청하신 학과가 반영되면 이메일로 알려드릴 수 있어요.
              </p>
            ) : (
              <p className="text-xs text-[#8a6d1f] bg-[#fff8e6] border border-[#f0e2bd] rounded-md px-2.5 py-2 mb-1.5 leading-relaxed">
                지금은 마케팅 정보 수신에 동의하지 않으셔서, 반영 소식을 따로 알려드리기 어려워요.{" "}
                <Link href="/mypage" className="underline underline-offset-2 font-medium">
                  마이페이지
                </Link>
                에서 언제든 바꾸실 수 있어요.
              </p>
            )}
          </>
        )}
        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="예: OO대 OO학과도 추가해주세요"
          rows={3}
          maxLength={500}
          className="w-full border border-[#d6e4d3] rounded-lg px-3 py-2 text-sm text-[#365927] resize-none"
        />
        <button
          onClick={handleRequestSubmit}
          disabled={requestSubmitting}
          className="mt-2 bg-[#365927] hover:bg-[#4a7a38] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition"
        >
          {requestSubmitting ? "보내는 중..." : "요청 보내기"}
        </button>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-[#365927] mb-3">로그인이 필요해요</h2>
            <p className="text-[#5a7d50] text-xs mb-6">
              로그인하고 남겨주시면 반영됐을 때 알려드릴 수 있어요.
            </p>
            <div className="space-y-3">
              <Link
                href="/login?redirect=/naeshin"
                onClick={() => setShowLoginModal(false)}
                className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
              >
                로그인하기
              </Link>
              <button
                onClick={() => setShowLoginModal(false)}
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

/* 배지는 종류별로 색을 달리한다. 한 색으로 묶어봤으나, 실제로 이 배지들을 읽는 입장에서는
   "학종이냐 / 통합모집이냐 / 분교냐"가 각각 다른 확인 사항이라 색이 구분되는 편이 낫다는
   판단(2026-08-15). 되돌릴 때 참고: 통일안은 주의색 하나 + 채움/테두리로만 구분했었다. */
function ComprehensiveBadge({ name }: { name?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
      {name ? `학종 · ${name}` : "학종"}
    </span>
  );
}

function SubjectAdmissionBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      교과 · {name}
    </span>
  );
}

function MergedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      계열모집
    </span>
  );
}

function BranchCampusBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
      {name}
    </span>
  );
}

function CutoffBreakdown({ cutoffRaw }: { cutoffRaw: CutoffRaw }) {
  const parts: string[] = [];
  if (cutoffRaw.avg !== undefined) parts.push(`평균 ${cutoffRaw.avg}`);
  if (cutoffRaw.cut50 !== undefined) parts.push(`50% ${cutoffRaw.cut50}`);
  if (cutoffRaw.cut70 !== undefined) parts.push(`70% ${cutoffRaw.cut70}`);
  if (parts.length === 0) return null;

  const year = cutoffRaw.year ?? 2026;
  return (
    <>
      {cutoffRaw.notice && (
        <p className="text-[11px] text-[#8aab82] mt-1.5 leading-relaxed">{cutoffRaw.notice}</p>
      )}
      <p className="text-[11px] text-[#a8bfa2] mt-1.5">
        9등급제 발표컷 · {year}학년도 · {parts.join(" · ")}
      </p>
    </>
  );
}

function CutoffLine({ cutoff9, cutoff5 }: { cutoff9: number; cutoff5: number }) {
  return (
    <p className="text-sm text-[#8aab82] mt-1">
      9등급제 커트라인 <b className="text-[#365927]">{cutoff9}등급</b> · 5등급제 환산{" "}
      <b className="text-[#365927]">{cutoff5}등급</b>
    </p>
  );
}

/**
 * 결과 리스트 맨 아래에 딱 1회만 노출되는 무료 자료 CTA.
 *
 * 카드마다 붙이지 않는 이유: 결과는 대학 단위 리스트라 tier에 속한 대학 수(지거국 9곳)만큼
 * 버튼이 늘어난다. 예전엔 '어려움' 카드 안에 정시·논술 버튼이 있어서 최악의 경우 한 화면에
 * 버튼이 18개까지 찍혔고, 그게 오히려 광고처럼 읽혔다. 노출 범위는 모든 판정으로 넓히되
 * 노출 횟수는 1회로 줄이는 게 이 컴포넌트의 목적이다.
 *
 * 링크는 유료가 아니라 무료 자료(`?category=고등` = 무료 입시 › 고등학생, 30건)로 보낸다.
 * 지금 트래픽은 5등급제 사용자가 압도적인 현 고1이라 결제 의사가 거의 없고, 유료 논술은
 * 자료가 1건뿐이어서 눌러 들어가면 빈약하다.
 */
function ResultCta({
  results,
  enteredAvg,
  department,
  tier,
}: {
  results: UniversityResult[];
  enteredAvg: number | null;
  department: NaeshinDepartment;
  tier: string;
}) {
  const verdicts = results.flatMap((r) => (r.kind === "result" ? [r.result.verdict] : []));
  if (verdicts.length === 0) return null;

  // achievable이 하나라도 있으면 "목표가 보이는" 상태로 본다 — 동기가 가장 높은 순간이다.
  const tone = verdicts.includes("achievable")
    ? "achievable"
    : verdicts.includes("safe")
      ? "safe"
      : "hard";

  // 당위("~해야 해요")가 아니라 제안 톤으로 쓴다 — 계산기를 쓰러 온 사람에게 지시하면 반감이 든다.
  // ⚠️ '어려움'에서 정시・학종・논술을 언급하는데, 목적지의 무료 자료는 무료-수시 29건(생기부 =
  // 학종 대비로 적합) · 무료-정시 1건 · 무료-논술 0건이다. 논술 무료 자료가 생기기 전까진
  // 기대와 살짝 어긋날 수 있다는 걸 알고 쓴 문구다.
  // 모바일에서 문장 단위로 끊기게 두 토막으로 나눠 둔다(좁은 화면에서 단어 중간이 잘리지 않게).
  const [headlineLead, headlineTail]: [string, string] =
    tone === "achievable"
      ? enteredAvg !== null
        ? [`지금 ${enteredAvg}등급에서 목표까지,`, "도움될 만한 자료를 모아뒀어요."]
        : ["목표까지 가는 데", "도움될 만한 자료를 모아뒀어요."]
      : tone === "safe"
        ? ["지금 잘하고 있어요.", "미리 챙겨두면 좋을 자료도 있어요."]
        : ["교과 말고도 정시・학종・논술 같은 길이 있어요.", "준비에 참고할 자료도 모아뒀어요."];

  // 배경을 흰색으로 두는 이유: 페이지 body가 #f5f9f4라서 초록 틴트를 깔면 배경과 같은 색이 돼
  // 면으로 존재하지 않는다. 흰색은 페이지보다 밝아서 위로 들린다. 결과 카드(핑크·파랑 틴트)는
  // 그림자가 없으므로 shadow-sm과 좌측 액센트 바로 "결과가 아니라 다음 단계"임을 구분한다.
  return (
    <div className="mt-5 rounded-lg border border-[#e6ece4] border-l-4 border-l-[#5a7d50] bg-white shadow-sm px-4 py-4">
      <p className="text-sm font-medium text-[#365927] break-keep">
        {headlineLead}
        <br className="sm:hidden" />{" "}
        {headlineTail}
      </p>
      <p className="text-xs text-[#4a6b40] mt-1 break-keep">
        선배들이 만든 자료 중 <b className="text-[#5a7d50]">무료로 받을 수 있는 것</b>만 모아뒀어요.
        <br className="sm:hidden" />
        부담 없이 둘러보셔도 괜찮아요.
      </p>
      {/* py-3 = 44px 높이. 유입 3분의 2가 모바일이고 이게 전환 동선의 유일한 버튼이라
          터치 타깃 권장치(44×44)를 맞춘다. */}
      <Link
        href="/?category=고등"
        onClick={() =>
          trackEvent("naeshin_cta_click", {
            tone,
            department,
            tier,
            target: "free",
          })
        }
        className="inline-block mt-3 text-sm font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-5 py-3 transition"
      >
        무료 자료 둘러보기 →
      </Link>
    </div>
  );
}

function ResultCard({ entry }: { entry: UniversityResult }) {
  if (entry.kind === "excluded") {
    return (
      <div className="border border-[#d6e4d3] rounded-lg px-4 py-3 bg-[#f5f9f4]">
        <p className="font-medium text-[#365927]">{entry.university}</p>
        <p className="text-sm text-[#8aab82] mt-0.5">{entry.reason}</p>
      </div>
    );
  }

  if (entry.kind === "unavailable") {
    return (
      <div className="border border-[#d6e4d3] rounded-lg px-4 py-3 bg-[#f5f9f4]">
        <p className="font-medium text-[#365927]">{entry.university}</p>
        <p className="text-sm text-[#8aab82] mt-0.5">
          {UNAVAILABLE_MESSAGES[entry.status]}
          {entry.note && ` (${entry.note})`}
        </p>
      </div>
    );
  }

  const { result, cutoffRaw } = entry;
  const displayName = cutoffRaw.actualName ? `${entry.university}(${cutoffRaw.actualName})` : entry.university;

  if (result.verdict === "impossible") {
    const noSemestersLeft = result.remainingCount === 0;
    return (
      <div className="border border-[#f0c8c8] rounded-lg px-4 py-3 bg-[#fdf3f3]">
        <p className="font-medium text-[#365927] flex flex-wrap items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
          {cutoffRaw.admissionType !== "comprehensive" && cutoffRaw.admissionName && (
            <SubjectAdmissionBadge name={cutoffRaw.admissionName} />
          )}
          {cutoffRaw.mergedUnit && <MergedBadge />}
          {cutoffRaw.branchCampus && <BranchCampusBadge name={cutoffRaw.branchCampus} />}
        </p>
        {/* 대안(정시・논술・학종) 안내는 목록 아래 ResultCta가 한 번만 한다.
            카드마다 반복하면 결과가 15장일 때 같은 문장을 15번 읽게 된다. */}
        <p className="text-sm text-[#b5504f] mt-0.5">
          {noSemestersLeft
            ? "지금 성적으로는 교과전형이 어려워 보여요ㅠㅠ"
            : "교과전형으로는 어려워 보여요ㅠㅠ"}
        </p>
        {noSemestersLeft && <CutoffLine cutoff9={result.cutoff9} cutoff5={result.cutoff5} />}
        <CutoffBreakdown cutoffRaw={cutoffRaw} />
      </div>
    );
  }

  if (result.verdict === "safe") {
    const noSemestersLeft = result.remainingCount === 0;
    return (
      <div className="border border-[#c9d9f5] rounded-lg px-4 py-3 bg-[#f2f6fd]">
        <p className="font-medium text-[#365927] flex flex-wrap items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
          {cutoffRaw.admissionType !== "comprehensive" && cutoffRaw.admissionName && (
            <SubjectAdmissionBadge name={cutoffRaw.admissionName} />
          )}
          {cutoffRaw.mergedUnit && <MergedBadge />}
          {cutoffRaw.branchCampus && <BranchCampusBadge name={cutoffRaw.branchCampus} />}
        </p>
        <p className="text-sm text-[#3a5a8f] mt-0.5">
          {noSemestersLeft
            ? "안정권이에요! 정시보다 수시에 집중해도 좋아요."
            : "이미 안정권이에요! 지금 페이스를 유지해보세요."}
        </p>
        {noSemestersLeft && <CutoffLine cutoff9={result.cutoff9} cutoff5={result.cutoff5} />}
        <CutoffBreakdown cutoffRaw={cutoffRaw} />
      </div>
    );
  }

  if (result.verdict === "achievable" && result.requiredAvg !== null) {
    const otherSystem = result.gradeSystem === "9" ? "5" : "9";
    return (
      <div className="border border-[#c9d9f5] rounded-lg px-4 py-3 bg-[#f2f6fd]">
        <p className="font-medium text-[#365927] flex flex-wrap items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
          {cutoffRaw.admissionType !== "comprehensive" && cutoffRaw.admissionName && (
            <SubjectAdmissionBadge name={cutoffRaw.admissionName} />
          )}
          {cutoffRaw.mergedUnit && <MergedBadge />}
          {cutoffRaw.branchCampus && <BranchCampusBadge name={cutoffRaw.branchCampus} />}
        </p>
        {result.aheadOfPace && (
          <p className="text-sm text-[#3a5a8f] mt-0.5">지금 페이스를 유지한다면 안정권이에요.</p>
        )}
        {/* 계산기의 결과값은 문장이 아니라 숫자다. 숫자를 본문 크기 문장 안에 묻으면
            도구가 아니라 안내문처럼 읽힌다. */}
        <p className="text-xs text-[#5a7d50] mt-2">남은 학기 평균</p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-[#365927] tracking-tight leading-none">
            {result.requiredAvg}
          </span>
          <span className="text-sm font-medium text-[#5a7d50]">
            등급 ({result.gradeSystem}등급제){result.aheadOfPace ? "까지 여유" : " 필요"}
          </span>
        </p>
        <p className="text-xs text-[#8aab82] mt-1.5">
          {otherSystem}등급제 환산 약 {result.requiredAvgConverted}등급 · 커트라인이 아닌 남은 학기 목표 평균
        </p>
        <CutoffBreakdown cutoffRaw={cutoffRaw} />
      </div>
    );
  }

  return (
    <div className="border border-[#d6e4d3] rounded-lg px-4 py-3 bg-[#f5f9f4]">
      <p className="font-medium text-[#365927]">{entry.university}</p>
      <p className="text-sm text-[#8aab82] mt-0.5">아직 데이터를 준비 중이에요.</p>
    </div>
  );
}
