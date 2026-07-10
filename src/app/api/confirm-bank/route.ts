import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderReceiptEmail, type OrderReceiptItem } from "@/lib/email/orderReceipt";

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

  // supplier 권한 확인
  const { data: profile } = await anonClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "supplier") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // service_role로 주문 상태 업데이트
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orders, error: fetchError } = await adminClient
    .from("orders")
    .select("id, payment_status, payment_method")
    .eq("order_id", orderId)
    .eq("payment_status", "pending")
    .eq("payment_method", "bank_transfer");

  if (fetchError || !orders || orders.length === 0) {
    return NextResponse.json({ error: "확인할 수 있는 주문이 없습니다." }, { status: 400 });
  }

  const { error: updateError } = await adminClient
    .from("orders")
    .update({ payment_status: "done" })
    .eq("order_id", orderId)
    .eq("payment_method", "bank_transfer");

  if (updateError) {
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  // 주문 완료 영수증 이메일 발송 (실패해도 결제 확정 자체는 이미 완료된 상태이므로 응답에 영향 없음)
  try {
    const { data: orderItems } = await adminClient
      .from("orders")
      .select("buyer_email, amount, materials(title, file_url)")
      .eq("order_id", orderId)
      .eq("payment_method", "bank_transfer");

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

      await sendOrderReceiptEmail({ to: buyerEmail, orderId, items, totalAmount });

      await adminClient
        .from("orders")
        .update({ sent_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("payment_method", "bank_transfer");
    }
  } catch (emailError) {
    console.error("[confirm-bank] 영수증 이메일 발송 실패:", emailError);
  }

  return NextResponse.json({ success: true });
}
