-- 결제 없이 유료 자료를 받을 수 있던 구멍 차단
--
-- 발견: 2026-08-24. 로그인만 하면 결제 없이 유료 PDF 45건 전부를 받을 수 있었다.
--
-- 원인: 주문 행을 클라이언트가 직접 INSERT하는데(checkout/page.tsx, bank-pending),
--       RLS가 buyer_id만 검사하고 payment_status·amount는 전혀 보지 않았다.
--
--   ① 결제 건너뛰기 — payment_status:'done'으로 직접 INSERT하면 스토리지 RLS
--      (materials_select_buyer_purchased)가 그 사람을 구매자로 인정한다.
--      실측: 위조 전 접근 가능 파일 0개 → 위조 후 1개.
--
--   ② 금액 위조 — /api/confirm은 "DB의 amount 합계"와 "PortOne 실제 결제액"을
--      대조하는데, 그 amount 자체가 클라이언트가 넣은 값이다. amount=100으로
--      넣고 100원을 결제하면 양쪽이 100이라 검증을 통과한다.
--
-- 조치: INSERT 시점에 상태와 금액을 DB가 강제한다.
--   - payment_status는 'pending'만 허용. 'done'으로 바꾸는 건 service_role을 쓰는
--     서버 라우트(confirm / confirm-bank / register-free)만 할 수 있다.
--   - amount는 실제 materials.price의 배수여야 한다. 장바구니가 수량을 지원하므로
--     (CartContext.setItemQuantity) 배수를 허용하되, 무료 자료는 0원으로 고정한다.
--
-- 게스트 주문(buyer_id null)은 그대로 허용한다 — 비로그인 계좌이체 결제 경로다.
-- buyer_id가 null이면 스토리지 정책이 구매자로 인정하지 않으므로 악용 여지가 없다.

drop policy if exists orders_insert_buyer on public.orders;

create policy orders_insert_buyer on public.orders
for insert to anon, authenticated
with check (
  (buyer_id = (select auth.uid()) or buyer_id is null)
  and payment_status = 'pending'
  and exists (
    select 1
    from public.materials m
    where m.id = material_id
      and m.is_deleted = false
      and case
            when m.price = 0 then amount = 0
            else amount > 0 and amount % m.price = 0
          end
  )
);
