import { resend, EMAIL_FROM } from "@/lib/resend";
import { COMPANY_INFO } from "@/lib/companyInfo";

/* 아이디 찾기·비밀번호 재설정 메일. 주문 영수증 메일과 같은 모양을 쓴다. */

const LOGIN_URL = "https://www.cango.kr/login";

function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string) {
  return `
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,'Pretendard',sans-serif;color:#365927;">
      <img src="https://www.cango.kr/cango-logo.png" alt="CANGO" width="120" style="display:block;margin-bottom:20px;" />
      <h1 style="font-size:20px;margin-bottom:20px;">${title}</h1>
      ${body}
      <p style="margin-top:32px;font-size:12px;color:#999;line-height:1.6;">
        직접 요청하지 않으셨다면 이 메일은 그냥 두셔도 괜찮아요. 계정에는 아무 변화가 없어요.<br />
        문의는 이 메일에 회신하시거나 ${COMPANY_INFO.email}로 보내주세요.<br />
        ${COMPANY_INFO.businessName} | ${COMPANY_INFO.representative} | ${COMPANY_INFO.address}
      </p>
    </div>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#365927;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>`;
}

async function send(to: string, subject: string, html: string, text: string) {
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    replyTo: COMPANY_INFO.email,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend 발송 실패: ${error.message}`);
}

export async function sendUserIdEmail(to: string, userid: string) {
  const id = escapeHtml(userid);
  await send(
    to,
    "[CANGO] 아이디를 알려드려요",
    layout(
      "아이디를 알려드려요",
      `<p style="font-size:14px;color:#5a7d50;">이 이메일로 가입된 CANGO 아이디예요.</p>
       <div style="margin-top:12px;padding:16px;background:#f3f8f1;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:0.5px;">${id}</div>
       ${button(LOGIN_URL, "로그인하러 가기")}`
    ),
    [
      "[CANGO] 아이디를 알려드려요",
      "",
      `이 이메일로 가입된 CANGO 아이디: ${userid}`,
      `로그인: ${LOGIN_URL}`,
      "",
      "직접 요청하지 않으셨다면 이 메일은 그냥 두셔도 괜찮아요.",
    ].join("\n")
  );
}

export async function sendPasswordResetEmail(to: string, userid: string, resetLink: string) {
  const id = escapeHtml(userid);
  await send(
    to,
    "[CANGO] 비밀번호를 새로 정할 수 있어요",
    layout(
      "비밀번호를 새로 정할 수 있어요",
      `<p style="font-size:14px;color:#5a7d50;line-height:1.6;">
         아이디 <strong>${id}</strong>의 비밀번호 재설정 요청을 받았어요.<br />
         아래 버튼을 누르면 새 비밀번호를 정하는 화면으로 이동해요.
       </p>
       ${button(resetLink, "새 비밀번호 정하기")}
       <p style="margin-top:16px;font-size:12px;color:#999;">이 링크는 한 번만 쓸 수 있어요. 다시 필요하면 비밀번호 찾기에서 새로 요청하시면 돼요.</p>`
    ),
    [
      "[CANGO] 비밀번호를 새로 정할 수 있어요",
      "",
      `아이디 ${userid}의 비밀번호 재설정 요청을 받았어요.`,
      `새 비밀번호 정하기: ${resetLink}`,
      "",
      "이 링크는 한 번만 쓸 수 있어요.",
      "직접 요청하지 않으셨다면 이 메일은 그냥 두셔도 괜찮아요.",
    ].join("\n")
  );
}
