-- 진로 탐구(/career) 결과 카드에서 "등급컷 준비되면 알려주세요"를 받기 위한 확장.
-- 새 테이블을 만들지 않고 기존 naeshin_requests를 재사용한다 —
-- 공급자 대시보드(/supplier/naeshin-requests)가 이미 이 테이블을 보고 있고,
-- "학과 추가 요청"이라는 성격이 자유 문의와 같기 때문이다.
alter table public.naeshin_requests
  add column if not exists department text,
  add column if not exists notified_at timestamptz;

comment on column public.naeshin_requests.department is
  '진로 탐구에서 알림 신청한 학과명(careerDepartments의 name 기준). null이면 내신 계산기 자유 문의.';
comment on column public.naeshin_requests.notified_at is
  '해당 학과가 계산기에 추가돼 신청자에게 알린 시각. null이면 미발송.';

-- RLS 정책은 content만 검사하므로 department 길이는 컬럼 제약으로 막는다.
alter table public.naeshin_requests
  add constraint naeshin_requests_department_len
  check (department is null or char_length(department) between 1 and 100);

-- 같은 사람이 같은 학과를 여러 번 신청하지 못하게 한다.
-- 자유 문의는 department가 null이라 이 제약 밖에 있다(부분 인덱스).
create unique index if not exists naeshin_requests_user_department_uniq
  on public.naeshin_requests (user_id, department)
  where department is not null;

-- 기존 SELECT 정책이 공급자 전용이라 신청자 본인도 자기 신청 내역을 못 읽었다.
-- 결과 카드에 "이미 신청함" 상태를 표시하려면 본인 행 조회가 필요하다.
create policy "users can view their own requests"
  on public.naeshin_requests
  for select to authenticated
  using (auth.uid() = user_id);

-- ── 2차: 찜 해제 ────────────────────────────────────────────────
-- 찜은 되돌릴 수 있어야 한다. 잘못 누른 찜을 지우지 못하면 "정말 가고 싶은 학과"라는
-- 신호가 오염되고, 그 신호가 이 기능의 유일한 산출물이다.
-- 자유 문의(department is null)는 운영 기록이라 삭제 대상에서 뺀다.
create policy "users can remove their own department wishes"
  on public.naeshin_requests
  for delete to authenticated
  using (auth.uid() = user_id and department is not null);

-- ── 3차: INSERT 가드레일 ─────────────────────────────────────────
-- 찜 INSERT 정책이 department를 전혀 검증하지 않아, 로그인한 사람이면 콘솔에서
-- 아무 학과명이나 무제한으로 넣을 수 있었다(화면 버튼만 막혀 있었다).
-- 학과별 집계가 "다음에 어느 학과를 넣을까"의 근거라 오염되면 기능이 무의미해진다.
-- 학과명 화이트리스트는 유지비가 커서(학과 추가마다 마이그레이션) 사람당 상한만 둔다.
create or replace function public.career_wish_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.naeshin_requests
  where user_id = auth.uid() and department is not null
$$;

drop policy "authenticated users can submit a request" on public.naeshin_requests;

create policy "authenticated users can submit a request"
  on public.naeshin_requests
  for insert to authenticated
  with check (
    char_length(content) > 0
    and char_length(content) <= 500
    and auth.uid() = user_id
    and (
      department is null
      or (
        content like '[진로 탐구]%'
        and public.career_wish_count() < 200
      )
    )
  );
