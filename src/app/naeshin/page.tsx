import type { Metadata } from "next";
import NaeshinClient from "./NaeshinClient";

const NAESHIN_URL = "https://www.cango.kr/naeshin";
const NAESHIN_TITLE = "내신 계산기 · 학과별 등급컷으로 지원 가능 대학 계산";
const NAESHIN_DESCRIPTION =
  "무료 내신 계산기 - 지금까지의 내신 성적으로 목표 대학 합격을 위해 남은 학기에 필요한 등급을 예측하세요. 의대·공대·자연계는 물론 사범대(교육학·국어교육·영어교육)·법학과·미디어커뮤니케이션·정치외교 등 문과 학과까지, 38개 대학 21개 학과의 학생부교과전형 등급컷으로 지원 가능 대학을 확인할 수 있어요.";

export const metadata: Metadata = {
  title: NAESHIN_TITLE,
  description: NAESHIN_DESCRIPTION,
  keywords: [
    "내신 계산기",
    "내신 등급 계산기",
    "내신 등급 계산",
    "내신 평균 계산",
    "필요 내신 등급",
    "지원 가능 대학",
    "학생부교과전형",
    "등급컷",
    "고등 내신",
    // 문과 계열 (v2.0, 2026-08-02) — 학과명 검색 유입 확보용
    "문과 내신 계산기",
    "문과 등급컷",
    "사범대 내신",
    "사범대 등급컷",
    "교육학과 등급컷",
    "국어교육과 등급컷",
    "영어교육과 등급컷",
    "법학과 내신",
    "미디어커뮤니케이션학과 등급컷",
    "정치외교학과 등급컷",
    "학과별 등급컷",
    "CANGO",
    "캔고",
  ],
  alternates: { canonical: NAESHIN_URL },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: NAESHIN_URL,
    siteName: "CANGO",
    title: NAESHIN_TITLE,
    description: NAESHIN_DESCRIPTION,
  },
};

export default function NaeshinPage() {
  return <NaeshinClient />;
}
