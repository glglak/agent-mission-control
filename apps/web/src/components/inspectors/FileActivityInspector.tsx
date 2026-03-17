'use client';

import type { WorldState } from '@amc/simulation-engine';

interface FileActivityInspectorProps {
  worldState: WorldState;
}

export function FileActivityInspector({ worldState }: FileActivityInspectorProps) {
  const files = Array.from(worldState.fileNodes.values())
    .sort((a, b) => b.glowIntensity - a.glowIntensity);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
        File Activity
      </h3>

      {files.length === 0 ? (
        <div className="text-sm text-slate-400">No file activity yet</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-3 text-xs p-2 bg-slate-50 rounded border border-slate-100"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: '#d97706',
                  opacity: 0.3 + file.glowIntensity * 0.7,
                  boxShadow: file.glowIntensity > 0.5
                    ? `0 0 ${file.glowIntensity * 8}px #d97706`
                    : 'none',
                }}
              />
              <span className="text-slate-600 truncate flex-1 font-mono">
                {file.path}
              </span>
              <span className="text-slate-400 flex-shrink-0">
                {file.editCount} edit{file.editCount !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
