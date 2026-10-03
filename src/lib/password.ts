/* 비밀번호 규칙 — 회원가입과 비밀번호 재설정이 같은 규칙을 쓰도록 한 곳에 둔다. */

export function validatePassword(v: string) {
  if (!v) return "";
  if (v.length < 8 || v.length > 16) return "8~16자로 입력해주세요.";
  if (!/[a-zA-Z]/.test(v)) return "문자를 포함해야 합니다.";
  if (!/[0-9]/.test(v)) return "숫자를 포함해야 합니다.";
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(v)) return "특수문자를 포함해야 합니다.";
  return "";
}

export function validateConfirm(password: string, confirm: string) {
  if (!confirm) return "";
  if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
  return "";
}
