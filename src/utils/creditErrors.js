import { toast } from 'sonner';
import { invalidateCreditBalance } from '@/components/credits/CreditBalanceWidget';

/**
 * Inspect an Axios-style error from a backend function call.
 * If it's a 402 Insufficient Credits error, show a tailored toast and return true.
 * Otherwise return false so the caller can fall through to default error handling.
 */
export function handleCreditError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (status === 402 || data?.error === 'Insufficient credits') {
    const msg = data?.message || 'You don\'t have enough credits for this generation.';
    toast.error(msg, {
      description: `Required: ${data?.required ?? '?'} · Balance: ${data?.balance ?? '?'}`,
      action: {
        label: 'Get Credits',
        onClick: () => { window.location.href = '/credits'; },
      },
      duration: 8000,
    });
    return true;
  }
  return false;
}

/**
 * Call after a successful synchronous generation to refresh the cached balance.
 * If the backend returned credits_remaining, use it directly (no extra request).
 */
export function refreshCreditsFromResponse(responseData) {
  if (responseData?.credits_remaining != null) {
    invalidateCreditBalance(responseData.credits_remaining);
  } else {
    invalidateCreditBalance();
  }
}