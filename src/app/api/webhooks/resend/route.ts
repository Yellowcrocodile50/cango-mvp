import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

type ResendWebhookEvent = {
  type: string;
  data: {
    email_id: string;
    // email.bounced 에만 존재 (https://resend.com/docs/webhooks/emails/bounced)
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

// 반송 사유를 한 줄로 — "메시지 (Permanent/Suppressed)"
function formatBounceReason(bounce: ResendWebhookEvent["data"]["bounce"]): string | null {
  if (!bounce) return null;
  const kind = [bounce.type, bounce.subType].filter(Boolean).join("/");
  const message = bounce.message?.trim();
  if (message && kind) return `${message} (${kind})`;
  return message || kind || null;
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
    event = wh.verify(payload, headers) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "서명 검증 실패" }, { status: 401 });
  }

  const emailId = event.data?.email_id;
  const TRACKED = ["email.delivered", "email.bounced", "email.complained"];

  if (emailId && TRACKED.includes(event.type)) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // email_status 는 실제 전달 결과. is_sent 는 공급자가 "발송완료"를 눌러도 켜지므로
    // 전달의 증거가 아니다 — 반송 판정은 반드시 email_status 로 한다.
    const status = event.type.replace("email.", "") as "delivered" | "bounced" | "complained";
    const patch: Record<string, unknown> = {
      email_status: status,
      email_status_at: new Date().toISOString(),
      email_error: status === "bounced" ? formatBounceReason(event.data.bounce) : null,
    };
    // 전달된 경우에만 발송완료로 승격. 반송이면 is_sent 는 건드리지 않는다
    // (공급자가 이미 수동으로 켰을 수 있으나, 배지는 email_status 를 우선한다)
    if (status === "delivered") patch.is_sent = true;

    await adminClient.from("orders").update(patch).eq("resend_email_id", emailId);
  }

  return NextResponse.json({ received: true });
}
