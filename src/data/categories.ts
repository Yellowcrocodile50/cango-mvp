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
  {
    label: "기타",
    items: ["기타"],
  },
];

export const allCategories = categoryGroups.flatMap((g) => g.items);

export type Category = string;
