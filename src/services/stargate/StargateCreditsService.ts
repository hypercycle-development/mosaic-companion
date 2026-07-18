// ============================================
// STARGATE - Credits Service (Beta Payment Ledger)
// In-memory + localStorage credits tracking for AIM usage
// ============================================

class StargateCreditsService {
  private balance = 0;
  private transactions: Array<{
    id: string;
    type: 'deposit' | 'deduct' | 'refund';
    amount: number;
    aimName?: string;
    description?: string;
    timestamp: number;
  }> = [];

  constructor() {
    this.loadPersisted();
  }

  private loadPersisted(): void {
    try {
      const raw = localStorage.getItem('stargate_credits_balance');
      if (raw) this.balance = parseFloat(raw);
      const txRaw = localStorage.getItem('stargate_credits_transactions');
      if (txRaw) this.transactions = JSON.parse(txRaw);
    } catch {
      console.warn('[StargateCredits] Failed to load persisted data');
    }
  }

  private persist(): void {
    try {
      localStorage.setItem('stargate_credits_balance', this.balance.toFixed(6));
      localStorage.setItem('stargate_credits_transactions', JSON.stringify(this.transactions.slice(-200)));
    } catch {
      console.warn('[StargateCredits] Failed to persist data');
    }
  }

  getBalance(): number {
    return this.balance;
  }

  /** Add credits (e.g. manual top-up, payment received) */
  deposit(amount: number, description?: string): void {
    if (amount <= 0) return;
    this.balance += amount;
    this.transactions.push({
      id: `tx_${Date.now()}`,
      type: 'deposit',
      amount,
      description: description || 'Deposit',
      timestamp: Date.now(),
    });
    this.persist();
  }

  /** Deduct credits on AIM call */
  deduct(amount: number, aimName?: string): void {
    if (amount <= 0) return;
    if (this.balance < amount) {
      throw new Error(`Insufficient credits: ${this.balance.toFixed(4)} < ${amount.toFixed(4)}`);
    }
    this.balance = Math.max(0, this.balance - amount);
    this.transactions.push({
      id: `tx_${Date.now()}`,
      type: 'deduct',
      amount,
      aimName,
      description: `AIM usage: ${aimName || 'unknown'}`,
      timestamp: Date.now(),
    });
    this.persist();
  }

  /** Refund credits on failed call */
  refund(amount: number, aimName?: string): void {
    if (amount <= 0) return;
    this.balance += amount;
    this.transactions.push({
      id: `tx_${Date.now()}`,
      type: 'refund',
      amount,
      aimName,
      description: `Refund for: ${aimName || 'unknown'}`,
      timestamp: Date.now(),
    });
    this.persist();
  }

  getTransactionHistory() {
    return [...this.transactions].reverse();
  }

  getStats(): { totalDeposited: number; totalSpent: number; totalRefunded: number } {
    return this.transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'deposit') acc.totalDeposited += tx.amount;
        if (tx.type === 'deduct') acc.totalSpent += tx.amount;
        if (tx.type === 'refund') acc.totalRefunded += tx.amount;
        return acc;
      },
      { totalDeposited: 0, totalSpent: 0, totalRefunded: 0 }
    );
  }
}

export const stargateCredits = new StargateCreditsService();
export default StargateCreditsService;
