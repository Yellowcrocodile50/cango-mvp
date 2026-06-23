// 계좌이체 주문은 "입금 완료했어요" 시점에 생성한다.
// 체크아웃에서 만든 주문 데이터를 입금 안내 페이지로 넘기기 위한 세션 저장소 키/타입.

export const BANK_ORDER_KEY = "cango-bank-order";

export interface BankOrderRow {
  material_id: string;
  buyer_id: string;
  buyer_email: string;
  buyer_phone: string | null;
  amount: number;
  payment_status: string;
  order_id: string;
  payment_method: string;
  cash_receipt_requested: boolean;
  cash_receipt_phone: string | null;
}

export interface BankOrderStash {
  orderId: string;
  rows: BankOrderRow[];
  materialIds: string[];
}
