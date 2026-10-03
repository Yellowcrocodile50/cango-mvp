-- 아이디·비밀번호 찾기 요청 기록 — 메일 남발(남의 메일함 폭탄, 발송 비용) 방지용 횟수 제한
--
-- /api/auth/find-userid, /api/auth/request-password-reset이 요청마다 한 줄 남기고,
-- 최근 1시간 동안 같은 대상(이메일·아이디)과 같은 IP의 요청 수를 세어 넘으면 메일을 보내지 않는다.
-- 원문 IP·이메일은 저장하지 않는다. 서버 비밀값으로 만든 HMAC만 남긴다.
--
-- 접근: service_role(서버 라우트)만. RLS를 켜고 정책을 두지 않으며 anon·authenticated 권한도 회수한다.
--
-- 롤백: drop table if exists public.auth_recovery_requests;

create table if not exists public.auth_recovery_requests (
  id bigserial primary key,
  kind text not null check (kind in ('find_userid', 'reset_password')),
  target_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_recovery_requests_target_idx
  on public.auth_recovery_requests (target_hash, created_at);
create index if not exists auth_recovery_requests_ip_idx
  on public.auth_recovery_requests (ip_hash, created_at);

alter table public.auth_recovery_requests enable row level security;
revoke all on public.auth_recovery_requests from anon, authenticated;

-- 오래된 기록 정리용 인덱스. 횟수 제한은 최근 1시간만 보므로, 라우트가 기록할 때 하루 지난 행을 함께 지운다
-- (거절된 요청도 기록되므로 정리하지 않으면 계속 쌓인다 — 배포 전 Claude·Codex 리뷰).
create index if not exists auth_recovery_requests_created_idx
  on public.auth_recovery_requests (created_at);
