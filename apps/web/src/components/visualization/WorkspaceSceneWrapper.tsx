'use client';

import dynamic from 'next/dynamic';
import type { WorldState } from '@amc/simulation-engine';

const WorkspaceScene = dynamic(
  () => import('./WorkspaceScene').then((m) => ({ default: m.WorkspaceScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-amc-panel rounded-lg border border-amc-border flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading 3D workspace...</div>
      </div>
    ),
  }
);

interface Props {
  worldState: WorldState;
}

export function WorkspaceSceneWrapper({ worldState }: Props) {
  return <WorkspaceScene worldState={worldState} />;
}
