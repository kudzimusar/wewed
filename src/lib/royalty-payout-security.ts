export const PAYOUT_MUTATIONS_DISABLED_CODE = 'PAYOUT_MUTATIONS_DISABLED'

export const PAYOUT_MUTATIONS_DISABLED_MESSAGE =
  'Payout changes are temporarily unavailable while secure payout processing is configured.'

export function payoutMutationsDisabledPayload() {
  return {
    success: false,
    code: PAYOUT_MUTATIONS_DISABLED_CODE,
    error: PAYOUT_MUTATIONS_DISABLED_MESSAGE,
  } as const
}
