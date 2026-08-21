/**
 * 입금은 확인됐지만 아직 `pending`으로 둔 주문의 `order_id`.
 *
 * 통계·정산 집계에서만 `done`처럼 취급한다. 실제 상태를 바꾸지 않는 이유는,
 * 상태를 done으로 넘기면 자료 발송 메일이 따라 나가기 때문이다.
 *
 * `order-1786967700000-recov1` = 14,000원(2026-08-17 20:55 KST) 복구 건.
 * 다건 주문 INSERT 버그로 레코드가 없던 걸 되살렸는데, **어떤 자료를 샀는지 구매자
 * 확인이 끝나지 않아** 발송을 미루고 있다. 메일 차단은 별도로
 * `api/confirm-bank/route.ts`의 `EMAIL_SUPPRESSED_ORDER_IDS`가 맡는다.
 *
 * 🔜 주문이 실제로 done이 되면 이 목록에서 빼면 된다. 남겨둬도 결과는 같다 —
 * `done이거나 이 목록에 있으면` 조건이라 같은 행이 두 번 세어지지 않는다.
 */
export const DEPOSIT_CONFIRMED_ORDER_IDS = new Set<string>([
  "order-1786967700000-recov1",
]);

/** Supabase `.or()`에 넣을 필터. "결제 완료 or 입금 확인된 보류 주문" */
export const PAID_OR_FILTER = [
  "payment_status.eq.done",
  ...[...DEPOSIT_CONFIRMED_ORDER_IDS].map((id) => `order_id.eq.${id}`),
].join(",");
