// =============================================================================
// POOL: Battery Validator Pool
// CometBFT validator fleet monitoring for Battery Coin blockchain.
// =============================================================================

import React from 'react';
import { Radio, ArrowLeft } from 'lucide-react';
import ValidatorFleetGrid from './ValidatorFleetGrid';
import useValidatorTelemetry from './useValidatorTelemetry';
import type { PoolProps } from './types';

const BatteryValidatorPool: React.FC<PoolProps> = ({ onBack }) => {
  const { telemetry, loading, error, refresh } = useValidatorTelemetry();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Battery Validator Pool</h2>
            <p className="text-[10px] text-gray-400">CometBFT consensus · batterycoin-1</p>
          </div>
        </div>
      </div>

      <ValidatorFleetGrid
        validators={telemetry}
        poolName="Battery Coin (batterycoin-1)"
        loading={loading}
        error={error}
        onRefresh={refresh}
        columns={{ sm: 1, md: 1, lg: 2, xl: 2 }}
      />
    </div>
  );
};

export default BatteryValidatorPool;
