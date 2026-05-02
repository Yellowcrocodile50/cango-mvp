import { COMPANY_INFO } from "@/lib/companyInfo";

export const metadata = {
  title: "개인정보 처리방침 | CANGO",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[#365927] mb-8">개인정보 처리방침</h1>

      <div className="space-y-8 text-sm leading-relaxed text-[#365927]">
        <section>
          <p>
            {COMPANY_INFO.serviceName}(이하 &ldquo;회사&rdquo;)는 「개인정보 보호법」
            제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하게
            처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제1조 (수집하는 개인정보 항목)</h2>
          <p>회사는 다음의 개인정보를 수집·이용합니다.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>회원가입 시: 이메일, 비밀번호, 아이디, 이름(또는 닉네임), 휴대전화번호</li>
            <li>결제 시: 결제 수단 정보, 구매 내역, 거래 금액</li>
            <li>자동 수집: 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP, 기기 정보</li>
            <li>선택 항목: 마케팅 정보 수신 동의 여부</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제2조 (개인정보의 처리 목적)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 가입 및 본인 확인</li>
            <li>서비스 제공 및 계약 이행 (자료 판매·구매 중개, 다운로드 권한 관리)</li>
            <li>결제 및 정산 처리</li>
            <li>고객 문의 응대 및 분쟁 해결</li>
            <li>마케팅 및 광고에의 활용 (선택 동의 시)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제3조 (개인정보의 보유 및 이용 기간)</h2>
          <p>
            회사는 회원 탈퇴 시까지 개인정보를 보유하며, 탈퇴 즉시 파기합니다. 단,
            관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>전자상거래법: 계약·청약철회 기록 5년, 대금결제 및 재화공급 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
            <li>통신비밀보호법: 접속 로그 3개월</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제4조 (개인정보의 제3자 제공)</h2>
          <p>
            회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단,
            다음의 경우에는 예외적으로 제공할 수 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령에 의거하거나 수사 목적으로 관계 기관의 요구가 있는 경우</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제5조 (개인정보 처리의 위탁)</h2>
          <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Supabase Inc. — 회원 인증 및 데이터베이스 관리</li>
            <li>Vercel Inc. — 호스팅 서비스</li>
            <li>토스페이먼츠 — 결제 처리 (이용 신청 후)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제6조 (정보주체의 권리·의무 및 행사 방법)</h2>
          <p>
            이용자는 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를
            행사할 수 있으며, 회사는 지체 없이 조치합니다. 권리 행사는 고객센터
            ({COMPANY_INFO.email})를 통해 신청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제7조 (개인정보의 안전성 확보 조치)</h2>
          <p>
            회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>비밀번호 암호화 저장 및 전송 구간 암호화(HTTPS)</li>
            <li>개인정보 접근 권한 최소화 및 통제</li>
            <li>접근 로그 기록 및 정기 점검</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제8조 (개인정보 보호책임자)</h2>
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄하여 책임지는 개인정보 보호책임자를
            지정하고 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>성명: {COMPANY_INFO.representative}</li>
            <li>이메일: {COMPANY_INFO.email}</li>
            <li>연락처: {COMPANY_INFO.phone}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제9조 (개인정보 처리방침의 변경)</h2>
          <p>
            본 처리방침은 시행일로부터 적용되며, 법령 및 정책 변경에 따라 내용이
            추가·삭제될 수 있습니다. 변경 시 변경 사유 및 적용일을 사전에 공지합니다.
          </p>
        </section>

      </div>
    </div>
  );
}
