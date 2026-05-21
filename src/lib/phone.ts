export function validatePhone(v: string): string {
  if (!v) return "";
  if (!/^010-?[0-9]{4}-?[0-9]{4}$/.test(v)) return "올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)";
  return "";
}

export function normalizePhone(p: string): string {
  const digits = p.replace(/[^0-9]/g, "");
  if (/^010[0-9]{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return p;
}
