export interface PaymentRequest {
  reservationId: string;
  paymentMethodId: string;
}

export interface PaymentResponse {
  status: "SUCCESS" | "FAILED" | "EXPIRED";
  bookingId?: string;
  message?: string;
}

export async function submitPayment(
  request: PaymentRequest,
): Promise<PaymentResponse> {
  const res = await fetch("/api/v1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 410 || body?.status === "EXPIRED") {
      return { status: "EXPIRED", message: "Hold expired during payment" };
    }
    return {
      status: "FAILED",
      message: body?.message ?? `Payment failed: ${res.status}`,
    };
  }

  return res.json();
}
