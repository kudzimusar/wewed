'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Flame,
  Coffee,
  Image as ImageIcon,
  BookOpen,
  ShoppingBag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoldOrnament } from '@/components/wedding/decorative-elements';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ProductId = 'candle' | 'mug' | 'print' | 'album';

interface Product {
  id: ProductId;
  name: string;
  price: number;
  description: string;
  icon: typeof Flame;
  gradient: string;
  available: boolean;
  badge?: string;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

const PRODUCTS: Product[] = [
  {
    id: 'candle',
    name: '“Mr & Mrs Musarurwa” Candle',
    price: 24,
    description: 'Hand-poured soy candle with gold monogram. 40-hour burn time.',
    icon: Flame,
    gradient: 'from-clay/30 via-gold/15 to-espresso/10',
    available: true,
  },
  {
    id: 'mug',
    name: 'Monogram Mug',
    price: 18,
    description: 'Ceramic mug with C&K 23.12.26 monogram. Dishwasher safe.',
    icon: Coffee,
    gradient: 'from-sage/25 via-gold/15 to-espresso/10',
    available: true,
  },
  {
    id: 'print',
    name: 'Forever Print',
    price: 45,
    description:
      'Archival-quality art print of the couple. A heirloom for the mantle.',
    icon: ImageIcon,
    gradient: 'from-plum/25 via-gold/15 to-espresso/10',
    available: false,
    badge: 'Coming Soon',
  },
  {
    id: 'album',
    name: 'Memory Album',
    price: 65,
    description: 'Linen-bound photo album for your favorite 60 moments.',
    icon: BookOpen,
    gradient: 'from-gold/30 via-champagne/20 to-espresso/10',
    available: false,
    badge: 'Coming Soon',
  },
];

const EASING = [0.22, 1, 0.36, 1] as const;

/* ─── Product card ───────────────────────────────────────────────────────── */

function ProductCard({ product, index }: { product: Product; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = product.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
      transition={{ duration: 0.7, ease: EASING, delay: 0.1 * index }}
      className="h-full"
    >
      <Card
        className="group h-full overflow-hidden border border-gold/25 bg-champagne shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/50 hover:shadow-xl"
      >
        {/* Image placeholder — gradient + icon + monogram motif */}
        <div
          className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-br ${product.gradient}`}
        >
          {/* Dotted texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25% 25%, #1A1410 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />

          {/* Subtle shimmer on hover */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />

          {/* Center product icon with gold ring */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-gold/40 bg-champagne/40 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
            <Icon className="h-10 w-10 text-gold" />
          </div>

          {/* Monogram watermark in corner */}
          <span className="absolute bottom-3 right-3 font-serif text-[10px] uppercase tracking-[0.2em] text-espresso/40">
            C&amp;K · 23.12.26
          </span>

          {/* Coming soon badge */}
          {product.badge && (
            <div className="absolute left-3 top-3">
              <Badge className="border border-gold/40 bg-espresso/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light shadow-sm backdrop-blur-sm">
                {product.badge}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="flex h-full flex-col p-5 md:p-6">
          {/* Name + price */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="wewed-heading text-lg leading-snug text-espresso md:text-xl">
              {product.name}
            </h3>
            <span className="shrink-0 font-serif text-2xl text-gold">
              ${product.price}
            </span>
          </div>

          {/* Description */}
          <p className="mb-5 text-sm leading-relaxed text-espresso/65">
            {product.description}
          </p>

          {/* CTA pinned to bottom */}
          <div className="mt-auto">
            <Button
              disabled={!product.available}
              className="w-full rounded-full border border-gold/50 bg-transparent py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-espresso transition-all hover:bg-gold hover:text-espresso disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-espresso/50"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {product.available ? 'Add to Cart' : 'Notify Me'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Main merch teaser section ──────────────────────────────────────────── */

export function MerchTeaser() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      id="merch"
      className="wewed-section relative bg-ivory py-20 md:py-32"
    >
      {/* Soft background texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, #BF9B5F 1px, transparent 1px), radial-gradient(circle at 20% 80%, #C0633F 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        {/* Heading */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mx-auto mb-12 max-w-3xl text-center md:mb-16"
        >
          <div className="mb-4 flex justify-center">
            <GoldOrnament className="w-full max-w-[180px]" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-gold-muted">
            wewed Keepsakes
          </p>
          <h2 className="wewed-heading text-4xl text-espresso md:text-5xl lg:text-6xl">
            wewed Keepsakes
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-espresso/70 md:text-lg">
            Take a piece of forever with you
          </p>
        </motion.div>

        {/* Product grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7 lg:items-stretch">
          {PRODUCTS.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>

        {/* Note about shipping */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, ease: EASING, delay: 0.4 }}
          className="mx-auto mt-10 max-w-2xl text-center md:mt-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-champagne/70 px-5 py-2.5 text-xs text-espresso/70 shadow-sm backdrop-blur-sm md:text-sm">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            All keepsakes are made-to-order and ship globally from Harare.
          </div>
        </motion.div>

        {/* Browse full store CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.5 }}
          className="mt-8 flex justify-center md:mt-10"
        >
          <Button
            asChild
            className="group rounded-full bg-espresso px-8 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-champagne transition-all hover:bg-plum hover:shadow-lg hover:shadow-plum/20"
          >
            <a href="#">
              Browse Full Store
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default MerchTeaser;
