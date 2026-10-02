-- 무료 자료 등록을 DB 차원에서 1회로 고정한다 (멱등성)
--
-- /api/register-free는 "이미 받았나 조회 → 없으면 INSERT" 순서라,
-- 같은 사용자의 요청 두 건이 동시에 들어오면 둘 다 조회를 통과해 주문이 2건 생길 수 있었다.
-- 앱 코드의 조회만으로는 막을 수 없어서, (구매자, 자료) 조합을 무료 완료 주문에 한해 유일하게 만든다.
-- 라우트는 이 제약 위반(23505)을 "이미 등록됨"으로 처리한다.
--
-- 범위: amount = 0 AND payment_status = 'done'인 행만.
--   - 무료 완료 주문은 register-free만 만든다(무료 자료는 장바구니에 담을 수 없다).
--   - 탈퇴로 익명화된 주문(buyer_id IS NULL)은 제외.
-- 적용 전 중복 0건 확인함.
--
-- 롤백: drop index if exists public.orders_free_buyer_material_unique;

create unique index if not exists orders_free_buyer_material_unique
  on public.orders (buyer_id, material_id)
  where amount = 0 and payment_status = 'done' and buyer_id is not null;
