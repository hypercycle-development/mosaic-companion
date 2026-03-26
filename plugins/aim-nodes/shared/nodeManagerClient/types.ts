export type Address = `0x${string}`;

export interface INodeSigner {
  getAddress(): Promise<Address>;
  signMessage(message: string): Promise<Address>;
}

export interface NodeInfo {
  protocol_version?: string;
  tm?: {
    address?: string;
    driver?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface NodeManagerClientOptions {
  baseUrl: string;
  mode: "frontend_hypercyclejs" | "backend_viem";
  signer?: INodeSigner;
  fetchImpl?: typeof fetch;
  defaultCurrencyType?: string;
  defaultTxDriver?: string;
  logger?: any; // ILogger
}

export interface CallAimArgs<TReq = any> {
  slot: number;
  actionPath: string;
  method?: "POST" | "GET";
  payload?: TReq;
  extraHeaders?: Record<string, string>;
  currencyType?: string;
  txDriver?: string;
  costOnly?: boolean;
  timeoutMs?: number;
  sender?: Address; // Required for frontend mode unless handled externally
}
