import { permanentRedirect } from 'next/navigation'

/**
 * Compatibility route for direct pricing links.
 * The canonical pricing experience is the pricing section on the homepage.
 */
export default function PricingRoute() {
  permanentRedirect('/#pricing')
}
