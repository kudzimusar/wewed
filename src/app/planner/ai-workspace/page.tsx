'use client'

import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AiPlannerAssistant } from '@/components/wedding/ai-planner-assistant'
import { AiWorkspaceRecords } from '@/components/wedding/ai-workspace-records'
import { AiWorkspaceSaveForms } from '@/components/wedding/ai-workspace-save-forms'
import { AiDocumentMaintenance } from '@/components/wedding/ai-document-maintenance'

export default function PlannerAiWorkspacePage() {
  return (
    <main className="min-h-screen bg-espresso px-3 pb-24 pt-4 text-champagne sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-champagne/[0.035] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-gold text-espresso">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="wewed-heading text-xl text-champagne">Wewed AI Operations</h1>
              <p className="text-xs text-champagne/50">
                Live wedding context, durable drafts, controlled actions, and document retrieval
              </p>
            </div>
          </div>
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-3 py-2 text-xs text-gold hover:bg-gold/10"
          >
            <ArrowLeft className="size-3.5" />
            Planner workspace
          </Link>
        </header>

        <AiWorkspaceSaveForms />
        <AiDocumentMaintenance />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
          <section className="min-h-[760px] overflow-hidden rounded-2xl border border-gold/20 bg-espresso shadow-2xl">
            <AiPlannerAssistant />
          </section>
          <AiWorkspaceRecords />
        </div>
      </div>
    </main>
  )
}
