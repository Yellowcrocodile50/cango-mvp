// 검색 색인 제외: 네이버가 브랜드 검색("cango.kr")의 대표 문서로 홈 대신 이 약관 페이지를
// 노출해 왔다(서치어드바이저 실측: /terms 25클릭 = "cango.kr" 검색 25클릭과 정확히 일치).
// 약관류는 검색 유입 가치가 없으므로 색인에서 빼고 홈이 대표 문서가 되게 한다.
export const metadata = {
  title: "마케팅 정보 수신 동의",
  robots: { index: false, follow: true },
};

export default function MarketingTermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[#365927] mb-8">마케팅 정보 수신 동의</h1>

      <div className="space-y-8 text-sm leading-relaxed text-[#365927]">
        <section>
          <p>
            CANGO 및 제반 서비스 이용과 관련하여 필요한 사항을 규정합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 CANGO가 제공하는 마케팅 정보 수신에 동의함으로써, CANGO가 회원에게
            유용한 정보, 혜택, 소식 등을 전달하기 위한 내용을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제2조 (수집 및 이용 항목)</h2>
          <p>CANGO는 다음의 회원 정보를 활용하여 마케팅 정보를 제공합니다.</p>
          <ol className="list-decimal pl-5 space-y-1 mt-2">
            <li>아이디</li>
            <li>이메일 주소</li>
            <li>연락처(휴대전화 포함)</li>
            <li>학생(학년) 및 학부모 여부</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제3조 (수신 정보의 종류)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 아래와 같은 마케팅 정보를 수신할 수 있습니다.</li>
            <li>할인 코드, 이벤트, 캠페인 등 프로모션 정보</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제4조 (수신 방법)</h2>
          <p>마케팅 정보는 다음 중 하나 이상의 방법으로 발송됩니다.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>이메일</li>
            <li>문자 메시지(SMS, LMS)</li>
            <li>카카오톡 알림톡</li>
            <li>플랫폼 내 알림</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제5조 (동의 철회 및 변경)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 언제든지 마케팅 정보 수신에 대한 동의를 철회할 수 있습니다.</li>
            <li>동의 철회는 마이페이지 설정, 이메일 내 수신 거부 링크, 고객센터를 통해 요청 가능합니다.</li>
            <li>동의 철회 시, 마케팅 정보 수신은 즉시 중단되며, 철회 이전까지 제공된 정보의 이용에는 영향을 미치지 않습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제6조 (보유 및 이용 기간)</h2>
          <p>
            마케팅 정보 수신 동의는 철회 시점까지 유효하며, 수신 동의 철회 또는 회원 탈퇴 시
            즉시 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우에는 그에 따릅니다.
          </p>
        </section>
      </div>
    </div>
  );
}
