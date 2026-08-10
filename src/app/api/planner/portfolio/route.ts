import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  readWeddingIntelligence,
  type AttentionSeverity,
} from '@/lib/planner-relationship-intelligence'
import { listAccessibleWeddings } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  high: 1,
  normal: 2,
}

export async function GET(request: NextRequest) {
  try {
    const session = readAppSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sign in is required.' },
        { status: 401 },
      )
    }
    if (session.role !== 'planner') {
      return NextResponse.json(
        { success: false, error: 'Planner portfolio access is required.' },
        { status: 403 },
      )
    }

    const accessible = await listAccessibleWeddings(session.userId, session.role)
    const managed = accessible.filter(
      (wedding) =>
        wedding.membershipStatus === 'active' &&
        ['planner', 'coordinator'].includes(wedding.membershipRole),
    )

    if (managed.length === 0) {
      return NextResponse.json({
        success: true,
        generatedAt: new Date().toISOString(),
        activeWeddingId: session.activeWeddingId,
        portfolio: {
          activeWeddings: 0,
          next30Days: 0,
          next90Days: 0,
          needsAttention: 0,
          atRisk: 0,
          overdueTasks: 0,
          blockedTasks: 0,
          pendingRsvps: 0,
          pendingVendorContracts: 0,
          overdueBudgetPayments: 0,
        },
        weddings: [],
        priorities: [],
      })
    }

    const intelligence = await readWeddingIntelligence(managed.map((wedding) => wedding.id))
    const membershipByWedding = new Map(managed.map((wedding) => [wedding.id, wedding]))

    const weddings = intelligence.map((wedding) => {
      const membership = membershipByWedding.get(wedding.weddingId)
      return {
        ...wedding,
        date: wedding.date.toISOString(),
        membershipRole: membership?.membershipRole || 'planner',
        membershipStatus: membership?.membershipStatus || 'active',
      }
    })

    const portfolio = weddings.reduce(
      (summary, wedding) => {
        summary.activeWeddings += 1
        if (wedding.health.daysUntilWedding >= 0 && wedding.health.daysUntilWedding <= 30) {
          summary.next30Days += 1
        }
        if (wedding.health.daysUntilWedding >= 0 && wedding.health.daysUntilWedding <= 90) {
          summary.next90Days += 1
        }
        if (wedding.health.state !== 'on_track') summary.needsAttention += 1
        if (wedding.health.state === 'at_risk') summary.atRisk += 1
        summary.overdueTasks += wedding.tasks.overdue
        summary.blockedTasks += wedding.tasks.blocked
        summary.pendingRsvps += wedding.guests.pending
        summary.pendingVendorContracts += wedding.vendors.pendingContracts
        summary.overdueBudgetPayments += wedding.budget.overduePayments
        return summary
      },
      {
        activeWeddings: 0,
        next30Days: 0,
        next90Days: 0,
        needsAttention: 0,
        atRisk: 0,
        overdueTasks: 0,
        blockedTasks: 0,
        pendingRsvps: 0,
        pendingVendorContracts: 0,
        overdueBudgetPayments: 0,
      },
    )

    const priorities = weddings
      .flatMap((wedding) =>
        wedding.attention.map((item) => ({
          weddingId: wedding.weddingId,
          weddingTitle: wedding.title,
          coupleName: wedding.coupleName,
          weddingDate: wedding.date,
          daysUntilWedding: wedding.health.daysUntilWedding,
          ...item,
        })),
      )
      .sort((a, b) => {
        const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        if (severity !== 0) return severity
        const aDays = a.daysUntilWedding < 0 ? Number.MAX_SAFE_INTEGER : a.daysUntilWedding
        const bDays = b.daysUntilWedding < 0 ? Number.MAX_SAFE_INTEGER : b.daysUntilWedding
        if (aDays !== bDays) return aDays - bDays
        return a.weddingTitle.localeCompare(b.weddingTitle)
      })
      .slice(0, 30)

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      activeWeddingId: session.activeWeddingId,
      portfolio,
      weddings,
      priorities,
    })
  } catch (error) {
    console.error('[planner portfolio GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load planner portfolio intelligence.' },
      { status: 500 },
    )
  }
}
