import { redirect } from 'next/navigation'

/**
 * Compatibility route for bookmarked and documented approval URLs.
 * The approvals queue currently lives as a permission-scoped section
 * inside the main Wewed Admin Console.
 */
export default function AdminApprovalsRoute() {
  redirect('/admin')
}
