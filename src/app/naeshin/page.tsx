import type { Metadata } from "next";
import NaeshinClient from "./NaeshinClient";

const NAESHIN_URL = "https://www.cango.kr/naeshin";
const NAESHIN_TITLE = "내신 계산기 · 내신 등급/지원 가능 대학 계산";
const NAESHIN_DESCRIPTION =
  "무료 내신 계산기 - 지금까지의 내신 성적으로 목표 대학 합격을 위해 남은 학기에 필요한 등급을 예측하고, 학생부교과전형 등급컷 기반으로 지원 가능한 대학을 확인하세요.";

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
