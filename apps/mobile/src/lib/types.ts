export type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'

export interface WeddingSummary {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  membershipRole: string
  membershipStatus: 'active' | 'invited'
  permissions: string[]
}

export interface MobileUser {
  id: string
  accessUserId: string
  email: string
  displayName: string | null
  avatarUrl?: string | null
  role: DashboardRole
  coupleId: string | null
  activeWeddingId: string
}

export interface MobileSessionPayload {
  success: true
  authorized?: true
  user: MobileUser
  activeWedding: WeddingSummary | null
  weddings: WeddingSummary[]
  workspace: 'wedding' | 'planner_portfolio' | 'vendor_portfolio' | 'wewed_platform' | string
  businessAccountId?: string
  sessionToken: string
}

export interface ApiErrorPayload {
  success?: false
  authorized?: false
  error?: string
  code?: string
  field?: string
}

export interface PlannerTask {
  id: string
  title: string
  description: string | null
  category: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | string
  priority: 'low' | 'medium' | 'high' | string
  dueDate: string | null
  assignee: string | null
}

export interface PlannerBudgetRow {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  vendorId: string | null
  vendorName: string | null
  notes: string | null
  dueDate: string | null
}

export interface PlannerBudgetSummary {
  totalEstimated: number
  totalActual: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  percentPaid: number
}

export interface PlannerGuest {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  side: string
  rsvpStatus?: string
  seatingTableId?: string | null
  seatingTableName?: string | null
  plusOne?: boolean
  dietaryRestrictions?: string | null
}

export interface PlannerVendor {
  id: string
  name: string
  category: string
  contact?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  contractStatus?: string | null
  paymentStatus?: string | null
  rating?: number | null
  notes?: string | null
}

export interface PlannerTimelineItem {
  id: string
  title: string
  time: string
  duration: number
  category: string
  location?: string | null
  description?: string | null
  responsible?: string | null
  status?: string
  order: number
}
