import Link from "next/link";

/* 아이디 찾기 메일 발송 후 안내 페이지. 가입된 이메일일 때만 이 페이지로 넘어온다.
   검색 색인 제외는 상위 find-id/layout이 맡는다. */
export default function FindIdSentPage() {
  return (
    <div className="max-w-sm mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-6 text-[#365927]">아이디 찾기</h1>
      <div className="p-5 bg-green-50 border border-green-200 rounded-lg text-green-700 leading-relaxed">
        <p className="font-medium">아이디를 이메일로 보내드렸습니다!</p>
        <p className="mt-1">이메일을 확인해주세요.</p>
      </div>
      {/* 네이버·iCloud에서 "메일이 안 왔다" 문의가 실제로 있었다 — 스팸함·프로모션 탭 안내 */}
      <p className="text-sm text-[#5a7d50] mt-4 leading-relaxed break-keep">
        <span className="block">몇 분이 지나도 안 보이면</span> 스팸함이나 프로모션 탭도 한번 확인해 주세요.
      </p>
      <Link
        href="/login"
        className="mt-8 flex items-center justify-center w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition"
      >
        로그인으로 돌아가기
      </Link>
    </div>
  );
}
