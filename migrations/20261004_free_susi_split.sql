-- 무료 수시 자료를 학년·과목(+입시 정보)으로 옮긴다 (2026-10-04 사용자 요청)
--
-- ⚠️ 적용 시점: **새 코드 배포가 끝난 직후.** 지금 라이브 코드는 "무료-수시-고1-과학" 같은 값을 모른다.
--    먼저 옮기면 라이브에서 해당 자료가 무료로 인식되지 않아 무료 다운로드가 막힌다.
--    새 코드는 옛 값 "무료-수시"도 그대로 읽으므로, 배포 → 이 SQL 순서면 어느 순간에도 깨지지 않는다.
--
-- 대상: category = '무료-수시'인 살아 있는 자료 37개를 id로 고정해서 옮긴다(제목 패턴에 기대지 않게).
--   고1 과학 3 · 고1 사회 2 · 고1 한국사 3 · 입시 정보 29(선행학습 영향평가 보고서 27 + 생기부 가이드 2)
--   통합과학2·통합사회2·한국사2는 2022 개정 교육과정 고1 과목이라 고1로 분류했다.
--
-- 롤백: update public.materials set category = '무료-수시'
--        where category in ('무료-수시-고1-과학','무료-수시-고1-사회','무료-수시-고1-한국사','무료-수시-입시정보');

update public.materials set category = '무료-수시-고1-과학'
where category = '무료-수시' and id in (
  'ef54bf67-ce8e-418f-8c75-22aa2973403f',
  'b8d51555-243e-4bc2-a847-a554729a853e',
  '69e0b897-dcd8-4134-99ad-629b0c283540'
);

update public.materials set category = '무료-수시-고1-사회'
where category = '무료-수시' and id in (
  '803872fb-12ec-4c90-b285-8d11ea3a462d',
  '984efcae-a039-40fd-a1f2-6da7d1ed679f'
);

update public.materials set category = '무료-수시-고1-한국사'
where category = '무료-수시' and id in (
  '9efab71a-b744-4a0c-9979-e7567239af28',
  '5735c498-e266-49b5-a327-4f23405bffc8',
  '17edc427-7ae4-40f2-a1b3-d23e73a0f730'
);

-- 나머지(보고서·생기부 가이드) — 위에서 옮기지 않은 '무료-수시' 전부
update public.materials set category = '무료-수시-입시정보'
where category = '무료-수시' and is_deleted = false;
