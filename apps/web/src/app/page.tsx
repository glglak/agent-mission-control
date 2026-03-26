'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useSimulation } from '@/hooks/useSimulation';
import { useUIStore } from '@/stores/ui-store';
import { StatusBar } from '@/components/dashboard/StatusBar';
import { SessionList } from '@/components/dashboard/SessionList';
import { AgentGrid } from '@/components/dashboard/AgentGrid';
import { CommunicationGraph } from '@/components/graphs/CommunicationGraph';
import { PixelOfficeWrapper } from '@/components/visualization/PixelOfficeWrapper';
import { AgentInspector } from '@/components/inspectors/AgentInspector';
import { FileActivityInspector } from '@/components/inspectors/FileActivityInspector';
import { EventLog } from '@/components/inspectors/EventLog';
import { TimelineBar } from '@/components/timeline/TimelineBar';
import { ScrumPanel } from '@/components/dashboard/ScrumPanel';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

export default function DashboardPage() {
  useWebSocket();
  const { state: worldState } = useSimulation();
  const { view, setView, inspectorOpen, toggleInspector } = useUIStore();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Agent Mission Control
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button
            onClick={toggleInspector}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              inspectorOpen
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Inspector
          </button>
        </div>
      </header>

      <StatusBar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-slate-200 bg-slate-50 flex-shrink-0">
          <SessionList />
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-amc-panel">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* 3D / Dashboard view */}
            {(view === '3d' || view === 'split') && (
              <div style={{ height: view === '3d' ? 'calc(100vh - 140px)' : '50vh' }}>
                <PixelOfficeWrapper worldState={worldState} />
              </div>
            )}

            {(view === 'dashboard' || view === 'split') && (
              <>
                <AgentGrid worldState={worldState} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <CommunicationGraph worldState={worldState} />
                  <FileActivityInspector worldState={worldState} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ActivityFeed />
                  <EventLog />
                </div>
              </>
            )}


            <TimelineBar />
          </div>
        </main>

        {/* Right panel: Scrum Board or Inspector */}
        <aside className="w-80 border-l border-slate-200 bg-white flex-shrink-0 overflow-y-auto">
          {inspectorOpen ? (
            <AgentInspector worldState={worldState} />
          ) : (
            <ScrumPanel />
          )}
        </aside>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: string;
  onChange: (v: 'dashboard' | '3d' | 'split') => void;
}) {
  const options = [
    { value: 'dashboard' as const, label: '2D' },
    { value: '3d' as const, label: '3D' },
    { value: 'split' as const, label: 'Split' },
  ];

  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs transition-colors ${
            view === opt.value
              ? 'bg-amc-accent text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
