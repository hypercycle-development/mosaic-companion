import React from 'react';

export interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-500 text-white">{status}</span>;
};
