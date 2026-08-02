"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/ga";
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
  { label: "공대", departments: ["컴퓨터공학과", "전자전기공학과", "기계공학과"] },
  { label: "자연", departments: ["화학과", "생명과학과"] },
  { label: "상경", departments: ["경영학과"] },
  { label: "사회", departments: ["미디어커뮤니케이션학과", "정치외교학과"] },
  { label: "법학", departments: ["법학과"] },
  { label: "사범대", departments: ["교육학과", "국어교육과", "영어교육과", "사회·윤리교육과"] },
  { label: "인문/어문", departments: ["국어국문학과", "영어영문학과", "중어중문학과"] },
];

const SEMESTER_LABELS = ["1학년 1학기", "1학년 2학기", "2학년 1학기", "2학년 2학기", "3학년 1학기"];

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
  no_data: "아직 데이터를 준비 중이에요.",
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
  year?: 2025 | 2026;
  note?: string;
};

type UniversityResult =
  | { kind: "excluded"; university: string; reason: string }
  | { kind: "unavailable"; university: string; status: Exclude<DeptCutoff["status"], "data">; note?: string }
  | { kind: "result"; university: string; result: NaeshinResult; cutoffRaw: CutoffRaw };

export default function NaeshinClient() {
  const [track, setTrack] = useState(TRACKS[0].label);
  const [department, setDepartment] = useState<NaeshinDepartment>(TRACKS[0].departments[0]);
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
        .select("userid, grade")
        .eq("id", user.id)
        .single();
      setRequestUser({ id: user.id, userid: profile?.userid ?? user.email ?? "", grade: profile?.grade ?? null });
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
    toast.success("요청 접수됐어요! 다음 업데이트 때 참고할게요.");
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
        <p className="flex items-center gap-2 text-sm font-semibold text-[#5a7d50] mb-2">
          내신 계산기
          <span className="align-middle text-xs font-semibold text-[#5a7d50] bg-[#eaf2e8] border border-[#d6e4d3] rounded-full px-2 py-0.5">
            v2.0
          </span>
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#365927] leading-tight tracking-tight">
          가고 싶은 대학, <br className="sm:hidden" />
          <span className="text-[#4a7a38]">지금부터 몇 등급</span>이 필요할까?
        </h1>
        <p className="mt-3 text-base sm:text-lg text-[#4a6b40] leading-relaxed">
          내 성적을 매겨주는 계산기가 아니에요.
          <br />
          <b className="text-[#365927]">목표 대학에 맞춰,</b>
          <br className="sm:hidden" />{" "}
          <b className="text-[#365927]">남은 학기에 받아야 할 등급을 거꾸로 계산</b>해주는
          <br className="sm:hidden" />{" "}
          <b className="text-[#365927]">역산 내신 계산기</b>예요.
        </p>
      </div>

      <div className="bg-[#eef5ec] border border-[#d6e4d3] text-[#4a6b40] text-sm rounded-lg px-4 py-3 mb-4 space-y-2">
        <p className="font-semibold text-[#365927]">📌 전형 유형 이해하기</p>
        <p>
          <b className="text-[#365927]">교과전형(정량평가)</b> — 내신 등급을 정해진 공식으로 계산해 점수가 높은 순으로 뽑아요. 숫자로 딱 떨어져서 예측이 가능하고, <b>이 계산기가 바로 이 기준</b>이에요.
        </p>
        <p>
          <b className="text-[#365927]">학종・학생부종합전형(정성평가)</b> — 내신뿐 아니라 생활기록부・면접까지 종합적으로 평가해요. 학교별 환산점수・반영 과목, 특목고・자사고 내신 반영 방식까지 달라서 변수가 훨씬 많아 예측이 어려워요.
        </p>
      </div>

      <div className="bg-[#fff8e6] border border-[#f0dca0] text-[#8a6d1f] text-sm rounded-lg px-4 py-3 mb-8">
        ⚠️ 이 계산기는 공개된 교과전형 등급컷을 바탕으로 한 <b>단순 예측</b>이며, 실제 입결과 다를 수 있습니다.
        <br />
        반드시 참고용으로 활용해주세요.
        <br />
        <ComprehensiveBadge /> 표시가 있는 학교는 교과전형이 없어서 학종(학생부종합전형) 수치로 대체한 거예요. 이 성적은 정성평가라 내신만으로 정해지지 않으니 참고만 해주세요.
        <br />
        <MergedBadge /> 표시는 개별 학과가 아니라 계열・학부 통합모집 수치라, 실제 학과 컷과 다를 수 있어요.
        <br />
        <BranchCampusBadge name="○○" /> 표시는 본교가 아닌 <b>분교・제2캠퍼스</b> 소속 학과예요. 위치도 모집도 본교와 완전히 다르니 꼭 확인하고 지원해주세요.
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
        </div>
      )}

      <div className="mt-12 border-t border-[#d6e4d3] pt-6">
        <h2 className="text-base font-bold text-[#365927] mb-1">이 학교/학과도 보고 싶어요!</h2>
        <p className="text-xs text-[#8aab82] mb-3">
          문과 계열(사회・법학・사범대)을 새로 넣었어요. 아직 없는 학교나 학과를 알려주시면 다음 업데이트 때 반영할게요.
        </p>
        {requestUser && (
          <p className="text-xs text-[#5a7a4e] mb-1.5">
            {requestUser.userid}
            {requestUser.grade ? ` · ${requestUser.grade}` : ""}(으)로 문의를 남겨요.
          </p>
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
            <h2 className="text-2xl font-bold text-[#365927] mb-3">로그인이 필요합니다!</h2>
            <p className="text-[#5a7d50] text-xs mb-6">
              로그인 후 문의를 남겨주셔야 새 버전을 알려드릴 수 있어요!
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

function ComprehensiveBadge({ name }: { name?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
      {name ? `학종 · ${name}` : "학종"}
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
      {name}캠
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
    <p className="text-[11px] text-[#a8bfa2] mt-1.5">
      9등급제 발표컷 · {year}학년도 · {parts.join(" · ")}
    </p>
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
        <p className="font-medium text-[#365927] flex items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
          {cutoffRaw.mergedUnit && <MergedBadge />}
          {cutoffRaw.branchCampus && <BranchCampusBadge name={cutoffRaw.branchCampus} />}
        </p>
        <p className="text-sm text-[#b5504f] mt-0.5">
          {noSemestersLeft
            ? "이미 입력한 성적으로는 교과전형 합격이 어려워요ㅠㅠ 정시・논술이나 정성평가인 학종 전형을 추천해요!"
            : "교과전형으로는 합격이 어려워요ㅠㅠ 목표 대학을 위해서는 정시・논술이나 정성평가인 학종 전형을 추천해요!"}
        </p>
        {noSemestersLeft && <CutoffLine cutoff9={result.cutoff9} cutoff5={result.cutoff5} />}
        <CutoffBreakdown cutoffRaw={cutoffRaw} />
        <Link
          href="/?category=정시"
          className="inline-block mt-2 text-xs font-medium text-white bg-[#365927] hover:bg-[#4a7a38] rounded-full px-3 py-1.5 transition"
        >
          정시 자료 보러가기 →
        </Link>
      </div>
    );
  }

  if (result.verdict === "safe") {
    const noSemestersLeft = result.remainingCount === 0;
    return (
      <div className="border border-[#c9d9f5] rounded-lg px-4 py-3 bg-[#f2f6fd]">
        <p className="font-medium text-[#365927] flex items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
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
        <p className="font-medium text-[#365927] flex items-center gap-1.5">
          {displayName}
          {cutoffRaw.admissionType === "comprehensive" && <ComprehensiveBadge name={cutoffRaw.admissionName} />}
          {cutoffRaw.mergedUnit && <MergedBadge />}
          {cutoffRaw.branchCampus && <BranchCampusBadge name={cutoffRaw.branchCampus} />}
        </p>
        {result.aheadOfPace && (
          <p className="text-sm text-[#3a5a8f] mt-0.5">지금 페이스를 유지한다면 안정권이에요!</p>
        )}
        <p className="text-sm text-[#3a5a8f] mt-0.5">
          남은 학기 평균 <b className="text-[#365927]">{result.requiredAvg}등급</b>({result.gradeSystem}등급제)
          {result.aheadOfPace ? "까지는 여유가 있어요." : "이 필요해요."}
        </p>
        <p className="text-xs text-[#8aab82] mt-1">
          위 남은 학기 평균을 {otherSystem}등급제로 환산하면 약 {result.requiredAvgConverted}등급이에요
          <span className="text-[#c0d2ba]"> (커트라인이 아니라 남은 학기 목표 평균이에요)</span>
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
