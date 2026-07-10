import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

type ResendWebhookEvent = {
  type: string;
  data: { email_id: string };
};

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

  if (event.type === "email.delivered" && event.data?.email_id) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await adminClient
      .from("orders")
      .update({ is_sent: true })
      .eq("resend_email_id", event.data.email_id)
      .eq("is_sent", false);
  }

  return NextResponse.json({ received: true });
}
