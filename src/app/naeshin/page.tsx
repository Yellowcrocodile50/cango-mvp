import type { Metadata } from "next";
import NaeshinClient from "./NaeshinClient";

export const metadata: Metadata = {
  title: "내신 계산기",
  description:
    "지금까지의 내신 성적으로 목표 대학 합격을 위해 남은 학기에 필요한 등급을 예측해보세요. 학생부교과전형 등급컷 기반 단순 예측 서비스입니다.",
  alternates: { canonical: "https://www.cango.kr/naeshin" },
};

export default function NaeshinPage() {
  return <NaeshinClient />;
}
