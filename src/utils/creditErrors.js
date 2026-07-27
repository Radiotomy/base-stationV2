import { toast } from 'sonner';
import { invalidateCreditBalance } from '@/components/credits/CreditBalanceWidget';

/**
 * Inspect an Axios-style error from a backend function call.
 * If it's a 402 Insufficient Credits error, show a tailored toast and return true.
 * Otherwise return false so the caller can fall through to default error handling.
 *
 * Also surfaces aimusicapi.ai spec error types (per docs.aimusicapi.ai/error-handling):
 *   400 validation_error · 401 unauthorized · 403 forbidden · 410 endpoint_retired ·
 *   429 rate_limited · 502 upstream_error · 504 timeout
 */
export function handleCreditError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  // ONLY treat as a user credit issue when our own backend says so.
  // Upstream provider 402s (aimusicapi.ai account out of credits) have
  // provider_status set and should fall through to the generic error path.
  const isOurInternalCreditError =
    data?.error === 'Insufficient credits' && !data?.provider_status;
  if (isOurInternalCreditError) {
    const msg = data?.message || 'You don\'t have enough credits for this generation.';
    toast.error(msg, {
      description: `Required: ${data?.required ?? '?'} · Balance: ${data?.balance ?? '?'} · During the open beta, credits are allotted by the BASE Station team.`,
      action: {
        label: 'View Credits',
        onClick: () => { window.location.href = '/credits'; },
      },
      duration: 10000,
    });
    return true;
  }
  // Non-premium monthly quota reached (premium tier gating)
  if (status === 403 && data?.error === 'Monthly credit limit reached') {
    toast.error(data?.message || 'Monthly credit limit reached.', {
      description: `Used ${data?.monthly_used ?? '?'} / ${data?.monthly_limit ?? '?'} this month.`,
      action: {
        label: 'View Credits',
        onClick: () => { window.location.href = '/credits'; },
      },
      duration: 10000,
    });
    return true;
  }
  return false;
}

/**
 * Returns a friendly message for known aimusicapi.ai error types.
 * Returns null if the error isn't a recognized provider error.
 */
export function getProviderErrorMessage(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const providerType = data?.provider_type;
  const raw = data?.error || data?.message || err?.message || '';

  if (status === 410 || providerType === 'endpoint_retired') {
    return 'This feature has been retired by the provider. Please use the current Create or Extend flow.';
  }
  if (status === 429 || providerType === 'rate_limited') {
    return 'Too many requests right now — please wait a few seconds and try again.';
  }
  if (status === 400 || providerType === 'validation_error') {
    return raw || 'Invalid input — check your prompt, tags, or model selection.';
  }
  if (status === 401 || providerType === 'unauthorized') {
    return 'Provider authentication failed. Please contact support.';
  }
  if (status === 403 || providerType === 'forbidden') {
    // Spec lists copyrighted/inappropriate content, artist/producer name blocks
    return raw || 'This request was blocked by content policy. Try different lyrics or style.';
  }
  if (status === 504) {
    return 'Generation timed out on the provider side. Credits were refunded — please try again.';
  }
  if (status === 502 || providerType === 'upstream_error') {
    return 'The music provider is temporarily unavailable. Please retry in a moment.';
  }
  // Upstream provider out of credits — distinct from the user's own credit balance.
  if (status === 402 && data?.provider_status === 402) {
    return 'The music provider account is temporarily out of credits. We\'ve been notified — please try a different provider or retry shortly.';
  }
  return null;
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