/* Supabase(PostgREST)는 한 응답에 최대 1000행만 돌려주고 초과분은 에러 없이 버린다.
   행이 1000개를 넘으면 공급자 화면에서 오래된 주문·매출·회원이 조용히 빠진다.
   다 받을 때까지 1000행씩 끊어서 가져온다.

   ⚠️ page()가 만드는 쿼리는 유일한 컬럼(id 등)까지 포함해 정렬해야 한다.
   정렬이 없거나 동점이 있으면 청크 경계에서 행이 중복되거나 빠진다. */
export const FETCH_CHUNK = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += FETCH_CHUNK) {
    const { data, error } = await page(from, from + FETCH_CHUNK - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < FETCH_CHUNK) return { data: rows, error: null };
  }
}

/* `.in("id", ids)`에 id를 수백 개 넣으면 요청 URL이 길어져 Bad Request로 통째로 실패한다
   (profiles 수백 개에서 실측). id를 나눠 여러 번 조회해 합친다. */
export const IN_CHUNK = 200;

export async function fetchByIdChunks<T>(
  ids: string[],
  page: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await page(ids.slice(i, i + IN_CHUNK));
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}
