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
    items: ["수시", "정시"],
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
    label: "무료 내신 자료",
    items: [
      "공통국어", "문학", "비문학", "화법과작문", "언어와매체",
      "고1영어", "고2영어", "고3영어",
      "공통수학1", "공통수학2", "대수", "미적분1", "미적분2", "확률과 통계", "기하",
      "통합과학", "물리", "화학", "지구과학", "생명과학",
      "통합사회", "사회문화", "세계사", "경제", "정치와법", "지리",
      "한국사",
    ],
    subGroups: [
      { label: "국어", items: ["공통국어", "문학", "비문학", "화법과작문", "언어와매체"] },
      { label: "영어", items: ["고1영어", "고2영어", "고3영어"] },
      { label: "수학", items: ["공통수학1", "공통수학2", "대수", "미적분1", "미적분2", "확률과 통계", "기하"] },
      { label: "과학탐구", items: ["통합과학", "물리", "화학", "지구과학", "생명과학"] },
      { label: "사회탐구", items: ["통합사회", "사회문화", "세계사", "경제", "정치와법", "지리"] },
      { label: "한국사", items: ["한국사"] },
    ],
  },
];

export const allCategories = categoryGroups.flatMap((g) => g.items);

export function getCategoryLabel(category: string): string {
  const highschoolGroup = categoryGroups.find((g) => g.label === "고등학생(대학입시)");
  if (highschoolGroup?.items.includes(category)) {
    return `(고등학생)${category}`;
  }

  const middleGroup = categoryGroups.find((g) => g.label === "중학생");
  if (middleGroup?.items.includes(category)) {
    return `(중학생)${category}`;
  }

  const freeGroup = categoryGroups.find((g) => g.label === "무료 내신 자료");
  if (freeGroup?.subGroups) {
    for (const sg of freeGroup.subGroups) {
      if (sg.items.includes(category)) {
        if (sg.label === category) return category;
        return `(${sg.label})${category}`;
      }
    }
  }

  return category;
}

export type Category = string;

export type BreadcrumbItem = {
  name: string;
  href: string | null;
};

export function getBreadcrumb(category: string | null): BreadcrumbItem[] {
  if (!category) return [];

  // 최상위 그룹 자체인 경우
  const topGroup = categoryGroups.find((g) => g.label === category);
  if (topGroup) return [{ name: category, href: null }];

  // 무료 내신 자료 하위 계층 처리 (2단계 / 3단계)
  const freeGroup = categoryGroups.find((g) => g.label === "무료 내신 자료");
  if (freeGroup?.subGroups) {
    // 2단계: 국어/영어/수학 등 subGroup 라벨
    const subGroup = freeGroup.subGroups.find((sg) => sg.label === category);
    if (subGroup) {
      return [
        { name: "무료 내신 자료", href: "/?category=무료 내신 자료" },
        { name: category, href: null },
      ];
    }
    // 3단계: 공통국어/문학 등 subGroup 내 항목
    for (const sg of freeGroup.subGroups) {
      if (sg.items.includes(category)) {
        return [
          { name: "무료 내신 자료", href: "/?category=무료 내신 자료" },
          { name: sg.label, href: `/?category=${sg.label}` },
          { name: category, href: null },
        ];
      }
    }
  }

  // 고등학생/중학생 하위 항목 (수시/정시/공부법/고교입시)
  for (const group of categoryGroups) {
    if (group.label === "무료 내신 자료") continue;
    if (group.items.includes(category) && group.label !== category) {
      return [
        { name: group.label, href: `/?category=${group.label}` },
        { name: category, href: null },
      ];
    }
  }

  return [{ name: category, href: null }];
}
