'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Calendar, MapPin, Mail, Lock, ChevronRight, ChevronLeft, Check, Sparkles, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const THEMES = [
  { id: 'gold', name: 'Gold & Champagne', primary: '#BF9B5F', accent: '#C0633F', bg: '#FBF6EE', memory: '#6B2D3A' },
  { id: 'emerald', name: 'Emerald & Ivory', primary: '#0F766E', accent: '#059669', bg: '#FAFAF9', memory: '#064E3B' },
  { id: 'navy', name: 'Navy & Blush', primary: '#1E3A8A', accent: '#DB2777', bg: '#FDF2F8', memory: '#831843' },
  { id: 'burgundy', name: 'Burgundy & Gold', primary: '#991B1B', accent: '#D97706', bg: '#FEF3C7', memory: '#7F1D1D' },
  { id: 'sage', name: 'Sage & Cream', primary: '#7C7A52', accent: '#84CC16', bg: '#FEFCE8', memory: '#365314' },
  { id: 'midnight', name: 'Midnight & Silver', primary: '#1E293B', accent: '#64748B', bg: '#F1F5F9', memory: '#0F172A' },
]

export function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ slug: string; url: string } | null>(null)
  const [data, setData] = useState({
    partner1: '',
    partner2: '',
    surname: '',
    weddingDate: '',
    venue: '',
    venueCity: '',
    venueCountry: '',
    email: '',
    password: '',
    themeId: 'gold',
  })

  const steps = ['Account', 'Couple', 'Theme', 'Review']
  const theme = THEMES.find((t) => t.id === data.themeId) || THEMES[0]

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          theme: { primaryColor: theme.primary, accentColor: theme.accent, backgroundColor: theme.bg, memoryColor: theme.memory },
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCreated({ slug: json.slug, url: json.url })
        toast.success('Your wedding website is ready!')
      } else {
        toast.error(json.error || 'Failed to create wedding')
      }
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 0) return data.email && data.password.length >= 8
    if (step === 1) return data.partner1 && data.partner2 && data.weddingDate && data.venue && data.venueCity
    if (step === 2) return true
    return true
  }

  // Success screen
  if (created) {
    return (
      <div className="min-h-screen bg-champagne flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/10">
            <Check className="h-10 w-10 text-gold" />
          </div>
          <h1 className="font-serif text-3xl font-light text-espresso mb-3">Your wedding website is ready!</h1>
          <p className="font-sans text-sm text-espresso/60 mb-6">
            {data.partner1} & {data.partner2}'s website has been created. Share this link with your guests:
          </p>
          <div className="rounded-lg border border-gold/30 bg-white/60 p-3 mb-6">
            <code className="font-mono text-sm text-gold">wewed.app{created.url}</code>
          </div>
          <Button
            onClick={() => { window.location.href = created.url }}
            className="w-full bg-gold text-espresso hover:bg-gold/90"
          >
            <Heart className="mr-2 h-4 w-4" />
            View Your Wedding Website
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-champagne flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-light text-espresso">Create Your Wedding</h1>
          <p className="mt-2 font-sans text-sm text-espresso/60">Your forever page on wewed — where love lives</p>
        </div>

        {/* Progress */}
        <div className="mb-8 flex justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all ${
                i === step ? 'border-gold bg-gold text-espresso' : i < step ? 'border-gold/40 bg-gold/10 text-gold' : 'border-espresso/20 text-espresso/30'
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`h-px w-8 ${i < step ? 'bg-gold/40' : 'bg-espresso/10'}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gold/30 bg-white/80 p-6 shadow-xl backdrop-blur-md">
          <AnimatePresence mode="wait">
            {/* Step 0: Account */}
            {step === 0 && (
              <motion.div key="account" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-serif text-xl text-espresso mb-4">Account</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-espresso/70">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-espresso/30" />
                      <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="you@email.com" className="pl-10 border-gold/30 bg-white/60" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-espresso/70">Password (min 8 chars)</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-espresso/30" />
                      <Input type="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="••••••••" className="pl-10 border-gold/30 bg-white/60" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 1: Couple Details */}
            {step === 1 && (
              <motion.div key="couple" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-serif text-xl text-espresso mb-4">Couple Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-espresso/70">Partner 1</Label>
                      <Input value={data.partner1} onChange={(e) => setData({ ...data, partner1: e.target.value })} placeholder="Sarah" className="mt-1 border-gold/30 bg-white/60" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-espresso/70">Partner 2</Label>
                      <Input value={data.partner2} onChange={(e) => setData({ ...data, partner2: e.target.value })} placeholder="David" className="mt-1 border-gold/30 bg-white/60" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-espresso/70">Surname (optional)</Label>
                    <Input value={data.surname} onChange={(e) => setData({ ...data, surname: e.target.value })} placeholder="Johnson" className="mt-1 border-gold/30 bg-white/60" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-espresso/70">Wedding Date</Label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-espresso/30" />
                      <Input type="date" value={data.weddingDate} onChange={(e) => setData({ ...data, weddingDate: e.target.value })} className="pl-10 border-gold/30 bg-white/60" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-espresso/70">Venue Name</Label>
                    <Input value={data.venue} onChange={(e) => setData({ ...data, venue: e.target.value })} placeholder="Garden Pavilion" className="mt-1 border-gold/30 bg-white/60" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-espresso/70">City</Label>
                      <Input value={data.venueCity} onChange={(e) => setData({ ...data, venueCity: e.target.value })} placeholder="Cape Town" className="mt-1 border-gold/30 bg-white/60" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-espresso/70">Country</Label>
                      <Input value={data.venueCountry} onChange={(e) => setData({ ...data, venueCountry: e.target.value })} placeholder="South Africa" className="mt-1 border-gold/30 bg-white/60" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Theme */}
            {step === 2 && (
              <motion.div key="theme" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-serif text-xl text-espresso mb-4">Choose Your Theme</h2>
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setData({ ...data, themeId: t.id })}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        data.themeId === t.id ? 'border-gold shadow-md' : 'border-espresso/10 hover:border-gold/30'
                      }`}
                    >
                      <div className="flex gap-1 mb-2">
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: t.primary }} />
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: t.accent }} />
                        <div className="h-6 w-6 rounded-full border border-espresso/10" style={{ backgroundColor: t.bg }} />
                      </div>
                      <p className="font-sans text-xs font-medium text-espresso">{t.name}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-serif text-xl text-espresso mb-4">Review & Create</h2>
                <div className="space-y-3 font-sans text-sm text-espresso/80">
                  <div className="flex justify-between"><span className="text-espresso/50">Couple:</span><span>{data.partner1} & {data.partner2}</span></div>
                  {data.surname && <div className="flex justify-between"><span className="text-espresso/50">Surname:</span><span>{data.surname}</span></div>}
                  <div className="flex justify-between"><span className="text-espresso/50">Date:</span><span>{data.weddingDate}</span></div>
                  <div className="flex justify-between"><span className="text-espresso/50">Venue:</span><span>{data.venue}, {data.venueCity}</span></div>
                  <div className="flex justify-between"><span className="text-espresso/50">Theme:</span><span>{theme.name}</span></div>
                  <div className="flex justify-between"><span className="text-espresso/50">Email:</span><span>{data.email}</span></div>
                </div>
                <div className="mt-4 rounded-lg border border-gold/20 bg-gold/5 p-3">
                  <p className="font-sans text-xs text-espresso/60">
                    <Sparkles className="inline h-3 w-3 mr-1 text-gold" />
                    We'll create your website with 80+ checklist tasks, budget tracker, timeline, seating chart, and a songbook — all pre-filled and ready to customize.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="text-espresso/60">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : <div />}

            {step < 3 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="bg-gold text-espresso hover:bg-gold/90 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={loading}
                className="bg-gold text-espresso hover:bg-gold/90"
              >
                {loading ? 'Creating...' : 'Create My Wedding'} <Heart className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Back to site */}
        <div className="mt-4 text-center">
          <button onClick={() => { window.location.href = '/' }} className="font-sans text-xs text-espresso/40 hover:text-espresso/60">
            ← Back to Charity & Kudzie's site
          </button>
        </div>
      </div>
    </div>
  )
}
