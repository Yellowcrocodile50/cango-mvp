import { resend, EMAIL_FROM } from "@/lib/resend";
import { COMPANY_INFO } from "@/lib/companyInfo";

export type OrderReceiptItem = {
  title: string;
  amount: number;
  downloadUrl: string | null;
  attachment?: { filename: string; content: Buffer } | null;
};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

// "자료명" 또는 "자료명 외 N건" — 제목/본문 문구에서 공용으로 사용
function itemsLabel(items: OrderReceiptItem[]) {
  const first = items[0]?.title ?? "";
  return items.length > 1 ? `"${first}" 외 ${items.length - 1}건` : `"${first}"`;
}

function itemNote(item: OrderReceiptItem) {
  if (!item.downloadUrl) return "삭제된 자료입니다. 고객센터로 문의해주세요.";
  if (item.attachment) return "이 메일에 첨부된 파일에서도 확인하실 수 있어요.";
  return "파일 용량이 커서 첨부 대신 아래 링크로 안내드려요.";
}

function buildHtml(orderId: string, items: OrderReceiptItem[], totalAmount: number) {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;">
            <div style="font-size:14px;color:#365927;font-weight:600;">${item.title}</div>
            <div style="font-size:13px;color:#5a7d50;margin-top:4px;">${formatWon(item.amount)}</div>
            <div style="margin-top:6px;font-size:12px;color:#999;">${itemNote(item)}</div>
            ${
              item.downloadUrl
                ? `<a href="${item.downloadUrl}" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#365927;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;">자료 다운로드</a>`
                : ""
            }
          </td>
        </tr>`
    )
    .join("");

  return `
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,'Pretendard',sans-serif;color:#365927;">
      <img src="https://www.cango.kr/cango-logo.png" alt="CANGO" width="120" style="display:block;margin-bottom:20px;" />
      <h1 style="font-size:20px;margin-bottom:24px;">[CANGO] 구매해주셔서 감사합니다!</h1>
      <p style="font-size:14px;color:#5a7d50;">주문번호 ${orderId} ${itemsLabel(items)}의 입금이 확인되어 자료를 보내드립니다.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${itemsHtml}</table>
      <div style="margin-top:20px;padding-top:16px;border-top:2px solid #365927;font-size:15px;font-weight:700;">
        총 결제금액 ${formatWon(totalAmount)}
      </div>
      <p style="margin-top:32px;font-size:12px;color:#999;line-height:1.6;">
        다운로드 링크는 30일간 유효합니다. 문의사항은 이 메일에 회신하시거나 ${COMPANY_INFO.email}로 연락주세요.<br />
        ${COMPANY_INFO.businessName} | ${COMPANY_INFO.representative} | ${COMPANY_INFO.address}
      </p>
    </div>`;
}

function buildText(orderId: string, items: OrderReceiptItem[], totalAmount: number) {
  const lines = items.map(
    (item) =>
      `- ${item.title} (${formatWon(item.amount)})\n  ${itemNote(item)}${item.downloadUrl ? `\n  다운로드: ${item.downloadUrl}` : ""}`
  );
  return [
    `[CANGO] 구매해주셔서 감사합니다!`,
    `주문번호 ${orderId} ${itemsLabel(items)}의 입금이 확인되어 자료를 보내드립니다.`,
    "",
    ...lines,
    "",
    `총 결제금액 ${formatWon(totalAmount)}`,
    "",
    `다운로드 링크는 30일간 유효합니다. 문의사항은 ${COMPANY_INFO.email}로 연락주세요.`,
  ].join("\n");
}

export async function sendOrderReceiptEmail(params: {
  to: string;
  orderId: string;
  items: OrderReceiptItem[];
  totalAmount: number;
}) {
  const { to, orderId, items, totalAmount } = params;
  const attachments = items
    .filter((item): item is OrderReceiptItem & { attachment: NonNullable<OrderReceiptItem["attachment"]> } => !!item.attachment)
    .map((item) => ({ filename: item.attachment.filename, content: item.attachment.content }));

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    replyTo: COMPANY_INFO.email,
    subject: `[CANGO] 주문 완료 - ${items[0]?.title ?? ""}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""}`,
    html: buildHtml(orderId, items, totalAmount),
    text: buildText(orderId, items, totalAmount),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (error) {
    throw new Error(`Resend 발송 실패: ${error.message}`);
  }
  return data;
}
