import { Badge } from "@/components/ui/badge";

interface Props {
  is_sent: boolean;
  payment_status: string;
  payment_method?: string;
  /** Resend 웹훅이 기록한 실제 전달 결과. is_sent 보다 우선한다 */
  email_status?: string | null;
}

export function OrderStatusBadge({ is_sent, payment_status, payment_method, email_status }: Props) {
  // 반송/스팸신고는 전달 실패다. is_sent 는 "발송완료" 수동 클릭으로도 켜지므로
  // 이걸 먼저 보지 않으면 반송된 주문이 발송완료로 보인다.
  if (email_status === "bounced")
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">반송</Badge>;
  if (email_status === "complained")
    return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">스팸신고</Badge>;
  if (is_sent)
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">발송완료</Badge>;
  if (payment_status === "done")
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">발송대기</Badge>;
  if (payment_status === "pending" && payment_method === "bank_transfer")
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">입금대기</Badge>;
  if (payment_status === "pending")
    return <Badge variant="secondary">결제대기</Badge>;
  if (payment_status === "canceled")
    return <Badge variant="destructive">취소</Badge>;
  return <Badge variant="outline">{payment_status}</Badge>;
}
