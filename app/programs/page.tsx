'use client';

import { MoreHorizontal, Plus } from 'lucide-react';

type WeekPreviewItem = {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  focus: string;
};

type ProgramCardItem = {
  id: string;
  title: string;
  frequency: string;
};

const weekPreview: WeekPreviewItem[] = [
  { day: 'Mon', focus: 'Push' },
  { day: 'Tue', focus: 'Legs' },
  { day: 'Wed', focus: 'Rest' },
  { day: 'Thu', focus: 'Pull' },
  { day: 'Fri', focus: 'Push' },
  { day: 'Sat', focus: 'Legs' },
  { day: 'Sun', focus: 'Rest' },
];

const programs: ProgramCardItem[] = [
  { id: 'arnold-split', title: 'Arnold Split', frequency: '6 days/week' },
  { id: 'ppl-hypertrophy', title: 'PPL Hypertrophy', frequency: '6 days/week' },
  { id: 'upper-lower-strength', title: 'Upper / Lower Strength', frequency: '4 days/week' },
  { id: 'power-hypertrophy-ul', title: 'Power Hypertrophy UL', frequency: '4 days/week' },
];

export default function ProgramsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
      <header>
        <h1 className="text-3xl font-bold text-zinc-100">Program Library</h1>
      </header>

      <section className="space-y-4">
        <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">Current Blueprint</p>
        <article className="rounded-3xl border border-green-500/30 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_20px_50px_rgba(34,197,94,0.12)] backdrop-blur-xl">
          <div className="space-y-1">
            <p className="text-zinc-400 text-xs uppercase">Active Program</p>
            <h2 className="text-zinc-100 text-2xl font-bold">5/3/1 BBB</h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {weekPreview.map((item) => (
              <div
                key={item.day}
                className="rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-2 text-center"
              >
                <p className="text-zinc-400 text-[10px] uppercase">{item.day}</p>
                <p className="text-zinc-100 text-sm font-bold">{item.focus}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">The Vault</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 backdrop-blur-xl transition-colors hover:bg-white/5"
          >
            <div className="rounded-full border border-zinc-700 p-2">
              <Plus className="h-6 w-6 text-zinc-100" />
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-xs uppercase">Builder</p>
              <p className="text-zinc-100 font-bold">Create New</p>
            </div>
          </button>

          {programs.map((program) => (
            <article
              key={program.id}
              className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl transition-colors hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-zinc-100 text-lg font-bold">{program.title}</p>
                  <p className="mt-2 text-zinc-400 text-xs uppercase">{program.frequency}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Program actions for ${program.title}`}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
