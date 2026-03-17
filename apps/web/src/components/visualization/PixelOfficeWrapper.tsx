'use client';

import dynamic from 'next/dynamic';
import type { WorldState } from '@amc/simulation-engine';

const PixelOffice = dynamic(
  () => import('./PixelOffice').then((m) => ({ default: m.PixelOffice })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#1e1e32] rounded-xl border border-slate-700 flex items-center justify-center">
        <div className="text-slate-500 text-sm font-mono">Loading pixel office...</div>
      </div>
    ),
  }
);

interface Props {
  worldState: WorldState;
}

export function PixelOfficeWrapper({ worldState }: Props) {
  return <PixelOffice worldState={worldState} />;
}
