import type { Metadata } from 'next'
import { AccountDeletionForm } from '@/components/account/account-deletion-form'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'

export const metadata: Metadata = {
  title: 'Delete your Wewed account',
  description: 'Request deletion of a Wewed account and associated personal data.',
  robots: { index: true, follow: true },
}

export default function AccountDeletionPage() {
  return (
    <PublicPlatformShell>
      <section className="bg-espresso px-4 py-16 text-champagne sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Privacy control</p>
          <h1 className="mt-4 font-serif text-5xl">Delete your Wewed account</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-champagne/70">You can start account deletion here from any browser or from Settings inside Wewed.</p>
        </div>
      </section>
      <section className="bg-ivory px-4 py-14 text-espresso sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-6 text-sm leading-7 text-espresso/70">
            <div>
              <h2 className="font-serif text-3xl text-espresso">What happens next</h2>
              <p className="mt-3">Wewed verifies that you own the account and that deleting shared wedding or business records will not override another authorised person’s rights. We then close the account and delete or anonymise personal data that is no longer needed.</p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-espresso">Timing</h2>
              <p className="mt-2">Verified requests are normally completed within 30 days. Removal from encrypted backups may take up to 90 days as backups cycle out.</p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-espresso">Limited retention</h2>
              <p className="mt-2">Wewed may retain the minimum records required for security, fraud prevention, legal obligations, disputes, financial reporting or the rights of other wedding participants. These records remain access controlled and are not used for unrelated marketing.</p>
            </div>
            <p>Privacy questions can also be sent to <a className="font-semibold text-gold-dark underline" href="mailto:privacy@wewed.pro">privacy@wewed.pro</a>.</p>
          </div>
          <AccountDeletionForm />
        </div>
      </section>
    </PublicPlatformShell>
  )
}
