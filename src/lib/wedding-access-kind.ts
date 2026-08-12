export type PublicWeddingAccessKind =
  | 'public'
  | 'couple_owner'
  | 'wedding_member'
  | 'invited_guest'
  | null

/**
 * Server-resolved application role for the active wedding.
 *
 * This value is intentionally separate from PublicWeddingAccessKind:
 * access kind answers whether somebody may view the wedding social site,
 * while viewer role answers whether private owner/planner/admin chrome may
 * be rendered. Never infer this role from client-side state.
 */
export type WeddingViewerRole = 'admin' | 'couple' | 'planner' | 'vendor' | null
