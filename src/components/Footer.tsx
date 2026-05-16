import Link from "next/link";
import { COMPANY_INFO } from "@/lib/companyInfo";

export default function Footer() {
  return (
    <footer className="border-t border-[#d6e4d3] bg-[#eaf2e8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-[#5a7d50]">
          <div>
            <h3 className="font-bold text-[#365927] mb-3">CANGO</h3>
            <p>선배들이 만든 입시 자료 마켓플레이스</p>
            <p className="text-xs mt-1 text-[#8aab82]">수시·정시·공부법까지 검증된 자료를<br />쉽게 구매하고 즉시 다운로드하세요.</p>
          </div>
          <div>
            <h3 className="font-bold text-[#365927] mb-3">고객센터</h3>
            <p>이메일: {COMPANY_INFO.email}</p>
            <p>전화: {COMPANY_INFO.phone}</p>
            <p>운영시간: {COMPANY_INFO.customerSupportHours}</p>
          </div>
          <div>
            <h3 className="font-bold text-[#365927] mb-3">안내</h3>
            <Link href="/terms" className="block hover:text-[#365927] transition">
              이용약관
            </Link>
            <Link href="/privacy" className="block hover:text-[#365927] transition">
              개인정보 처리방침
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#d6e4d3] text-xs text-[#8aab82] space-y-1">
          <p>
            상호: {COMPANY_INFO.serviceName} | 대표: {COMPANY_INFO.representative} |
            사업자등록번호: {COMPANY_INFO.businessNumber}
          </p>
          <p>
            통신판매업 신고번호: {COMPANY_INFO.ecommerceNumber}
          </p>
          <p>주소: {COMPANY_INFO.address}</p>
          <p className="pt-2">&copy; 2026 CANGO. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
