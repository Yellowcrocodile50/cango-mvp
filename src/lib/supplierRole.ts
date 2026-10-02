import { supabase } from "@/lib/supabase";

/**
 * 이 사용자가 공급자인지 — 화면 분기(공급자 대시보드 진입, 업로드 폼, 헤더 메뉴)용.
 *
 * 기준은 `profiles.role` 하나다. 서버 권한(RLS의 is_supplier(), withdraw 라우트)이 이걸 보고,
 * 공급자 승격도 대시보드에서 profiles.role을 바꾸는 것으로 정해져 있다.
 * `user_metadata.role`은 사용자가 updateUser로 스스로 고칠 수 있어 기준으로 쓰지 않는다.
 *
 * profiles SELECT 정책이 본인 행 읽기를 허용하므로 브라우저 세션으로 조회된다.
 * 데이터 접근은 어차피 RLS가 막으니, 이 함수는 "무엇을 보여줄지"만 정한다.
 */
export async function fetchIsSupplier(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "supplier";
}
