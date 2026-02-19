import * as React from 'react';

import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX';
import { Footer } from '@/components/layout/Footer';

type LegalPageLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function LegalPageLayout({ title, subtitle, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 print:bg-white">
      <div className="print:hidden">
        <BikeflipHeaderPX />
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12 print:max-w-none print:px-0 print:py-0">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-3 text-sm text-zinc-600 md:text-base">{subtitle}</p> : null}
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8 print:mt-4 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-p:text-zinc-700 prose-li:text-zinc-700">
            {children}
          </div>
        </section>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
