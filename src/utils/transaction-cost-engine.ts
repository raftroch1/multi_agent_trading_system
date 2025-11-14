/**
 * INSTITUTIONAL-GRADE TRANSACTION COST MODELING
 * Models realistic trading costs, slippage, and market impact
 */

export interface TransactionCosts {
  commission: number; // Per contract commission
  regulatory: number; // SEC/OCC fees 
  slippage: number; // Market impact cost
  bidAskSpread: number; // Half spread cost
  total: number; // Total transaction cost
}

export interface FillSimulation {
  requestedPrice: number; // Price we wanted
  executedPrice: number; // Price we actually got
  slippageBps: number; // Slippage in basis points
  costs: TransactionCosts;
}

export class TransactionCostEngine {
  
  // COMMISSION STRUCTURE (typical retail broker)
  private static readonly COMMISSION_PER_CONTRACT = 0.65; // $0.65 per options contract
  private static readonly REGULATORY_FEES = 0.0221; // SEC/OCC fees per $100 notional
  private static readonly MIN_COMMISSION = 0.50; // Minimum per order
  
  /**
   * Simulate realistic fill for options trade
   */
  static simulateFill(
    side: 'BUY' | 'SELL',
    bid: number,
    ask: number,
    quantity: number,
    marketCondition: 'NORMAL' | 'VOLATILE' | 'ILLIQUID' = 'NORMAL'
  ): FillSimulation {
    
    const midPrice = (bid + ask) / 2;
    const spread = ask - bid;
    
    // Calculate slippage based on market conditions
    const slippageMultiplier = this.getSlippageMultiplier(marketCondition, quantity);
    
    let executedPrice: number;
    let slippageBps: number;
    
    if (side === 'BUY') {
      // Buying: pay closer to ask, plus slippage
      const basePrice = bid + (spread * 0.7); // 70% toward ask
      const slippageAmount = spread * slippageMultiplier;
      executedPrice = Math.min(ask, basePrice + slippageAmount);
      slippageBps = ((executedPrice - midPrice) / midPrice) * 10000;
    } else {
      // Selling: receive closer to bid, minus slippage  
      const basePrice = ask - (spread * 0.7); // 70% toward bid
      const slippageAmount = spread * slippageMultiplier;
      executedPrice = Math.max(bid, basePrice - slippageAmount);
      slippageBps = ((midPrice - executedPrice) / midPrice) * 10000;
    }
    
    // Calculate transaction costs
    const costs = this.calculateCosts(executedPrice, quantity);
    
    return {
      requestedPrice: side === 'BUY' ? ask : bid,
      executedPrice: Math.round(executedPrice * 100) / 100, // Round to penny
      slippageBps: Math.round(slippageBps),
      costs
    };
  }
  
  /**
   * Get slippage multiplier based on market conditions
   */
  private static getSlippageMultiplier(
    condition: 'NORMAL' | 'VOLATILE' | 'ILLIQUID',
    quantity: number
  ): number {
    
    let baseSlippage: number;
    
    switch (condition) {
      case 'NORMAL':
        baseSlippage = 0.1; // 10% of spread
        break;
      case 'VOLATILE':
        baseSlippage = 0.25; // 25% of spread during high vol
        break;
      case 'ILLIQUID':
        baseSlippage = 0.4; // 40% of spread for illiquid options
        break;
    }
    
    // Size penalty: larger trades get worse fills
    const sizePenalty = Math.min(0.2, quantity / 50); // Up to 20% penalty for 50+ contracts
    
    return baseSlippage + sizePenalty;
  }
  
  /**
   * Calculate comprehensive transaction costs
   */
  private static calculateCosts(price: number, quantity: number): TransactionCosts {
    
    // Commission (per contract)
    const commission = Math.max(
      this.MIN_COMMISSION,
      quantity * this.COMMISSION_PER_CONTRACT
    );
    
    // Regulatory fees (SEC/OCC)
    const notionalValue = price * quantity * 100; // Options are 100 shares
    const regulatory = (notionalValue / 100) * this.REGULATORY_FEES;
    
    // Bid-ask spread cost (embedded in execution price)
    const bidAskSpread = 0; // Already accounted for in fill simulation
    
    // Market impact/slippage (embedded in execution price)
    const slippage = 0; // Already accounted for in fill simulation
    
    const total = commission + regulatory + bidAskSpread + slippage;
    
    return {
      commission: Math.round(commission * 100) / 100,
      regulatory: Math.round(regulatory * 100) / 100,
      slippage,
      bidAskSpread,
      total: Math.round(total * 100) / 100
    };
  }
  
  /**
   * Determine market condition based on indicators
   */
  static determineMarketCondition(
    vixLevel?: number,
    bidAskSpread?: number,
    volume?: number
  ): 'NORMAL' | 'VOLATILE' | 'ILLIQUID' {
    
    // VIX-based volatility
    if (vixLevel && vixLevel > 25) {
      return 'VOLATILE';
    }
    
    // Wide spreads indicate illiquidity
    if (bidAskSpread && bidAskSpread > 0.10) { // > $0.10 spread
      return 'ILLIQUID';
    }
    
    // Low volume indicates illiquidity  
    if (volume !== undefined && volume < 10) {
      return 'ILLIQUID';
    }
    
    return 'NORMAL';
  }
  
  /**
   * Calculate total round-trip cost for a spread trade
   */
  static calculateSpreadCosts(
    legs: Array<{
      side: 'BUY' | 'SELL';
      bid: number;
      ask: number;
      quantity: number;
    }>,
    marketCondition: 'NORMAL' | 'VOLATILE' | 'ILLIQUID' = 'NORMAL'
  ): { fills: FillSimulation[]; totalCost: number; totalSlippage: number } {
    
    const fills: FillSimulation[] = [];
    let totalCost = 0;
    let totalSlippage = 0;
    
    for (const leg of legs) {
      const fill = this.simulateFill(
        leg.side,
        leg.bid,
        leg.ask,
        leg.quantity,
        marketCondition
      );
      
      fills.push(fill);
      totalCost += fill.costs.total;
      totalSlippage += Math.abs(fill.slippageBps);
    }
    
    return {
      fills,
      totalCost: Math.round(totalCost * 100) / 100,
      totalSlippage: Math.round(totalSlippage)
    };
  }
}