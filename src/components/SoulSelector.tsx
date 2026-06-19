import React, { useState, useCallback, useMemo } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Edit3,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Wand2,
  Bot,
  Shield,
  Zap,
  Compass,
  Palette,
  Target,
  Search,
} from "lucide-react";
import { AgentSoul, SoulArchetype, SoulGrade } from "../types/soul";
import { PREDEFINED_SOULS, getSoulById, DEFAULT_SOUL } from "../data/predefined-souls";
import { gradeSoul } from "../services/SoulGraderService";

// =============================================================================
// Icon Mapping
// =============================================================================

const ARCHETYPE_ICONS: Record<SoulArchetype, React.ReactNode> = {
  executor: <Target size={20} />,
  researcher: <Search size={20} />,
  creative: <Palette size={20} />,
  guardian: <Shield size={20} />,
  navigator: <Compass size={20} />,
  fast: <Zap size={20} />,
  custom: <Wand2 size={20} />,
};

// =============================================================================
// Soul Grade Badge
// =============================================================================

interface SoulGradeBadgeProps {
  grade?: SoulGrade;
  size?: "sm" | "md" | "lg";
}

const SoulGradeBadge: React.FC<SoulGradeBadgeProps> = ({ grade, size = "md" }) => {
  if (!grade) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 ${
        size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs"
      }`}>
        <AlertCircle size={size === "sm" ? 10 : size === "lg" ? 14 : 12} />
        Not graded
      </span>
    );
  }

  const { score, verdict } = grade;
  
  const colorClass = score >= 90 
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : score >= 75
    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
    : score >= 60
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";

  const deployabilityIcon = grade.deployability === "Approved" 
    ? <CheckCircle size={size === "sm" ? 10 : size === "lg" ? 14 : 12} />
    : grade.deployability === "Approved with fixes"
    ? <AlertCircle size={size === "sm" ? 10 : size === "lg" ? 14 : 12} />
    : <AlertCircle size={size === "sm" ? 10 : size === "lg" ? 14 : 12} className="text-red-400" />;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colorClass} ${
      size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs"
    }`}>
      {deployabilityIcon}
      {score}/100 — {verdict}
    </span>
  );
};

// =============================================================================
// Soul Card
// =============================================================================

interface SoulCardProps {
  soul: AgentSoul;
  isSelected: boolean;
  onSelect: () => void;
  showGrade?: SoulGrade;
}

const SoulCard: React.FC<SoulCardProps> = ({ soul, isSelected, onSelect, showGrade }) => {
  return (
    <button
      onClick={onSelect}
      className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
        isSelected
          ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
          : "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: soul.color }}
        >
          {ARCHETYPE_ICONS[soul.archetype] || <Bot size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white text-sm">{soul.name}</h4>
            {soul.customizable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                Editable
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{soul.description}</p>
          
          {showGrade && (
            <div className="mt-2">
              <SoulGradeBadge grade={showGrade} size="sm" />
            </div>
          )}
        </div>
      </div>

      {isSelected && (
        <div className="absolute top-2 right-2">
          <CheckCircle size={16} className="text-cyan-400" />
        </div>
      )}

      {/* Recommended tags */}
      <div className="flex flex-wrap gap-1 mt-3">
        {soul.recommendedFor.slice(0, 2).map((rec, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
            {rec}
          </span>
        ))}
        {soul.recommendedFor.length > 2 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
            +{soul.recommendedFor.length - 2}
          </span>
        )}
      </div>
    </button>
  );
};

// =============================================================================
// Soul Editor
// =============================================================================

interface SoulEditorProps {
  initialSoulMarkdown: string;
  onChange: (markdown: string) => void;
  onGrade: (grade: SoulGrade) => void;
  grade?: SoulGrade;
  isGrading: boolean;
}

const SoulEditor: React.FC<SoulEditorProps> = ({
  initialSoulMarkdown,
  onChange,
  onGrade,
  grade,
  isGrading,
}) => {
  const [markdown, setMarkdown] = useState(initialSoulMarkdown);
  const [showPreview, setShowPreview] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleChange = useCallback((newMarkdown: string) => {
    setMarkdown(newMarkdown);
    onChange(newMarkdown);
  }, [onChange]);

  const handleGrade = useCallback(async () => {
    const result = await gradeSoul(markdown);
    onGrade(result);
  }, [markdown, onGrade]);

  // Parse sections from markdown
  const sections = useMemo(() => {
    const matches = markdown.match(/^## (.+)$/gm);
    return matches?.map(m => m.replace(/^## /, "")) || [];
  }, [markdown]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !showPreview
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Edit3 size={14} />
            Edit
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showPreview
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-2">
          <SoulGradeBadge grade={grade} size="md" />
          <button
            onClick={handleGrade}
            disabled={isGrading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
          >
            {isGrading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            {isGrading ? "Grading..." : "Grade SOUL"}
          </button>
        </div>
      </div>

      {/* Section quick-nav */}
      {sections.length > 0 && !showPreview && (
        <div className="flex flex-wrap gap-1">
          {sections.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                activeSection === section
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-gray-800 text-gray-500 hover:text-gray-400"
              }`}
            >
              {section}
            </button>
          ))}
        </div>
      )}

      {/* Editor / Preview */}
      {showPreview ? (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-auto max-h-96">
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed">
              {markdown}
            </pre>
          </div>
        </div>
      ) : (
        <textarea
          value={markdown}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full h-96 bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-none leading-relaxed"
          placeholder="# SOUL.md\n\nDefine your agent's identity, mission, and constraints..."
          spellCheck={false}
        />
      )}

      {/* Grade Details */}
      {grade && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-medium text-white flex items-center gap-2">
            <CheckCircle size={14} className="text-cyan-400" />
            Grade Details
          </h5>
          
          {grade.automaticBlockers.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-red-400 font-medium">Automatic Blockers:</span>
              <ul className="text-xs text-red-400/80 list-disc list-inside">
                {grade.automaticBlockers.map((blocker, i) => (
                  <li key={i}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          {grade.topDriftRisks.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-amber-400 font-medium">Top Drift Risks:</span>
              <ul className="text-xs text-amber-400/80 list-disc list-inside">
                {grade.topDriftRisks.slice(0, 3).map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          {grade.fixes.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-cyan-400 font-medium">Suggested Fixes:</span>
              <ol className="text-xs text-gray-400 list-decimal list-inside">
                {grade.fixes.slice(0, 3).map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main SoulSelector Component
// =============================================================================

export interface SoulSelectorProps {
  selectedSoulId: string | null;
  customSoulMarkdown: string | null;
  soulGrade?: SoulGrade;
  onSelectSoul: (soulId: string) => void;
  onCustomizeSoul: (customMarkdown: string) => void;
  onGradeChange: (grade: SoulGrade) => void;
}

export const SoulSelector: React.FC<SoulSelectorProps> = ({
  selectedSoulId,
  customSoulMarkdown,
  soulGrade,
  onSelectSoul,
  onCustomizeSoul,
  onGradeChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  const selectedSoul = useMemo(() => 
    selectedSoulId ? getSoulById(selectedSoulId) : null,
    [selectedSoulId]
  );

  const currentSoulMarkdown = customSoulMarkdown || selectedSoul?.soulMarkdown || DEFAULT_SOUL.soulMarkdown;

  const handleGrade = useCallback(async (grade: SoulGrade) => {
    setIsGrading(false);
    onGradeChange(grade);
  }, [onGradeChange]);

  const handleCustomize = useCallback((markdown: string) => {
    onCustomizeSoul(markdown);
    // Auto-enter edit mode if customizing
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [onCustomizeSoul, isEditing]);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">
                {selectedSoul ? selectedSoul.name : "Select Agent Soul"}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedSoul 
                  ? selectedSoul.description 
                  : "Choose an identity that shapes how this agent behaves"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {soulGrade && (
              <SoulGradeBadge grade={soulGrade} />
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronDown size={14} />
                  Close
                </>
              ) : (
                <>
                  <ChevronRight size={14} />
                  {selectedSoul ? "Change" : "Select"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Soul Gallery */}
      {isExpanded && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <Bot size={14} />
            Choose a Soul Archetype
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PREDEFINED_SOULS.map((soul) => (
              <SoulCard
                key={soul.id}
                soul={soul}
                isSelected={soul.id === selectedSoulId}
                onSelect={() => {
                  onSelectSoul(soul.id);
                  setIsExpanded(false);
                  // Clear custom override when selecting predefined
                  if (soul.id !== "custom") {
                    onCustomizeSoul("");
                  }
                }}
                showGrade={soul.id === selectedSoulId ? soulGrade : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Soul Editor (for custom souls or when editing) */}
      {(selectedSoul?.customizable || customSoulMarkdown) && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white font-medium flex items-center gap-2">
                <Edit3 size={16} className="text-cyan-400" />
                Soul Constitution
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Edit the SOUL.md to customize this agent's identity
              </p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isEditing
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-gray-800 text-gray-400 hover:text-gray-300"
              }`}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
              {isEditing ? "Done Editing" : "Edit"}
            </button>
          </div>

          {isEditing && (
            <SoulEditor
              initialSoulMarkdown={currentSoulMarkdown}
              onChange={handleCustomize}
              onGrade={handleGrade}
              grade={soulGrade}
              isGrading={isGrading}
            />
          )}

          {!isEditing && soulGrade && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SoulGradeBadge grade={soulGrade} size="lg" />
              </div>
              
              {soulGrade.strengths.length > 0 && (
                <div className="text-sm text-gray-400">
                  <span className="text-emerald-400 font-medium">Strong: </span>
                  {soulGrade.strengths[0]}
                </div>
              )}

              {soulGrade.fixes.length > 0 && (
                <div className="text-sm text-gray-400">
                  <span className="text-amber-400 font-medium">Fix next: </span>
                  {soulGrade.fixes[0]}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SoulSelector;
