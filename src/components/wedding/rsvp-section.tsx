'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Check, Sparkles, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useWewedStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { SectionInfo } from '@/components/wedding/section-info'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'

/* ── Zod Schema ── */
const rsvpSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email address'),
  attendance: z.enum(['accept', 'decline']),
  mealPreference: z.string().optional(),
  dietaryRequirements: z.string().optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().optional(),
  plusOneMeal: z.string().optional(),
  childrenAttending: z.boolean().optional(),
  numberOfChildren: z.string().optional(),
  songRequest: z.string().optional(),
  messageToCouple: z.string().optional(),
})

type RsvpFormValues = z.infer<typeof rsvpSchema>

/* ── Gold Sparkles Animation ── */
function GoldSparkles() {
  const sparkles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 0.8,
    size: Math.random() * 6 + 3,
  }))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-gold"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            y: [0, -40, -80],
          }}
          transition={{
            duration: 1.5,
            delay: s.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

/* ── Field Animation Variants ── */
import type { Variants } from 'framer-motion'
const EASE_RSVP = [0.25, 0.46, 0.45, 0.94] as const
const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.5,
      ease: EASE_RSVP,
    },
  }),
}

/* ── Main Component ── */
export function RsvpSection() {
  const { rsvpSubmitted, setRsvpSubmitted } = useWewedStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)

  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      mealPreference: '',
      dietaryRequirements: '',
      plusOne: false,
      plusOneName: '',
      plusOneMeal: '',
      childrenAttending: false,
      numberOfChildren: '',
      songRequest: '',
      messageToCouple: '',
    },
  })

  const plusOneEnabled = form.watch('plusOne')
  const childrenEnabled = form.watch('childrenAttending')
  const attendance = form.watch('attendance')

  const onSubmit = useCallback(
    async (data: RsvpFormValues) => {
      setIsSubmitting(true)
      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Submission failed')
        setRsvpSubmitted(true)
        setShowSparkles(true)
        toast.success('Your RSVP has been received!', {
          description: 'We can\'t wait to celebrate with you!',
        })
        setTimeout(() => setShowSparkles(false), 3000)
      } catch {
        toast.error('Something went wrong', {
          description: 'Please try again or contact us directly.',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [setRsvpSubmitted]
  )

  /* ── Success State ── */
  if (rsvpSubmitted) {
    return (
      <section id="rsvp" className="wewed-section py-20 md:py-32">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            {showSparkles && <GoldSparkles />}
            <Card className="border-gold/30 bg-champagne relative overflow-hidden">
              <CardContent className="flex flex-col items-center gap-6 py-12">
                <motion.div
                  className="flex size-20 items-center justify-center rounded-full bg-gold/20"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                >
                  <Check className="size-10 text-gold" strokeWidth={1.5} />
                </motion.div>
                <h2 className="wewed-heading text-3xl md:text-4xl text-espresso">
                  Thank You!
                </h2>
                <div className="wewed-divider w-24" />
                <p className="font-sans text-muted-foreground max-w-md leading-relaxed">
                  Your RSVP has been received. We&apos;re so grateful you&apos;ll be part of our special day.
                  Check your email for a confirmation with all the details.
                </p>
                <div className="flex items-center gap-2 text-gold">
                  <Heart className="size-4" fill="currentColor" />
                  <span className="wewed-monogram text-sm">Charity &amp; Kudzie</span>
                  <Heart className="size-4" fill="currentColor" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    )
  }

  /* ── Form State ── */
  return (
    <section id="rsvp" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>Will you join us?</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            RSVP <SectionInfo text="Fill in this form to confirm your attendance. Choose your meal, note dietary needs, and request a song for the dance floor. Please respond by November 23, 2026." />
          </h2>
          <p className="mt-6 font-sans text-muted-foreground leading-relaxed">
            We&apos;d love to celebrate with you. Please respond by{' '}
            <span className="font-medium text-espresso">November 23, 2026</span>.
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="border-gold/20 bg-champagne shadow-lg">
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Full Name */}
                  <motion.div custom={0} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-sans text-espresso text-sm font-medium">
                            Full Name <span className="text-clay">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your full name"
                              className="border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* Email */}
                  <motion.div custom={1} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-sans text-espresso text-sm font-medium">
                            Email <span className="text-clay">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              className="border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* Attendance */}
                  <motion.div custom={2} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <FormField
                      control={form.control}
                      name="attendance"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="font-sans text-espresso text-sm font-medium">
                            Will you attend? <span className="text-clay">*</span>
                          </FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                            >
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="accept" className="border-gold/50 text-gold" />
                                </FormControl>
                                <Label className="font-sans cursor-pointer text-espresso">
                                  Joyfully Accept
                                </Label>
                              </FormItem>
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="decline" className="border-gold/50 text-gold" />
                                </FormControl>
                                <Label className="font-sans cursor-pointer text-espresso">
                                  Regretfully Decline
                                </Label>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* Meal fields shown only if accepting */}
                  <AnimatePresence>
                    {attendance === 'accept' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6 overflow-hidden"
                      >
                        {/* Meal Preference */}
                        <motion.div custom={3} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                          <FormField
                            control={form.control}
                            name="mealPreference"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-sans text-espresso text-sm font-medium">
                                  Meal Preference
                                </FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="w-full border-gold/30 bg-white/80 font-sans focus:ring-gold/20">
                                      <SelectValue placeholder="Choose your meal" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="beef">Beef</SelectItem>
                                    <SelectItem value="chicken">Chicken</SelectItem>
                                    <SelectItem value="vegetarian">Vegetarian</SelectItem>
                                    <SelectItem value="vegan">Vegan</SelectItem>
                                    <SelectItem value="traditional">Traditional Zimbabwean</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>

                        {/* Dietary Requirements */}
                        <motion.div custom={4} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                          <FormField
                            control={form.control}
                            name="dietaryRequirements"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-sans text-espresso text-sm font-medium">
                                  Dietary Requirements
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Any allergies or dietary needs we should know about..."
                                    className="min-h-[80px] resize-none border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="font-sans text-xs">
                                  Optional — let us know so we can accommodate you.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>

                        {/* Plus One */}
                        <motion.div custom={5} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                          <FormField
                            control={form.control}
                            name="plusOne"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border border-gold/20 bg-white/50 p-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="border-gold/50 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="font-sans cursor-pointer text-espresso text-sm font-medium">
                                    Bringing a plus one?
                                  </FormLabel>
                                  <FormDescription className="font-sans text-xs">
                                    We&apos;d love to welcome your guest too.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </motion.div>

                        {/* Plus One Details */}
                        <AnimatePresence>
                          {plusOneEnabled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="space-y-6 overflow-hidden pl-4 border-l-2 border-gold/20"
                            >
                              <FormField
                                control={form.control}
                                name="plusOneName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-sans text-espresso text-sm font-medium">
                                      Plus One Name
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Your guest's full name"
                                        className="border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="plusOneMeal"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-sans text-espresso text-sm font-medium">
                                      Plus One Meal Preference
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="w-full border-gold/30 bg-white/80 font-sans focus:ring-gold/20">
                                          <SelectValue placeholder="Choose their meal" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="beef">Beef</SelectItem>
                                        <SelectItem value="chicken">Chicken</SelectItem>
                                        <SelectItem value="vegetarian">Vegetarian</SelectItem>
                                        <SelectItem value="vegan">Vegan</SelectItem>
                                        <SelectItem value="traditional">Traditional Zimbabwean</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Children Attending */}
                        <motion.div custom={6} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                          <FormField
                            control={form.control}
                            name="childrenAttending"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border border-gold/20 bg-white/50 p-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="border-gold/50 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="font-sans cursor-pointer text-espresso text-sm font-medium">
                                    Children attending?
                                  </FormLabel>
                                  <FormDescription className="font-sans text-xs">
                                    Little ones are welcome! Let us know so we can plan accordingly.
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </motion.div>

                        {/* Number of Children */}
                        <AnimatePresence>
                          {childrenEnabled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden pl-4 border-l-2 border-gold/20"
                            >
                              <FormField
                                control={form.control}
                                name="numberOfChildren"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-sans text-espresso text-sm font-medium">
                                      Number of Children
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="1"
                                        max="5"
                                        placeholder="How many?"
                                        className="w-24 border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Song Request */}
                        <motion.div custom={7} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                          <FormField
                            control={form.control}
                            name="songRequest"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-sans text-espresso text-sm font-medium">
                                  Song Request
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="What song gets you on the dance floor?"
                                    className="border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="font-sans text-xs">
                                  Help shape the playlist for the night!
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Message to Couple */}
                  <motion.div custom={8} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <FormField
                      control={form.control}
                      name="messageToCouple"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-sans text-espresso text-sm font-medium">
                            Message to the Couple
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Share your love, wishes, or a special memory..."
                              className="min-h-[100px] resize-none border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="font-sans text-xs">
                            Optional — we&apos;d love to hear from you.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div custom={9} variants={fieldVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gold text-espresso hover:bg-gold-light font-sans font-medium tracking-wide shadow-md transition-all duration-300 hover:shadow-lg h-12 text-base"
                    >
                      {isSubmitting ? (
                        <motion.div
                          className="size-5 rounded-full border-2 border-espresso/30 border-t-espresso"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      ) : (
                        <>
                          <Send className="size-4" />
                          Send Your RSVP
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Monogram footer */}
                  <div className="pt-2 text-center">
                    <span className="wewed-monogram text-xs tracking-widest">
                      C&amp;K &middot; 23.12.26
                    </span>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
