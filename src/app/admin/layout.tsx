import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AdminUtilityNav } from '@/components/admin/admin-utility-nav'
import { NotebookUtilityEntry } from '@/components/notebook/notebook-utility-entry'
import './admin-responsive.css'

export const metadata: Metadata = {
  title: 'Wewed Business Admin Console',
  description: 'Private parent-company operations workspace for Wewed.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AdminUtilityNav />
      <NotebookUtilityEntry surface="admin" />
    </>
  )
}
