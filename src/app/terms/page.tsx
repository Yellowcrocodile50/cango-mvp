import { COMPANY_INFO } from "@/lib/companyInfo";

export const metadata = {
  title: "이용약관 | CANGO",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold text-[#365927] mb-2">이용약관</h1>
      <p className="text-xs text-[#8aab82] mb-8">
        시행일자: 2026-04-29 (초안)
      </p>

      <div className="space-y-8 text-sm leading-relaxed text-[#365927]">
        <section>
          <h2 className="text-base font-semibold mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 {COMPANY_INFO.serviceName}(이하 &ldquo;회사&rdquo;)가 제공하는
            PDF 자료 마켓플레이스 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여
            회사와 이용자의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을
            목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제2조 (정의)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>&ldquo;이용자&rdquo;란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 의미합니다.</li>
            <li>&ldquo;구매자&rdquo;란 자료를 구매하는 회원을 의미합니다.</li>
            <li>&ldquo;공급자&rdquo;란 자료를 등록·판매하는 회원을 의미합니다.</li>
            <li>&ldquo;자료&rdquo;란 공급자가 등록한 PDF 형태의 디지털 콘텐츠를 의미합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제3조 (약관의 효력 및 변경)</h2>
          <p>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생하며, 회사는 관련 법령에
            위배되지 않는 범위 내에서 약관을 변경할 수 있습니다. 변경 시 변경 사유 및
            적용일을 사전에 공지합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제4조 (회원가입)</h2>
          <p>
            이용자는 회사가 정한 양식에 따라 회원정보를 기입하고 본 약관 및
            개인정보 처리방침에 동의함으로써 회원가입을 신청합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제5조 (서비스의 제공)</h2>
          <p>
            회사는 다음과 같은 서비스를 제공합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>PDF 자료의 등록·판매 및 구매 중개</li>
            <li>회원의 구매 내역 및 다운로드 관리</li>
            <li>기타 회사가 정하는 부가 서비스</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제6조 (구매 및 결제)</h2>
          <p>
            구매자는 서비스 내 결제 수단을 통해 자료를 구매할 수 있으며, 결제는
            토스페이먼츠 등 회사가 지정한 PG사를 통해 처리됩니다. 결제 완료 후
            구매자는 마이페이지에서 자료를 다운로드할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제7조 (환불)</h2>
          <p>
            디지털 콘텐츠 특성상 다운로드가 완료된 자료는 원칙적으로 환불이
            제한됩니다. 단, 자료 자체의 결함이 명백한 경우 회사 정책에 따라 환불이
            가능합니다. 환불 신청은 고객센터({COMPANY_INFO.email})로 문의해주세요.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제8조 (회사의 책임 및 의무)</h2>
          <p>
            회사는 안정적인 서비스 제공을 위해 노력하며, 이용자의 개인정보 보호를
            위한 보안 시스템을 갖춥니다. 단, 이용자의 귀책사유로 발생한 손해에
            대해서는 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제9조 (이용자의 의무)</h2>
          <p>
            이용자는 타인의 저작물을 무단으로 등록하거나, 구매한 자료를 제3자에게
            재배포·재판매하여서는 안 됩니다. 위반 시 회사는 이용 정지 및 법적 조치를
            취할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">제10조 (분쟁 해결)</h2>
          <p>
            본 약관과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 상호 협의에 의해
            해결하며, 협의가 이루어지지 않을 경우 관할 법원의 판결에 따릅니다.
          </p>
        </section>

        <section className="pt-6 border-t border-[#d6e4d3]">
          <p className="text-xs text-[#5a7d50]">
            <strong>※ 본 약관은 초안이며 사업자 등록 및 법무 검토 후 최종 확정됩니다.</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
