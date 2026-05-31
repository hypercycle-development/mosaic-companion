import React from 'react';

export const ProviderIcon: React.FC<{ provider: string }> = ({ provider }) => {
  // Placeholder: just render provider name
  return <span className="text-xs font-mono">{provider}</span>;
};
