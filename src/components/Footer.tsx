export default function Footer() {
  return (
    <footer className="border-t border-[#d6e4d3] bg-[#eaf2e8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-[#5a7d50]">
          <div>
            <h3 className="font-bold text-[#365927] mb-3">CANGO</h3>
            <p>PDF 자료 마켓플레이스</p>
            <p>당신의 지식을 거래하세요.</p>
          </div>
          <div>
            <h3 className="font-bold text-[#365927] mb-3">고객센터</h3>
            <p>이메일: youCANGO@gmail.com</p>
            <p>운영시간: 평일 10:00 - 18:00</p>
          </div>
          <div>
            <h3 className="font-bold text-[#365927] mb-3">안내</h3>
            <p>이용약관</p>
            <p>개인정보처리방침</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[#d6e4d3] text-xs text-[#8aab82] text-center">
          &copy; 2026 CANGO. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
