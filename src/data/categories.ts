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

export const allCategories = categoryGroups.flatMap((g) => g.items);

export const FREE_PARENT_CATEGORY = "무료 입시 자료";

// 무료 입시 자료 subGroup 내부 label → UI 표시 이름
export const FREE_SUB_DISPLAY: Record<string, string> = {
  "고등": "고등학생(대학입시)",
  "중학": "중학생",
};

// "무료-수시" → "수시" 처리
function stripFreePrefix(s: string): string {
  return s.startsWith("무료-") ? s.slice(3) : s;
}

export function isFreeCategory(category: string): boolean {
  const freeGroup = categoryGroups.find((g) => g.label === FREE_PARENT_CATEGORY);
  if (!freeGroup) return false;
  if (category === FREE_PARENT_CATEGORY) return true;
  return freeGroup.items.includes(category);
}

export function getCategoryLabel(category: string): string {
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
