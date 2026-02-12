import React from 'react';
import { Server } from 'lucide-react';

export const NodesList = ({ data, loading }: { data: any[], loading: boolean }) => {
  return (
    <div className="text-center py-10 text-[var(--textMuted)]">
      <Server className="mx-auto mb-2 opacity-50" size={32} />
      <p>Node list integration coming soon.</p>
    </div>
  );
};
