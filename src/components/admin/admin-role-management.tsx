'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  WEWED_ADMIN_ROLES,
  WEWED_ADMIN_ROLE_LABELS,
  hasWewedAdminPermission,
  type WewedAdminRole,
} from '@/lib/wewed-admin-policy'

type Member = {
  membershipId: string
  userId: string
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: string | null
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

type Payload = {
  success: boolean
  error?: string
  admin: { email: string; role: string; permissions: string[] }
  members: Member[]
}

function date(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AdminRoleManagement() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<WewedAdminRole>('wewed_operations_admin')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/roles', { cache: 'no-store' })
      const payload = (await response.json()) as Payload
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load roles.')
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load roles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(body: Record<string, unknown>, successMessage: string) {
    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string; invitationSent?: boolean }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Role action failed.')
      setNotice(payload.invitationSent ? `${successMessage} Supabase sent an invitation email.` : successMessage)
      await load()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Role action failed.')
      return false
    } finally {
      setWorking(false)
    }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await act(
      { action: 'add_admin_member', email, name, role },
      `${email} was added to Wewed platform access.`,
    )
    if (ok) {
      setEmail('')
      setName('')
      setRole('wewed_operations_admin')
    }
  }

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso text-champagne"><Loader2 className="size-8 animate-spin text-gold" /></main>
  }

  if (!data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne"><Card className="max-w-lg border-red-300/25 bg-white/[0.04] text-champagne"><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto size-10 text-gold" /><h1 className="mt-4 text-2xl font-semibold">Role management unavailable</h1><p className="mt-3 text-sm text-champagne/60">{error}</p><Button onClick={() => void load()} className="mt-6 bg-gold text-espresso hover:bg-gold-light">Retry</Button></CardContent></Card></main>
  }

  const canManage = hasWewedAdminPermission(data.admin.permissions, 'admin.members.manage')

  return (
    <main className="min-h-screen bg-espresso px-5 py-24 text-champagne lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">Platform RBAC</p>
            <h1 className="mt-2 text-4xl font-semibold">Administrator roles</h1>
            <p className="mt-2 text-sm text-champagne/55">Invite an administrator, assign a real platform role, or suspend an existing membership.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading || working} className="border-gold/25 text-gold hover:bg-gold/10"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-300/25 bg-red-300/10 text-red-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}`}>{error || notice}</div>}

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader><CardTitle className="text-lg">Add or invite administrator</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={invite} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_240px_auto]">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Administrator email" required disabled={!canManage} className="border-gold/20 bg-black/15" />
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" disabled={!canManage} className="border-gold/20 bg-black/15" />
              <select value={role} onChange={(event) => setRole(event.target.value as WewedAdminRole)} disabled={!canManage} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                {WEWED_ADMIN_ROLES.map((item) => <option key={item} value={item}>{WEWED_ADMIN_ROLE_LABELS[item]}</option>)}
              </select>
              <Button type="submit" disabled={!canManage || working || !email.trim()} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Add role</Button>
            </form>
            {!canManage && <p className="mt-3 text-xs text-champagne/45">Your current role can read memberships but cannot add or change them.</p>}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.025]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gold/15 bg-black/15 text-[10px] uppercase tracking-[0.16em] text-champagne/45"><tr><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">Application user</th><th className="px-4 py-3">Last login</th></tr></thead>
              <tbody className="divide-y divide-gold/10">
                {data.members.map((member) => (
                  <tr key={member.membershipId}>
                    <td className="px-4 py-4"><p className="font-semibold">{member.name || member.email}</p><p className="mt-1 text-xs text-champagne/40">{member.email}</p></td>
                    <td className="px-4 py-4"><select value={member.role} disabled={!canManage || working} onChange={(event) => void act({ action: 'update_admin_role', membershipId: member.membershipId, role: event.target.value, status: member.status }, `${member.email} role updated.`)} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm">{WEWED_ADMIN_ROLES.map((item) => <option key={item} value={item}>{WEWED_ADMIN_ROLE_LABELS[item]}</option>)}</select></td>
                    <td className="px-4 py-4"><select value={member.status} disabled={!canManage || working} onChange={(event) => void act({ action: 'update_admin_role', membershipId: member.membershipId, role: member.role, status: event.target.value }, `${member.email} membership updated.`)} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm"><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></td>
                    <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${member.userActive ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-red-300/30 bg-red-300/10 text-red-100'}`}>{member.userActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-4 text-xs text-champagne/45">{date(member.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Card className="border-gold/15 bg-white/[0.035] text-champagne"><CardHeader><CardTitle className="text-lg">Role boundaries</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{Object.entries(WEWED_ADMIN_ROLE_LABELS).map(([key, label]) => <div key={key} className="rounded-xl border border-gold/10 bg-black/10 p-4"><p className="font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-champagne/45">{key === 'wewed_super_admin' ? 'Full platform control and role assignment.' : key === 'wewed_operations_admin' ? 'Approvals, lifecycle, onboarding, support and incidents.' : key === 'wewed_billing_admin' ? 'Billing, account read and analytics.' : key === 'wewed_support_admin' ? 'Support operations and limited incident access.' : 'Read-only analysis and audit visibility.'}</p></div>)}</CardContent></Card>
      </div>
    </main>
  )
}
