export type SubGroup = {
  label: string;
  items: string[];
};

export type CategoryGroup = {
  label: string;
  items: string[];
  subGroups?: SubGroup[];
};

export const categoryGroups: CategoryGroup[] = [
  {
    label: "고등학생(대학입시)",
    items: ["수시", "정시", "논술"],
  },
  {
    label: "중학생",
    items: ["공부법", "고교입시"],
  },
  {
    label: "진로/직업",
    items: ["진로/직업"],
  },
  {
    label: "기타",
    items: ["기타"],
  },
  {
    label: "무료 입시 자료",
    items: ["무료-수시", "무료-정시", "무료-논술", "무료-공부법", "무료-고교입시", "무료-진로/직업", "무료-기타"],
    subGroups: [
      { label: "고등", items: ["무료-수시", "무료-정시", "무료-논술"] },
      { label: "중학", items: ["무료-공부법", "무료-고교입시"] },
      { label: "진로/직업", items: ["무료-진로/직업"] },
      { label: "기타", items: ["무료-기타"] },
    ],
  },
];

export const FREE_PARENT_CATEGORY = "무료 입시 자료";

/* ── 무료 수시 세분화 (2026-10-04 사용자 요청) ─────────────────────────────
   무료 입시 자료 › 고등 › 수시 › 고1·고2·고3 › 국어·수학·영어·사회·과학 (+ 고1만 한국사)
                              › 입시 정보 (선행학습 영향평가 보고서·생기부 가이드처럼 학년·과목이 없는 자료)
   카테고리 값은 "무료-수시-고1-국어"처럼 상위 값을 접두어로 이어 붙인다. 그래서 "무료-수시"를 고르면
   그 아래 전부, "무료-수시-고1"을 고르면 고1 전 과목이 잡힌다(categoryMatches).
   예전 값 "무료-수시"도 그대로 유효하다 — 자료를 옮기기 전·후 어느 쪽이든 깨지지 않게. */
export const FREE_SUSI = "무료-수시";
export const SUSI_GRADES = ["고1", "고2", "고3"] as const;
export type SusiGrade = (typeof SUSI_GRADES)[number];
const COMMON_SUBJECTS = ["국어", "수학", "영어", "사회", "과학"];
export const SUSI_INFO = "무료-수시-입시정보";

export function susiSubjects(grade: SusiGrade): string[] {
  return grade === "고1" ? [...COMMON_SUBJECTS, "한국사"] : COMMON_SUBJECTS;
}
export const susiGradeCategory = (grade: SusiGrade) => `${FREE_SUSI}-${grade}`;
export const susiSubjectCategory = (grade: SusiGrade, subject: string) => `${FREE_SUSI}-${grade}-${subject}`;

/** 자료에 실제로 붙일 수 있는 수시 카테고리(학년×과목 + 입시 정보) */
export const SUSI_LEAF_CATEGORIES: string[] = [
  ...SUSI_GRADES.flatMap((g) => susiSubjects(g).map((sub) => susiSubjectCategory(g, sub))),
  SUSI_INFO,
];

/** "무료-수시-고1-국어" → { grade: "고1", subject: "국어" } / 입시 정보 → { info: true } */
export function parseSusiCategory(category: string): { grade?: SusiGrade; subject?: string; info?: boolean } | null {
  if (category === FREE_SUSI) return {};
  if (category === SUSI_INFO) return { info: true };
  if (!category.startsWith(`${FREE_SUSI}-`)) return null;
  const [grade, subject] = category.slice(FREE_SUSI.length + 1).split("-");
  if (!(SUSI_GRADES as readonly string[]).includes(grade)) return null;
  return { grade: grade as SusiGrade, subject };
}

/** 고른 카테고리(selected)에 자료 카테고리가 들어가는지 — 상위 값을 고르면 하위 값도 포함 */
export function categoryMatches(selected: string, materialCategory: string): boolean {
  // 항목 하나와 비교 — 자기 자신이거나 그 아래(접두어 + "-")
  const inItem = (item: string) => materialCategory === item || materialCategory.startsWith(`${item}-`);
  if (selected === FREE_PARENT_CATEGORY) return isFreeCategory(materialCategory);
  // ⚠️ 그룹 항목은 재귀하지 말고 바로 비교한다. "진로/직업"·"기타"는 그룹 이름과 항목 이름이 같아서
  // 재귀하면 같은 인자로 끝없이 다시 불려 홈이 죽는다(배포 전 Claude·Codex 리뷰가 둘 다 잡음).
  const top = categoryGroups.find((g) => g.label === selected);
  if (top) return top.items.some(inItem);
  const sub = categoryGroups.flatMap((g) => g.subGroups ?? []).find((sg) => sg.label === selected);
  if (sub) return sub.items.some(inItem);
  return inItem(selected);
}

// 무료 입시 자료 subGroup 내부 label → UI 표시 이름
export const FREE_SUB_DISPLAY: Record<string, string> = {
  "고등": "고등학생(대학입시)",
  "중학": "중학생",
};

// "무료-수시" → "수시" 처리
function stripFreePrefix(s: string): string {
  return s.startsWith("무료-") ? s.slice(3) : s;
}

/** 무료 자료인가 — 다운로드·무료 등록 API가 이걸로 유료/무료를 가른다.
 *  무료 카테고리 값은 모두 "무료-"로 시작한다(세분화된 "무료-수시-고1-국어" 포함). */
export function isFreeCategory(category: string): boolean {
  return category === FREE_PARENT_CATEGORY || category.startsWith("무료-");
}

export function getCategoryLabel(category: string): string {
  const susi = parseSusiCategory(category);
  if (susi && category !== FREE_SUSI) {
    if (susi.info) return "무료 입시 › 수시 › 입시 정보";
    return `무료 입시 › 수시 › ${susi.grade}${susi.subject ? ` ${susi.subject}` : ""}`;
  }
  const displayCat = stripFreePrefix(category);

  for (const group of categoryGroups) {
    if (group.subGroups) {
      for (const sg of group.subGroups) {
        if (sg.items.includes(category)) {
          // 무료 카테고리는 "무료 입시 › [항목]" 형태로 유료와 명확히 구분
          return `무료 입시 › ${displayCat}`;
        }
      }
      continue;
    }
    if (group.items.includes(category) && group.label !== category) {
      const prefix = group.label === "고등학생(대학입시)" ? "고등학생" : group.label;
      return `${prefix} › ${displayCat}`;
    }
  }
  return displayCat;
}

export type Category = string;

export type BreadcrumbItem = {
  name: string;
  href: string | null;
};

export function getBreadcrumb(category: string | null): BreadcrumbItem[] {
  if (!category) return [];

  // 무료 › 고등 › 수시 › 고1 › 국어 — 마지막 단계만 링크 없이, 위 단계는 모두 그 목록으로 가는 링크
  const susi = parseSusiCategory(category);
  if (susi && category !== FREE_SUSI) {
    const href = (c: string) => `/?category=${encodeURIComponent(c)}`;
    const trail: BreadcrumbItem[] = [
      { name: FREE_PARENT_CATEGORY, href: href(FREE_PARENT_CATEGORY) },
      { name: FREE_SUB_DISPLAY["고등"], href: href("고등") },
      { name: "수시", href: href(FREE_SUSI) },
    ];
    if (susi.info) trail.push({ name: "입시 정보", href: null });
    else if (susi.grade && susi.subject) {
      trail.push({ name: susi.grade, href: href(susiGradeCategory(susi.grade)) });
      trail.push({ name: susi.subject, href: null });
    } else if (susi.grade) trail.push({ name: susi.grade, href: null });
    return trail;
  }

  const displayCat = stripFreePrefix(category);

  const topGroup = categoryGroups.find((g) => g.label === category);
  if (topGroup) return [{ name: category, href: null }];

  const freeGroup = categoryGroups.find((g) => g.label === FREE_PARENT_CATEGORY);
  if (freeGroup?.subGroups) {
    const subGroup = freeGroup.subGroups.find((sg) => sg.label === category);
    if (subGroup) {
      const displaySgLabel = FREE_SUB_DISPLAY[subGroup.label] ?? displayCat;
      return [
        { name: FREE_PARENT_CATEGORY, href: `/?category=${encodeURIComponent(FREE_PARENT_CATEGORY)}` },
        { name: displaySgLabel, href: null },
      ];
    }
    for (const sg of freeGroup.subGroups) {
      if (sg.items.includes(category)) {
        const displaySgLabel = FREE_SUB_DISPLAY[sg.label] ?? stripFreePrefix(sg.label);
        // subGroup 이름과 항목 이름이 같으면(진로/직업, 기타) 중간 단계 생략
        if (displaySgLabel === displayCat) {
          return [
            { name: FREE_PARENT_CATEGORY, href: `/?category=${encodeURIComponent(FREE_PARENT_CATEGORY)}` },
            { name: displayCat, href: null },
          ];
        }
        return [
          { name: FREE_PARENT_CATEGORY, href: `/?category=${encodeURIComponent(FREE_PARENT_CATEGORY)}` },
          { name: displaySgLabel, href: `/?category=${encodeURIComponent(sg.label)}` },
          { name: displayCat, href: null },
        ];
      }
    }
  }

  for (const group of categoryGroups) {
    if (group.label === FREE_PARENT_CATEGORY) continue;
    if (group.items.includes(category) && group.label !== category) {
      return [
        { name: group.label, href: `/?category=${encodeURIComponent(group.label)}` },
        { name: category, href: null },
      ];
    }
  }

  return [{ name: displayCat, href: null }];
}

/** 자료 등록·수정 화면의 카테고리 선택지. 무료 수시는 "무료-수시" 대신 학년×과목·입시 정보로 펼친다.
 *  (등록 화면 두 곳이 같은 목록을 쓰도록 한 곳에 둔다) */
export function getCategoryOptions(current?: string): { group: string; options: { value: string; label: string }[] }[] {
  const out: { group: string; options: { value: string; label: string }[] }[] = [];
  // 수정 중인 자료가 아직 옛 값("무료-수시")이면 선택지에 남겨 둔다 — 없으면 저장할 때 첫 항목으로 조용히 바뀐다
  if (current === FREE_SUSI) {
    out.push({ group: "현재 값", options: [{ value: FREE_SUSI, label: "수시 (옛 분류, 무료)" }] });
  }
  for (const group of categoryGroups) {
    if (!group.subGroups) {
      out.push({ group: group.label, options: group.items.map((item) => ({ value: item, label: item })) });
      continue;
    }
    for (const sub of group.subGroups) {
      const subLabel = `${group.label} › ${FREE_SUB_DISPLAY[sub.label] ?? sub.label}`;
      const options: { value: string; label: string }[] = [];
      for (const item of sub.items) {
        if (item === FREE_SUSI) {
          for (const leaf of SUSI_LEAF_CATEGORIES) {
            const p = parseSusiCategory(leaf)!;
            options.push({ value: leaf, label: p.info ? "수시 · 입시 정보 (무료)" : `수시 · ${p.grade} ${p.subject} (무료)` });
          }
        } else {
          options.push({ value: item, label: `${stripFreePrefix(item)} (무료)` });
        }
      }
      out.push({ group: subLabel, options });
    }
  }
  return out;
}
