import Link from "next/link";
import {
  FREE_SUSI,
  SUSI_GRADES,
  SUSI_INFO,
  parseSusiCategory,
  susiGradeCategory,
  susiSubjectCategory,
  susiSubjects,
} from "@/data/categories";

/* 무료 수시 목록 위의 학년·과목 칩 (2026-10-04 사용자 결정: 헤더는 '수시'까지, 세분화는 목록 위 칩).
   1줄: 전체 · 고1 · 고2 · 고3 · 입시 정보 / 2줄(학년을 골랐을 때만): 전체 · 과목들(고1만 한국사).
   칩은 링크라 주소(?category=)가 바뀌고, 뒤로 가기·공유가 그대로 된다.
   모바일에서 잘못 눌리지 않게 높이 40px·폭 48px 이상, 칩 사이 8px. 모바일은 좌우 여백을 줄여
   학년 줄(전체·고1·고2·고3·입시 정보)이 360px 폭에서도 한 줄에 들어가게 했다(두 줄이 섞여 보이던 것). */

const href = (c: string) => `/?category=${encodeURIComponent(c)}`;

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center justify-center min-h-[40px] min-w-[48px] px-3 sm:px-4 rounded-full text-sm font-medium border transition ${
        active
          ? "bg-[#365927] border-[#365927] text-white"
          : "bg-white border-[#d6e4d3] text-[#365927] hover:border-[#365927]"
      }`}
    >
      {children}
    </Link>
  );
}

export default function SusiFilterChips({ category }: { category: string }) {
  const susi = parseSusiCategory(category);
  if (!susi) return null;
  const grade = susi.grade;

  return (
    <div className="mt-4 space-y-3">
      <nav aria-label="학년" className="flex flex-wrap gap-2">
        <Chip to={href(FREE_SUSI)} active={category === FREE_SUSI}>전체</Chip>
        {SUSI_GRADES.map((g) => (
          <Chip key={g} to={href(susiGradeCategory(g))} active={grade === g}>{g}</Chip>
        ))}
        <Chip to={href(SUSI_INFO)} active={!!susi.info}>입시 정보</Chip>
      </nav>
      {grade && (
        <nav aria-label="과목" className="flex flex-wrap gap-2">
          <Chip to={href(susiGradeCategory(grade))} active={!susi.subject}>전체</Chip>
          {susiSubjects(grade).map((sub) => (
            <Chip key={sub} to={href(susiSubjectCategory(grade, sub))} active={susi.subject === sub}>{sub}</Chip>
          ))}
        </nav>
      )}
    </div>
  );
}
