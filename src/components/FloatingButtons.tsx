"use client";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_BpejX/friend";

export default function FloatingButtons() {
  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-8 sm:right-6">
      <a
        href={KAKAO_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg transition hover:scale-110 active:scale-95"
        style={{ backgroundColor: "#FEE500" }}
        aria-label="카카오채널 문의"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7">
          <path fill="#3A1D1D" d="M12 3C6.477 3 2 6.701 2 11.25c0 2.85 1.696 5.367 4.29 6.916-.172.61-.625 2.208-.715 2.55-.112.42.153.414.322.302.132-.088 2.1-1.425 2.953-2.002.698.098 1.415.15 2.15.15 5.523 0 10-3.701 10-8.25C22 6.7 17.523 3 12 3z" />
          <text x="12" y="13.2" textAnchor="middle" fontSize="4.8" fontWeight="bold" fill="#FEE500" fontFamily="Arial, sans-serif">TALK</text>
        </svg>
        <span className="text-[9px] font-bold mt-0.5" style={{ color: "#3A1D1D" }}>
          문의하기
        </span>
      </a>
    </div>
  );
}
