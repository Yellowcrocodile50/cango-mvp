import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderReceiptEmail, type OrderReceiptItem } from "@/lib/email/orderReceipt";

/**
 * 영수증 메일을 보내지 않을 주문. 결제 상태만 done으로 바꾸고 메일은 건너뛴다.
 *
 * `order-1786967700000-recov1` = 복구 건. 입금은 확인됐지만
 * **어떤 자료를 샀는지 아직 구매자 확인 전**이라, 틀린 PDF가 나가면 되돌릴 수 없다.
 *
 * 🔜 자료가 확정되면: 이 목록에서 빼고 → 해당 행을 `pending`으로 되돌린 뒤
 * 입금확인을 다시 누른다. (confirm-bank는 pending 행이 있어야만 동작한다)
 */
const EMAIL_SUPPRESSED_ORDER_IDS = new Set<string>(["order-1786967700000-recov1"]);

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  // 요청자의 세션 토큰으로 role 확인 (supplier만 허용)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // supplier 권한 확인
  // ⚠️ anonClient로 조회하면 안 된다. auth.getUser(token)은 토큰 검증만 할 뿐
  // 클라이언트에 세션을 붙이지 않으므로, 이어지는 .from() 호출은 anon 권한으로 나간다.
  // profiles SELECT 정책이 본인/공급자로 제한되면 anon은 0행을 받아 항상 403이 된다.
  // 토큰 검증은 위에서 이미 끝났으므로 권한 조회는 service_role로 한다.
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "supplier") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { data: orders, error: fetchError } = await adminClient
    .from("orders")
    .select("id, materials(supplier_id)")
    .eq("order_id", orderId)
    .eq("payment_status", "pending")
    .eq("payment_method", "bank_transfer");

  if (fetchError) {
    return NextResponse.json({ error: "주문 조회에 실패했습니다." }, { status: 500 });
  }
  // pending 행이 없다 = 이미 입금확인됐거나 취소됐다. 아래 UPDATE에서 경쟁에 진 경우와 같은 상황이므로 같은 409로 답한다.
  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "이미 처리되었거나 취소된 주문입니다." }, { status: 409 });
  }

  // service_role은 RLS를 건너뛰므로 "내 자료의 주문인가"를 여기서 직접 확인한다.
  // 한 주문번호에 다른 공급자의 자료가 섞여 있으면 남의 주문까지 확정하게 되므로 전체를 거절한다.
  const ownsAll = orders.every(
    (o) => (o.materials as unknown as { supplier_id: string } | null)?.supplier_id === user.id
  );
  if (!ownsAll) {
    // 공급자가 여럿이 되면 여러 공급자의 자료가 한 주문번호에 섞일 수 있다. 입금 계좌가 하나라
    // 누가 확정할지 정해지지 않았으므로 지금은 막고 운영자가 처리한다(현재 공급자는 1명).
    return NextResponse.json({ error: "다른 공급자의 자료가 포함된 주문이라 직접 확정할 수 없습니다." }, { status: 403 });
  }

  // pending → done 전환은 "아직 pending인 행"에만 건다. 조회와 변경 사이에
  // 같은 요청이 한 번 더 들어오거나(두 번 클릭) 구매자가 취소하면, 늦게 온 쪽은 바꿀 행이 없다.
  // 실제로 바꾼 행이 있는 요청만 메일을 보낸다 — 메일이 두 번 나가지 않게 하는 유일한 지점이다.
  const { data: confirmed, error: updateError } = await adminClient
    .from("orders")
    .update({ payment_status: "done" })
    .eq("order_id", orderId)
    .eq("payment_method", "bank_transfer")
    .eq("payment_status", "pending")
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }
  if (!confirmed || confirmed.length === 0) {
    return NextResponse.json({ error: "이미 처리되었거나 취소된 주문입니다." }, { status: 409 });
  }
  const confirmedIds = confirmed.map((o) => o.id);

  if (EMAIL_SUPPRESSED_ORDER_IDS.has(orderId)) {
    console.warn(`[confirm-bank] 메일 발송 보류 주문: ${orderId}`);
    return NextResponse.json({ success: true, emailSuppressed: true });
  }

  // 주문 완료 영수증 이메일 발송. 결제 확정은 이미 끝났으므로 실패해도 되돌리지 않지만,
  // 공급자가 "발송된 줄" 알고 넘어가지 않도록 결과를 응답에 그대로 싣는다(emailSent).
  // 메일에는 이번 요청이 실제로 확정한 행만 담는다 — 같은 주문번호의 취소된 행이 섞이지 않게.
  let emailSent = false;
  try {
    const { data: orderItems } = await adminClient
      .from("orders")
      .select("buyer_email, amount, materials(title, file_url)")
      .in("id", confirmedIds);

    const buyerEmail = orderItems?.[0]?.buyer_email;

    if (orderItems && orderItems.length > 0 && buyerEmail) {
      const ATTACH_MAX_BYTES = 8 * 1024 * 1024; // 파일 1개당 첨부 허용 상한 (base64 변환 시 ~11MB)
      const ATTACH_TOTAL_BUDGET = 15 * 1024 * 1024; // 이메일 1건당 첨부 총량 상한
      let attachedBytesUsed = 0;

      // 첨부 용량 예산을 순서대로 소진해야 하므로 순차 처리 (Promise.all 병렬 처리 시 예산 계산 레이스 발생)
      const items: OrderReceiptItem[] = [];
      for (const o of orderItems) {
        const material = o.materials as unknown as { title: string; file_url: string | null } | null;
        let downloadUrl: string | null = null;
        let attachment: OrderReceiptItem["attachment"] = null;

        if (material?.file_url) {
          const { data: signedData } = await adminClient.storage
            .from("materials")
            .createSignedUrl(material.file_url, 60 * 60 * 24 * 30); // 30일
          downloadUrl = signedData?.signedUrl ?? null;

          const slashIndex = material.file_url.indexOf("/");
          const folder = material.file_url.slice(0, slashIndex);
          const filename = material.file_url.slice(slashIndex + 1);
          const { data: listData } = await adminClient.storage
            .from("materials")
            .list(folder, { search: filename });
          const fileSize = listData?.[0]?.metadata?.size as number | undefined;

          if (
            fileSize &&
            fileSize <= ATTACH_MAX_BYTES &&
            attachedBytesUsed + fileSize <= ATTACH_TOTAL_BUDGET
          ) {
            const { data: blob } = await adminClient.storage
              .from("materials")
              .download(material.file_url);
            if (blob) {
              attachedBytesUsed += fileSize;
              attachment = {
                filename: `${material.title.replace(/[\\/]/g, "-")}.pdf`,
                content: Buffer.from(await blob.arrayBuffer()),
              };
            }
          }
        }

        items.push({
          title: material?.title ?? "삭제된 자료",
          amount: o.amount,
          downloadUrl,
          attachment,
        });
      }
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      const emailResult = await sendOrderReceiptEmail({ to: buyerEmail, orderId, items, totalAmount });

      await adminClient
        .from("orders")
        .update({ sent_at: new Date().toISOString(), resend_email_id: emailResult?.id ?? null })
        .in("id", confirmedIds);
      emailSent = true;
    } else {
      console.error(`[confirm-bank] 구매자 이메일이 없어 영수증을 보내지 못함: ${orderId}`);
    }
  } catch (emailError) {
    console.error("[confirm-bank] 영수증 이메일 발송 실패:", emailError);
  }

  return NextResponse.json({ success: true, emailSent });
}
