-- 쓰지 않는 테이블 권한 회수 (이중 방어선)
--
-- 아래 권한들은 지금도 RLS 정책이 막고 있어 악용 가능한 구멍은 아니다.
-- 다만 레포를 공개하면 스키마가 드러나므로, 정책 하나가 잘못 수정되는
-- 순간 곧바로 뚫리는 상태를 남겨두지 않는다. GRANT와 RLS 두 겹으로 막는다.
--
-- 남겨야 하는 것 (앱이 실제로 쓴다):
--   orders  INSERT  ← anon: 비로그인 게스트 주문 (checkout, bank-pending)
--   orders  UPDATE  ← authenticated: 공급자 주문관리의 발송완료/현금영수증 처리
--   naeshin_requests INSERT/DELETE ← authenticated: 진로 탐구 찜 담기/해제
--   profiles UPDATE(marketing_agreed, marketing_agreed_at) ← 마이페이지 토글
--     (앞선 20260824_fix_role_privilege_escalation.sql에서 컬럼 단위로 재부여)

-- profiles: DELETE 정책이 없다. 탈퇴는 /api/account/withdraw가 service_role로 처리한다.
revoke delete on public.profiles from anon, authenticated;

-- orders: DELETE 정책이 없다(주문은 지우지 않고 상태로 관리한다).
--         UPDATE는 공급자(authenticated)만 쓰므로 anon에서 회수한다.
revoke delete on public.orders from anon, authenticated;
revoke update on public.orders from anon;

-- materials: 등록·수정·삭제는 모두 로그인한 공급자의 일이다.
revoke insert, update, delete on public.materials from anon;

-- naeshin_requests: 모든 정책이 authenticated 전용이고, UPDATE 정책은 아예 없다.
revoke insert, update, delete on public.naeshin_requests from anon;
revoke update on public.naeshin_requests from authenticated;
