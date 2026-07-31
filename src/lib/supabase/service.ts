import 'server-only'

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`[wewed] Missing ${name}.`)
  return value
}

export function createSupabaseServiceClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export async function findSupabaseAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase()

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    )
    if (match) return match
    if (data.users.length < 100) return null
  }

  return null
}
