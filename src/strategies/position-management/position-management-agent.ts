/**
 * POSITION MANAGEMENT AGENT
 *
 * Handles automated position monitoring, profit taking, and stop loss management
 * for 0-DTE options trading strategies
 */

import { Trade, Position, MarketData, OptionsChain } from '../../types';

export interface PositionManagementSettings {
  // Profit targets
  profitTargetPercent: number;        // Default: 50% profit target
  partialProfitLevels: number[];     // Array: [25%, 50%, 75%] for partial sells
  partialProfitSizes: number[];      // Array: [0.25, 0.25, 0.25] - fractions to sell at each level

  // Stop losses
  stopLossPercent: number;           // Default: 30% stop loss
  maxLossPercent: number;            // Maximum loss before forced liquidation

  // Time-based exits for 0-DTE
  minutesBeforeClose: number;        // Exit X minutes before market close
  maxHoldTimeMinutes: number;        // Maximum time to hold position

  // Greeks-based exits
  maxDeltaExposure: number;          // Maximum delta exposure per position
  maxThetaBurnRate: number;          // Maximum theta decay per minute

  // Volatility-based exits
  volatilityStopLoss: boolean;       // Use volatility for dynamic stops
  impliedVolatilityThreshold: number; // Exit if IV exceeds threshold

  // Position sizing
  maxPositionSize: number;           // Maximum position size in dollars
  maxPositionsAtOnce: number;        // Maximum concurrent positions

  // Risk management
  maxDailyLoss: number;              // Maximum daily loss amount
  maxRiskPerTrade: number;           // Maximum risk per trade (% of portfolio)
}

export interface PositionStatus {
  positionId: string;
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  timeToExpiration: number;         // Minutes until expiration
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  riskMetrics: {
    profitTarget: number;
    stopLoss: number;
    timeExitTime: Date;
    isAtRisk: boolean;
    riskFactors: string[];
  };
  actions: {
    shouldSellPartial: boolean;
    shouldSellFull: boolean;
    shouldAdjustStop: boolean;
    urgentExit: boolean;
  };
  status: 'PROFIT_TARGET' | 'STOP_LOSS' | 'TIME_EXIT' | 'GREEKS_RISK' | 'HOLDING' | 'URGENT_EXIT';
  lastUpdate: Date;
}

export interface PositionManagementDecision {
  action: 'HOLD' | 'SELL_PARTIAL' | 'SELL_FULL' | 'ADJUST_STOPS' | 'URGENT_EXIT';
  quantity?: number;                 // For partial sells
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  newStopLoss?: number;
  newProfitTarget?: number;
  positionId?: string;               // ID of the position this decision applies to
}

/**
 * Position Management Agent for automated trade lifecycle management
 */
export class PositionManagementAgent {
  private static readonly DEFAULT_SETTINGS: PositionManagementSettings = {
    // 0-DTE optimized profit targets
    profitTargetPercent: 50,         // 50% profit target for 0-DTE
    partialProfitLevels: [25, 50, 75], // Take profits at 25%, 50%, 75%
    partialProfitSizes: [0.3, 0.3, 0.2], // Sell 30%, 30%, then 20% (keep 20% for home run)

    // Stop losses optimized for 0-DTE
    stopLossPercent: 30,            // 30% stop loss
    maxLossPercent: 40,             // Force liquidation at 40% loss

    // Time-based exits (critical for 0-DTE)
    minutesBeforeClose: 30,         // Exit 30 minutes before close
    maxHoldTimeMinutes: 240,        // Max 4 hours hold time

    // Greeks-based risk management
    maxDeltaExposure: 50,           // Max delta per position
    maxThetaBurnRate: 100,          // Max $100/minute theta decay

    // Volatility exits
    volatilityStopLoss: true,
    impliedVolatilityThreshold: 2.0, // Exit if IV > 200%

    // Position sizing
    maxPositionSize: 1000,          // $1000 max per position
    maxPositionsAtOnce: 3,          // Max 3 positions at once

    // Risk management
    maxDailyLoss: 500,              // $500 max daily loss
    maxRiskPerTrade: 2,             // 2% max risk per trade
  };

  /**
   * Analyze all open positions and provide management decisions
   */
  static analyzePositions(
    positions: Position[],
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    customSettings?: Partial<PositionManagementSettings>
  ): {
    positionsStatus: PositionStatus[];
    decisions: PositionManagementDecision[];
    portfolioRisk: {
      totalPnL: number;
      totalRisk: number;
      riskFactors: string[];
      recommendations: string[];
    };
  } {
    const settings = { ...this.DEFAULT_SETTINGS, ...customSettings };
    const positionsStatus: PositionStatus[] = [];
    const decisions: PositionManagementDecision[] = [];

    console.log('🔍 POSITION MANAGEMENT AGENT - ANALYZING POSITIONS');
    console.log(`==================================================`);
    console.log(`Open Positions: ${positions.length}`);
    console.log(`Settings: Profit Target: ${settings.profitTargetPercent}%, Stop Loss: ${settings.stopLossPercent}%`);

    for (const position of positions) {
      const status = this.analyzePosition(position, marketData, optionsChain, settings);
      positionsStatus.push(status);

      const decision = this.makeDecision(status, settings);
      if (decision.action !== 'HOLD') {
        decisions.push(decision);
      }
    }

    // Calculate portfolio-level risk
    const portfolioRisk = this.calculatePortfolioRisk(positionsStatus, settings);

    console.log(`📊 POSITION ANALYSIS COMPLETE:`);
    console.log(`   Total P&L: $${portfolioRisk.totalPnL.toFixed(2)}`);
    console.log(`   Actions Required: ${decisions.length}`);
    console.log(`   Risk Factors: ${portfolioRisk.riskFactors.length}`);

    return {
      positionsStatus,
      decisions,
      portfolioRisk
    };
  }

  /**
   * Analyze individual position status and risk factors
   */
  private static analyzePosition(
    position: Position,
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    settings: PositionManagementSettings
  ): PositionStatus {
    const currentPrice = this.getCurrentOptionPrice(position, optionsChain);
    const entryPrice = position.entryPrice;
    const unrealizedPnL = (currentPrice - entryPrice) * position.quantity;
    const unrealizedPnLPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

    // Calculate time to expiration (critical for 0-DTE)
    const now = new Date();
    const expiration = new Date(position.expiration);
    const timeToExpiration = (expiration.getTime() - now.getTime()) / (1000 * 60); // Minutes

    // Get current Greeks
    const greeks = this.calculatePositionGreeks(position, optionsChain);

    // Calculate risk metrics
    const profitTarget = entryPrice * (1 + settings.profitTargetPercent / 100);
    const stopLoss = entryPrice * (1 - settings.stopLossPercent / 100);

    // Calculate time-based exit
    const marketClose = this.getMarketCloseTime();
    const timeExitTime = new Date(marketClose.getTime() - settings.minutesBeforeClose * 60 * 1000);

    // Risk factors assessment
    const riskFactors: string[] = [];
    let isAtRisk = false;

    // Profit/Loss risk
    if (unrealizedPnLPercent <= -settings.stopLossPercent) {
      riskFactors.push(`Stop loss triggered: ${unrealizedPnLPercent.toFixed(1)}%`);
      isAtRisk = true;
    }

    if (unrealizedPnLPercent >= settings.profitTargetPercent) {
      riskFactors.push(`Profit target reached: ${unrealizedPnLPercent.toFixed(1)}%`);
    }

    // Time risk (critical for 0-DTE)
    if (timeToExpiration < settings.minutesBeforeClose) {
      riskFactors.push(`Time critical: ${timeToExpiration.toFixed(0)} min until expiration`);
      isAtRisk = true;
    }

    if (timeToExpiration < 15) { // Less than 15 minutes
      riskFactors.push(`URGENT: Less than 15 minutes to expiration`);
      isAtRisk = true;
    }

    // Greeks risk
    if (Math.abs(greeks.delta) > settings.maxDeltaExposure) {
      riskFactors.push(`High delta exposure: ${greeks.delta.toFixed(1)}`);
      isAtRisk = true;
    }

    if (Math.abs(greeks.theta) > settings.maxThetaBurnRate) {
      riskFactors.push(`High theta decay: $${greeks.theta.toFixed(0)}/min`);
      isAtRisk = true;
    }

    // Determine actions
    const actions = {
      shouldSellPartial: this.shouldSellPartial(unrealizedPnLPercent, settings),
      shouldSellFull: this.shouldSellFull(unrealizedPnLPercent, timeToExpiration, settings),
      shouldAdjustStop: this.shouldAdjustStops(unrealizedPnLPercent, settings),
      urgentExit: this.shouldUrgentExit(unrealizedPnLPercent, timeToExpiration, riskFactors, settings)
    };

    // Determine status
    let status: PositionStatus['status'] = 'HOLDING';
    if (actions.urgentExit) {
      status = 'URGENT_EXIT';
    } else if (unrealizedPnLPercent <= -settings.stopLossPercent) {
      status = 'STOP_LOSS';
    } else if (unrealizedPnLPercent >= settings.profitTargetPercent) {
      status = 'PROFIT_TARGET';
    } else if (timeToExpiration < settings.minutesBeforeClose) {
      status = 'TIME_EXIT';
    } else if (isAtRisk) {
      status = 'GREEKS_RISK';
    }

    return {
      positionId: position.id || `${position.symbol}_${position.strike}_${position.side}`,
      symbol: position.symbol,
      side: position.side,
      strike: position.strike,
      expiration,
      entryPrice,
      currentPrice,
      quantity: position.quantity,
      unrealizedPnL,
      unrealizedPnLPercent,
      timeToExpiration,
      greeks,
      riskMetrics: {
        profitTarget,
        stopLoss,
        timeExitTime,
        isAtRisk,
        riskFactors
      },
      actions,
      status,
      lastUpdate: new Date()
    };
  }

  /**
   * Make position management decision based on analysis
   */
  private static makeDecision(
    status: PositionStatus,
    settings: PositionManagementSettings
  ): PositionManagementDecision {
    // Urgent exit takes priority
    if (status.actions.urgentExit) {
      return {
        action: 'URGENT_EXIT',
        quantity: status.quantity,
        reason: `URGENT: ${status.riskMetrics.riskFactors.join('; ')}`,
        urgency: 'CRITICAL'
      };
    }

    // Check stop loss
    if (status.unrealizedPnLPercent <= -settings.stopLossPercent) {
      return {
        action: 'SELL_FULL',
        quantity: status.quantity,
        reason: `Stop loss triggered at ${status.unrealizedPnLPercent.toFixed(1)}% loss`,
        urgency: 'HIGH'
      };
    }

    // Check profit taking (partial first)
    if (status.actions.shouldSellPartial) {
      const partialQuantity = Math.floor(status.quantity * 0.3); // Sell 30%
      return {
        action: 'SELL_PARTIAL',
        quantity: partialQuantity,
        reason: `Partial profit taking at ${status.unrealizedPnLPercent.toFixed(1)}% gain`,
        urgency: 'MEDIUM'
      };
    }

    // Check full profit target
    if (status.actions.shouldSellFull) {
      return {
        action: 'SELL_FULL',
        quantity: status.quantity,
        reason: `Profit target reached at ${status.unrealizedPnLPercent.toFixed(1)}% gain`,
        urgency: 'MEDIUM'
      };
    }

    // Time-based exit
    if (status.timeToExpiration < settings.minutesBeforeClose) {
      return {
        action: 'SELL_FULL',
        quantity: status.quantity,
        reason: `Time-based exit: ${status.timeToExpiration.toFixed(0)} minutes until expiration`,
        urgency: 'HIGH'
      };
    }

    // Greeks risk management
    if (status.status === 'GREEKS_RISK') {
      return {
        action: 'SELL_FULL',
        quantity: status.quantity,
        reason: `Greeks risk: ${status.riskMetrics.riskFactors.join('; ')}`,
        urgency: 'HIGH'
      };
    }

    // Default: hold
    return {
      action: 'HOLD',
      reason: 'Position monitoring - no action required',
      urgency: 'LOW'
    };
  }

  /**
   * Calculate portfolio-level risk metrics
   */
  private static calculatePortfolioRisk(
    positionsStatus: PositionStatus[],
    settings: PositionManagementSettings
  ): {
    totalPnL: number;
    totalRisk: number;
    riskFactors: string[];
    recommendations: string[];
  } {
    const totalPnL = positionsStatus.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const totalRisk = positionsStatus.filter(pos => pos.riskMetrics.isAtRisk).length;

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // Count urgent exits
    const urgentExits = positionsStatus.filter(pos => pos.status === 'URGENT_EXIT').length;
    if (urgentExits > 0) {
      riskFactors.push(`${urgentExits} positions require urgent exit`);
      recommendations.push('Immediate liquidation recommended for urgent positions');
    }

    // Time risk assessment
    const timeCriticalPositions = positionsStatus.filter(
      pos => pos.timeToExpiration < 30
    ).length;
    if (timeCriticalPositions > 0) {
      riskFactors.push(`${timeCriticalPositions} positions < 30 min to expiration`);
      recommendations.push('Consider reducing exposure in time-critical positions');
    }

    // Profit/loss assessment
    const losingPositions = positionsStatus.filter(pos => pos.unrealizedPnLPercent < -20).length;
    if (losingPositions > 0) {
      riskFactors.push(`${losingPositions} positions with >20% losses`);
      recommendations.push('Review stop loss strategy for losing positions');
    }

    // Concentration risk
    const totalPositions = positionsStatus.length;
    if (totalPositions > settings.maxPositionsAtOnce) {
      riskFactors.push(`High concentration: ${totalPositions} positions (max: ${settings.maxPositionsAtOnce})`);
      recommendations.push('Reduce position count to manage risk');
    }

    if (riskFactors.length === 0) {
      recommendations.push('Portfolio risk is within acceptable parameters');
    }

    return {
      totalPnL,
      totalRisk,
      riskFactors,
      recommendations
    };
  }

  // =================== HELPER METHODS ===================

  private static getCurrentOptionPrice(position: Position, optionsChain: OptionsChain[]): number {
    const option = optionsChain.find(
      opt => opt.strike === position.strike &&
             opt.side === position.side &&
             opt.expiration.getTime() === position.expiration.getTime()
    );
    return option?.midPrice || position.entryPrice;
  }

  private static calculatePositionGreeks(position: Position, optionsChain: OptionsChain[]) {
    const option = optionsChain.find(
      opt => opt.strike === position.strike &&
             opt.side === position.side &&
             opt.expiration.getTime() === position.expiration.getTime()
    );

    return {
      delta: option?.delta || 0,
      gamma: option?.gamma || 0,
      theta: option?.theta || 0,
      vega: option?.vega || 0
    };
  }

  private static getMarketCloseTime(): Date {
    const now = new Date();
    const marketClose = new Date();
    marketClose.setHours(16, 0, 0, 0); // 4:00 PM ET

    // If it's after market close, use next day's close
    if (now > marketClose) {
      marketClose.setDate(marketClose.getDate() + 1);
    }

    return marketClose;
  }

  private static shouldSellPartial(pnlPercent: number, settings: PositionManagementSettings): boolean {
    return settings.partialProfitLevels.some((level, index) =>
      pnlPercent >= level && pnlPercent < level + 10
    );
  }

  private static shouldSellFull(pnlPercent: number, timeToExpiry: number, settings: PositionManagementSettings): boolean {
    return pnlPercent >= settings.profitTargetPercent ||
           timeToExpiry < settings.minutesBeforeClose ||
           pnlPercent <= -settings.maxLossPercent;
  }

  private static shouldAdjustStops(pnlPercent: number, settings: PositionManagementSettings): boolean {
    return pnlPercent > 20; // Adjust stops after 20% profit
  }

  private static shouldUrgentExit(
    pnlPercent: number,
    timeToExpiry: number,
    riskFactors: string[],
    settings: PositionManagementSettings
  ): boolean {
    return pnlPercent <= -settings.maxLossPercent ||
           timeToExpiry < 10 || // Less than 10 minutes
           riskFactors.some(factor => factor.includes('URGENT'));
  }

  /**
   * Get recommended position size based on risk parameters
   */
  static getRecommendedPositionSize(
    accountValue: number,
    riskPerTrade: number = 2,
    stopLossPercent: number = 30
  ): {
    maxPositionSize: number;
    recommendedSize: number;
    contracts: number;
    riskAmount: number;
  } {
    const riskAmount = accountValue * (riskPerTrade / 100);
    const maxPositionSize = accountValue * 0.1; // Max 10% of account
    const recommendedSize = riskAmount / (stopLossPercent / 100);

    return {
      maxPositionSize,
      recommendedSize: Math.min(recommendedSize, maxPositionSize),
      contracts: Math.floor(recommendedSize / 100), // Assuming $100 per contract
      riskAmount
    };
  }
}