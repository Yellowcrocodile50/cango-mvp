export const categoryGroups = [
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
] as const;

export const allCategories = categoryGroups.flatMap((g) => g.items);

export type Category = (typeof allCategories)[number];
