'use client'

import {
  type AccountRole,
  usePublicAccountSession,
} from '@/components/public/public-account-actions'

const ROLE_COPY: Record<AccountRole, string> = {
  admin: 'Your Wewed operational alerts, delivery issues and system actions. Only activity you are authorized to access appears here.',
  planner: 'Your planning reminders, deadlines and actions across the weddings you are authorized to manage.',
  couple: 'Your wedding reminders, deadlines and actions for the wedding activity you are authorized to access.',
  vendor: 'Your service, contract and delivery reminders for work you are authorized to access.',
  provider: 'Your provider reminders and account actions for services you are authorized to manage.',
}

export function NotificationRoleDescription() {
  const session = usePublicAccountSession()
  const role = session?.authorized ? session.user?.role : null

  return (
    <p
      className="mt-2 max-w-2xl text-sm text-[#f5ead7]/55"
      data-testid="notification-role-description"
    >
      {role
        ? ROLE_COPY[role]
        : 'Your Wewed reminders, updates and actions. Only activity you are authorized to access appears here.'}
    </p>
  )
}
