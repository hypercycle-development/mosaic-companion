/** ============================================================
 * NFT COLLECTION CARD COMPONENTS
 * ============================================================
 * Premium React components for rendering verified Cardano NFT
 * collection cards inside Stargate / AdaPortalPanel.
 *
 * Features:
 *   - Collection grouping by policy ID
 *   - Verified badge with glow effect
 *   - IPFS image rendering with fallback
 *   - Infrastructure stats panel (HyperCycle node data)
 *   - Expandable metadata drawer
 *   - Social links
 *   - Responsive grid layout
 *
 * Phase: 4 of NFT Collection Card System
 * ============================================================ */

import React, { useState, useCallback } from 'react';
import {
  Layers, Shield, Globe, ExternalLink, ChevronDown, ChevronUp,
  Cpu, Server, Zap, Award, Hash, Image as ImageIcon, Box,
  Factory, TrendingUp, Link2, MessageCircle, Mail, Twitter,
  X,
} from 'lucide-react';
import type {
  ResolvedCollectionGroup,
  ResolvedNFTAsset,
  CIP25Metadata,
} from '../services/AdaPortal/MetadataResolver';
import type { StargateCollectionConfig } from '../services/AdaPortal/CollectionRegistry';

// ─── Helper: IPFS image with fallback ───────────────────────────

const FALLBACK_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="%2364748b" viewBox="0 0 24 24"><rect width="24" height="24" fill="%231f2937" rx="4"/><path d="M4 4h16v16H4z" fill="none"/><circle cx="12" cy="12" r="4" stroke="%2364748b" stroke-width="1.5" fill="none"/><path d="M4 16l4-4 3 3 5-5 4 4" stroke="%2364748b" stroke-width="1.5" fill="none"/></svg>';

function IPFSImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const url = src || FALLBACK_IMG;
  return (
    <img
      src={err ? FALLBACK_IMG : url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setErr(true)}
    />
  );
}

// ─── Single Asset Row (inside collection card) ────────────────

function NFTAssetRow({ asset }: { asset: ResolvedNFTAsset }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-900/40 hover:bg-gray-800/60 transition-colors">
      <div className="w-8 h-8 rounded bg-gray-800 flex-shrink-0 overflow-hidden">
        <IPFSImage
          src={asset.imageUrl}
          alt={asset.metadata?.name || asset.assetName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-300 truncate">
          {asset.metadata?.name || asset.assetName || `Asset`}
        </div>
        <div className="text-[10px] text-gray-500 font-mono truncate">
          {asset.fingerprint?.slice(0, 16)}...
        </div>
      </div>
      <span className="text-xs text-blue-400 font-mono shrink-0">×{asset.quantity}</span>
    </div>
  );
}

// ─── Infrastructure Panel ───────────────────────────────────────

function InfrastructurePanel({ config }: { config?: StargateCollectionConfig }) {
  if (!config?.infrastructure) return null;
  const infra = config.infrastructure;
  return (
    <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-gray-900/80 to-gray-800/60 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-2">
        <Factory size={14} className="text-purple-400" />
        <span className="text-xs font-semibold text-purple-300">Node Factory Stats</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Server size={12} className="text-blue-400" />
          <div>
            <div className="text-[10px] text-gray-500">Factories</div>
            <div className="text-sm font-bold text-white">{infra.nodeFactories}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-green-400" />
          <div>
            <div className="text-[10px] text-gray-500">Active Nodes</div>
            <div className="text-sm font-bold text-white">{infra.activeNodes}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-amber-400" />
          <div>
            <div className="text-[10px] text-gray-500">Compute</div>
            <div className="text-sm font-bold text-white">{infra.computePowerTFLOPS.toLocaleString()} TFLOPS</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={12} className="text-pink-400" />
          <div>
            <div className="text-[10px] text-gray-500">cHYPC Pool</div>
            <div className="text-sm font-bold text-white">{infra.activeNodes.toLocaleString()} cHYPC</div>
          </div>
        </div>
      </div>
      {infra.delegatedSince && (
        <div className="text-[10px] text-gray-600 mt-2">
          Delegated since {infra.delegatedSince}
        </div>
      )}
    </div>
  );
}

// ─── Utility Badges ─────────────────────────────────────────────

function UtilityBadges({ utility }: { utility?: StargateCollectionConfig['utility'] }) {
  if (!utility) return null;
  const badges = [
    { key: 'stargateAccess', label: 'Stargate', icon: Shield, active: utility.stargateAccess },
    { key: 'nodeFactoryControl', label: 'Node Factory', icon: Factory, active: utility.nodeFactoryControl },
    { key: 'governanceVoting', label: 'Governance', icon: Award, active: utility.governanceVoting },
    { key: 'premiumAIMs', label: 'Premium AIMs', icon: Cpu, active: utility.premiumAIMs },
    { key: 'computeCredits', label: 'Compute', icon: Zap, active: utility.computeCredits },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {badges.map(b => (
        b.active ? (
          <span
            key={b.key}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/20"
          >
            <b.icon size={10} /> {b.label}
          </span>
        ) : null
      ))}
    </div>
  );
}

// ─── Social Links ─────────────────────────────────────────────

function SocialLinks({ config }: { config?: StargateCollectionConfig }) {
  if (!config) return null;
  const links = [
    { url: config.website, icon: Globe, label: 'Website' },
    { url: config.twitter, icon: Twitter, label: 'Twitter' },
    { url: config.discord, icon: MessageCircle, label: 'Discord' },
    { url: config.telegram, icon: Mail, label: 'Telegram' },
  ].filter(l => l.url);
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {links.map(l => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          <l.icon size={10} /> {l.label} <ExternalLink size={8} />
        </a>
      ))}
    </div>
  );
}

// ─── Collection Card (main component) ──────────────────────────

export interface NFTCollectionCardProps {
  group: ResolvedCollectionGroup;
  onAssetClick?: (asset: ResolvedNFTAsset) => void;
}

export function NFTCollectionCard({ group, onAssetClick }: NFTCollectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = group.collectionConfig;
  const accent = group.accentColor || '#3b82f6';
  const isPremium = config?.display.cardVariant === 'premium';

  return (
    <div
      className={`
        relative rounded-xl border overflow-hidden transition-all duration-300
        ${isPremium
          ? 'bg-gray-900/80 border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.08)]'
          : group.isVerified
            ? 'bg-gray-900/60 border-gray-700/50 hover:border-gray-600'
            : 'bg-gray-900/40 border-gray-800/50 hover:border-gray-700'
        }
      `}
    >
      {/* Glow overlay for premium */}
      {isPremium && config?.display.glowEffect && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${accent}40, transparent 70%)`,
          }}
        />
      )}

      {/* Top: Banner area (if we had a banner image) */}
      <div
        className="h-2 w-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}80)` }}
      />

      <div className="p-4 relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Logo / Collection image */}
          <div
            className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border-2"
            style={{ borderColor: `${accent}40` }}
          >
            <IPFSImage
              src={config?.logoImage || group.representativeMetadata?.image || null}
              alt={group.collectionName}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white truncate">{group.collectionName}</h3>
              {group.isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                  <Shield size={10} /> Verified
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {'NFT'}
              {' · '}
              <span className="text-gray-300 font-medium">{group.assets.length} NFT{group.assets.length > 1 ? 's' : ''}</span>
              {' · '}
              <span className="text-gray-300 font-medium">{group.totalQuantity} total</span>
            </div>
            {config?.description && (
              <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{config.description}</p>
            )}
          </div>
        </div>

        {/* Utility badges */}
        <UtilityBadges utility={config?.utility} />

        {/* Social links */}
        <SocialLinks config={config} />

        {/* Infrastructure panel */}
        <InfrastructurePanel config={config} />

        {/* Asset list (scrollable) */}
        <div className="mt-3 max-h-40 overflow-y-auto space-y-1 pr-1">
          {group.assets.slice(0, expanded ? undefined : 4).map(asset => (
            <div
              key={`${asset.policyId}-${asset.assetName}-${asset.fingerprint}`}
              onClick={() => onAssetClick?.(asset)}
              className={onAssetClick ? 'cursor-pointer' : ''}
            >
              <NFTAssetRow asset={asset} />
            </div>
          ))}
          {!expanded && group.assets.length > 4 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-center text-[11px] text-gray-500 hover:text-gray-300 py-1 transition-colors"
            >
              +{group.assets.length - 4} more · Click to expand
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-700/40">
          <span className="text-[10px] text-gray-600 font-mono truncate max-w-[60%]">
            Policy: {group.policyId.slice(0, 16)}...
          </span>
          <a
            href={`https://pool.pm/${group.policyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors"
          >
            pool.pm <ExternalLink size={8} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Grid of Collection Cards ─────────────────────────────────

export interface NFTCollectionGridProps {
  groups: ResolvedCollectionGroup[];
  onAssetClick?: (asset: ResolvedNFTAsset) => void;
  title?: string;
}

export function NFTCollectionGrid({ groups, onAssetClick, title }: NFTCollectionGridProps) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-blue-400" />
          <h4 className="font-semibold text-white">{title}</h4>
          <span className="text-xs text-gray-500">({groups.reduce((s, g) => s + g.assets.length, 0)} assets)</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => (
          <NFTCollectionCard
            key={group.policyId}
            group={group}
            onAssetClick={onAssetClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Asset Detail Modal ───────────────────────────────────────

export interface NFTAssetModalProps {
  asset: ResolvedNFTAsset | null;
  onClose: () => void;
}

export function NFTAssetModal({ asset, onClose }: NFTAssetModalProps) {
  if (!asset) return null;
  const meta = asset.metadata;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800"
        >
          <h3 className="text-sm font-bold text-white">{meta?.name || 'Asset Details'}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {/* Image */}
          {asset.imageUrl && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-800"
            >
              <IPFSImage
                src={asset.imageUrl}
                alt={meta?.name || asset.assetName}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            {meta?.description && (
              <p className="text-xs text-gray-400">{meta.description}</p>
            )}

            {/* Identity grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]"
            >
              <div className="p-2 rounded bg-gray-800/50">
                <div className="text-gray-500 mb-0.5">Policy ID</div>
                <div className="font-mono text-gray-300 break-all">{asset.policyId}</div>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <div className="text-gray-500 mb-0.5">Asset Name</div>
                <div className="font-mono text-gray-300 break-all">{asset.assetName}</div>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <div className="text-gray-500 mb-0.5">Fingerprint</div>
                <div className="font-mono text-gray-300 break-all">{asset.fingerprint}</div>
              </div>
              <div className="p-2 rounded bg-gray-800/50">
                <div className="text-gray-500 mb-0.5">Quantity</div>
                <div className="font-mono text-gray-300">{asset.quantity}</div>
              </div>
            </div>

            {/* Attributes */}
            {meta?.attributes && meta.attributes.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-gray-500 mb-1">Attributes</div>
                <div className="flex flex-wrap gap-1.5">
                  {meta.attributes.map((attr, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700"
                    >
                      <span className="text-gray-500">{attr.trait_type}: </span>
                      {String(attr.value)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {meta?.files && meta.files.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-gray-500 mb-1">Files</div>
                {meta.files.map((f, i) => (
                  <a
                    key={i}
                    href={f.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 block"
                  >
                    {f.name || f.mediaType || 'File'} <ExternalLink size={8} className="inline" />
                  </a>
                ))}
              </div>
            )}

            {/* Socials */}
            {(meta?.website || meta?.twitter) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {meta.website && (
                  <a href={meta.website} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    <Globe size={10} /> Website <ExternalLink size={8} />
                  </a>
                )}
                {meta.twitter && (
                  <a href={meta.twitter} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    <Twitter size={10} /> Twitter <ExternalLink size={8} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
