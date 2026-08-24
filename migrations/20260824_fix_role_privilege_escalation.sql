-- 권한 상승(privilege escalation) 차단
--
-- 발견: 2026-08-24. 일반 가입자가 스스로 supplier가 되어 전 회원(166명)의
-- 이메일·전화번호·학년을 읽을 수 있었다. 경로가 둘이었다.
--
--   A) 가입 시 role 주입
--      handle_new_user가 raw_user_meta_data->>'role'을 그대로 profiles.role에 넣었다.
--      앱은 'buyer'를 보내지만 그건 클라이언트 값일 뿐이라, 가입 엔드포인트를 직접
--      호출하며 'supplier'를 넣으면 그대로 통과했다.
--
--   B) 가입 후 자가 승격
--      profiles UPDATE 정책이 `auth.uid() = id`뿐이고 WITH CHECK가 없었다.
--      (Postgres는 UPDATE에서 WITH CHECK가 없으면 USING을 검사에 재사용하므로
--       role 값은 무엇으로 바꾸든 통과한다.) authenticated에 role 컬럼 UPDATE
--      권한이 있었고 차단 트리거도 없었다.
--
-- 두 경로 모두 is_supplier() → profiles_select_own_or_supplier로 이어져
-- 전 회원 조회가 열렸다. 실측: 승격 전 1명 → 승격 후 166명.
--
-- 함께 고친 것: materials INSERT/UPDATE에 공급자 검증이 없어 가입자 누구나
-- 홈 상품 목록(is_deleted=false만 필터)에 임의 항목을 올릴 수 있었다.

-- ─────────────────────────────────────────────────────────────
-- 1) 가입 시 클라이언트가 보낸 role을 신뢰하지 않는다
-- ─────────────────────────────────────────────────────────────
-- role을 'buyer'로 고정한다. 공급자는 가입 메타데이터가 아니라 관리자가
-- 대시보드(service_role)에서 profiles.role을 직접 승격시켜 만든다.
-- 나머지 필드는 신원·권한과 무관해 기존 동작을 유지한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, role, userid, user_type, grade, phone, marketing_agreed)
  values (
    new.id,
    new.email,
    'buyer',  -- ⚠️ raw_user_meta_data->>'role'을 쓰지 말 것 (클라이언트가 자유롭게 지정 가능)
    coalesce(new.raw_user_meta_data->>'userid', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'user_type', ''),
    nullif(new.raw_user_meta_data->>'grade', ''),
    public.normalize_phone(nullif(new.raw_user_meta_data->>'phone', '')),
    coalesce((new.raw_user_meta_data->>'marketing_agreed')::boolean, false)
  );
  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────
-- 2) 일반 사용자가 profiles를 직접 쓰지 못하게 한다
-- ─────────────────────────────────────────────────────────────
-- 컬럼 단위 REVOKE는 테이블 단위 GRANT를 깎아내지 못한다(Postgres 동작).
-- 그래서 테이블 권한을 회수한 뒤 필요한 컬럼만 다시 부여한다.
--
-- 앱이 profiles에 쓰는 곳은 마이페이지 마케팅 수신 토글 한 곳뿐이다
-- (src/app/mypage/page.tsx). 행 생성은 위 트리거가 SECURITY DEFINER로 하므로
-- INSERT 권한 회수의 영향을 받지 않는다.
revoke insert, update on public.profiles from anon, authenticated;
grant update (marketing_agreed, marketing_agreed_at) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) 자료 등록/수정은 실제 공급자만
-- ─────────────────────────────────────────────────────────────
-- 기존 정책은 supplier_id = auth.uid()만 봤다. 자기 id를 넣는 건 누구나 되므로
-- 가입자 아무나 상품을 올릴 수 있었다. is_supplier()를 함께 요구한다.
-- (is_supplier()는 profiles.role을 읽는데, 1·2번으로 그 값이 신뢰 가능해졌다.)
drop policy if exists materials_insert_supplier on public.materials;
create policy materials_insert_supplier on public.materials
  for insert to authenticated
  with check ((select auth.uid()) = supplier_id and public.is_supplier());

drop policy if exists materials_update_supplier on public.materials;
create policy materials_update_supplier on public.materials
  for update to authenticated
  using ((select auth.uid()) = supplier_id and public.is_supplier())
  with check ((select auth.uid()) = supplier_id and public.is_supplier());

-- DELETE는 그대로 둔다. 등록이 공급자로 제한된 이상 남의 행을 지울 수 없고,
-- 공급자 권한이 해제된 뒤에도 자기가 올린 자료는 정리할 수 있어야 한다.
