import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <main className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <div className="relative z-10"><BrandMark inverted /></div>
        <div className="relative z-10 max-w-xl pb-8">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100">Built for momentum</span>
          <h2 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-0.04em]">One calm place for your team’s most important work.</h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Plan clearly, stay aligned, and move every project forward without losing the details that matter.</p>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-7">
            {[["Private", "Tenant spaces"], ["Clear", "Role controls"], ["Fast", "Team setup"]].map(([value, label]) => (
              <div key={label}><p className="font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandMark /></div>
          <div className="mb-8">
            <p className="text-sm font-semibold text-brand-600">WELCOME TO NORTHSTAR</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
            <p className="mt-3 leading-7 text-slate-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
