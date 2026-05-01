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
