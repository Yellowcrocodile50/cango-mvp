-- 카드 결제 확정의 "결제번호는 한 번만" 을 DB에서 원자적으로 보장한다
--
-- /api/confirm은 "이미 done인 행이 있나" 조회 → pending 조회 → UPDATE 순서라, 같은 결제번호로
-- 요청 두 건이 동시에 들어오면 한쪽이 조회를 통과한 뒤 다른 쪽이 확정하고, 그 사이 끼워 넣은
-- 새 pending 행까지 추가 결제 없이 확정될 수 있었다(배포 전 Codex 리뷰가 짚음).
-- INSERT 정책은 order_id 값을 막지 않으므로 orders 쪽 조건만으로는 닫을 수 없다.
--
-- 라우트는 확정 작업 맨 앞에서 결제번호를 여기에 INSERT한다. 먼저 넣은 요청만 진행하고,
-- 유니크 위반(23505)이면 409. 확정이 실패하면 claim을 지워 재시도를 허용한다.
--
-- 접근: service_role(서버 라우트)만. RLS를 켜고 정책을 두지 않으며 anon·authenticated 권한도 회수한다.
-- 기존 카드 결제 확정 기록(payment_key)이 없는 시점에 적용해 백필하지 않았다.
--
-- 롤백: drop table if exists public.payment_claims;

create table if not exists public.payment_claims (
  payment_id text primary key,
  claimed_at timestamptz not null default now()
);

alter table public.payment_claims enable row level security;
revoke all on public.payment_claims from anon, authenticated;

-- 확정에 성공한 점유 표시. 오래된 점유 정리는 confirmed_at이 NULL인 것(버려진 것)만 지운다.
-- 성공한 점유까지 시간 기준으로 지우면 그 결제번호를 다시 쓸 수 있게 된다(배포 전 Codex 리뷰).
alter table public.payment_claims add column if not exists confirmed_at timestamptz;
