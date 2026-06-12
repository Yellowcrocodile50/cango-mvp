import { Badge } from "@/components/ui/badge";

interface Props {
  is_sent: boolean;
  payment_status: string;
  payment_method?: string;
}

export function OrderStatusBadge({ is_sent, payment_status, payment_method }: Props) {
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
