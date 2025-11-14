/**
 * DYNAMIC PROFIT MANAGER
 *
 * Enhanced position management for 0-DTE SPY options with:
 * - Dynamic profit targets based on account size and daily goals
 * - Trailing stop functionality for profit protection
 * - Adaptive exit strategies based on market conditions
 * - Risk-adjusted position sizing
 *
 * Target: $300/day on $25,000 account (1.2% daily return)
 */

import { Position, MarketData, OptionsChain } from './types';

export interface DynamicProfitSettings {
  accountSize: number;
  dailyProfitTarget: number;      // Dollar amount (e.g., $300)
  maxDailyRisk: number;           // Dollar amount (e.g., $750 = 3%)
  trailingStopPercent: number;    // Trailing stop distance (e.g., 25%)
  trailingStopActivation: number; // Activate after X% profit (e.g., 30%)
  profitLockLevels: number[];     // Profit levels to lock (e.g., [30, 50, 75, 100])
  profitLockPercents: number[];   // % to lock at each level (e.g., [25, 25, 25, 25])
}

export interface TrailingStopState {
  active: boolean;
  activatedAt: number;            // Price when activated
  highestPrice: number;           // Highest price seen since activation
  currentStopPrice: number;       // Current trailing stop price
  percentFromHigh: number;        // Distance from highest price (%)
}

export interface DynamicExitRecommendation {
  action: 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'MOVE_STOP';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  suggestedQuantity?: number;     // For partial exits
  suggestedPrice?: number;         // For limit orders
  trailingStopUpdate?: number;     // New trailing stop price
  confidence: number;              // 0-100
}

export interface PositionAnalysis {
  position: Position;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  profitTarget: number;            // Dynamic profit target
  stopLoss: number;                // Current stop loss
  trailingStop: TrailingStopState;
  exitRecommendation: DynamicExitRecommendation;
  timeToExpiry: number;            // Minutes
  dailyProgress: {
    currentProfit: number;
    targetProgress: number;        // % of daily target achieved
    remainingTarget: number;
    recommendation: string;
  };
}

/**
 * Dynamic Profit Manager
 * Manages positions with dynamic profit targets and trailing stops
 */
export class DynamicProfitManager {
  private static readonly DEFAULT_SETTINGS: DynamicProfitSettings = {
    accountSize: 25000,
    dailyProfitTarget: 300,
    maxDailyRisk: 750,  // 3% of account
    trailingStopPercent: 25,  // Trail by 25%
    trailingStopActivation: 30,  // Activate at 30% profit
    profitLockLevels: [30, 50, 75, 100],
    profitLockPercents: [25, 25, 25, 25]
  };

  private static settings: DynamicProfitSettings = { ...this.DEFAULT_SETTINGS };
  private static dailyPnL: number = 0;
  private static trailingStops: Map<string, TrailingStopState> = new Map();

  /**
   * Update settings
   */
  static updateSettings(newSettings: Partial<DynamicProfitSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Reset daily tracking (call at market open)
   */
  static resetDaily(): void {
    this.dailyPnL = 0;
    this.trailingStops.clear();
  }

  /**
   * Update daily P&L
   */
  static updateDailyPnL(realizedPnL: number): void {
    this.dailyPnL += realizedPnL;
  }

  /**
   * Analyze position with dynamic profit management
   */
  static analyzePosition(
    position: Position,
    currentPrice: number,
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): PositionAnalysis {
    // Calculate P&L
    const unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
    const unrealizedPnLPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Calculate dynamic profit target based on account size and position size
    const profitTarget = this.calculateDynamicProfitTarget(position, unrealizedPnLPercent);

    // Calculate stop loss
    const stopLoss = this.calculateStopLoss(position, unrealizedPnLPercent);

    // Get or create trailing stop state
    const trailingStop = this.updateTrailingStop(
      position,
      currentPrice,
      unrealizedPnLPercent
    );

    // Calculate time to expiry
    const timeToExpiry = this.getTimeToExpiry(position.expiration);

    // Generate exit recommendation
    const exitRecommendation = this.generateExitRecommendation(
      position,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      profitTarget,
      stopLoss,
      trailingStop,
      timeToExpiry,
      marketData
    );

    // Calculate daily progress
    const dailyProgress = this.calculateDailyProgress(unrealizedPnL);

    return {
      position,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      profitTarget,
      stopLoss,
      trailingStop,
      exitRecommendation,
      timeToExpiry,
      dailyProgress
    };
  }

  /**
   * Calculate dynamic profit target based on position and market conditions
   */
  private static calculateDynamicProfitTarget(
    position: Position,
    currentPnLPercent: number
  ): number {
    // Base target: 50% profit for 0-DTE (aggressive but achievable)
    let targetPercent = 50;

    // Adjust based on time to expiry
    const timeToExpiry = this.getTimeToExpiry(position.expiration);
    
    if (timeToExpiry < 60) {
      // Less than 1 hour: increase target (theta decay acceleration)
      targetPercent = 60;
    } else if (timeToExpiry < 120) {
      // Less than 2 hours: standard target
      targetPercent = 50;
    } else if (timeToExpiry < 240) {
      // Less than 4 hours: slightly lower target
      targetPercent = 45;
    } else {
      // More than 4 hours: conservative target
      targetPercent = 40;
    }

    // Adjust based on daily progress
    const progressPercent = (this.dailyPnL / this.settings.dailyProfitTarget) * 100;
    
    if (progressPercent >= 100) {
      // Already hit daily target - be more aggressive
      targetPercent *= 1.2;
    } else if (progressPercent >= 75) {
      // Close to target - maintain current target
      targetPercent *= 1.0;
    } else if (progressPercent < 25) {
      // Far from target - be slightly more aggressive
      targetPercent *= 1.1;
    }

    return Math.round(targetPercent);
  }

  /**
   * Calculate stop loss based on position and conditions
   */
  private static calculateStopLoss(
    position: Position,
    currentPnLPercent: number
  ): number {
    // Base stop loss: 50% loss for 0-DTE
    let stopLossPercent = -50;

    // If position is profitable, use tighter stop
    if (currentPnLPercent > 0) {
      stopLossPercent = -25;  // Tighter stop when profitable
    }

    // Time-based adjustment
    const timeToExpiry = this.getTimeToExpiry(position.expiration);
    
    if (timeToExpiry < 30) {
      // Emergency exit zone - very tight stop
      stopLossPercent = -20;
    }

    return stopLossPercent;
  }

  /**
   * Update trailing stop for position
   */
  private static updateTrailingStop(
    position: Position,
    currentPrice: number,
    currentPnLPercent: number
  ): TrailingStopState {
    const positionId = position.id || position.symbol;
    let trailingStop = this.trailingStops.get(positionId);

    // Initialize if doesn't exist
    if (!trailingStop) {
      trailingStop = {
        active: false,
        activatedAt: 0,
        highestPrice: currentPrice,
        currentStopPrice: 0,
        percentFromHigh: 0
      };
      this.trailingStops.set(positionId, trailingStop);
    }

    // Activate trailing stop if profit threshold reached
    if (!trailingStop.active && currentPnLPercent >= this.settings.trailingStopActivation) {
      trailingStop.active = true;
      trailingStop.activatedAt = currentPrice;
      trailingStop.highestPrice = currentPrice;
      trailingStop.currentStopPrice = currentPrice * (1 - this.settings.trailingStopPercent / 100);
      console.log(`🎯 TRAILING STOP ACTIVATED for ${position.symbol} at ${currentPrice.toFixed(2)}`);
    }

    // Update trailing stop if active
    if (trailingStop.active) {
      // Update highest price
      if (currentPrice > trailingStop.highestPrice) {
        trailingStop.highestPrice = currentPrice;
        // Recalculate stop price
        trailingStop.currentStopPrice = currentPrice * (1 - this.settings.trailingStopPercent / 100);
        console.log(`📈 TRAILING STOP RAISED to ${trailingStop.currentStopPrice.toFixed(2)}`);
      }

      trailingStop.percentFromHigh = ((currentPrice - trailingStop.highestPrice) / trailingStop.highestPrice) * 100;
    }

    return trailingStop;
  }

  /**
   * Generate exit recommendation
   */
  private static generateExitRecommendation(
    position: Position,
    currentPrice: number,
    unrealizedPnL: number,
    unrealizedPnLPercent: number,
    profitTarget: number,
    stopLoss: number,
    trailingStop: TrailingStopState,
    timeToExpiry: number,
    marketData: MarketData[]
  ): DynamicExitRecommendation {
    // Check stop loss
    if (unrealizedPnLPercent <= stopLoss) {
      return {
        action: 'EXIT_FULL',
        urgency: 'CRITICAL',
        reason: `Stop loss hit: ${unrealizedPnLPercent.toFixed(1)}% loss`,
        confidence: 100
      };
    }

    // Check trailing stop
    if (trailingStop.active && currentPrice <= trailingStop.currentStopPrice) {
      return {
        action: 'EXIT_FULL',
        urgency: 'HIGH',
        reason: `Trailing stop triggered at ${trailingStop.currentStopPrice.toFixed(2)}`,
        confidence: 95
      };
    }

    // Check profit target
    if (unrealizedPnLPercent >= profitTarget) {
      return {
        action: 'EXIT_FULL',
        urgency: 'HIGH',
        reason: `Profit target reached: ${unrealizedPnLPercent.toFixed(1)}% (target: ${profitTarget}%)`,
        confidence: 90
      };
    }

    // Check profit lock levels for partial exits
    for (let i = 0; i < this.settings.profitLockLevels.length; i++) {
      const level = this.settings.profitLockLevels[i];
      const lockPercent = this.settings.profitLockPercents[i];

      if (unrealizedPnLPercent >= level && unrealizedPnLPercent < (this.settings.profitLockLevels[i + 1] || Infinity)) {
        const suggestedQuantity = Math.floor(position.quantity * (lockPercent / 100));
        
        if (suggestedQuantity > 0) {
          return {
            action: 'SCALE_OUT',
            urgency: 'MEDIUM',
            reason: `Profit lock level ${level}% reached - scale out ${lockPercent}%`,
            suggestedQuantity,
            confidence: 80
          };
        }
      }
    }

    // Check time-based exit
    if (timeToExpiry < 30) {
      if (unrealizedPnLPercent > 10) {
        return {
          action: 'EXIT_FULL',
          urgency: 'HIGH',
          reason: `Emergency time exit: ${timeToExpiry.toFixed(0)} min remaining with profit`,
          confidence: 85
        };
      } else if (unrealizedPnLPercent < -20) {
        return {
          action: 'EXIT_FULL',
          urgency: 'CRITICAL',
          reason: `Emergency time exit: ${timeToExpiry.toFixed(0)} min remaining with loss`,
          confidence: 95
        };
      }
    } else if (timeToExpiry < 60 && unrealizedPnLPercent > 20) {
      return {
        action: 'SCALE_OUT',
        urgency: 'MEDIUM',
        reason: `Time decay zone: ${timeToExpiry.toFixed(0)} min remaining - take profits`,
        suggestedQuantity: Math.floor(position.quantity * 0.5),
        confidence: 75
      };
    }

    // Check if trailing stop should be moved up
    if (trailingStop.active && unrealizedPnLPercent > 40) {
      return {
        action: 'MOVE_STOP',
        urgency: 'LOW',
        reason: `Strong profit: ${unrealizedPnLPercent.toFixed(1)}% - trailing stop active`,
        trailingStopUpdate: trailingStop.currentStopPrice,
        confidence: 70
      };
    }

    // Default: hold position
    return {
      action: 'HOLD',
      urgency: 'LOW',
      reason: `Position within targets: ${unrealizedPnLPercent.toFixed(1)}% P&L, ${timeToExpiry.toFixed(0)} min remaining`,
      confidence: 60
    };
  }

  /**
   * Calculate daily progress towards profit target
   */
  private static calculateDailyProgress(positionPnL: number): {
    currentProfit: number;
    targetProgress: number;
    remainingTarget: number;
    recommendation: string;
  } {
    const currentProfit = this.dailyPnL + positionPnL;
    const targetProgress = (currentProfit / this.settings.dailyProfitTarget) * 100;
    const remainingTarget = this.settings.dailyProfitTarget - currentProfit;

    let recommendation: string;
    if (targetProgress >= 100) {
      recommendation = '✅ Daily target achieved - trade defensively or close for day';
    } else if (targetProgress >= 75) {
      recommendation = '🎯 Near daily target - look for final opportunity';
    } else if (targetProgress >= 50) {
      recommendation = '📈 Halfway to target - maintain discipline';
    } else if (targetProgress >= 25) {
      recommendation = '⚡ Building momentum - stay focused';
    } else {
      recommendation = '🚀 Early in day - patient execution';
    }

    return {
      currentProfit,
      targetProgress: Math.round(targetProgress),
      remainingTarget: Math.max(0, remainingTarget),
      recommendation
    };
  }

  /**
   * Get time to expiry in minutes
   */
  private static getTimeToExpiry(expiration: Date): number {
    const now = new Date();
    const timeToExpiry = expiration.getTime() - now.getTime();
    return Math.max(0, timeToExpiry / (1000 * 60));
  }

  /**
   * Recommend position size based on daily progress and risk
   */
  static recommendPositionSize(
    entryPrice: number,
    accountSize: number = this.settings.accountSize,
    dailyPnL: number = this.dailyPnL
  ): number {
    // Base position size: 3% of account per trade
    const baseRiskPercent = 0.03;
    let riskAmount = accountSize * baseRiskPercent;

    // Adjust based on daily progress
    const targetProgress = (dailyPnL / this.settings.dailyProfitTarget) * 100;
    
    if (targetProgress >= 100) {
      // Already hit target - use 1% risk (conservative)
      riskAmount = accountSize * 0.01;
    } else if (targetProgress >= 75) {
      // Near target - use 2% risk
      riskAmount = accountSize * 0.02;
    } else if (targetProgress < 25 && dailyPnL < 0) {
      // Behind and losing - use 2% risk (defensive)
      riskAmount = accountSize * 0.02;
    }

    // Check daily risk limit
    const dailyRiskUsed = Math.abs(Math.min(0, dailyPnL));
    const remainingDailyRisk = this.settings.maxDailyRisk - dailyRiskUsed;

    if (remainingDailyRisk < riskAmount) {
      riskAmount = Math.max(0, remainingDailyRisk);
    }

    // Calculate contracts (assuming 50% stop loss)
    const maxLossPerContract = entryPrice * 0.5;
    const contracts = Math.floor(riskAmount / maxLossPerContract);

    return Math.max(1, Math.min(10, contracts));
  }

  /**
   * Get current settings
   */
  static getSettings(): DynamicProfitSettings {
    return { ...this.settings };
  }

  /**
   * Get daily P&L
   */
  static getDailyPnL(): number {
    return this.dailyPnL;
  }

  /**
   * Get daily progress summary
   */
  static getDailyProgressSummary(): {
    dailyPnL: number;
    targetProgress: number;
    remainingTarget: number;
    tradesCount: number;
    recommendation: string;
  } {
    const targetProgress = (this.dailyPnL / this.settings.dailyProfitTarget) * 100;
    const remainingTarget = Math.max(0, this.settings.dailyProfitTarget - this.dailyPnL);

    let recommendation: string;
    if (targetProgress >= 100) {
      recommendation = '✅ Daily target achieved! Consider stopping or trading very conservatively.';
    } else if (targetProgress >= 75) {
      recommendation = '🎯 Close to target - 1-2 more good trades should do it.';
    } else if (targetProgress >= 50) {
      recommendation = '📈 Halfway there - stay disciplined and patient.';
    } else if (targetProgress >= 25) {
      recommendation = '⚡ Good start - maintain focus and execution quality.';
    } else if (this.dailyPnL < 0) {
      recommendation = '⚠️ Behind for day - stick to plan, avoid revenge trading.';
    } else {
      recommendation = '🚀 Fresh start - execute with patience and precision.';
    }

    return {
      dailyPnL: this.dailyPnL,
      targetProgress: Math.round(targetProgress),
      remainingTarget,
      tradesCount: this.trailingStops.size,
      recommendation
    };
  }
}
