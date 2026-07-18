/**
 * Taste-Skill Dial Panel Component
 *
 * Three adjustable dials (VARIANCE / MOTION / DENSITY) with preset selectors.
 * Used in Stargate marketplace and Vault skill detail view.
 */

import React, { useState, useCallback } from "react";

interface TasteSkillDials {
  designVariance: number;
  motionIntensity: number;
  visualDensity: number;
}

interface TasteSkillPreset {
  name: string;
  dials: TasteSkillDials;
}

interface TasteSkillDialPanelProps {
  initialDials?: TasteSkillDials;
  presets?: TasteSkillPreset[];
  onChange?: (dials: TasteSkillDials) => void;
  onPresetSelect?: (preset: TasteSkillPreset) => void;
  readOnly?: boolean;
}

const DEFAULT_DIALS: TasteSkillDials = {
  designVariance: 8,
  motionIntensity: 6,
  visualDensity: 4,
};

const DIAL_CONFIG = {
  designVariance: {
    label: "DESIGN VARIANCE",
    description: "1 = Perfect Symmetry · 10 = Artsy Chaos",
    color: "#a855f7", // purple
    minLabel: "Clean",
    maxLabel: "Wild",
  },
  motionIntensity: {
    label: "MOTION INTENSITY",
    description: "1 = Static · 10 = Cinematic / Physics",
    color: "#3b82f6", // blue
    minLabel: "Still",
    maxLabel: "Alive",
  },
  visualDensity: {
    label: "VISUAL DENSITY",
    description: "1 = Art Gallery / Airy · 10 = Cockpit / Packed",
    color: "#22c55e", // green
    minLabel: "Spacious",
    maxLabel: "Dense",
  },
};

export const TasteSkillDialPanel: React.FC<TasteSkillDialPanelProps> = ({
  initialDials = DEFAULT_DIALS,
  presets = [],
  onChange,
  onPresetSelect,
  readOnly = false,
}) => {
  const [dials, setDials] = useState<TasteSkillDials>(initialDials);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const updateDial = useCallback(
    (key: keyof TasteSkillDials, value: number) => {
      const newDials = { ...dials, [key]: value };
      setDials(newDials);
      setActivePreset(null); // Custom override clears preset
      onChange?.(newDials);
    },
    [dials, onChange]
  );

  const selectPreset = useCallback(
    (preset: TasteSkillPreset) => {
      setDials(preset.dials);
      setActivePreset(preset.name);
      onPresetSelect?.(preset);
      onChange?.(preset.dials);
    },
    [onChange, onPresetSelect]
  );

  const dialKeys: (keyof TasteSkillDials)[] = ["designVariance", "motionIntensity", "visualDensity"];

  return (
    <div className="taste-skill-dial-panel" style={{ padding: "16px", background: "#0f172a", borderRadius: "12px", color: "#e2e8f0", maxWidth: "480px" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>
        Taste Skill Dials
      </h3>

      {/* Dials */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
        {dialKeys.map((key) => {
          const config = DIAL_CONFIG[key];
          const value = dials[key];
          return (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: config.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {config.label}
                </span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: config.color }}>
                  {value}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "50px" }}>{config.minLabel}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={value}
                  disabled={readOnly}
                  onChange={(e) => updateDial(key, parseInt(e.target.value, 10))}
                  style={{
                    flex: 1,
                    accentColor: config.color,
                    height: "6px",
                    cursor: readOnly ? "default" : "pointer",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "50px", textAlign: "right" }}>{config.maxLabel}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>{config.description}</span>
            </div>
          );
        })}
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>
            Presets
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {presets.map((preset) => {
              const isActive = activePreset === preset.name;
              return (
                <button
                  key={preset.name}
                  disabled={readOnly}
                  onClick={() => selectPreset(preset)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: isActive ? "2px solid #a855f7" : "1px solid #334155",
                    background: isActive ? "rgba(168,85,247,0.15)" : "#1e293b",
                    color: isActive ? "#e9d5ff" : "#cbd5e1",
                    fontSize: "12px",
                    cursor: readOnly ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary badge */}
      <div
        style={{
          marginTop: "16px",
          padding: "10px 14px",
          background: "rgba(168,85,247,0.08)",
          borderRadius: "8px",
          border: "1px solid rgba(168,85,247,0.2)",
          fontSize: "13px",
          fontFamily: "monospace",
          color: "#d8b4fe",
        }}
      >
        {dials.designVariance} / {dials.motionIntensity} / {dials.visualDensity}
        {" "}
        {activePreset ? `← ${activePreset}` : "← Custom"}
      </div>
    </div>
  );
};

export default TasteSkillDialPanel;
