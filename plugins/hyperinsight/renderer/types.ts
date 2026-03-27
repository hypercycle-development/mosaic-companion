export interface NodeSearchParams {
    pageSize?: number;
    cursor?: number;
    sortBy?: string;
    onlineOnly?: boolean;
    gpuOnly?: boolean;
    gpuName?: string;
    minRam?: number;
    aimContains?: string;
}

export interface NodeEndpoint {
    url: string;
    type: string;
    isPrimary: boolean;
}

export interface RunningAimDetail {
    name: string;
    version: string | null;
    description: string | null;
}

export interface NodeDetail {
    licenseKey: string;
    name?: string;
    isAlive: boolean;
    cpuCount: number;
    gpuCount: number;
    ramBytes: number;
    vramBytes: number;
    hotWalletAddress: string | null;
    coldWalletAddress: string | null;
    platform: string | null;
    gpuName: string | null;
    uptimePercent: number | null;
    totalHeartbeats: number | null;
    lastContactAt: string | null;
    runningAims: RunningAimDetail[];
    endpoints: NodeEndpoint[];
}

export interface NodeSummary {
    licenseKey: string;
    name?: string;
    region?: string;
    isAlive: boolean;
    cpuCount: number;
    gpuCount: number;
    ramBytes: number;
    platform?: string;
    gpuName?: string;
    uptimePercent?: number;
    lastContactAt?: string;
    aimsCount: number;
}

// ── Aim Profile ────────────────────────────────────────────────────────────

export interface AimVersionSummaryDto {
    tagName: string;
    activeInstanceCount: number;
    firstSeen: string;
    lastSeen: string;
}

export interface AimStatsDto {
    activeNodes: number;
    totalComputeTflops: number;
    totalComputeCghz: number;
    totalRamBytes: number;
    totalVramBytes: number;
}

export interface AimProfileDto {
    id: number;
    name: string;
    namespace: string;
    description: string | null;
    pullCount: number;
    starCount: number;
    firstSeen: string;
    lastUpdated: string;
    dataFreshnessUtc: string;
    versionsTracked: number;
    latestStats: AimStatsDto | null;
    versions: AimVersionSummaryDto[];
    completenessScore: number | null;
}

export interface AimNodeInstanceDto {
    nodeId: string;
    nodeName: string | null;
    nodeLicense: number;
    region: string | null;
    tagName: string;
    isAlive: boolean;
    uptimePercent: number;
    gpuName: string | null;
    computeTflops: number;
    compositeScore: number | null;
    distanceKm: number | null;
    primaryEndpointUrl: string;
    lastContactAt: string;
}

export interface AimNodesOpts {
    version?: string;
    userLat?: number;
    userLng?: number;
}

// ── Manifest ────────────────────────────────────────────────────────────────

export interface ManifestCost {
    currency: string;
    min: number;
    max: number;
    estimated: number;
}

export interface ManifestExampleCall {
    method: string;
    body?: Record<string, unknown>;
    output?: Record<string, unknown>;
}

export interface ManifestEndpoint {
    uri: string;
    inputMethods: string[];
    documentation: string | null;
    inputBody: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
    isPublic?: boolean;
    currency?: string;
    costs?: ManifestCost[];
    exampleCalls?: ManifestExampleCall[];
}

// ── Node Profile ─────────────────────────────────────────────────────────────

export interface NodeStatusDto {
    isAlive: boolean;
    uptimePercent: number;
    totalHeartbeats: number;
}

export interface NodeHardwareDto {
    cpuCount: number;
    gpuCount: number;
    gpuName: string | null;
    ramBytes: number;
    vramBytes: number;
    diskSpaceBytes: number;
    diskSpaceFreeBytes: number;
    computeTflops: number;
    computeCghz: number;
    hotWalletAddress: string | null;
    coldWalletAddress: string | null;
    acceptingCurrencies: string[];
}

export interface NodeEndpointDto {
    url: string;
    endpointType: string;
    isPrimary: boolean;
    lastVerified: string | null;
}

export interface NodeRunningAimDto {
    aimId: number;
    aimName: string;
    aimNamespace: string;
    tagName: string;
    digest: string;
    deploymentStatus: string;
    deployedSince: string;
}

export interface UptimeDataPointDto {
    bucket: string;
    uptimePercent: number;
    isAlive: boolean;
}

export interface NodeRevenueDto {
    totalRevenueUsdc: number;
    revenueBySource: Array<{ source: string; total: number; chain: string }>;
    latestSnapshotTime: string | null;
}

export interface NodeProfileDto {
    licenseKey: number;
    name: string | null;
    nodeId: string;
    nodeVersion: string;
    platform: string;
    network: string;
    region: string | null;
    firstSeen: string;
    lastContactAt: string;
    dataFreshnessUtc: string;
    currentStatus: NodeStatusDto;
    hardware: NodeHardwareDto;
    endpoints: NodeEndpointDto[];
    runningAims: NodeRunningAimDto[];
    uptimeHistory: UptimeDataPointDto[];
    isRevenueIncluded: boolean;
    revenue: NodeRevenueDto | null;
    // Stage 7 additions (may be absent on older API responses):
    measuredUptime?: MeasuredUptimeDto[];
    nodeReportedUptimePercent?: number | null;
}

// ── Stage 7 ──────────────────────────────────────────────────────────────────

export interface MeasuredUptimeDto {
    windowType: string;       // "1d" | "7d" | "30d" | "60d"
    totalProbes: number;
    successfulProbes: number;
    uptimePercent: number;
    computedAt: string;
}

export interface AimDeploymentDto {
    endpointUrl: string;
    nodeLicense: number;
    nodeName: string | null;
    nodeRegion: string | null;
    compositeScore: number;
    healthScore: number;
    latencyScore: number;
    uptimeScore: number;
    hardwareBonus: number;
    pollTier: string;
    lastProbedAt: string | null;
    lastHealthyAt: string | null;
    consecutiveFailures: number;
    manifestVersion: string | null;
    releaseTagName: string | null;
    measuredUptime7d: number | null;
    currency: string | null;
    costMinMicroUsdc: number | null;
    costMaxMicroUsdc: number | null;
}

export interface ToolScoreData {
    compositeScore: number | null;
    healthScore: number | null;
    latencyScore: number | null;
    uptimeScore: number | null;
    consecutiveFailures: number;
    pollTier: string | null;
    lastProbedAt: string | null;
    status: string | null;
    measuredUptime7d: number | null;
    manifestVersion: string | null;
    releaseTagName: string | null;
    updatedAt: string;
}

export interface SubscribePayload {
    endpointUrl: string;
    aimId?: number;
    nodeLicense?: number;
}

export interface SubscriptionDto {
    id: string;
    endpointUrl: string;
    aimId: number | null;
    nodeLicense: number | null;
    status: 'pending' | 'active' | 'degraded' | 'disconnected' | 'failed';
    subscribedAt: string;
    lastVerifiedAt: string | null;
}

export interface VerificationEventDto {
    time: string;
    probeType: string;
    httpStatus: number | null;
    latencyMs: number | null;
    isHealthy: boolean;
    errorMessage: string | null;
}
