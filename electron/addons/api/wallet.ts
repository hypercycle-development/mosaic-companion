/**
 * `addonAPI.wallet` — `wallet:read`. Calls the same underlying
 * functions the `tools:execute web3:*` path uses (`getWalletAddress`,
 * `fetchNativeBalance`, `fetchTokenBalance`, `getActiveNetwork`) — never the
 * raw wallet key itself. No signing surface in v1: when `wallet:sign`
 * ships it must route through the payments-jit approval-modal path, not a
 * raw signing method added here.
 */

import { getWalletAddress } from "../../integrations/web3/index";
import { getActiveNetwork, getTokens } from "../../integrations/web3/config";
import { fetchNativeBalance, fetchTokenBalance } from "../../integrations/tools/modules/web3";
import { ApiValidationError, type ApiNamespace } from "./types";

export const methods: ApiNamespace = {
  getAddress: {
    permission: "wallet:read",
    handler: () => getWalletAddress(),
  },
  getBalance: {
    permission: "wallet:read",
    handler: async (_ctx, tokenSymbolArg) => {
      if (tokenSymbolArg !== undefined && typeof tokenSymbolArg !== "string") {
        throw new ApiValidationError("tokenSymbol must be a string if present");
      }
      const tokenSymbol = typeof tokenSymbolArg === "string" ? tokenSymbolArg : undefined;
      const address = getWalletAddress();
      if (!address) return null;

      if (!tokenSymbol || tokenSymbol.toUpperCase() === "ETH") {
        const { balance } = await fetchNativeBalance(address);
        return { symbol: "ETH", balance, decimals: 18 };
      }

      const token = getTokens().find((t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());
      if (!token) {
        throw new ApiValidationError(`Unknown token "${tokenSymbol}"`);
      }
      const { balance } = await fetchTokenBalance(address, token);
      return { symbol: token.symbol, balance, decimals: token.decimals };
    },
  },
  getNetworkInfo: {
    permission: "wallet:read",
    handler: () => {
      const network = getActiveNetwork();
      return {
        networkId: network.id,
        chainId: network.chainId,
        name: network.name,
        rpcConfigured: Boolean(network.customRpcUrl || network.rpcUrl),
      };
    },
  },
};
