import { randomUUID } from 'node:crypto'
import { createClient, type User as SupabaseUser } from '@supabase/supabase-js'
import { db } from '../src/lib/db'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function findAuthUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<SupabaseUser | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    )
    if (match) return match
    if (data.users.length < 100) return null
  }

  return null
}

async function main() {
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const email = required('WEWED_ADMIN_EMAIL').toLowerCase()
  const password = required('WEWED_ADMIN_PASSWORD')
  const displayName = process.env.WEWED_ADMIN_NAME?.trim() || 'Wewed Administrator'

  if (password.length < 12) {
    throw new Error('WEWED_ADMIN_PASSWORD must be at least 12 characters.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let authUser = await findAuthUser(supabase, email)

  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, wewed_role: 'admin' },
    })
    if (error) throw error
    authUser = data.user
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, wewed_role: 'admin' },
    })
    if (error) throw error
    authUser = data.user
  }

  const appUser = await db.user.upsert({
    where: { email },
    update: {
      name: displayName,
      role: 'admin',
      isActive: true,
    },
    create: {
      id: randomUUID(),
      email,
      name: displayName,
      role: 'admin',
      isActive: true,
    },
  })

  await db.userProfile.upsert({
    where: { id: authUser.id },
    update: {
      email,
      displayName,
      role: 'admin',
      isBanned: false,
      bannedAt: null,
      banReason: null,
    },
    create: {
      id: authUser.id,
      email,
      displayName,
      role: 'admin',
    },
  })

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_admin."BusinessAccountMember"
      ("id", "businessAccountId", "userId", "role", "status", "permissions")
     VALUES ($1, 'wewed-platform', $2, 'wewed_super_admin', 'active', '["*"]'::jsonb)
     ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET
       role = EXCLUDED.role,
       status = 'active',
       permissions = '["*"]'::jsonb,
       "updatedAt" = CURRENT_TIMESTAMP`,
    `member-wewed-admin-${appUser.id}`,
    appUser.id,
  )

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_admin."BusinessAuditLog"
      ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
     VALUES ($1, $2, 'wewed-platform', 'wewed_admin.provisioned', 'User', $2, $3::jsonb)`,
    `audit-${randomUUID()}`,
    appUser.id,
    JSON.stringify({ email, displayName }),
  )

  console.log(`Wewed administrator provisioned: ${email}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
