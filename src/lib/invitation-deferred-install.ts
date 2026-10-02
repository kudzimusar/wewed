export function androidDeferredInvitationHandoffEnabled(
  weddingId: string,
  env: {
    vercelEnv?: string
    configuredFlag?: string
    writablePreviewWeddingId?: string
  } = {},
): boolean {
  const vercelEnv = env.vercelEnv ?? process.env.VERCEL_ENV
  const configuredFlag =
    env.configuredFlag ?? process.env.ANDROID_DEFERRED_INVITATION_HANDOFF
  const writablePreviewWeddingId =
    env.writablePreviewWeddingId ?? process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID

  if (vercelEnv === 'preview' && writablePreviewWeddingId === weddingId) return true

  // Android Play builds v14+ include Install Referrer support. Production therefore keeps
  // deferred continuity on by default; setting the flag to "0" is an explicit emergency kill.
  if (vercelEnv === 'production') return configuredFlag !== '0'

  // Local/CI/non-production environments remain opt-in unless they are the dedicated UAT wedding.
  return configuredFlag === '1'
}
