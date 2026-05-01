export type Address = `0x${string}`;

export interface IPaymentSigner {
  getAddress(): Promise<Address>;
  getChainId(): Promise<number>;
  switchNetwork(chainId: number, rpcUrl?: string): Promise<void>;
  sendErc20Transfer(args: { tokenAddress: Address; to: Address; amount: bigint }): Promise<{ txHash: Address }>;
  waitForConfirmations(args: { txHash: Address; confirmations: number }): Promise<void>;
}

export class PolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyDeniedError';
  }
}

export class UserRejectedError extends Error {
  constructor(message: string = 'User rejected the transaction approval request.') {
    super(message);
    this.name = 'UserRejectedError';
  }
}
