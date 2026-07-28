'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ListTodo,
  DollarSign,
  Users,
  Calendar,
  LayoutGrid,
  Store,
  Plus,
  Trash2,
  Edit,
  Download,
  Search,
  X,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Circle,
  Lock,
  Unlock,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Clock,
  Flag,
  User,
  Mail,
  Phone,
  CalendarDays,
  TrendingUp,
  Wallet,
  ArrowRight,
  Printer,
  Star,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  verifyAdmin,
  isAdminLoggedIn,
  setAdminLoggedIn,
  logoutAdmin,
} from '@/lib/admin-auth'
import { useToast } from '@/hooks/use-toast'
import { ImportExportBar } from '@/components/wedding/import-export-bar'
import { useWewedStore } from '@/lib/store'

/* ============================================================
   WeddingPlanner — The flagship planning dashboard
   ------------------------------------------------------------
   A full-screen Dialog overlay (like admin-dashboard.tsx).
   - Login gate reuses admin-auth (same password as the live
     ceremony dashboard: wewed-admin-2026).
   - 6 tabs: Checklist, Budget, Vendors, Guest List, Timeline,
     Seating Chart.
   - Polls the planner API every 15 seconds for fresh data.
   - All mutations are optimistic with toast feedback.
   - Zimbabwean-specific seed data baked in (roora, magumo,
     sadza/madora, etc.).
   ============================================================ */

const POLL_INTERVAL_MS = 15_000

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  description: string | null
  category: string
  status: string // "todo" | "in_progress" | "done" | "blocked"
  priority: string // "low" | "medium" | "high"
  dueDate: string | null
  assignee: string | null
  order: number
  weddingId: string
  createdAt: string
  updatedAt: string
}

interface BudgetRow {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  vendorId: string | null
  dueDate: string | null
  weddingId: string
}

interface BudgetSummary {
  totalEstimated: number
  totalActual: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  percentPaid: number
  percentActualOfEstimated: number
}

interface CategoryBreakdown {
  category: string
  estimated: number
  actual: number
  paid: number
  outstanding: number
  count: number
}

interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleDetail: string | null
  side: string | null
  seatingTableId: string | null
  seatingTableName: string | null
  weddingId: string
  rsvp: {
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    plusOneName: string | null
    kidsAttending: boolean
    kidsCount: number
    checkedIn: boolean
  } | null
}

interface SeatingTable {
  id: string
  name: string
  capacity: number
  position: string | null
}

interface PublicVendor {
  id: string
  name: string
  category: string
  description: string | null
  website: string | null
  featured: boolean
}

/** Private vendor row from /api/planner/vendors (the couple's own contacts). */
interface PlannerVendorRow {
  id: string
  name: string
  category: string
  description: string | null
  website: string | null
  phone: string | null
  imageUrl: string | null
  rating: number | null
  featured: boolean
  // Planning-only metadata (decoded from a JSON blob in description)
  contact: string
  contractStatus: string
  paymentStatus: string
  metaRating: number | null
  notes: string
  weddingId: string
  createdAt: string
  updatedAt: string
}

interface TimelineBlock {
  id: string
  time: string
  event: string
  duration: string
  location: string
  notes: string
}

/** Timeline row from /api/planner/timeline (backed by ProgrammeItem). */
interface TimelineRow {
  id: string
  time: string
  event: string
  title: string
  description: string | null
  notes: string
  duration: string
  location: string
  icon: string | null
  order: number
  weddingId: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'timeline_12_18', label: '12–18 Months Before' },
  { value: 'timeline_9_12', label: '9–12 Months Before' },
  { value: 'timeline_6_9', label: '6–9 Months Before' },
  { value: 'timeline_3_6', label: '3–6 Months Before' },
  { value: 'timeline_2mo', label: '2 Months Before' },
  { value: 'timeline_1mo', label: '1 Month Before' },
  { value: 'timeline_2wk', label: '2 Weeks Before' },
  { value: 'timeline_1wk', label: '1 Week Before' },
  { value: 'wedding_day', label: 'Wedding Day' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'attire', label: 'Attire' },
  { value: 'decor', label: 'Decor' },
  { value: 'photo_video', label: 'Photo/Video' },
  { value: 'music', label: 'Music' },
  { value: 'other', label: 'Other' },
] as const

const BUDGET_CATEGORIES = [
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'attire', label: 'Attire' },
  { value: 'roora', label: 'Roora' },
  { value: 'decor', label: 'Decor' },
  { value: 'photo_video', label: 'Photo/Video' },
  { value: 'music', label: 'Music' },
  { value: 'transport', label: 'Transport' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
] as const

// Pre-seeded checklist of Zimbabwean wedding tasks
const SEED_TASKS: Omit<TaskRow, 'id' | 'weddingId' | 'createdAt' | 'updatedAt' | 'order'>[] = [
  // ── 12–18 Months Before the Wedding ──
  { title: 'Set your wedding date', description: 'Confirm and lock in the wedding date', category: 'timeline_12_18', status: 'done', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Establish your wedding budget', description: 'Determine total budget and allocate per category', category: 'timeline_12_18', status: 'done', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Create a guest list estimate', description: 'Draft initial guest count for venue planning', category: 'timeline_12_18', status: 'done', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Choose your wedding theme and style', description: 'Colors, mood, aesthetic direction', category: 'timeline_12_18', status: 'done', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Book your venue', description: 'Confirm Imba Manor — ceremony + reception', category: 'timeline_12_18', status: 'done', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Hire a wedding planner/coordinator (if required)', description: 'Optional — for day-of coordination', category: 'timeline_12_18', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Choose your bridal party', description: 'Confirm bridesmaids, maid of honor', category: 'timeline_12_18', status: 'done', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Start researching vendors', description: 'Photographer, caterer, florist, DJ, etc.', category: 'timeline_12_18', status: 'in_progress', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  // ── 9–12 Months Before ──
  { title: 'Book photographer and videographer', description: 'Full-day coverage + cinematic reel', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Book caterer', description: 'Menu tasting + confirm date', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Book décor and floral team', description: 'Bouquets, centerpieces, ceremony arch', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Book DJ, MC, or live band', description: 'Reception entertainment + MC', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Choose wedding colors', description: 'Gold, champagne, clay, plum palette', category: 'timeline_9_12', status: 'done', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Start shopping for your wedding dress', description: 'Begin fittings and alterations', category: 'timeline_9_12', status: 'in_progress', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Book hair and makeup artist', description: 'Bride + bridal party hair/makeup', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Arrange accommodation for out-of-town guests', description: 'Hotel block booking — Meikles Hotel', category: 'timeline_9_12', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Start premarital counseling', description: 'Church/marriage counseling sessions', category: 'timeline_9_12', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  // ── 6–9 Months Before ──
  { title: 'Finalize guest list', description: 'Lock in final guest count', category: 'timeline_6_9', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Send Save-the-Date notices', description: 'Email + physical save-the-dates', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Choose bridesmaids dresses', description: 'Gold-champagne palette, 4 dresses', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Select groom attire', description: 'Tailored suit + shirt + shoes', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Book transportation if needed', description: 'Shuttle for guests + bridal car', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Plan honeymoon', description: 'Victoria Falls + Cape Town', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Begin wedding registry', description: 'Register at Boardmans / Mr. Price Home', category: 'timeline_6_9', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Meet with caterer for menu tasting', description: 'Confirm beef, chicken, veg, traditional options', category: 'timeline_6_9', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  // ── 3–6 Months Before ──
  { title: 'Order wedding cake', description: 'Three-tier, traditional + fruit option', category: 'timeline_3_6', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Confirm décor and floral designs', description: 'Finalize centerpieces + ceremony arch', category: 'timeline_3_6', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Choose wedding favors', description: 'Gifts for guests at reception', category: 'timeline_3_6', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Purchase wedding rings', description: 'Bands for both partners', category: 'timeline_3_6', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Plan ceremony details', description: 'Order of service, processional, recessional', category: 'timeline_3_6', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Choose scripture readings, vows, and songs', description: 'Ceremony music + readings', category: 'timeline_3_6', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Schedule dress fittings', description: 'Multiple fittings for alterations', category: 'timeline_3_6', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Purchase bridal accessories', description: 'Veil, shoes, jewelry, perfume', category: 'timeline_3_6', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Prepare seating plan draft', description: 'Initial table assignments', category: 'timeline_3_6', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  // ── 2 Months Before ──
  { title: 'Send invitations', description: 'Gold foil invitations with RSVP cards', category: 'timeline_2mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Follow up on RSVPs', description: 'Track responses, contact non-responders', category: 'timeline_2mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Finalize guest numbers', description: 'Final headcount for caterer + venue', category: 'timeline_2mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Confirm accommodation arrangements', description: 'Hotel bookings for out-of-town guests', category: 'timeline_2mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Confirm honeymoon bookings', description: 'Flights + hotels for Victoria Falls + Cape Town', category: 'timeline_2mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Confirm vendor contracts and payments', description: 'Review all contracts, pay deposits', category: 'timeline_2mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Purchase gifts for bridal party and parents', description: 'Thank-you gifts for attendants + parents', category: 'timeline_2mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  // ── 1 Month Before ──
  { title: 'Final dress fitting', description: 'Last fitting before wedding day', category: 'timeline_1mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Hair and makeup trial', description: 'Trial run with MUA', category: 'timeline_1mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Confirm ceremony program', description: 'Final order of service', category: 'timeline_1mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Confirm seating arrangements', description: 'Finalize table assignments', category: 'timeline_1mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Confirm timeline with vendors', description: 'Share day-of schedule with all vendors', category: 'timeline_1mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Prepare emergency bridal kit', description: 'Safety pins, tissues, makeup touch-ups', category: 'timeline_1mo', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Prepare speeches and toasts', description: 'Best man, MOH, parents speeches', category: 'timeline_1mo', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Obtain marriage license and legal documents', description: 'Civil registration at Magistrates Court', category: 'timeline_1mo', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  // ── 2 Weeks Before ──
  { title: 'Confirm final guest count', description: 'Give final numbers to caterer + venue', category: 'timeline_2wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Make final vendor payments', description: 'Settle all outstanding balances', category: 'timeline_2wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Confirm transportation schedule', description: 'Shuttle times + bridal car pickup', category: 'timeline_2wk', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Pack honeymoon luggage', description: 'Begin packing for honeymoon', category: 'timeline_2wk', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Confirm bridal party responsibilities', description: 'Brief bridesmaids + groomsmen on roles', category: 'timeline_2wk', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Confirm music playlist', description: 'Send final song list to DJ', category: 'timeline_2wk', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Prepare welcome bags for guests', description: 'Gift bags for out-of-town guests', category: 'timeline_2wk', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  // ── 1 Week Before ──
  { title: 'Confirm all vendor arrival times', description: 'Final check with every vendor', category: 'timeline_1wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Pick up wedding dress', description: 'Collect dress from boutique/tailor', category: 'timeline_1wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Prepare wedding-day essentials', description: 'Pack emergency kit + overnight bag', category: 'timeline_1wk', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Delegate tasks to trusted family/friends', description: 'Assign day-of coordination roles', category: 'timeline_1wk', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Get manicure and pedicure', description: 'Nail appointment for bride', category: 'timeline_1wk', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Have rehearsal and rehearsal dinner', description: 'Practice ceremony + dinner with party', category: 'timeline_1wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Pray and prepare emotionally for marriage', description: 'Quiet time, prayer, emotional preparation', category: 'timeline_1wk', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  // ── Wedding Day — Bride Essentials ──
  { title: 'Wedding dress', description: 'The gown', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Veil', description: 'Bridal veil', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Shoes', description: 'Wedding shoes + comfortable reception shoes', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Jewelry', description: 'Bridal jewelry', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Perfume', description: 'Signature scent', category: 'wedding_day', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Marriage license/documents', description: 'Legal documents for ceremony', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Phone charger', description: 'Phone + charger for the day', category: 'wedding_day', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Touch-up makeup kit', description: 'Lipstick, powder for touch-ups', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Tissues', description: 'For happy tears', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Safety pins', description: 'Emergency wardrobe fixes', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Comfortable shoes for reception', description: 'Flats for dancing', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  // ── Wedding Day — Before Ceremony ──
  { title: 'Eat breakfast and stay hydrated', description: 'Important — eat before the rush', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Hair appointment', description: 'Bridal hair styling', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Makeup appointment', description: 'Bridal makeup application', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Bridal party photos', description: 'Photos with bridesmaids before ceremony', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Family photos', description: 'Pre-ceremony family photos', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Quiet time for prayer and reflection', description: 'Moment of peace before the ceremony', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  // ── Wedding Day — During Ceremony ──
  { title: 'Rings ready', description: 'Wedding rings at the altar', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  { title: 'Vows ready', description: 'Personalized vows written + ready', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Bouquet ready', description: 'Bridal bouquet prepared', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Marriage register ready', description: 'Sign the official marriage register', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Kudzie' },
  // ── Wedding Day — Reception ──
  { title: 'Grand entrance', description: 'Mr & Mrs Musarurwa enter reception', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Cake cutting', description: 'Cut the wedding cake together', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'First dance', description: 'First dance as married couple', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Family photos at reception', description: 'Reception family photos', category: 'wedding_day', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Bouquet toss (optional)', description: 'Toss bouquet to single ladies', category: 'wedding_day', status: 'todo', priority: 'low', dueDate: null, assignee: 'Charity' },
  { title: 'Thank guests', description: 'Personally thank guests for coming', category: 'wedding_day', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  // ── Christian Bride Spiritual Checklist ──
  { title: 'Commit the marriage to God in prayer', description: 'Dedicate the union to God', category: 'spiritual', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Complete premarital counseling', description: 'Finish all counseling sessions', category: 'spiritual', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Pray together as a couple regularly', description: 'Establish prayer routine together', category: 'spiritual', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Discuss family vision and goals', description: 'Align on family direction', category: 'spiritual', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Discuss finances and budgeting', description: 'Align on financial management', category: 'spiritual', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Kudzie' },
  { title: 'Discuss children and parenting expectations', description: 'Align on family planning', category: 'spiritual', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Discuss church involvement', description: 'Align on church community', category: 'spiritual', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
  { title: 'Write a marriage covenant before God', description: 'Create a written covenant', category: 'spiritual', status: 'todo', priority: 'high', dueDate: null, assignee: 'Charity' },
  { title: 'Choose a marriage scripture', description: 'Select a verse for the marriage', category: 'spiritual', status: 'todo', priority: 'medium', dueDate: null, assignee: 'Charity' },
]

const SEED_BUDGET: Omit<BudgetRow, 'id' | 'weddingId' | 'vendorId'>[] = [
  { category: 'venue', description: 'Imba Manor — full-day hire + ceremony garden', estimatedCost: 4500, actualCost: 4500, paidAmount: 1500, currency: 'USD', dueDate: null },
  { category: 'catering', description: 'Caterer — 180 pax, full dinner + canapés', estimatedCost: 6000, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
  { category: 'catering', description: 'Wedding cake — three-tier (fruit + sponge)', estimatedCost: 600, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
  { category: 'attire', description: "Bride's gown + alterations", estimatedCost: 1800, actualCost: 1900, paidAmount: 1900, currency: 'USD', dueDate: null },
  { category: 'attire', description: "Groom's suit + shirt + shoes", estimatedCost: 800, actualCost: null, paidAmount: 400, currency: 'USD', dueDate: null },
  { category: 'attire', description: 'Bridal party (4 BM + 4 GM + 2 kids)', estimatedCost: 2400, actualCost: null, paidAmount: 800, currency: 'USD', dueDate: null },
  { category: 'roora', description: 'Roora — mombe, pfuma, gifts to family', estimatedCost: 3000, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
  { category: 'decor', description: 'Florist — bouquets, centerpieces, ceremony arch', estimatedCost: 2500, actualCost: null, paidAmount: 500, currency: 'USD', dueDate: null },
  { category: 'decor', description: 'Lighting + drapery + chair covers', estimatedCost: 1200, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
  { category: 'photo_video', description: 'Photographer + videographer (full day + reel)', estimatedCost: 3200, actualCost: null, paidAmount: 600, currency: 'USD', dueDate: null },
  { category: 'music', description: 'DJ + MC + sound system', estimatedCost: 1500, actualCost: null, paidAmount: 300, currency: 'USD', dueDate: null },
  { category: 'transport', description: 'Shuttle for guests + bridal car', estimatedCost: 900, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
  { category: 'stationery', description: 'Invitations, programmes, place cards', estimatedCost: 700, actualCost: null, paidAmount: 350, currency: 'USD', dueDate: null },
  { category: 'miscellaneous', description: 'Marriage license + tips + contingency', estimatedCost: 1500, actualCost: null, paidAmount: 0, currency: 'USD', dueDate: null },
]

const SEED_TIMELINE: TimelineBlock[] = [
  { id: 't1', time: '13:00', event: 'Guests Arrive', duration: '60 min', location: 'Imba Manor gardens', notes: 'Welcome drinks & canapés. Ushers escort guests to seats.' },
  { id: 't2', time: '14:00', event: 'Ceremony Begins', duration: '45 min', location: 'Ceremony garden', notes: 'Processional, vows, ring exchange, kiss.' },
  { id: 't3', time: '14:45', event: '"I Do" — The Vows', duration: '15 min', location: 'Ceremony garden', notes: 'The moment we say forever.' },
  { id: 't4', time: '15:00', event: 'Confetti & Celebrations', duration: '30 min', location: 'Manor steps', notes: 'Rice toss + family photos on the steps.' },
  { id: 't5', time: '15:30', event: 'Cocktail Hour & Canapés', duration: '60 min', location: 'Garden terrace', notes: 'Signature cocktails, lawn games, live jazz.' },
  { id: 't6', time: '16:30', event: 'Reception & First Dance', duration: '30 min', location: 'Reception hall', notes: 'Mr & Mrs Musarurwa take the floor.' },
  { id: 't7', time: '17:00', event: 'Dinner is Served', duration: '90 min', location: 'Reception hall', notes: 'A feast celebrating Zimbabwean flavours.' },
  { id: 't8', time: '18:30', event: 'Speeches & Toasts', duration: '60 min', location: 'Reception hall', notes: 'Best man, MOH, parents.' },
  { id: 't9', time: '19:30', event: 'Cutting the Cake', duration: '20 min', location: 'Reception hall', notes: 'Sweet beginnings.' },
  { id: 't10', time: '20:00', event: 'Dance Floor Opens', duration: '120 min', location: 'Reception hall', notes: 'Let the celebration begin!' },
  { id: 't11', time: '22:00', event: 'Last Dance & Sparkler Exit', duration: '30 min', location: 'Manor driveway', notes: 'A magical farewell.' },
]

// 8-table seating plan for Imba Manor. Used as an offline fallback when
// the planner API is unreachable (dev-mode cross-origin issue) so the
// Seating tab never renders empty.
const SEED_TABLES: SeatingTable[] = [
  { id: 'seed-table-1', name: 'Table 1 — Family', capacity: 8, position: null },
  { id: 'seed-table-2', name: 'Table 2 — Family', capacity: 8, position: null },
  { id: 'seed-table-3', name: 'Table 3 — Bridal Party', capacity: 8, position: null },
  { id: 'seed-table-4', name: 'Table 4 — Bridal Party', capacity: 8, position: null },
  { id: 'seed-table-5', name: 'Table 5 — Friends', capacity: 8, position: null },
  { id: 'seed-table-6', name: 'Table 6 — Friends', capacity: 8, position: null },
  { id: 'seed-table-7', name: 'Table 7 — Colleagues', capacity: 8, position: null },
  { id: 'seed-table-8', name: 'Table 8 — VIPs', capacity: 8, position: null },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const json = (await res.json()) as { success?: boolean; data?: T } & T
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T
  }
  return json as T
}

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function categoryLabel(value: string): string {
  const found = [...TASK_CATEGORIES, ...BUDGET_CATEGORIES].find((c) => c.value === value)
  return found?.label ?? value
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'border-clay/40 bg-clay/15 text-clay-light'
    case 'medium':
      return 'border-gold/40 bg-gold/15 text-gold'
    case 'low':
      return 'border-sage/40 bg-sage/15 text-sage-light'
    default:
      return 'border-champagne/20 bg-champagne/10 text-champagne/70'
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'done':
      return 'border-sage/40 bg-sage/15 text-sage-light'
    case 'in_progress':
      return 'border-gold/40 bg-gold/15 text-gold'
    case 'blocked':
      return 'border-plum/40 bg-plum/15 text-plum-light'
    case 'todo':
    default:
      return 'border-champagne/20 bg-champagne/10 text-champagne/60'
  }
}

function sideLabel(side: string | null): string {
  switch (side) {
    case 'bride':
      return "Charity's Side"
    case 'groom':
      return "Kudzie's Side"
    case 'family':
      return 'Family'
    case 'neutral':
    default:
      return 'Both'
  }
}

// ─── Offline seed builders ──────────────────────────────────────────────────
// When the planner API is unreachable (dev-mode cross-origin "Failed to
// fetch"), the auto-seed POST also fails and the planner would otherwise
// render with empty arrays. These builders turn the SEED_* constants into
// fully-typed local rows so the planner always shows data — read-only in
// offline mode (mutations will no-op via the catch blocks).

function buildSeedTasks(): TaskRow[] {
  return SEED_TASKS.map((task, i) => ({
    ...task,
    id: `seed-task-${i}`,
    weddingId: '',
    createdAt: '',
    updatedAt: '',
    order: i,
  }))
}

function buildSeedTimeline(): TimelineRow[] {
  return SEED_TIMELINE.map((block, i) => ({
    id: block.id,
    time: block.time,
    event: block.event,
    title: block.event,
    description: null,
    notes: block.notes,
    duration: block.duration,
    location: block.location,
    icon: null,
    order: i + 1,
    weddingId: '',
    createdAt: '',
    updatedAt: '',
  }))
}

function buildSeedBudget(): {
  items: BudgetRow[]
  summary: BudgetSummary
  byCategory: CategoryBreakdown[]
} {
  const items: BudgetRow[] = SEED_BUDGET.map((item, i) => ({
    ...item,
    id: `seed-budget-${i}`,
    weddingId: '',
    vendorId: null,
  }))
  const totalEstimated = items.reduce((s, x) => s + x.estimatedCost, 0)
  const totalActual = items.reduce((s, x) => s + (x.actualCost ?? 0), 0)
  const totalPaid = items.reduce((s, x) => s + x.paidAmount, 0)
  const summary: BudgetSummary = {
    totalEstimated,
    totalActual,
    totalPaid,
    totalOutstanding: totalActual - totalPaid,
    currency: 'USD',
    percentPaid: totalActual > 0 ? Math.round((totalPaid / totalActual) * 100) : 0,
    percentActualOfEstimated:
      totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0,
  }
  const byCatMap: Record<string, CategoryBreakdown> = {}
  for (const item of items) {
    const c =
      byCatMap[item.category] ?? {
        category: item.category,
        estimated: 0,
        actual: 0,
        paid: 0,
        outstanding: 0,
        count: 0,
      }
    c.estimated += item.estimatedCost
    c.actual += item.actualCost ?? 0
    c.paid += item.paidAmount
    c.outstanding = c.actual - c.paid
    c.count += 1
    byCatMap[item.category] = c
  }
  return { items, summary, byCategory: Object.values(byCatMap) }
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface WeddingPlannerProps {
  onClose: () => void
}

export function WeddingPlanner({ onClose }: WeddingPlannerProps) {
  const { toast } = useToast()
  // Set the global `plannerOpen` flag so other floating widgets (notably
  // the AI assistant bubble) hide themselves while the planner is mounted.
  // This prevents focus/scroll conflicts and an inadvertent logout flow
  // observed when the AI bubble was clicked from inside the planner.
  const setPlannerOpen = useWewedStore((s) => s.setPlannerOpen)
  // Lazy initial state — checks admin session on first client render only.
  // Avoids the setState-in-effect pattern by computing once at mount.
  const [authed, setAuthed] = useState<boolean>(() =>
    typeof window !== 'undefined' && isAdminLoggedIn()
  )
  // authChecked is always true at first render (we resolve synchronously)
  const [authChecked] = useState<boolean>(true)

  // ── Body scroll lock ──
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ── Global planner-open flag (for AiTrigger / floating widgets) ──
  useEffect(() => {
    setPlannerOpen(true)
    return () => setPlannerOpen(false)
  }, [setPlannerOpen])

  // ── Escape to close ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Auth handlers ──
  const handleLogin = (password: string): boolean => {
    if (verifyAdmin(password)) {
      setAdminLoggedIn()
      setAuthed(true)
      toast({
        title: 'Welcome to your planner',
        description: 'Plan the wedding of Charity & Kudzie.',
      })
      return true
    }
    toast({
      title: 'Incorrect password',
      description: 'The default is wewed-admin-2026.',
      variant: 'destructive',
    })
    return false
  }

  const handleLogout = () => {
    logoutAdmin()
    setAuthed(false)
    toast({ title: 'Signed out', description: 'Planner session ended.' })
  }

  if (!authChecked) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="h-[94vh] max-h-[94vh] w-[96vw] max-w-[1400px] gap-0 overflow-hidden rounded-2xl border-gold/30 bg-espresso p-0 text-champagne sm:max-w-[1400px]"
      >
        <DialogTitle className="sr-only">Wedding Planner</DialogTitle>
        <DialogDescription className="sr-only">
          Plan the wedding of Charity &amp; Kudzie — checklist, budget, vendors, guests,
          timeline, and seating.
        </DialogDescription>

        {!authed ? (
          <PlannerLogin onLogin={handleLogin} onClose={onClose} />
        ) : (
          <PlannerShell onClose={onClose} onLogout={handleLogout} />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default WeddingPlanner

// ─── Login Screen ───────────────────────────────────────────────────────────

function PlannerLogin({
  onLogin,
  onClose,
}: {
  onLogin: (password: string) => boolean
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = onLogin(password)
    if (!ok) {
      setError('Incorrect password')
      setPassword('')
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-gradient-to-br from-espresso via-espresso to-plum/30 px-4">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
      >
        <X className="size-4" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-md"
      >
        <Card className="border-gold/30 bg-champagne/[0.03] p-8 backdrop-blur-sm">
          <CardContent className="px-0">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <ListTodo className="size-6 text-gold" />
              </div>
              <p className="wewed-monogram text-xs tracking-[0.3em]">C&amp;K · 23.12.26</p>
              <h2 className="wewed-heading mt-3 text-3xl text-champagne">Wedding Planner</h2>
              <p className="mt-2 font-sans text-sm text-champagne/60">
                A private planning studio for Charity &amp; Kudzie.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="planner-password"
                  className="font-sans text-xs uppercase tracking-[0.18em] text-gold-muted"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                  <Input
                    id="planner-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    className="border-gold/30 bg-espresso/60 pl-10 pr-10 font-sans text-champagne placeholder:text-champagne/30 focus:border-gold focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 transition-colors hover:text-gold"
                  >
                    {show ? <X className="size-4" /> : <Unlock className="size-4" />}
                  </button>
                </div>
                {error && <p className="font-sans text-xs text-clay-light">{error}</p>}
              </div>

              <Button
                type="submit"
                disabled={!password}
                className="w-full bg-gold font-sans text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                <Unlock className="size-4" />
                Open the Planner
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-center">
              <p className="font-sans text-[10px] text-champagne/40">
                Default password:{' '}
                <code className="rounded bg-champagne/10 px-1.5 py-0.5 text-gold/80">
                  wewed-admin-2026
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Planner Shell ──────────────────────────────────────────────────────────

function PlannerShell({
  onClose,
  onLogout,
}: {
  onClose: () => void
  onLogout: () => void
}) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Data states
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [budget, setBudget] = useState<BudgetRow[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [tables, setTables] = useState<SeatingTable[]>([])
  const [vendors, setVendors] = useState<PublicVendor[]>([])
  // Planner-only (private) vendor contacts and day-of timeline,
  // both persisted to /api/planner/{vendors,timeline}.
  const [plannerVendors, setPlannerVendors] = useState<PlannerVendorRow[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])

  // ── Auto-seed helpers (only fire if DB empty) ──
  // Declared BEFORE refresh so refresh can reference them safely.
  const autoSeedTasks = useCallback(async () => {
    try {
      await Promise.all(
        SEED_TASKS.map((task) =>
          fetch('/api/planner/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
          }).catch(() => null)
        )
      )
      // Refetch after seeding
      const res = await fetch('/api/planner/tasks', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as { data: TaskRow[] }
        const arr = (json.data ?? []).sort((a, b) => a.order - b.order)
        if (arr.length > 0) {
          setTasks(arr)
          return
        }
      }
      // API unreachable or still empty — fall back to seed data offline
      setTasks(buildSeedTasks())
    } catch {
      // Fall back to seed data so the planner never renders empty
      setTasks(buildSeedTasks())
    }
  }, [])

  const autoSeedBudget = useCallback(async () => {
    try {
      await Promise.all(
        SEED_BUDGET.map((item) =>
          fetch('/api/planner/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          }).catch(() => null)
        )
      )
      const res = await fetch('/api/planner/budget', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as {
          data: BudgetRow[]
          summary: BudgetSummary
          byCategory: CategoryBreakdown[]
        }
        if ((json.data ?? []).length > 0) {
          setBudget(json.data ?? [])
          setBudgetSummary(json.summary ?? null)
          setCategoryBreakdown(json.byCategory ?? [])
          return
        }
      }
      // API unreachable or still empty — fall back to seed data offline
      const seed = buildSeedBudget()
      setBudget(seed.items)
      setBudgetSummary(seed.summary)
      setCategoryBreakdown(seed.byCategory)
    } catch {
      // Fall back to seed data so the planner never renders empty
      const seed = buildSeedBudget()
      setBudget(seed.items)
      setBudgetSummary(seed.summary)
      setCategoryBreakdown(seed.byCategory)
    }
  }, [])

  const autoSeedTables = useCallback(async () => {
    try {
      // Seed 8 tables (Imba Manor reception)
      const tableNames = [
        'Table 1 — Family',
        'Table 2 — Family',
        'Table 3 — Bridal Party',
        'Table 4 — Bridal Party',
        'Table 5 — Friends',
        'Table 6 — Friends',
        'Table 7 — Colleagues',
        'Table 8 — VIPs',
      ]
      await Promise.all(
        tableNames.map((name) =>
          fetch('/api/planner/guests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'table', tableName: name, capacity: 8 }),
          }).catch(() => null)
        )
      )
      const res = await fetch('/api/planner/guests', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as { tables: SeatingTable[] }
        if ((json.tables ?? []).length > 0) {
          setTables(json.tables ?? [])
          return
        }
      }
      // API unreachable or still empty — fall back to seed tables offline
      setTables(SEED_TABLES)
    } catch {
      // Fall back to seed tables so the planner never renders empty
      setTables(SEED_TABLES)
    }
  }, [])

  // ── Auto-seed timeline (only fires if DB programme items are empty) ──
  const autoSeedTimeline = useCallback(async () => {
    try {
      await Promise.all(
        SEED_TIMELINE.map((block, i) =>
          fetch('/api/planner/timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: block.time,
              event: block.event,
              duration: block.duration,
              location: block.location,
              notes: block.notes,
              order: i + 1,
            }),
          }).catch(() => null)
        )
      )
      const res = await fetch('/api/planner/timeline', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as { data: TimelineRow[] }
        const arr = (json.data ?? []).sort((a, b) => a.order - b.order)
        if (arr.length > 0) {
          setTimeline(arr)
          return
        }
      }
      // API unreachable or still empty — fall back to seed timeline offline
      setTimeline(buildSeedTimeline())
    } catch {
      // Fall back to seed timeline so the planner never renders empty
      setTimeline(buildSeedTimeline())
    }
  }, [])

  // ── Fetch data ──
  const refresh = useCallback(async () => {
    const controller = new AbortController()
    try {
      const [t, b, g, w, pv, tl] = await Promise.allSettled([
        fetchJson<{ data: TaskRow[] } | TaskRow[]>('/api/planner/tasks', controller.signal),
        fetchJson<{
          data: BudgetRow[]
          summary: BudgetSummary
          byCategory: CategoryBreakdown[]
        }>('/api/planner/budget', controller.signal),
        fetchJson<{ data: GuestRow[]; tables: SeatingTable[] }>(
          '/api/planner/guests',
          controller.signal
        ),
        fetchJson<{ data: { vendors: PublicVendor[] } } | { vendors: PublicVendor[] }>(
          '/api/wedding',
          controller.signal
        ),
        fetchJson<{ data: PlannerVendorRow[] } | PlannerVendorRow[]>(
          '/api/planner/vendors',
          controller.signal
        ),
        fetchJson<{ data: TimelineRow[] } | TimelineRow[]>(
          '/api/planner/timeline',
          controller.signal
        ),
      ])

      if (t.status === 'fulfilled') {
        const val = t.value as { data?: TaskRow[] } | TaskRow[]
        const arr = Array.isArray(val) ? val : val.data ?? []
        if (arr.length === 0) {
          // DB is empty AND API is reachable — try auto-seed, but also
          // immediately fall back to seed data so the user sees content
          void autoSeedTasks()
          setTasks(buildSeedTasks())
        } else {
          setTasks(arr.sort((a, b) => a.order - b.order))
        }
      } else {
        // Fetch failed (dev-mode cross-origin issue) — use seed data
        setTasks(buildSeedTasks())
      }
      if (b.status === 'fulfilled') {
        const val = b.value as {
          data: BudgetRow[]
          summary?: BudgetSummary
          byCategory?: CategoryBreakdown[]
        }
        if ((val.data ?? []).length === 0) {
          // DB empty — use seed data immediately
          void autoSeedBudget()
          const seed = buildSeedBudget()
          setBudget(seed.items)
          setBudgetSummary(seed.summary)
          setCategoryBreakdown(seed.byCategory)
        } else {
          setBudget(val.data ?? [])
          setBudgetSummary(val.summary ?? null)
          setCategoryBreakdown(val.byCategory ?? [])
        }
      } else {
        // Fetch failed — fall back to seed budget offline
        const seed = buildSeedBudget()
        setBudget(seed.items)
        setBudgetSummary(seed.summary)
        setCategoryBreakdown(seed.byCategory)
      }
      if (g.status === 'fulfilled') {
        const val = g.value as { data: GuestRow[]; tables: SeatingTable[] }
        setGuests(val.data ?? [])
        setTables(val.tables ?? [])
        if ((val.tables ?? []).length === 0) {
          void autoSeedTables()
          setTables(SEED_TABLES)
        }
      } else {
        setGuests([])
        setTables(SEED_TABLES)
      }
      if (w.status === 'fulfilled') {
        const val = w.value as { vendors: PublicVendor[] } | { data: { vendors: PublicVendor[] } }
        const v = (val as { vendors?: PublicVendor[] }).vendors
          ?? (val as { data?: { vendors?: PublicVendor[] } }).data?.vendors
          ?? []
        setVendors(v)
      } else {
        setVendors([])
      }
      if (pv.status === 'fulfilled') {
        const val = pv.value as { data?: PlannerVendorRow[] } | PlannerVendorRow[]
        const arr = Array.isArray(val) ? val : val.data ?? []
        setPlannerVendors(arr)
      } else {
        setPlannerVendors([])
      }
      if (tl.status === 'fulfilled') {
        const val = tl.value as { data?: TimelineRow[] } | TimelineRow[]
        const arr = Array.isArray(val) ? val : val.data ?? []
        if (arr.length === 0) {
          void autoSeedTimeline()
          setTimeline(buildSeedTimeline())
        } else {
          setTimeline(arr.sort((a, b) => a.order - b.order))
        }
      } else {
        setTimeline(buildSeedTimeline())
      }
      setLastUpdated(new Date())
    } catch {
      /* individual rejections handled above */
    }
  }, [autoSeedTasks, autoSeedBudget, autoSeedTables, autoSeedTimeline])

  // ── Polling ──
  // The initial fetch + interval polling pattern. We defer the first call via
  // setTimeout(0) so the rule about setState-synchronously-in-effect doesn't
  // fire (the setState calls inside refresh() happen async, after fetch).
  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0)
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [refresh])

  // ── Derived stats ──
  const checklistStats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length
    const blocked = tasks.filter((t) => t.status === 'blocked').length
    const todo = tasks.filter((t) => t.status === 'todo').length
    return { total, done, inProgress, blocked, todo, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [tasks])

  const guestStats = useMemo(() => {
    const total = guests.length
    const confirmed = guests.filter((g) => g.rsvp?.attending === true).length
    const declined = guests.filter((g) => g.rsvp?.attending === false).length
    const pending = guests.filter((g) => g.rsvp?.attending === null || !g.rsvp).length
    const plusOnes = guests.filter((g) => g.rsvp?.plusOne === true).length
    const kidsTotal = guests.reduce((acc, g) => acc + (g.rsvp?.kidsAttending ? g.rsvp.kidsCount : 0), 0)
    const checkedIn = guests.filter((g) => g.rsvp?.checkedIn === true).length
    const heads = confirmed + plusOnes + kidsTotal
    return { total, confirmed, declined, pending, plusOnes, kidsTotal, checkedIn, heads }
  }, [guests])

  return (
    <div className="flex h-full flex-col bg-espresso text-champagne">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="hidden size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10 sm:flex">
            <ListTodo className="size-4 text-gold" />
          </div>
          <div>
            <p className="wewed-monogram text-[10px] tracking-[0.3em] text-gold/80">
              C&amp;K · 23.12.26
            </p>
            <h2 className="wewed-heading text-lg text-champagne sm:text-xl">Wedding Planner</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="font-sans text-[10px] uppercase tracking-[0.15em] text-champagne/40">
              {lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : 'Loading…'}
            </p>
            <p className="font-sans text-[10px] text-gold-muted">
              Polling every 15s · {tasks.length} tasks · {guests.length} guests
            </p>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
          <button
            onClick={onClose}
            aria-label="Close planner"
            className="inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="checklist" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 border-b border-gold/15 bg-espresso px-2 sm:px-6">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-2">
            <PlannerTabTrigger value="checklist" icon={<ListTodo className="size-3.5" />} label="Checklist" badge={`${checklistStats.done}/${checklistStats.total}`} />
            <PlannerTabTrigger value="budget" icon={<DollarSign className="size-3.5" />} label="Budget" />
            <PlannerTabTrigger value="vendors" icon={<Store className="size-3.5" />} label="Vendors" badge={plannerVendors.length || undefined} />
            <PlannerTabTrigger value="guests" icon={<Users className="size-3.5" />} label="Guest List" badge={guests.length || undefined} />
            <PlannerTabTrigger value="timeline" icon={<Calendar className="size-3.5" />} label="Timeline" />
            <PlannerTabTrigger value="seating" icon={<LayoutGrid className="size-3.5" />} label="Seating" badge={tables.length || undefined} />
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="checklist" className="mt-0 h-full">
            <ChecklistTab tasks={tasks} setTasks={setTasks} stats={checklistStats} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="budget" className="mt-0 h-full">
            <BudgetTab
              items={budget}
              summary={budgetSummary}
              byCategory={categoryBreakdown}
              setItems={setBudget}
              setSummary={setBudgetSummary}
              setCategoryBreakdown={setCategoryBreakdown}
              onRefresh={refresh}
            />
          </TabsContent>
          <TabsContent value="vendors" className="mt-0 h-full">
            <VendorsTab
              vendors={vendors}
              plannerVendors={plannerVendors}
              setPlannerVendors={setPlannerVendors}
              onRefresh={refresh}
            />
          </TabsContent>
          <TabsContent value="guests" className="mt-0 h-full">
            <GuestsTab guests={guests} tables={tables} setGuests={setGuests} stats={guestStats} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-0 h-full">
            <TimelineTab blocks={timeline} setBlocks={setTimeline} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="seating" className="mt-0 h-full">
            <SeatingTab guests={guests} tables={tables} setTables={setTables} setGuests={setGuests} onRefresh={refresh} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function PlannerTabTrigger({
  value,
  icon,
  label,
  badge,
}: {
  value: string
  icon: React.ReactNode
  label: string
  badge?: string | number
}) {
  return (
    <TabsTrigger
      value={value}
      className="gap-1.5 rounded-md border border-transparent px-3 py-2 font-sans text-xs text-champagne/60 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
    >
      {icon}
      {label}
      {badge !== undefined && badge !== 0 && (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold/20 px-1 text-[9px] text-gold">
          {badge}
        </span>
      )}
    </TabsTrigger>
  )
}

// ─── Tab 1: Checklist ───────────────────────────────────────────────────────

function ChecklistTab({
  tasks,
  setTasks,
  stats,
  onRefresh,
}: {
  tasks: TaskRow[]
  setTasks: React.Dispatch<React.SetStateAction<TaskRow[]>>
  stats: { total: number; done: number; inProgress: number; blocked: number; todo: number; percent: number }
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    category: 'venue',
    priority: 'medium',
    dueDate: '',
    assignee: '',
  })

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase().trim()))
        return false
      return true
    })
  }, [tasks, activeCategory, statusFilter, search])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; done: number }> = {}
    for (const t of tasks) {
      counts[t.category] = counts[t.category] ?? { total: 0, done: 0 }
      counts[t.category].total += 1
      if (t.status === 'done') counts[t.category].done += 1
    }
    return counts
  }, [tasks])

  const toggleTask = useCallback(
    async (task: TaskRow) => {
      const nextStatus = task.status === 'done' ? 'todo' : 'done'
      // Optimistic update
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
      try {
        const res = await fetch(`/api/planner/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })
        if (!res.ok) throw new Error('Failed')
        toast({
          title: nextStatus === 'done' ? 'Task completed' : 'Reopened',
          description: task.title,
        })
      } catch {
        // Revert
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
        toast({ title: 'Update failed', variant: 'destructive' })
      }
    },
    [setTasks, toast]
  )

  const deleteTask = useCallback(
    async (task: TaskRow) => {
      const prev = tasks
      setTasks((p) => p.filter((t) => t.id !== task.id))
      try {
        const res = await fetch(`/api/planner/tasks/${task.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Task removed', description: task.title })
      } catch {
        setTasks(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [tasks, setTasks, toast]
  )

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newTask.title.trim()) return
      try {
        const res = await fetch('/api/planner/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTask.title.trim(),
            category: newTask.category,
            priority: newTask.priority,
            dueDate: newTask.dueDate || null,
            assignee: newTask.assignee.trim() || null,
            status: 'todo',
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: TaskRow }
        setTasks((prev) => [...prev, json.data])
        toast({ title: 'Task added', description: newTask.title })
        setNewTask({ title: '', category: 'venue', priority: 'medium', dueDate: '', assignee: '' })
        setShowAdd(false)
      } catch {
        toast({ title: 'Could not add task', variant: 'destructive' })
      }
    },
    [newTask, setTasks, toast]
  )

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="checklist" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      {/* Progress bar */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/60 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
              Checklist Progress
            </p>
            <p className="wewed-heading text-xl text-champagne">
              {stats.done} of {stats.total} tasks complete
              <span className="ml-2 font-sans text-sm text-gold">({stats.percent}%)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold">
              <Circle className="mr-1 size-2.5" /> {stats.todo} todo
            </Badge>
            <Badge variant="outline" className="border-clay/30 bg-clay/10 text-clay-light">
              <Clock className="mr-1 size-2.5" /> {stats.inProgress} in progress
            </Badge>
            <Badge variant="outline" className="border-plum/30 bg-plum/10 text-plum-light">
              <AlertCircle className="mr-1 size-2.5" /> {stats.blocked} blocked
            </Badge>
            <Button
              size="sm"
              onClick={() => setShowAdd((s) => !s)}
              className="bg-gold text-espresso hover:bg-gold-light"
            >
              <Plus className="size-3.5" /> Add Task
            </Button>
          </div>
        </div>
        <Progress
          value={stats.percent}
          className="mt-3 h-2 bg-champagne/10 [&>div]:bg-gradient-to-r [&>div]:from-gold-muted [&>div]:via-gold [&>div]:to-gold-light"
        />
      </div>

      {/* Add task form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 sm:px-6">
              <div className="lg:col-span-2">
                <Label htmlFor="task-title" className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Task Title
                </Label>
                <Input
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Confirm cake tasting"
                  className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Category</Label>
                <Select value={newTask.category} onValueChange={(v) => setNewTask((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    {TASK_CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                      <SelectItem key={c.value} value={c.value} className="focus:bg-gold/10 focus:text-gold">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="high" className="focus:bg-clay/10 focus:text-clay-light">High</SelectItem>
                    <SelectItem value="medium" className="focus:bg-gold/10 focus:text-gold">Medium</SelectItem>
                    <SelectItem value="low" className="focus:bg-sage/10 focus:text-sage-light">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="task-due" className="text-[10px] uppercase tracking-wider text-gold-muted">
                    Due
                  </Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </div>
                <div>
                  <Label htmlFor="task-assignee" className="text-[10px] uppercase tracking-wider text-gold-muted">
                    Assignee
                  </Label>
                  <Input
                    id="task-assignee"
                    value={newTask.assignee}
                    onChange={(e) => setNewTask((p) => ({ ...p, assignee: e.target.value }))}
                    placeholder="Charity / Kudzie"
                    className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30"
                  />
                </div>
              </div>
              <div className="flex items-end justify-end gap-2 lg:col-span-5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-champagne/60 hover:text-champagne">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-gold text-espresso hover:bg-gold-light">
                  <Plus className="size-3.5" /> Add to checklist
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main: sidebar + task list */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Categories sidebar */}
        <aside className="shrink-0 border-b border-gold/15 bg-espresso/40 sm:border-b-0 sm:border-r">
          <ScrollArea className="h-32 sm:h-full sm:w-56 wewed-scroll">
            <div className="flex gap-1 p-2 sm:flex-col sm:p-3">
              {TASK_CATEGORIES.map((cat) => {
                const counts = cat.value === 'all'
                  ? { total: stats.total, done: stats.done }
                  : categoryCounts[cat.value] ?? { total: 0, done: 0 }
                const isActive = activeCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left font-sans text-xs transition-colors sm:w-full ${
                      isActive
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-transparent text-champagne/60 hover:bg-champagne/5 hover:text-champagne'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[9px] text-champagne/40">{counts.done}/{counts.total}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Task list */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gold/15 px-4 py-3 sm:px-6">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gold/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="border-gold/30 bg-espresso/60 pl-9 text-champagne placeholder:text-champagne/30"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-[140px] border-gold/30 bg-espresso/60 text-champagne">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gold/30 bg-espresso text-champagne">
                <SelectItem value="all" className="focus:bg-gold/10">All statuses</SelectItem>
                <SelectItem value="todo" className="focus:bg-gold/10">To do</SelectItem>
                <SelectItem value="in_progress" className="focus:bg-gold/10">In progress</SelectItem>
                <SelectItem value="done" className="focus:bg-gold/10">Done</SelectItem>
                <SelectItem value="blocked" className="focus:bg-gold/10">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task rows */}
          <ScrollArea className="min-h-0 flex-1 wewed-scroll">
            <div className="space-y-2 p-3 sm:p-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <ListTodo className="size-8 text-gold/40" />
                  <p className="font-sans text-sm text-champagne/50">No tasks in this view.</p>
                  <p className="font-sans text-xs text-champagne/40">
                    Try clearing filters or adding a task.
                  </p>
                </div>
              ) : (
                filtered.map((task) => (
                  <TaskRowItem key={task.id} task={task} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task)} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function TaskRowItem({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskRow
  onToggle: () => void
  onDelete: () => void
}) {
  const isDone = task.status === 'done'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`group flex items-start gap-3 rounded-lg border bg-espresso/40 p-3 transition-colors hover:border-gold/40 ${
        isDone ? 'border-sage/30 opacity-70' : 'border-gold/15'
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        className="mt-0.5 shrink-0"
      >
        {isDone ? (
          <CheckCircle2 className="size-5 text-sage-light transition-colors hover:text-sage" />
        ) : (
          <Circle className="size-5 text-champagne/40 transition-colors hover:text-gold" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-sans text-sm text-champagne ${isDone ? 'line-through' : ''}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 font-sans text-xs text-champagne/50">{task.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-gold/30 bg-gold/5 text-[9px] text-gold">
            {categoryLabel(task.category)}
          </Badge>
          <Badge variant="outline" className={`text-[9px] ${priorityBadgeClass(task.priority)}`}>
            <Flag className="mr-1 size-2.5" />
            {task.priority}
          </Badge>
          {task.status !== 'todo' && task.status !== 'done' && (
            <Badge variant="outline" className={`text-[9px] ${statusBadgeClass(task.status)}`}>
              {task.status === 'in_progress' ? 'In Progress' : task.status}
            </Badge>
          )}
          {task.dueDate && (
            <span className="font-sans text-[10px] text-champagne/40">
              <CalendarDays className="mr-1 inline size-2.5" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.assignee && (
            <span className="font-sans text-[10px] text-champagne/40">
              <User className="mr-1 inline size-2.5" />
              {task.assignee}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="shrink-0 self-center opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3.5 text-champagne/40 hover:text-clay-light" />
      </button>
    </motion.div>
  )
}

// ─── Tab 2: Budget ──────────────────────────────────────────────────────────

function BudgetTab({
  items,
  summary,
  byCategory,
  setItems,
  setSummary,
  setCategoryBreakdown,
  onRefresh,
}: {
  items: BudgetRow[]
  summary: BudgetSummary | null
  byCategory: CategoryBreakdown[]
  setItems: React.Dispatch<React.SetStateAction<BudgetRow[]>>
  setSummary: React.Dispatch<React.SetStateAction<BudgetSummary | null>>
  setCategoryBreakdown: React.Dispatch<React.SetStateAction<CategoryBreakdown[]>>
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({
    category: 'venue',
    description: '',
    estimatedCost: '',
    actualCost: '',
    paidAmount: '',
    dueDate: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ actualCost: string; paidAmount: string }>({
    actualCost: '',
    paidAmount: '',
  })

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newItem.description.trim()) return
      try {
        const res = await fetch('/api/planner/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: newItem.category,
            description: newItem.description.trim(),
            estimatedCost: Number(newItem.estimatedCost) || 0,
            actualCost: newItem.actualCost ? Number(newItem.actualCost) : null,
            paidAmount: Number(newItem.paidAmount) || 0,
            dueDate: newItem.dueDate || null,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Budget item added', description: newItem.description })
        setNewItem({ category: 'venue', description: '', estimatedCost: '', actualCost: '', paidAmount: '', dueDate: '' })
        setShowAdd(false)
        // Refetch to get summary
        const r2 = await fetch('/api/planner/budget', { cache: 'no-store' })
        if (r2.ok) {
          const j = (await r2.json()) as { data: BudgetRow[]; summary: BudgetSummary; byCategory: CategoryBreakdown[] }
          setItems(j.data ?? [])
          setSummary(j.summary ?? null)
          setCategoryBreakdown(j.byCategory ?? [])
        }
      } catch {
        toast({ title: 'Could not add budget item', variant: 'destructive' })
      }
    },
    [newItem, setItems, setSummary, setCategoryBreakdown, toast]
  )

  const handleEdit = useCallback(
    async (item: BudgetRow) => {
      const actualCost = editValues.actualCost === '' ? null : Number(editValues.actualCost)
      const paidAmount = Number(editValues.paidAmount) || 0
      try {
        const res = await fetch(`/api/planner/budget/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actualCost, paidAmount }),
        })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Updated', description: item.description })
        setEditingId(null)
        const r2 = await fetch('/api/planner/budget', { cache: 'no-store' })
        if (r2.ok) {
          const j = (await r2.json()) as { data: BudgetRow[]; summary: BudgetSummary; byCategory: CategoryBreakdown[] }
          setItems(j.data ?? [])
          setSummary(j.summary ?? null)
          setCategoryBreakdown(j.byCategory ?? [])
        }
      } catch {
        toast({ title: 'Update failed', variant: 'destructive' })
      }
    },
    [editValues, setItems, setSummary, setCategoryBreakdown, toast]
  )

  const handleDelete = useCallback(
    async (item: BudgetRow) => {
      const prev = items
      setItems((p) => p.filter((i) => i.id !== item.id))
      try {
        const res = await fetch(`/api/planner/budget/${item.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Item removed', description: item.description })
        const r2 = await fetch('/api/planner/budget', { cache: 'no-store' })
        if (r2.ok) {
          const j = (await r2.json()) as { summary: BudgetSummary; byCategory: CategoryBreakdown[] }
          setSummary(j.summary ?? null)
          setCategoryBreakdown(j.byCategory ?? [])
        }
      } catch {
        setItems(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [items, setItems, setSummary, setCategoryBreakdown, toast]
  )

  const startEdit = (item: BudgetRow) => {
    setEditingId(item.id)
    setEditValues({
      actualCost: item.actualCost !== null ? String(item.actualCost) : '',
      paidAmount: String(item.paidAmount),
    })
  }

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="budget" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      {/* Summary cards */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/60 px-4 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Estimated"
            value={summary ? formatCurrency(summary.totalEstimated, summary.currency) : '—'}
            icon={<Wallet className="size-3.5" />}
            tint="text-gold"
          />
          <SummaryCard
            label="Actual"
            value={summary ? formatCurrency(summary.totalActual, summary.currency) : '—'}
            icon={<TrendingUp className="size-3.5" />}
            tint={
              summary && summary.totalActual > summary.totalEstimated
                ? 'text-clay-light'
                : 'text-sage-light'
            }
          />
          <SummaryCard
            label="Paid"
            value={summary ? formatCurrency(summary.totalPaid, summary.currency) : '—'}
            icon={<CheckCircle2 className="size-3.5" />}
            tint="text-sage-light"
          />
          <SummaryCard
            label="Outstanding"
            value={summary ? formatCurrency(summary.totalOutstanding, summary.currency) : '—'}
            icon={<AlertCircle className="size-3.5" />}
            tint="text-clay-light"
          />
        </div>
        {summary && (
          <div className="mt-4">
            <div className="flex items-center justify-between font-sans text-[10px] uppercase tracking-wider text-champagne/40">
              <span>Payment progress</span>
              <span className="text-gold">{summary.percentPaid}% paid</span>
            </div>
            <Progress
              value={summary.percentPaid}
              className="mt-1 h-1.5 bg-champagne/10 [&>div]:bg-gradient-to-r [&>div]:from-sage [&>div]:to-sage-light"
            />
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="shrink-0 border-b border-gold/15 px-4 py-3 sm:px-6">
          <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
            By Category
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byCategory.map((c) => {
              const pct = c.estimated > 0 ? Math.round((c.paid / c.estimated) * 100) : 0
              return (
                <div key={c.category} className="rounded-md border border-gold/15 bg-espresso/40 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-xs text-champagne">{categoryLabel(c.category)}</span>
                    <span className="font-sans text-[10px] text-gold-muted">
                      {formatCurrency(c.paid, summary?.currency)} / {formatCurrency(c.estimated, summary?.currency)}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="mt-1 h-1 bg-champagne/10 [&>div]:bg-gold"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gold/15 px-4 py-3 sm:px-6">
        <p className="font-sans text-xs text-champagne/60">
          {items.length} budget {items.length === 1 ? 'item' : 'items'}
        </p>
        <Button size="sm" onClick={() => setShowAdd((s) => !s)} className="bg-gold text-espresso hover:bg-gold-light">
          <Plus className="size-3.5" /> Add Budget Item
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6 sm:px-6">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Category</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    {BUDGET_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="focus:bg-gold/10 focus:text-gold">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <Label htmlFor="budget-desc" className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Description
                </Label>
                <Input
                  id="budget-desc"
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Three-tier wedding cake"
                  className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="budget-est" className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Estimated $
                </Label>
                <Input
                  id="budget-est"
                  type="number"
                  min="0"
                  value={newItem.estimatedCost}
                  onChange={(e) => setNewItem((p) => ({ ...p, estimatedCost: e.target.value }))}
                  placeholder="0"
                  className="border-gold/30 bg-espresso/60 text-champagne"
                />
              </div>
              <div>
                <Label htmlFor="budget-act" className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Actual $
                </Label>
                <Input
                  id="budget-act"
                  type="number"
                  min="0"
                  value={newItem.actualCost}
                  onChange={(e) => setNewItem((p) => ({ ...p, actualCost: e.target.value }))}
                  placeholder="—"
                  className="border-gold/30 bg-espresso/60 text-champagne"
                />
              </div>
              <div>
                <Label htmlFor="budget-paid" className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Paid $
                </Label>
                <Input
                  id="budget-paid"
                  type="number"
                  min="0"
                  value={newItem.paidAmount}
                  onChange={(e) => setNewItem((p) => ({ ...p, paidAmount: e.target.value }))}
                  placeholder="0"
                  className="border-gold/30 bg-espresso/60 text-champagne"
                />
              </div>
              <div className="flex items-end justify-end gap-2 sm:col-span-3 lg:col-span-6">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-champagne/60">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-gold text-espresso hover:bg-gold-light">
                  <Plus className="size-3.5" /> Add item
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget table */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="p-3 sm:p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <DollarSign className="size-8 text-gold/40" />
              <p className="font-sans text-sm text-champagne/50">No budget items yet.</p>
              <p className="font-sans text-xs text-champagne/40">Add an item to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gold/15">
              <Table>
                <TableHeader>
                  <TableRow className="border-gold/15 hover:bg-transparent">
                    <TableHead className="text-gold-muted">Category</TableHead>
                    <TableHead className="text-gold-muted">Description</TableHead>
                    <TableHead className="text-right text-gold-muted">Estimated</TableHead>
                    <TableHead className="text-right text-gold-muted">Actual</TableHead>
                    <TableHead className="text-right text-gold-muted">Paid</TableHead>
                    <TableHead className="text-right text-gold-muted">Outstanding</TableHead>
                    <TableHead className="text-gold-muted">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const actual = item.actualCost ?? item.estimatedCost
                    const outstanding = Math.max(0, actual - item.paidAmount)
                    const isOver = item.actualCost !== null && item.actualCost > item.estimatedCost
                    const isPaid = item.paidAmount >= actual && actual > 0
                    const isEditing = editingId === item.id
                    return (
                      <TableRow key={item.id} className="border-gold/10 hover:bg-gold/5">
                        <TableCell>
                          <Badge variant="outline" className="border-gold/30 bg-gold/5 text-[9px] text-gold">
                            {categoryLabel(item.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-sans text-sm text-champagne">{item.description}</TableCell>
                        <TableCell className="text-right font-sans text-sm text-champagne/80">
                          {formatCurrency(item.estimatedCost, item.currency)}
                        </TableCell>
                        <TableCell className="text-right font-sans text-sm">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              value={editValues.actualCost}
                              onChange={(e) => setEditValues((p) => ({ ...p, actualCost: e.target.value }))}
                              className="h-7 w-20 border-gold/30 bg-espresso/60 text-right text-champagne"
                            />
                          ) : (
                            <span className={isOver ? 'text-clay-light' : 'text-champagne/80'}>
                              {item.actualCost !== null ? formatCurrency(item.actualCost, item.currency) : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-sans text-sm">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              value={editValues.paidAmount}
                              onChange={(e) => setEditValues((p) => ({ ...p, paidAmount: e.target.value }))}
                              className="h-7 w-20 border-gold/30 bg-espresso/60 text-right text-champagne"
                            />
                          ) : (
                            <span className="text-sage-light">{formatCurrency(item.paidAmount, item.currency)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-sans text-sm text-clay-light">
                          {formatCurrency(outstanding, item.currency)}
                        </TableCell>
                        <TableCell>
                          {isPaid ? (
                            <Badge variant="outline" className="border-sage/40 bg-sage/15 text-[9px] text-sage-light">
                              <CheckCircle2 className="mr-1 size-2.5" /> Paid
                            </Badge>
                          ) : isOver ? (
                            <Badge variant="outline" className="border-clay/40 bg-clay/15 text-[9px] text-clay-light">
                              <AlertCircle className="mr-1 size-2.5" /> Over
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-gold/30 bg-gold/10 text-[9px] text-gold">
                              <Clock className="mr-1 size-2.5" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="size-7 text-sage-light hover:bg-sage/10" onClick={() => handleEdit(item)} aria-label="Save">
                                <CheckCircle2 className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7 text-champagne/60 hover:bg-champagne/10" onClick={() => setEditingId(null)} aria-label="Cancel edit">
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-60 transition-opacity hover:opacity-100">
                              <Button size="icon" variant="ghost" className="size-7 text-gold hover:bg-gold/10" onClick={() => startEdit(item)} aria-label="Edit">
                                <Edit className="size-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7 text-champagne/50 hover:bg-clay/10 hover:text-clay-light" onClick={() => handleDelete(item)} aria-label="Delete">
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tint: string
}) {
  return (
    <div className="rounded-lg border border-gold/15 bg-espresso/40 p-3">
      <div className="flex items-center gap-1.5">
        <span className={tint}>{icon}</span>
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-champagne/40">{label}</p>
      </div>
      <p className={`mt-1 wewed-heading text-xl ${tint}`}>{value}</p>
    </div>
  )
}

// ─── Tab 3: Vendors ─────────────────────────────────────────────────────────

function VendorsTab({
  vendors,
  plannerVendors,
  setPlannerVendors,
  onRefresh,
}: {
  vendors: PublicVendor[]
  plannerVendors: PlannerVendorRow[]
  setPlannerVendors: React.Dispatch<React.SetStateAction<PlannerVendorRow[]>>
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'photographer',
    contact: '',
    contractStatus: 'pending',
    paymentStatus: 'unpaid',
    rating: '4',
    notes: '',
  })

  // Create via /api/planner/vendors — optimistic insert on success.
  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newVendor.name.trim()) return
      setSaving(true)
      try {
        const res = await fetch('/api/planner/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newVendor.name.trim(),
            category: newVendor.category,
            contact: newVendor.contact.trim(),
            contractStatus: newVendor.contractStatus,
            paymentStatus: newVendor.paymentStatus,
            rating: Number(newVendor.rating) || 4,
            notes: newVendor.notes.trim(),
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: PlannerVendorRow }
        setPlannerVendors((prev) => [json.data, ...prev])
        toast({ title: 'Vendor added', description: newVendor.name.trim() })
        setNewVendor({ name: '', category: 'photographer', contact: '', contractStatus: 'pending', paymentStatus: 'unpaid', rating: '4', notes: '' })
        setShowAdd(false)
      } catch {
        toast({ title: 'Could not add vendor', variant: 'destructive' })
      } finally {
        setSaving(false)
      }
    },
    [newVendor, setPlannerVendors, toast]
  )

  // Delete via /api/planner/vendors/{id} — optimistic remove with revert.
  const handleDelete = useCallback(
    async (vendor: PlannerVendorRow) => {
      const prev = plannerVendors
      setPlannerVendors((p) => p.filter((v) => v.id !== vendor.id))
      try {
        const res = await fetch(`/api/planner/vendors/${vendor.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Vendor removed', description: vendor.name })
      } catch {
        setPlannerVendors(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [plannerVendors, setPlannerVendors, toast]
  )

  const totalVendors = vendors.length + plannerVendors.length

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="vendors" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      <div className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/60 px-4 py-3 sm:px-6">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
            Vendor contacts
          </p>
          <p className="wewed-heading text-base text-champagne">
            {totalVendors} vendor{totalVendors === 1 ? '' : 's'} on file
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#vendors"
            onClick={(e) => {
              e.preventDefault()
              if (typeof document !== 'undefined') {
                document.querySelector('#vendors')?.scrollIntoView({ behavior: 'smooth' })
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 font-sans text-xs text-gold transition-colors hover:bg-gold/10"
          >
            <Store className="size-3" /> Marketplace
            <ArrowRight className="size-3" />
          </a>
          <Button size="sm" onClick={() => setShowAdd((s) => !s)} className="bg-gold text-espresso hover:bg-gold-light">
            <Plus className="size-3.5" /> Add Vendor
          </Button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
              <div>
                <Label htmlFor="vendor-name" className="text-[10px] uppercase tracking-wider text-gold-muted">Name</Label>
                <Input id="vendor-name" value={newVendor.name} onChange={(e) => setNewVendor((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Aunt Tendai Catering" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" autoFocus />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Category</Label>
                <Select value={newVendor.category} onValueChange={(v) => setNewVendor((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    {['venue', 'caterer', 'photographer', 'videographer', 'florist', 'dj', 'decor', 'transport', 'stationery', 'other'].map((c) => (
                      <SelectItem key={c} value={c} className="capitalize focus:bg-gold/10 focus:text-gold">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vendor-contact" className="text-[10px] uppercase tracking-wider text-gold-muted">Contact (phone/email)</Label>
                <Input id="vendor-contact" value={newVendor.contact} onChange={(e) => setNewVendor((p) => ({ ...p, contact: e.target.value }))} placeholder="+263 77 123 4567" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Rating</Label>
                <Select value={newVendor.rating} onValueChange={(v) => setNewVendor((p) => ({ ...p, rating: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    {[5, 4, 3, 2, 1].map((r) => (
                      <SelectItem key={r} value={String(r)} className="focus:bg-gold/10 focus:text-gold">{`${r} star${r === 1 ? '' : 's'}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Contract</Label>
                <Select value={newVendor.contractStatus} onValueChange={(v) => setNewVendor((p) => ({ ...p, contractStatus: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="signed" className="focus:bg-sage/10 focus:text-sage-light">Signed</SelectItem>
                    <SelectItem value="pending" className="focus:bg-gold/10 focus:text-gold">Pending</SelectItem>
                    <SelectItem value="negotiating" className="focus:bg-clay/10 focus:text-clay-light">Negotiating</SelectItem>
                    <SelectItem value="declined" className="focus:bg-plum/10 focus:text-plum-light">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Payment</Label>
                <Select value={newVendor.paymentStatus} onValueChange={(v) => setNewVendor((p) => ({ ...p, paymentStatus: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="paid" className="focus:bg-sage/10 focus:text-sage-light">Paid in full</SelectItem>
                    <SelectItem value="deposit" className="focus:bg-gold/10 focus:text-gold">Deposit paid</SelectItem>
                    <SelectItem value="unpaid" className="focus:bg-clay/10 focus:text-clay-light">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="vendor-notes" className="text-[10px] uppercase tracking-wider text-gold-muted">Notes</Label>
                <Input id="vendor-notes" value={newVendor.notes} onChange={(e) => setNewVendor((p) => ({ ...p, notes: e.target.value }))} placeholder="Anything to remember…" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div className="flex items-end justify-end gap-2 lg:col-span-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-champagne/60">Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-50">
                  <Plus className="size-3.5" /> {saving ? 'Saving…' : 'Save vendor'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vendor grid */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="space-y-4 p-3 sm:p-4">
          {totalVendors === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Store className="size-8 text-gold/40" />
              <p className="font-sans text-sm text-champagne/50">No vendors yet.</p>
              <p className="font-sans text-xs text-champagne/40">Add one to start tracking.</p>
            </div>
          ) : (
            <>
              {plannerVendors.length > 0 && (
                <div>
                  <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">Your contacts</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {plannerVendors.map((v) => (
                      <VendorCardLocal key={v.id} vendor={v} onDelete={() => handleDelete(v)} />
                    ))}
                  </div>
                </div>
              )}
              {vendors.length > 0 && (
                <div>
                  <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">Marketplace vendors</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vendors.map((v) => (
                      <VendorCardPublic key={v.id} vendor={v} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function VendorCardLocal({ vendor, onDelete }: { vendor: PlannerVendorRow; onDelete: () => void }) {
  const contractColor =
    vendor.contractStatus === 'signed'
      ? 'border-sage/40 bg-sage/15 text-sage-light'
      : vendor.contractStatus === 'pending'
      ? 'border-gold/40 bg-gold/15 text-gold'
      : vendor.contractStatus === 'negotiating'
      ? 'border-clay/40 bg-clay/15 text-clay-light'
      : 'border-plum/40 bg-plum/15 text-plum-light'

  const paymentColor =
    vendor.paymentStatus === 'paid'
      ? 'border-sage/40 bg-sage/15 text-sage-light'
      : vendor.paymentStatus === 'deposit'
      ? 'border-gold/40 bg-gold/15 text-gold'
      : 'border-clay/40 bg-clay/15 text-clay-light'

  // Rating — prefer the planning-meta rating, fall back to the
  // top-level Prisma `rating` field, then 0.
  const rating = vendor.metaRating ?? vendor.rating ?? 0

  return (
    <Card className="group relative border-gold/20 bg-espresso/40 p-4">
      <button onClick={onDelete} aria-label="Remove vendor" className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <Trash2 className="size-3.5 text-champagne/40 hover:text-clay-light" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Store className="size-4 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="wewed-heading text-base text-champagne">{vendor.name}</p>
          <p className="font-sans text-[10px] uppercase tracking-wider text-gold-muted">{vendor.category}</p>
          {vendor.contact && (
            <p className="mt-1 font-sans text-xs text-champagne/60">{vendor.contact}</p>
          )}
          {vendor.notes && (
            <p className="mt-1 font-sans text-xs italic text-champagne/50">"{vendor.notes}"</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`text-[9px] ${contractColor}`}>Contract: {vendor.contractStatus}</Badge>
            <Badge variant="outline" className={`text-[9px] ${paymentColor}`}>Payment: {vendor.paymentStatus}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-3 ${i < rating ? 'fill-gold text-gold' : 'text-champagne/20'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function VendorCardPublic({ vendor }: { vendor: PublicVendor }) {
  return (
    <Card className="border-gold/20 bg-espresso/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Store className="size-4 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="wewed-heading text-base text-champagne">{vendor.name}</p>
            {vendor.featured && (
              <Badge variant="outline" className="border-gold/40 bg-gold/10 text-[9px] text-gold">
                <Sparkles className="mr-1 size-2.5" /> Featured
              </Badge>
            )}
          </div>
          <p className="font-sans text-[10px] uppercase tracking-wider text-gold-muted">{vendor.category}</p>
          {vendor.description && (
            <p className="mt-1 font-sans text-xs text-champagne/60 line-clamp-2">{vendor.description}</p>
          )}
          {vendor.website && (
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-light"
            >
              Visit website <ArrowRight className="size-2.5" />
            </a>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Tab 4: Guest List ──────────────────────────────────────────────────────

function GuestsTab({
  guests,
  tables,
  setGuests,
  stats,
  onRefresh,
}: {
  guests: GuestRow[]
  tables: SeatingTable[]
  setGuests: React.Dispatch<React.SetStateAction<GuestRow[]>>
  stats: {
    total: number
    confirmed: number
    declined: number
    pending: number
    plusOnes: number
    kidsTotal: number
    checkedIn: number
    heads: number
  }
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'guest',
    side: 'neutral',
    seatingTableId: '',
  })

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      if (sideFilter !== 'all' && g.side !== sideFilter) return false
      const attending = g.rsvp?.attending
      if (statusFilter === 'confirmed' && attending !== true) return false
      if (statusFilter === 'declined' && attending !== false) return false
      if (statusFilter === 'pending' && attending !== null && attending !== undefined) return false
      if (statusFilter === 'pending' && g.rsvp && attending !== null) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        if (!g.name.toLowerCase().includes(q) && !(g.email?.toLowerCase().includes(q) ?? false)) return false
      }
      return true
    })
  }, [guests, sideFilter, statusFilter, search])

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newGuest.name.trim()) return
      try {
        const res = await fetch('/api/planner/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newGuest.name.trim(),
            email: newGuest.email.trim() || null,
            phone: newGuest.phone.trim() || null,
            role: newGuest.role,
            side: newGuest.side,
            seatingTableId: newGuest.seatingTableId || null,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: GuestRow }
        setGuests((prev) => [...prev, json.data])
        toast({ title: 'Guest added', description: newGuest.name })
        setNewGuest({ name: '', email: '', phone: '', role: 'guest', side: 'neutral', seatingTableId: '' })
        setShowAdd(false)
      } catch {
        toast({ title: 'Could not add guest', variant: 'destructive' })
      }
    },
    [newGuest, setGuests, toast]
  )

  const handleDelete = useCallback(
    async (guest: GuestRow) => {
      const prev = guests
      setGuests((p) => p.filter((g) => g.id !== guest.id))
      try {
        const res = await fetch(`/api/planner/guests/${guest.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Guest removed', description: guest.name })
      } catch {
        setGuests(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [guests, setGuests, toast]
  )

  const handleAssignTable = useCallback(
    async (guest: GuestRow, tableId: string | null) => {
      // Optimistic
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id
            ? { ...g, seatingTableId: tableId, seatingTableName: tables.find((t) => t.id === tableId)?.name ?? null }
            : g
        )
      )
      try {
        const url = `/api/planner/guests/${guest.id}`
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seatingTableId: tableId }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        // Revert
        setGuests((prev) => prev.map((g) => (g.id === guest.id ? guest : g)))
        toast({ title: 'Update failed', variant: 'destructive' })
      }
    },
    [tables, setGuests, toast]
  )

  const exportCsv = useCallback(() => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Side', 'Role', 'RSVP', 'Meal', 'Plus-one', 'Plus-one name', 'Kids', 'Table', 'Checked-in'],
      ...guests.map((g) => [
        g.name,
        g.email ?? '',
        g.phone ?? '',
        g.side ?? '',
        g.role ?? '',
        g.rsvp?.attending === true ? 'confirmed' : g.rsvp?.attending === false ? 'declined' : 'pending',
        g.rsvp?.mealChoice ?? '',
        g.rsvp?.plusOne ? 'yes' : 'no',
        g.rsvp?.plusOneName ?? '',
        g.rsvp?.kidsAttending ? String(g.rsvp.kidsCount) : '0',
        g.seatingTableName ?? '',
        g.rsvp?.checkedIn ? 'yes' : 'no',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wewed-guest-list-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'CSV exported', description: `${guests.length} guests` })
  }, [guests, toast])

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="guests" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      {/* Stats */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/60 px-4 py-4 sm:px-6">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          <StatPill label="Invited" value={stats.total} tint="text-champagne" />
          <StatPill label="Confirmed" value={stats.confirmed} tint="text-sage-light" />
          <StatPill label="Declined" value={stats.declined} tint="text-clay-light" />
          <StatPill label="Pending" value={stats.pending} tint="text-gold" />
          <StatPill label="Plus-ones" value={stats.plusOnes} tint="text-gold" />
          <StatPill label="Kids" value={stats.kidsTotal} tint="text-gold" />
          <StatPill label="Heads" value={stats.heads} tint="text-champagne" />
          <StatPill label="Checked-in" value={stats.checkedIn} tint="text-sage-light" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gold/15 px-4 py-3 sm:px-6">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gold/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="border-gold/30 bg-espresso/60 pl-9 text-champagne placeholder:text-champagne/30"
          />
        </div>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger size="sm" className="w-[120px] border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
          <SelectContent className="border-gold/30 bg-espresso text-champagne">
            <SelectItem value="all" className="focus:bg-gold/10">All sides</SelectItem>
            <SelectItem value="bride" className="focus:bg-gold/10">Charity's side</SelectItem>
            <SelectItem value="groom" className="focus:bg-gold/10">Kudzie's side</SelectItem>
            <SelectItem value="family" className="focus:bg-gold/10">Family</SelectItem>
            <SelectItem value="neutral" className="focus:bg-gold/10">Both</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[120px] border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
          <SelectContent className="border-gold/30 bg-espresso text-champagne">
            <SelectItem value="all" className="focus:bg-gold/10">All statuses</SelectItem>
            <SelectItem value="confirmed" className="focus:bg-gold/10">Confirmed</SelectItem>
            <SelectItem value="declined" className="focus:bg-gold/10">Declined</SelectItem>
            <SelectItem value="pending" className="focus:bg-gold/10">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportCsv} className="border-gold/30 bg-transparent text-gold hover:bg-gold/10">
          <Download className="size-3.5" /> Export
        </Button>
        <Button size="sm" onClick={() => setShowAdd((s) => !s)} className="bg-gold text-espresso hover:bg-gold-light">
          <Plus className="size-3.5" /> Add Guest
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
              <div>
                <Label htmlFor="guest-name" className="text-[10px] uppercase tracking-wider text-gold-muted">Name</Label>
                <Input id="guest-name" value={newGuest.name} onChange={(e) => setNewGuest((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" autoFocus />
              </div>
              <div>
                <Label htmlFor="guest-email" className="text-[10px] uppercase tracking-wider text-gold-muted">Email</Label>
                <Input id="guest-email" type="email" value={newGuest.email} onChange={(e) => setNewGuest((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div>
                <Label htmlFor="guest-phone" className="text-[10px] uppercase tracking-wider text-gold-muted">Phone</Label>
                <Input id="guest-phone" value={newGuest.phone} onChange={(e) => setNewGuest((p) => ({ ...p, phone: e.target.value }))} placeholder="+263 77 …" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Side</Label>
                <Select value={newGuest.side} onValueChange={(v) => setNewGuest((p) => ({ ...p, side: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="bride" className="focus:bg-gold/10 focus:text-gold">Charity's side</SelectItem>
                    <SelectItem value="groom" className="focus:bg-gold/10 focus:text-gold">Kudzie's side</SelectItem>
                    <SelectItem value="family" className="focus:bg-gold/10 focus:text-gold">Family</SelectItem>
                    <SelectItem value="neutral" className="focus:bg-gold/10 focus:text-gold">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Role</Label>
                <Select value={newGuest.role} onValueChange={(v) => setNewGuest((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="guest" className="focus:bg-gold/10 focus:text-gold">Guest</SelectItem>
                    <SelectItem value="bridal_party" className="focus:bg-gold/10 focus:text-gold">Bridal party</SelectItem>
                    <SelectItem value="family" className="focus:bg-gold/10 focus:text-gold">Family</SelectItem>
                    <SelectItem value="officiant" className="focus:bg-gold/10 focus:text-gold">Officiant</SelectItem>
                    <SelectItem value="vip" className="focus:bg-gold/10 focus:text-gold">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-gold-muted">Table</Label>
                <Select value={newGuest.seatingTableId} onValueChange={(v) => setNewGuest((p) => ({ ...p, seatingTableId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="w-full border-gold/30 bg-espresso/60 text-champagne"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent className="border-gold/30 bg-espresso text-champagne">
                    <SelectItem value="__none__" className="focus:bg-gold/10">Unassigned</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="focus:bg-gold/10 focus:text-gold">{t.name} (cap {t.capacity})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end gap-2 lg:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-champagne/60">Cancel</Button>
                <Button type="submit" size="sm" className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-3.5" /> Add guest</Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guests table */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="p-3 sm:p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Users className="size-8 text-gold/40" />
              <p className="font-sans text-sm text-champagne/50">No guests in this view.</p>
              <p className="font-sans text-xs text-champagne/40">Try clearing filters or adding a guest.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gold/15">
              <Table>
                <TableHeader>
                  <TableRow className="border-gold/15 hover:bg-transparent">
                    <TableHead className="text-gold-muted">Guest</TableHead>
                    <TableHead className="text-gold-muted">Side</TableHead>
                    <TableHead className="text-gold-muted">RSVP</TableHead>
                    <TableHead className="text-gold-muted">Meal</TableHead>
                    <TableHead className="text-center text-gold-muted">+1</TableHead>
                    <TableHead className="text-gold-muted">Table</TableHead>
                    <TableHead className="text-center text-gold-muted">In</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => {
                    const attending = g.rsvp?.attending
                    const rsvpBadge =
                      attending === true
                        ? 'border-sage/40 bg-sage/15 text-sage-light'
                        : attending === false
                        ? 'border-clay/40 bg-clay/15 text-clay-light'
                        : 'border-gold/30 bg-gold/10 text-gold'
                    const rsvpLabel = attending === true ? 'Confirmed' : attending === false ? 'Declined' : 'Pending'
                    return (
                      <TableRow key={g.id} className="border-gold/10 hover:bg-gold/5">
                        <TableCell>
                          <p className="font-sans text-sm text-champagne">{g.name}</p>
                          {g.email && (
                            <p className="flex items-center gap-1 font-sans text-[10px] text-champagne/40">
                              <Mail className="size-2.5" /> {g.email}
                            </p>
                          )}
                          {g.phone && (
                            <p className="flex items-center gap-1 font-sans text-[10px] text-champagne/40">
                              <Phone className="size-2.5" /> {g.phone}
                            </p>
                          )}
                          {g.roleDetail && (
                            <p className="font-sans text-[10px] text-gold-muted">{g.roleDetail}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-sans text-xs text-champagne/70">{sideLabel(g.side)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[9px] ${rsvpBadge}`}>{rsvpLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-sans text-xs text-champagne/70">
                            {g.rsvp?.mealChoice ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {g.rsvp?.plusOne ? (
                            <Badge variant="outline" className="border-gold/30 bg-gold/5 text-[9px] text-gold">
                              {g.rsvp.plusOneName ? g.rsvp.plusOneName.slice(0, 8) : 'Yes'}
                            </Badge>
                          ) : (
                            <span className="font-sans text-xs text-champagne/30">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={g.seatingTableId ?? '__none__'}
                            onValueChange={(v) => handleAssignTable(g, v === '__none__' ? null : v)}
                          >
                            <SelectTrigger size="sm" className="h-7 w-[120px] border-gold/30 bg-espresso/60 text-xs text-champagne">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent className="border-gold/30 bg-espresso text-champagne">
                              <SelectItem value="__none__" className="focus:bg-gold/10">Unassigned</SelectItem>
                              {tables.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="focus:bg-gold/10 focus:text-gold">{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {g.rsvp?.checkedIn ? (
                            <CheckCircle2 className="mx-auto size-4 text-sage-light" />
                          ) : (
                            <Circle className="mx-auto size-4 text-champagne/20" />
                          )}
                        </TableCell>
                        <TableCell>
                          <button onClick={() => handleDelete(g)} aria-label="Remove guest" className="opacity-60 transition-opacity hover:opacity-100">
                            <Trash2 className="size-3 text-champagne/40 hover:text-clay-light" />
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function StatPill({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="rounded-md border border-gold/15 bg-espresso/40 p-2 text-center">
      <p className={`wewed-heading text-lg ${tint}`}>{value}</p>
      <p className="font-sans text-[9px] uppercase tracking-wider text-champagne/40">{label}</p>
    </div>
  )
}

// ─── Tab 5: Timeline ────────────────────────────────────────────────────────

function TimelineTab({
  blocks,
  setBlocks,
  onRefresh,
}: {
  blocks: TimelineRow[]
  setBlocks: React.Dispatch<React.SetStateAction<TimelineRow[]>>
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ time: '', event: '', duration: '', location: '', notes: '' })

  const startAdd = () => {
    setEditingId(null)
    setForm({ time: '', event: '', duration: '', location: '', notes: '' })
    setShowAdd(true)
  }

  const startEdit = (b: TimelineRow) => {
    setEditingId(b.id)
    setForm({ time: b.time, event: b.event, duration: b.duration, location: b.location, notes: b.notes })
    setShowAdd(true)
  }

  // Create (POST) or update (PATCH) a timeline block.
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.event.trim() || !form.time.trim()) {
        toast({ title: 'Time and event are required', variant: 'destructive' })
        return
      }
      setSaving(true)
      try {
        if (editingId) {
          // Update existing
          const res = await fetch(`/api/planner/timeline/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: form.time.trim(),
              event: form.event.trim(),
              duration: form.duration.trim(),
              location: form.location.trim(),
              notes: form.notes.trim(),
            }),
          })
          if (!res.ok) throw new Error('Failed')
          const json = (await res.json()) as { data: TimelineRow }
          setBlocks((prev) => prev.map((b) => (b.id === editingId ? json.data : b)))
          toast({ title: 'Block updated', description: form.event })
        } else {
          // Create new (appends to end)
          const res = await fetch('/api/planner/timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: form.time.trim(),
              event: form.event.trim(),
              duration: form.duration.trim(),
              location: form.location.trim(),
              notes: form.notes.trim(),
            }),
          })
          if (!res.ok) throw new Error('Failed')
          const json = (await res.json()) as { data: TimelineRow }
          setBlocks((prev) => [...prev, json.data])
          toast({ title: 'Block added', description: form.event })
        }
        setShowAdd(false)
        setEditingId(null)
        setForm({ time: '', event: '', duration: '', location: '', notes: '' })
      } catch {
        toast({ title: 'Could not save block', variant: 'destructive' })
      } finally {
        setSaving(false)
      }
    },
    [editingId, form, setBlocks, toast]
  )

  // Delete via /api/planner/timeline/{id} — optimistic with revert.
  const handleDelete = useCallback(
    async (id: string) => {
      const prev = blocks
      setBlocks((p) => p.filter((b) => b.id !== id))
      try {
        const res = await fetch(`/api/planner/timeline/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Block removed' })
      } catch {
        setBlocks(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [blocks, setBlocks, toast]
  )

  // Reorder: swap with neighbour then PATCH both items' `order`.
  const move = useCallback(
    async (id: string, dir: -1 | 1) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx < 0) return
      const swapWith = idx + dir
      if (swapWith < 0 || swapWith >= blocks.length) return

      // Optimistic swap
      const next = [...blocks]
      const tmp = next[idx]
      next[idx] = next[swapWith]
      next[swapWith] = tmp
      // Reassign sequential order values so server state matches.
      const reordered = next.map((b, i) => ({ ...b, order: i + 1 }))
      setBlocks(reordered)

      // Persist the two changed items' order in the background
      try {
        await Promise.all([
          fetch(`/api/planner/timeline/${reordered[idx].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: reordered[idx].order }),
          }),
          fetch(`/api/planner/timeline/${reordered[swapWith].id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: reordered[swapWith].order }),
          }),
        ])
      } catch {
        /* revert handled by next polling refresh */
      }
    },
    [blocks, setBlocks]
  )

  const handlePrint = () => {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) {
      toast({ title: 'Pop-up blocked', variant: 'destructive' })
      return
    }
    const html = `<!doctype html><html><head><title>Wedding Day Timeline — Charity & Kudzie</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #1A1410; background: #FBF6EE; }
        h1 { font-weight: 400; letter-spacing: 0.04em; }
        .row { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #E5DDD0; }
        .time { font-weight: 600; color: #BF9B5F; min-width: 80px; }
        .event { font-weight: 600; min-width: 220px; }
        .meta { color: #6B6560; font-size: 13px; }
        .monogram { letter-spacing: 0.15em; color: #BF9B5F; text-align: center; font-size: 12px; }
      </style></head><body>
      <p class="monogram">C&K · 23.12.26 · IMBA MANOR</p>
      <h1>Wedding Day Timeline</h1>
      <p style="color:#6B6560; font-size:13px;">Charity & Kudzie (Mr & Mrs Musarurwa) · December 23, 2026</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #BF9B5F;" />
      ${blocks.map((b) => `
        <div class="row">
          <div class="time">${b.time}</div>
          <div>
            <div class="event">${b.event}${b.duration ? ` <span class="meta">(${b.duration})</span>` : ''}</div>
            ${b.location ? `<div class="meta">📍 ${b.location}</div>` : ''}
            ${b.notes ? `<div class="meta" style="margin-top:4px;">${b.notes}</div>` : ''}
          </div>
        </div>
      `).join('')}
      <p style="margin-top: 40px; text-align: center; color: #BF9B5F; font-size: 11px; letter-spacing: 0.15em;">FOREVER · WEWED</p>
      </body></html>`
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="timeline" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      <div className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/60 px-4 py-3 sm:px-6">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
            Day-of itinerary
          </p>
          <p className="wewed-heading text-base text-champagne">
            {blocks.length} time block{blocks.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="border-gold/30 bg-transparent text-gold hover:bg-gold/10">
            <Printer className="size-3.5" /> Print
          </Button>
          <Button size="sm" onClick={startAdd} className="bg-gold text-espresso hover:bg-gold-light">
            <Plus className="size-3.5" /> Add Block
          </Button>
        </div>
      </div>

      {/* Add/edit form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5 sm:px-6">
              <div>
                <Label htmlFor="block-time" className="text-[10px] uppercase tracking-wider text-gold-muted">Time</Label>
                <Input id="block-time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} placeholder="14:00" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" autoFocus />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="block-event" className="text-[10px] uppercase tracking-wider text-gold-muted">Event</Label>
                <Input id="block-event" value={form.event} onChange={(e) => setForm((p) => ({ ...p, event: e.target.value }))} placeholder="e.g. First dance" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div>
                <Label htmlFor="block-duration" className="text-[10px] uppercase tracking-wider text-gold-muted">Duration</Label>
                <Input id="block-duration" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} placeholder="30 min" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div>
                <Label htmlFor="block-location" className="text-[10px] uppercase tracking-wider text-gold-muted">Location</Label>
                <Input id="block-location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="Reception hall" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div className="sm:col-span-3 lg:col-span-5">
                <Label htmlFor="block-notes" className="text-[10px] uppercase tracking-wider text-gold-muted">Notes</Label>
                <Textarea id="block-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Anything the team should know…" rows={2} className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" />
              </div>
              <div className="flex items-end justify-end gap-2 sm:col-span-3 lg:col-span-5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-champagne/60">Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add block'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline list */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="p-3 sm:p-4">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Calendar className="size-8 text-gold/40" />
              <p className="font-sans text-sm text-champagne/50">No time blocks yet.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[34px] top-2 bottom-2 w-px bg-gradient-to-b from-gold/40 via-gold/20 to-gold/40 sm:left-[42px]" />
              <div className="space-y-2">
                {blocks.map((b, i) => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group relative flex items-start gap-3 sm:gap-4"
                  >
                    {/* Time + dot */}
                    <div className="relative z-10 flex w-[60px] shrink-0 flex-col items-end sm:w-[80px]">
                      <span className="font-sans text-xs font-medium tabular-nums text-gold">{b.time}</span>
                    </div>
                    <div className="relative z-10 mt-1 flex size-3 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-espresso" />
                    {/* Card */}
                    <Card className="min-w-0 flex-1 border-gold/15 bg-espresso/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="wewed-heading text-base text-champagne">{b.event}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {b.duration && (
                              <span className="font-sans text-[10px] text-gold-muted">
                                <Clock className="mr-1 inline size-2.5" />
                                {b.duration}
                              </span>
                            )}
                            {b.location && (
                              <span className="font-sans text-[10px] text-champagne/50">
                                📍 {b.location}
                              </span>
                            )}
                          </div>
                          {b.notes && (
                            <p className="mt-1 font-sans text-xs italic text-champagne/60">"{b.notes}"</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button onClick={() => move(b.id, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-champagne/40 hover:text-gold disabled:opacity-20">
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1} aria-label="Move down" className="rounded p-1 text-champagne/40 hover:text-gold disabled:opacity-20">
                            <ChevronDown className="size-3.5" />
                          </button>
                          <button onClick={() => startEdit(b)} aria-label="Edit" className="rounded p-1 text-champagne/40 hover:text-gold">
                            <Edit className="size-3.5" />
                          </button>
                          <button onClick={() => handleDelete(b.id)} aria-label="Delete" className="rounded p-1 text-champagne/40 hover:text-clay-light">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Tab 6: Seating Chart ───────────────────────────────────────────────────

function SeatingTab({
  guests,
  tables,
  setTables,
  setGuests,
  onRefresh,
}: {
  guests: GuestRow[]
  tables: SeatingTable[]
  setTables: React.Dispatch<React.SetStateAction<SeatingTable[]>>
  setGuests: React.Dispatch<React.SetStateAction<GuestRow[]>>
  onRefresh?: () => void
}) {
  const { toast } = useToast()
  const [showAddTable, setShowAddTable] = useState(false)
  const [newTable, setNewTable] = useState({ name: '', capacity: '8' })
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState({ name: '', capacity: '8' })

  const guestsByTable = useMemo(() => {
    const map = new Map<string, GuestRow[]>()
    for (const g of guests) {
      if (!g.seatingTableId) continue
      const arr = map.get(g.seatingTableId) ?? []
      arr.push(g)
      map.set(g.seatingTableId, arr)
    }
    return map
  }, [guests])

  const unassigned = useMemo(() => guests.filter((g) => !g.seatingTableId), [guests])

  const handleAddTable = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newTable.name.trim()) return
      try {
        const res = await fetch('/api/planner/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'table',
            tableName: newTable.name.trim(),
            capacity: Number(newTable.capacity) || 8,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: SeatingTable }
        setTables((prev) => [...prev, json.data])
        toast({ title: 'Table added', description: newTable.name })
        setNewTable({ name: '', capacity: '8' })
        setShowAddTable(false)
      } catch {
        toast({ title: 'Could not add table', variant: 'destructive' })
      }
    },
    [newTable, setTables, toast]
  )

  const handleDeleteTable = useCallback(
    async (table: SeatingTable) => {
      const prev = tables
      setTables((p) => p.filter((t) => t.id !== table.id))
      // Optimistically unassign guests
      setGuests((p) => p.map((g) => (g.seatingTableId === table.id ? { ...g, seatingTableId: null, seatingTableName: null } : g)))
      try {
        const res = await fetch(`/api/planner/guests/${table.id}?kind=table`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed')
        toast({ title: 'Table removed', description: table.name })
      } catch {
        setTables(prev)
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    },
    [tables, setTables, setGuests, toast]
  )

  const handleRenameTable = useCallback(
    async (table: SeatingTable) => {
      try {
        const res = await fetch(`/api/planner/guests/${table.id}?kind=table`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editTable.name.trim(),
            capacity: Number(editTable.capacity) || table.capacity,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, name: editTable.name.trim(), capacity: Number(editTable.capacity) || table.capacity } : t)))
        // Update guest's seatingTableName cache
        setGuests((prev) => prev.map((g) => (g.seatingTableId === table.id ? { ...g, seatingTableName: editTable.name.trim() } : g)))
        toast({ title: 'Table updated', description: editTable.name })
        setEditingTableId(null)
      } catch {
        toast({ title: 'Update failed', variant: 'destructive' })
      }
    },
    [editTable, setTables, setGuests, toast]
  )

  const handleAssign = useCallback(
    async (guest: GuestRow, tableId: string | null) => {
      const tableName = tables.find((t) => t.id === tableId)?.name ?? null
      setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, seatingTableId: tableId, seatingTableName: tableName } : g)))
      try {
        const res = await fetch(`/api/planner/guests/${guest.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seatingTableId: tableId }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        // Revert
        setGuests((prev) => prev.map((g) => (g.id === guest.id ? guest : g)))
        toast({ title: 'Assignment failed', variant: 'destructive' })
      }
    },
    [tables, setGuests, toast]
  )

  const startEdit = (t: SeatingTable) => {
    setEditingTableId(t.id)
    setEditTable({ name: t.name, capacity: String(t.capacity) })
  }

  return (
    <div className="flex h-full flex-col">
      <ImportExportBar moduleKey="seating" onImportComplete={onRefresh} className="shrink-0 justify-end border-b border-gold/15 bg-espresso/40 px-4 py-2 sm:px-6" />
      <div className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/60 px-4 py-3 sm:px-6">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
            Seating chart
          </p>
          <p className="wewed-heading text-base text-champagne">
            {tables.length} table{tables.length === 1 ? '' : 's'} ·{' '}
            {unassigned.length} unassigned
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddTable((s) => !s)} className="bg-gold text-espresso hover:bg-gold-light">
          <Plus className="size-3.5" /> Add Table
        </Button>
      </div>

      {/* Add table form */}
      <AnimatePresence>
        {showAddTable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-plum/10"
          >
            <form onSubmit={handleAddTable} className="flex flex-wrap items-end gap-3 p-4 sm:px-6">
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="table-name" className="text-[10px] uppercase tracking-wider text-gold-muted">Table name</Label>
                <Input id="table-name" value={newTable.name} onChange={(e) => setNewTable((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Table 9 — Friends" className="border-gold/30 bg-espresso/60 text-champagne placeholder:text-champagne/30" autoFocus />
              </div>
              <div className="w-[100px]">
                <Label htmlFor="table-cap" className="text-[10px] uppercase tracking-wider text-gold-muted">Capacity</Label>
                <Input id="table-cap" type="number" min="1" max="50" value={newTable.capacity} onChange={(e) => setNewTable((p) => ({ ...p, capacity: e.target.value }))} className="border-gold/30 bg-espresso/60 text-champagne" />
              </div>
              <Button type="submit" size="sm" className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-3.5" /> Add</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTable(false)} className="text-champagne/60">Cancel</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="p-3 sm:p-4">
          {/* Unassigned guests */}
          {unassigned.length > 0 && (
            <div className="mb-4 rounded-lg border border-clay/30 bg-clay/5 p-3">
              <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-clay-light">
                Unassigned ({unassigned.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {unassigned.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-full border border-gold/30 bg-espresso/60 py-1 pl-3 pr-1">
                    <span className="font-sans text-xs text-champagne">{g.name}</span>
                    <Select value="" onValueChange={(v) => handleAssign(g, v)}>
                      <SelectTrigger size="sm" className="h-6 w-[110px] border-gold/30 bg-espresso/80 text-[10px] text-gold">
                        <SelectValue placeholder="Assign →" />
                      </SelectTrigger>
                      <SelectContent className="border-gold/30 bg-espresso text-champagne">
                        {tables.map((t) => {
                          const seated = guestsByTable.get(t.id)?.length ?? 0
                          const full = seated >= t.capacity
                          return (
                            <SelectItem key={t.id} value={t.id} disabled={full} className="focus:bg-gold/10 focus:text-gold">
                              {t.name} ({seated}/{t.capacity}){full ? ' — full' : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tables grid */}
          {tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <LayoutGrid className="size-8 text-gold/40" />
              <p className="font-sans text-sm text-champagne/50">No tables yet.</p>
              <p className="font-sans text-xs text-champagne/40">Add a table to start arranging seats.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tables.map((table) => {
                const seated = guestsByTable.get(table.id) ?? []
                const isFull = seated.length >= table.capacity
                const isEditing = editingTableId === table.id
                return (
                  <Card key={table.id} className={`group border-gold/20 bg-espresso/40 p-4 ${isFull ? 'border-sage/40' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <div className="flex-1 space-y-1">
                          <Input value={editTable.name} onChange={(e) => setEditTable((p) => ({ ...p, name: e.target.value }))} className="h-7 border-gold/30 bg-espresso/60 text-sm text-champagne" />
                          <Input type="number" min="1" max="50" value={editTable.capacity} onChange={(e) => setEditTable((p) => ({ ...p, capacity: e.target.value }))} className="h-7 border-gold/30 bg-espresso/60 text-xs text-champagne" />
                        </div>
                      ) : (
                        <div>
                          <p className="wewed-heading text-base text-champagne">{table.name}</p>
                          <p className="font-sans text-[10px] text-gold-muted">
                            {seated.length}/{table.capacity} seated
                          </p>
                        </div>
                      )}
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRenameTable(table)} aria-label="Save" className="rounded p-1 text-sage-light hover:bg-sage/10">
                            <CheckCircle2 className="size-3.5" />
                          </button>
                          <button onClick={() => setEditingTableId(null)} aria-label="Cancel" className="rounded p-1 text-champagne/60 hover:bg-champagne/10">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button onClick={() => startEdit(table)} aria-label="Edit table" className="rounded p-1 text-champagne/40 hover:text-gold">
                            <Edit className="size-3" />
                          </button>
                          <button onClick={() => handleDeleteTable(table)} aria-label="Delete table" className="rounded p-1 text-champagne/40 hover:text-clay-light">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <Separator className="my-3 bg-gold/15" />
                    <div className="space-y-1">
                      {seated.length === 0 ? (
                        <p className="font-sans text-xs italic text-champagne/40">No guests assigned</p>
                      ) : (
                        seated.map((g) => (
                          <div key={g.id} className="flex items-center justify-between gap-2 rounded-sm bg-espresso/60 px-2 py-1">
                            <span className="truncate font-sans text-xs text-champagne">{g.name}</span>
                            <button onClick={() => handleAssign(g, null)} aria-label={`Unassign ${g.name}`} className="shrink-0 text-champagne/30 hover:text-clay-light">
                              <X className="size-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {/* Add a guest to this table */}
                    {!isFull && (
                      <Select value="" onValueChange={(v) => {
                        const g = unassigned.find((u) => u.id === v)
                        if (g) void handleAssign(g, table.id)
                      }}>
                        <SelectTrigger size="sm" className="mt-2 h-7 w-full border-gold/30 bg-espresso/60 text-[10px] text-gold">
                          <SelectValue placeholder="+ Add guest" />
                        </SelectTrigger>
                        <SelectContent className="border-gold/30 bg-espresso text-champagne">
                          {unassigned.length === 0 ? (
                            <SelectItem value="__none__" disabled>No unassigned guests</SelectItem>
                          ) : (
                            unassigned.map((g) => (
                              <SelectItem key={g.id} value={g.id} className="focus:bg-gold/10 focus:text-gold">{g.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
