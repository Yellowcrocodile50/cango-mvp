import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { paymentId } = await req.json();

  if (!paymentId) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 이미 결제 완료 처리된 결제번호면 거절한다. INSERT 정책은 order_id 값을 막지 않으므로,
  // 끝난 결제번호로 새 pending 행을 넣고 다시 확정을 부르면 추가 결제 없이 자료가 열릴 수 있었다.
  const { data: used } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", paymentId)
    .eq("payment_status", "done")
    .limit(1);

  if (used && used.length > 0) {
    return NextResponse.json({ error: "이미 처리된 결제입니다." }, { status: 409 });
  }

  // 결제번호를 먼저 "점유"한다. payment_claims.payment_id가 기본키라 동시에 와도 한 요청만 성공한다.
  // 위의 done 조회만으로는 조회와 확정 사이에 다른 요청이 끼어드는 경우를 막지 못한다.
  const claim = () => supabase.from("payment_claims").insert({ payment_id: paymentId });
  let { error: claimError } = await claim();

  // 확정 도중 함수가 죽으면 finally가 못 돌아 점유가 남는다. 10분 넘게 남았는데 done이 아닌 점유는
  // 버려진 것으로 보고 한 번 치운 뒤 다시 점유한다. (위에서 done이 없음을 이미 확인했다.)
  // 오래된 것만 지우는 조건부 DELETE라, 동시에 여러 요청이 와도 다시 점유하는 건 하나뿐이다.
  if (claimError?.code === "23505") {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: cleared } = await supabase
      .from("payment_claims")
      .delete()
      .eq("payment_id", paymentId)
      .lt("claimed_at", staleBefore)
      .select("payment_id");
    if (cleared && cleared.length > 0) {
      console.warn(`[confirm] 버려진 결제 점유를 정리하고 재시도: ${paymentId}`);
      ({ error: claimError } = await claim());
    }
  }

  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ error: "이미 처리 중이거나 처리된 결제입니다." }, { status: 409 });
    }
    console.error(`[confirm] 결제번호 점유 실패: ${paymentId}`, claimError);
    return NextResponse.json({ error: "결제 확인 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 확정에 성공했을 때만 점유를 남긴다. 그 외 모든 경로에서는 풀어서 재시도를 허용한다.
  let confirmedOk = false;
  try {
    // DB에 저장된 금액 조회
    const { data: orders } = await supabase
      .from("orders")
      .select("id, amount, material_id")
      .eq("order_id", paymentId)
      .eq("payment_status", "pending");

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 400 });
    }

    const dbTotal = orders.reduce((sum, o) => sum + o.amount, 0);

    // 포트원 V2 결제 단건 조회 (금액 위변조 검증)
    const portoneRes = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!portoneRes.ok) {
      return NextResponse.json({ error: "결제 정보 조회에 실패했습니다." }, { status: 500 });
    }

    const portonePayment = await portoneRes.json();

    // 결제 상태 검증
    if (portonePayment.status !== "PAID") {
      await supabase
        .from("orders")
        .update({ payment_status: "canceled" })
        .eq("order_id", paymentId)
        .eq("payment_status", "pending");
      return NextResponse.json({ error: "결제가 완료되지 않았습니다." }, { status: 400 });
    }

    // 금액 위변조 검증
    if (portonePayment.amount?.total !== dbTotal) {
      await supabase
        .from("orders")
        .update({ payment_status: "canceled" })
        .eq("order_id", paymentId)
        .eq("payment_status", "pending");
      return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
    }

    // 결제 완료 상태로 업데이트 — 위에서 금액을 대조한 바로 그 pending 행만.
    // order_id 전체로 걸면 취소된 행이나 그사이 끼어든 행까지 검증 없이 done이 된다.
    const { data: confirmed, error: updateError } = await supabase
      .from("orders")
      .update({ payment_status: "done", payment_key: paymentId })
      .in("id", orders.map((o) => o.id))
      .eq("payment_status", "pending")
      .select("id");

    if (updateError || !confirmed || confirmed.length !== orders.length) {
      console.error(`[confirm] 결제 확정 실패: ${paymentId}`, updateError);
      return NextResponse.json({ error: "결제 확정 처리에 실패했습니다. 고객센터로 문의해주세요." }, { status: 500 });
    }

    confirmedOk = true;
    const materialIds = orders.map((o) => o.material_id);
    return NextResponse.json({ success: true, materialIds });
  } finally {
    if (!confirmedOk) {
      await supabase.from("payment_claims").delete().eq("payment_id", paymentId);
    }
  }
}
