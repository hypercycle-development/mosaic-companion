import React, { useState } from "react";
import { toast } from "react-toastify";
import type { AIAgentConfig } from "../types/ai";
import {
  fetchHypercycleNodeInfo,
  HYPERCYCLE_TODA_TDN_TYPE_HASH,
  registerHypercycleBalance,
  resolveTodaBalanceTxIdFromHypercycleNode,
} from "../services/hypercycleAgent";

function parseEvmTxHashFromToolData(data: unknown): string | null {
  if (typeof data !== "string") return null;
  const m = /Tx Hash:\s*(0x[a-fA-F0-9]+)/i.exec(data);
  return m?.[1] ?? null;
}

/** First `entryFiles` line from tool summary (Twin / binder). */
function parseEntryFileIdFromTodaToolData(data: unknown): string | null {
  const s = typeof data === "string" ? data : null;
  if (!s) return null;
  const m = /Entry file \(balance tx-id\):\s*([^\s\n]+)/i.exec(s);
  return m?.[1]?.trim() ?? null;
}

function parseTransferIdFromTodaSummary(s: string): string | null {
  const m = /Transfer ID:\s*([^\s\n]+)/i.exec(s);
  const id = m?.[1]?.trim();
  if (!id || id.toUpperCase() === "N/A") return null;
  return id;
}

/** USDC uses 6 decimals on Base; raw integer matches gateway tx-value / register. */
const USDC_SMALLEST_UNIT_DIVISOR = 1_000_000;

/** TDN uses 3 decimals; raw integer matches gateway tx-value / register. */
const TDN_SMALLEST_UNIT_DIVISOR = 1_000;

export function HypercycleBalancePanel({ agent }: { agent: AIAgentConfig }) {
  const [amountRaw, setAmountRaw] = useState("");
  const [txId, setTxId] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [tmPreview, setTmPreview] = useState<string | null>(null);
  const [tmHostAddr, setTmHostAddr] = useState<string | null>(null);
  const [tmEvm, setTmEvm] = useState<string | null>(null);
  const [baseRecipient, setBaseRecipient] = useState("");
  const [busy, setBusy] = useState<
    "idle" | "info" | "register" | "binder" | "transfer"
  >("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const runLoadInfo = async () => {
    setMsg(null);
    setBusy("info");
    try {
      const r = await fetchHypercycleNodeInfo(agent);
      if (!r.ok) {
        setTmPreview(null);
        setTmHostAddr(null);
        setTmEvm(null);
        setMsg(`GET /info failed (${r.status})`);
        return;
      }
      setTmPreview(r.tm ?? null);
      setTmHostAddr(r.tmHostAddress ?? null);
      setTmEvm(r.tmEvmRecipient ?? null);
      setBaseRecipient((prev) =>
        r.tmEvmRecipient?.trim() ? r.tmEvmRecipient.trim() : prev,
      );
      if (r.tm?.trim()) {
        setMsg(null);
      } else {
        setMsg(
          "Could not read tx-sender from `tm` (expected string or object with `address`).",
        );
      }
    } catch (e) {
      setTmPreview(null);
      setTmHostAddr(null);
      setTmEvm(null);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const runSendFromMosaic = async () => {
    const exec = window.electronAPI?.tools?.execute;
    if (!exec) {
      toast.error("Web3 tools are not available.");
      return;
    }
    const raw = amountRaw.trim();
    if (!/^\d+$/.test(raw) || raw === "0") {
      setMsg(
        "Enter a positive integer amount (smallest units, same as tx-value).",
      );
      return;
    }
    setMsg(null);
    setBusy("transfer");
    try {
      if (agent.hypercycleBackend === "basechain") {
        const to = (baseRecipient.trim() || tmEvm?.trim() || "").trim();
        if (!/^0x[a-fA-F0-9]{40}$/i.test(to)) {
          setMsg(
            "Set a valid 0x USDC recipient (from Load Address or paste manually).",
          );
          setBusy("idle");
          return;
        }
        const rawNum = parseInt(raw, 10);
        const humanUsdc =
          (rawNum / USDC_SMALLEST_UNIT_DIVISOR).toFixed(6).replace(/\.?0+$/, "") ||
          "0";
        const r = await exec("web3:transfer_token", {
          to,
          amount: humanUsdc,
          token: "USDC",
          confirmed: true,
        });
        if (!r.success) {
          setMsg(r.error ?? "USDC transfer failed.");
          toast.error(r.error ?? "Transfer failed");
          return;
        }
        const hash = parseEvmTxHashFromToolData(r.data);
        if (hash) setTxId(hash);
        toast.success("USDC transfer submitted.");
        setMsg(
          hash
            ? "USDC sent. tx-id filled for registration."
            : String(
                r.data ??
                  "USDC sent — copy the tx hash into tx-id if needed.",
              ),
        );
      } else {
        const to = tmHostAddr?.trim();
        if (!to) {
          setMsg(
            "Load Address first — the node must return tm.host_address to send TDN from MosAIc.",
          );
          toast.error("Missing Twin URL (tm.host_address)");
          return;
        }
        const rawNum = parseInt(raw, 10);
        const humanTdn =
          (rawNum / TDN_SMALLEST_UNIT_DIVISOR).toFixed(3).replace(/\.?0+$/, "") ||
          "0";
        const r = await exec("web3:transfer_toda", {
          to,
          amount: humanTdn,
          typeHash: HYPERCYCLE_TODA_TDN_TYPE_HASH,
          confirmed: true,
        });
        if (!r.success) {
          setMsg(r.error ?? "TDN transfer failed.");
          toast.error(r.error ?? "Transfer failed");
          return;
        }
        const payload = r.data;
        let txIdToSet: string | null = null;
        const tryResolveBinder = async (ref: string) => {
          try {
            return await resolveTodaBalanceTxIdFromHypercycleNode(agent, ref);
          } catch {
            return null;
          }
        };
        const fillFromSummary = async (summary: string) => {
          const fromFile = parseEntryFileIdFromTodaToolData(summary);
          if (fromFile) return fromFile;
          const tid = parseTransferIdFromTodaSummary(summary);
          if (tid) return tryResolveBinder(tid);
          return null;
        };
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const o = payload as Record<string, unknown>;
          if (typeof o.entryFileId === "string" && o.entryFileId.trim()) {
            txIdToSet = o.entryFileId.trim();
          } else if (
            typeof o.transferId === "string" &&
            o.transferId.trim() &&
            o.transferId.toUpperCase() !== "N/A"
          ) {
            txIdToSet = await tryResolveBinder(o.transferId.trim());
          }
          if (!txIdToSet && typeof o.summary === "string") {
            txIdToSet = await fillFromSummary(o.summary);
          }
        } else if (typeof payload === "string") {
          txIdToSet = await fillFromSummary(payload);
        }
        if (txIdToSet) setTxId(txIdToSet);
        toast.success("TDN transfer submitted.");
        setMsg(
          txIdToSet
            ? "TDN sent — tx-id filled (entryFiles / binder)."
            : "TDN sent — paste tx-id from the binder or use Resolve with a transfer reference.",
        );
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMsg(err);
      toast.error(err);
    } finally {
      setBusy("idle");
    }
  };

  const runRegister = async () => {
    setMsg(null);
    setBusy("register");
    try {
      const r = await registerHypercycleBalance(agent, {
        txValue: amountRaw.trim(),
        txId: txId.trim(),
      });
      if (r.ok) {
        setMsg("Balance registered.");
        toast.success("Balance registered.");
      } else {
        setMsg(
          `POST /balance failed (${r.status}): ${r.rawText.slice(0, 400)}`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const runResolveBinder = async () => {
    if (agent.hypercycleBackend === "basechain") {
      setMsg("Binder resolve is for TODA only.");
      return;
    }
    setMsg(null);
    setBusy("binder");
    try {
      const r = await resolveTodaBalanceTxIdFromHypercycleNode(
        agent,
        transferRef.trim(),
      );
      setTxId(r);
      setMsg("Filled tx-id from node binder.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const isBusy = busy !== "idle";

  return (
    <div className="border border-gray-800 rounded-lg p-3 space-y-3 bg-gray-950/50">
      <div className="text-sm text-gray-300 font-medium">
        Fund and register balance
      </div>
      {tmPreview && (
        <p className="text-xs text-gray-500 font-mono break-all">
          <span className="text-gray-600">Address (tx-sender): </span>
          {tmPreview}
        </p>
      )}
      {tmHostAddr && agent.hypercycleBackend !== "basechain" && (
        <p className="text-xs text-gray-500 font-mono break-all">
          <span className="text-gray-600">Twin URL (send TDN): </span>
          {tmHostAddr}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runLoadInfo}
          disabled={isBusy}
          className="px-3 py-1.5 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
        >
          {busy === "info" ? "Loading…" : "Load Address"}
        </button>
      </div>

      <div className="border-t border-gray-800 pt-3 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">Amount (smallest units)</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value.replace(/\D/g, ""))}
            className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
            placeholder="e.g. 500000"
          />
          {amountRaw.trim() &&
            /^\d+$/.test(amountRaw.trim()) &&
            amountRaw.trim() !== "0" && (
              <p className="text-xs text-gray-600 mt-1">
                {agent.hypercycleBackend === "basechain" ? (
                  <>
                    Equivalence:{" "}
                    <span className="font-mono text-gray-500">{amountRaw}</span>{" "}
                    →{" "}
                    <span className="font-mono text-gray-500">
                      {(
                        Number(amountRaw) / USDC_SMALLEST_UNIT_DIVISOR
                      ).toFixed(6).replace(/\.?0+$/, "") || "0"}
                    </span>{" "}
                    USDC (6 decimals). Same integer as tx-value for register.
                  </>
                ) : (
                  <>
                    Equivalence:{" "}
                    <span className="font-mono text-gray-500">{amountRaw}</span>{" "}
                    →{" "}
                    <span className="font-mono text-gray-500">
                      {(
                        Number(amountRaw) / TDN_SMALLEST_UNIT_DIVISOR
                      ).toFixed(3).replace(/\.?0+$/, "") || "0"}
                    </span>{" "}
                    TDN (3 decimals). Same integer as tx-value for register.
                  </>
                )}
              </p>
            )}
        </label>

        <div className="text-xs text-gray-500 font-medium">Send from MosAIc</div>
        {agent.hypercycleBackend === "basechain" && (
          <label className="block">
            <span className="text-xs text-gray-500">USDC recipient (0x)</span>
            <input
              type="text"
              value={baseRecipient}
              onChange={(e) => setBaseRecipient(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
              placeholder={
                tmEvm
                  ? tmEvm
                  : "Paste node deposit address if not filled from /info"
              }
            />
          </label>
        )}
        <button
          type="button"
          onClick={runSendFromMosaic}
          disabled={isBusy || !amountRaw.trim() || amountRaw.trim() === "0"}
          className="px-3 py-2 text-sm rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "transfer"
            ? "Sending…"
            : agent.hypercycleBackend === "basechain"
              ? "Send USDC"
              : "Send TDN"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
        <label className="block col-span-2">
          <span className="text-xs text-gray-500">tx-id (register)</span>
          <input
            type="text"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
            placeholder={
              agent.hypercycleBackend === "basechain"
                ? "0x… transaction hash"
                : "Entry file id or transfer id"
            }
          />
        </label>
        {agent.hypercycleBackend !== "basechain" && (
          <label className="block col-span-2">
            <span className="text-xs text-gray-500">
              TODA: optional binder resolve
            </span>
            <div className="flex gap-2 mt-0.5">
              <input
                type="text"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
                placeholder="transfer or reference id"
              />
              <button
                type="button"
                onClick={runResolveBinder}
                disabled={isBusy || !transferRef.trim()}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 whitespace-nowrap"
              >
                {busy === "binder" ? "…" : "Resolve tx-id"}
              </button>
            </div>
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={runRegister}
        disabled={
          isBusy ||
          !amountRaw.trim() ||
          amountRaw.trim() === "0" ||
          !txId.trim()
        }
        className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === "register" ? "Registering…" : "Register balance"}
      </button>
      {msg && (
        <p className="text-xs text-gray-400 whitespace-pre-wrap">{msg}</p>
      )}
    </div>
  );
}
