/**
 * PROFIT PROTECTION MANAGER
 *
 * Specialized manager for profit protection and trailing stop strategies
 * Optimized for 0-DTE SPY options with dynamic trailing stops and scaled profit taking
 */

import {
  Position,
  OptionsChain,
  DynamicExitSignal,
  MarketData
} from './types';

export interface ProfitProtectionThresholds {
  // Profit targets
  riskRewardLevels: number[];        // [1R, 2R, 3R, 5R] profit targets
  partialProfitTakes: number[];     // Percentage to take at each level [20%, 30%, 30%, 20%]
  minimumProfitTarget: number;      // Minimum profit before any trailing

  // Trailing stop settings
  trailingStopEnabled: boolean;
  trailingStopDistance: number;      // Initial trailing distance ($)
  trailingStopActivation: number;   // Activate after X% profit
  trailingStopTightening: number;    // Tighten stop after each target hit

  // Stop loss settings
  maxLossPercent: number;           // Maximum loss percentage
  emergencyStopLoss: number;        // Emergency stop loss for volatility spikes
  breakevenStop: boolean;           // Move to breakeven after 1R profit

  // Volatility adjustments
  volatilityMultiplier: number;     // Multiply stop distance by volatility factor
  adrAdjustment: boolean;           // Adjust stops based on Average Daily Range

  // Time-based profit protection
  timeBasedStopTightening: boolean; // Tighten stops as expiration approaches
  profitDecayProtection: boolean;   // Protect profits from theta decay
}

export interface TrailingStopState {
  isActive: boolean;
  activationPrice: number;          // Price when trailing stop activated
  currentStopPrice: number;         // Current trailing stop price
  highestPrice: number;             // Highest price seen (for long positions)
  lowestPrice: number;              // Lowest price seen (for short positions)
  lastAdjustment: Date;             // When stop was last adjusted
  stopDistance: number;             // Current stop distance
  adjustmentHistory: StopAdjustment[]; // History of stop adjustments
}

export interface StopAdjustment {
  timestamp: Date;
  oldStopPrice: number;
  newStopPrice: number;
  reason: string;
  profitLevel: number;              // R-multiple at adjustment
}

export interface ProfitProtectionAnalysis {
  positionId: string;
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;

  // Profit analysis
  profitMetrics: {
    currentPnL: number;             // Current P&L in dollars
    currentPnLPercent: number;      // Current P&L percentage
    currentRMultiple: number;       // Current risk-multiple (R)
    maxProfit: number;              // Maximum profit achieved
    maxRMultiple: number;           // Maximum R-multiple achieved
    profitEfficiency: number;       // Profit efficiency score (0-100)
  };

  // Trailing stop analysis
  trailingStop: TrailingStopState;

  // Risk management
  riskManagement: {
    stopLossPrice: number;          // Current stop loss price
    riskAmount: number;             // Current risk amount
    rewardRiskRatio: number;        // Current reward:risk ratio
    positionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    protectionLevel: number;        // Percentage of profits protected (0-100)
  };

  // Profit targets
  profitTargets: {
    nextTarget: number;              // Next R-multiple target
    targetPrice: number;            // Price for next target
    targetQuantity: number;         // Quantity to exit at target
    targetsHit: number[];           // R-multiples already hit
    remainingTargets: number[];     // R-multiples still pending
  };

  // Action recommendations
  recommendation: {
    action: 'HOLD' | 'TAKE_PROFIT' | 'MOVE_STOP' | 'EMERGENCY_EXIT' | 'SCALE_PARTIAL';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    executeImmediately: boolean;
    profitProtectionAction?: string;
    suggestedStopPrice?: number;
    exitQuantity?: number;
    confidence: number;             // Confidence in recommendation (0-100)
  };

  timestamp: Date;
}

export interface ProfitProtectionPortfolioSummary {
  totalPositions: number;
  totalPnL: number;
  totalProtectedProfits: number;    // Profits protected by stops
  totalUnrealizedRisk: number;       // Current unrealized risk

  portfolioMetrics: {
    averageRMultiple: number;       // Average R-multiple across positions
    winRate: number;                // Percentage of profitable positions
    profitFactor: number;           // Total profits / total losses
    maxDrawdown: number;            // Maximum portfolio drawdown
    profitProtectionRatio: number;  // Protected profits / total profits
  };

  activeTrailingStops: number;       // Positions with active trailing stops
  positionsAtRisk: number;          // Positions with losses
  positionsProtected: number;       // Positions with stop losses

  riskDistribution: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    criticalRisk: number;
  };

  timestamp: Date;
}

/**
 * Profit Protection Manager
 *
 * Provides sophisticated profit protection strategies for 0-DTE options
 * Features dynamic trailing stops, scaled profit taking, and risk management
 */
export class ProfitProtectionManager {
  private static readonly DEFAULT_THRESHOLDS: ProfitProtectionThresholds = {
    // R-multiple profit targets for 0-DTE
    riskRewardLevels: [1, 2, 3, 5],           // 1R, 2R, 3R, 5R targets
    partialProfitTakes: [20, 30, 30, 20],     // Take 20%, 30%, 30%, 20% at each level
    minimumProfitTarget: 0.10,               // Minimum 10% profit before trailing

    // Trailing stop configuration
    trailingStopEnabled: true,
    trailingStopDistance: 0.05,               // 5 cents trailing distance
    trailingStopActivation: 0.25,             // Activate after 25% profit
    trailingStopTightening: 0.8,              // Tighten by 20% after each target

    // Stop loss settings
    maxLossPercent: 0.15,                    // Maximum 15% loss
    emergencyStopLoss: 0.20,                 // Emergency stop at 20% loss
    breakevenStop: true,                     // Move to breakeven after 1R

    // Volatility adjustments
    volatilityMultiplier: 1.5,               // Expand stops in high volatility
    adrAdjustment: true,                     // Use ADR for stop adjustment

    // Time-based adjustments
    timeBasedStopTightening: true,            // Tighten as expiration approaches
    profitDecayProtection: true              // Protect from theta decay
  };

  private static trailingStopStates = new Map<string, TrailingStopState>();

  /**
   * Analyze positions from profit protection perspective
   */
  static async analyzePositions(
    positions: Position[],
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    customThresholds?: Partial<ProfitProtectionThresholds>
  ): Promise<ProfitProtectionAnalysis[]> {
    const thresholds = { ...this.DEFAULT_THRESHOLDS, ...customThresholds };

    console.log(`🛡️ PROFIT PROTECTION ANALYSIS: Analyzing ${positions.length} positions`);

    const analyses: ProfitProtectionAnalysis[] = [];

    for (const position of positions) {
      try {
        const analysis = await this.analyzePosition(position, optionsChain, marketData, thresholds);
        analyses.push(analysis);

        // Update trailing stop state
        this.updateTrailingStopState(position.id || '', analysis.trailingStop);

      } catch (error) {
        console.error(`❌ Profit protection analysis failed for ${position.symbol}: ${error}`);
      }
    }

    return analyses;
  }

  /**
   * Analyze single position for profit protection
   */
  private static async analyzePosition(
    position: Position,
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    thresholds: ProfitProtectionThresholds
  ): Promise<ProfitProtectionAnalysis> {
    // Get current options data
    const optionData = optionsChain.find(opt =>
      opt.symbol === position.symbol &&
      opt.strike === position.strike &&
      Math.abs(opt.expiration.getTime() - position.expiration.getTime()) < 86400000
    );

    if (!optionData) {
      throw new Error(`Options data not found for ${position.symbol} ${position.strike} ${position.expiration}`);
    }

    const currentPrice = optionData.midPrice || ((optionData.bid + optionData.ask) / 2);

    // Calculate profit metrics
    const profitMetrics = this.calculateProfitMetrics(position, currentPrice);

    // Get or create trailing stop state
    const trailingStop = this.getTrailingStopState(position.id || '', position, currentPrice, thresholds, profitMetrics);

    // Risk management analysis
    const riskManagement = this.analyzeRiskManagement(position, currentPrice, trailingStop, thresholds);

    // Profit targets analysis
    const profitTargets = this.analyzeProfitTargets(position, currentPrice, profitMetrics, thresholds);

    // Generate recommendation
    const recommendation = this.generateProfitProtectionRecommendation(
      position,
      profitMetrics,
      trailingStop,
      riskManagement,
      profitTargets,
      thresholds
    );

    return {
      positionId: position.id || '',
      symbol: position.symbol,
      side: position.side,
      strike: (position as any).strike || 0,
      expiration: position.expiration,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      currentPrice,
      profitMetrics,
      trailingStop,
      riskManagement,
      profitTargets,
      recommendation,
      timestamp: new Date()
    };
  }

  /**
   * Calculate comprehensive profit metrics
   */
  private static calculateProfitMetrics(
    position: Position,
    currentPrice: number
  ): {
    currentPnL: number;
    currentPnLPercent: number;
    currentRMultiple: number;
    maxProfit: number;
    maxRMultiple: number;
    profitEfficiency: number;
  } {
    const currentPnL = (currentPrice - position.entryPrice) * position.quantity;
    const currentPnLPercent = currentPnL / (position.entryPrice * position.quantity);
    const currentRMultiple = currentPnLPercent / this.DEFAULT_THRESHOLDS.maxLossPercent;

    // Get historical max profit (would need to track this over time)
    // For now, use current as max
    const maxProfit = currentPnL;
    const maxRMultiple = currentRMultiple;

    // Profit efficiency (how efficiently profit was generated)
    const profitEfficiency = Math.max(0, Math.min(100, (currentRMultiple / 3) * 100)); // Normalize to 3R as 100%

    return {
      currentPnL,
      currentPnLPercent,
      currentRMultiple,
      maxProfit,
      maxRMultiple,
      profitEfficiency
    };
  }

  /**
   * Get or create trailing stop state
   */
  private static getTrailingStopState(
    positionId: string,
    position: Position,
    currentPrice: number,
    thresholds: ProfitProtectionThresholds,
    profitMetrics: { currentPnLPercent: number; currentRMultiple: number }
  ): TrailingStopState {
    let state = this.trailingStopStates.get(positionId);

    if (!state) {
      // Initialize new state
      state = {
        isActive: false,
        activationPrice: position.entryPrice,
        currentStopPrice: position.entryPrice * (1 - thresholds.maxLossPercent),
        highestPrice: position.entryPrice,
        lowestPrice: position.entryPrice,
        lastAdjustment: new Date(),
        stopDistance: thresholds.trailingStopDistance,
        adjustmentHistory: []
      };
    }

    // Update price tracking
    if (currentPrice > state.highestPrice) {
      state.highestPrice = currentPrice;
    }
    if (currentPrice < state.lowestPrice) {
      state.lowestPrice = currentPrice;
    }

    // Check if trailing stop should be activated
    const shouldActivate = !state.isActive &&
                          profitMetrics.currentPnLPercent >= thresholds.trailingStopActivation;

    if (shouldActivate) {
      state.isActive = true;
      state.activationPrice = currentPrice;
      state.currentStopPrice = currentPrice * (1 - thresholds.trailingStopDistance);
      state.adjustmentHistory.push({
        timestamp: new Date(),
        oldStopPrice: state.currentStopPrice,
        newStopPrice: state.currentStopPrice,
        reason: 'Trailing stop activated',
        profitLevel: profitMetrics.currentRMultiple
      });
    }

    // Update trailing stop if active
    if (state.isActive && thresholds.trailingStopEnabled) {
      const newStopPrice = state.highestPrice * (1 - thresholds.trailingStopDistance);

      if (newStopPrice > state.currentStopPrice) {
        state.currentStopPrice = newStopPrice;
        state.lastAdjustment = new Date();
        state.adjustmentHistory.push({
          timestamp: new Date(),
          oldStopPrice: state.currentStopPrice,
          newStopPrice: newStopPrice,
          reason: 'Trailing stop adjusted upward',
          profitLevel: profitMetrics.currentRMultiple
        });
      }
    }

    // Move to breakeven after 1R profit
    if (thresholds.breakevenStop && profitMetrics.currentRMultiple >= 1 && state.currentStopPrice < position.entryPrice) {
      state.currentStopPrice = position.entryPrice;
      state.adjustmentHistory.push({
        timestamp: new Date(),
        oldStopPrice: state.currentStopPrice,
        newStopPrice: position.entryPrice,
        reason: 'Stop moved to breakeven (1R profit)',
        profitLevel: profitMetrics.currentRMultiple
      });
    }

    return state;
  }

  /**
   * Analyze risk management metrics
   */
  private static analyzeRiskManagement(
    position: Position,
    currentPrice: number,
    trailingStop: TrailingStopState,
    thresholds: ProfitProtectionThresholds
  ): {
    stopLossPrice: number;
    riskAmount: number;
    rewardRiskRatio: number;
    positionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    protectionLevel: number;
  } {
    const stopLossPrice = trailingStop.isActive ? trailingStop.currentStopPrice :
                        position.entryPrice * (1 - thresholds.maxLossPercent);

    const riskAmount = Math.abs(currentPrice - stopLossPrice) * position.quantity;
    const currentProfit = (currentPrice - position.entryPrice) * position.quantity;
    const rewardRiskRatio = currentProfit !== 0 ? Math.abs(currentProfit / riskAmount) : 0;

    // Position risk assessment
    const lossPercent = (stopLossPrice - currentPrice) / position.entryPrice;
    let positionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (lossPercent <= -thresholds.emergencyStopLoss) {
      positionRisk = 'CRITICAL';
    } else if (lossPercent <= -thresholds.maxLossPercent) {
      positionRisk = 'HIGH';
    } else if (lossPercent <= -thresholds.maxLossPercent * 0.5) {
      positionRisk = 'MEDIUM';
    } else {
      positionRisk = 'LOW';
    }

    // Protection level calculation
    const protectionLevel = currentProfit > 0 ?
      Math.max(0, Math.min(100, ((currentProfit - riskAmount) / currentProfit) * 100)) : 0;

    return {
      stopLossPrice,
      riskAmount,
      rewardRiskRatio,
      positionRisk,
      protectionLevel
    };
  }

  /**
   * Analyze profit targets and scaling opportunities
   */
  private static analyzeProfitTargets(
    position: Position,
    currentPrice: number,
    profitMetrics: { currentRMultiple: number },
    thresholds: ProfitProtectionThresholds
  ): {
    nextTarget: number;
    targetPrice: number;
    targetQuantity: number;
    targetsHit: number[];
    remainingTargets: number[];
  } {
    const targetsHit: number[] = [];
    const remainingTargets: number[] = [];

    // Determine which targets have been hit
    thresholds.riskRewardLevels.forEach(level => {
      if (profitMetrics.currentRMultiple >= level) {
        targetsHit.push(level);
      } else {
        remainingTargets.push(level);
      }
    });

    // Find next target
    const nextTarget = remainingTargets.length > 0 ? Math.min(...remainingTargets) : 0;

    // Calculate price for next target
    const riskAmount = position.entryPrice * thresholds.maxLossPercent;
    const targetProfit = nextTarget * riskAmount;
    const targetPrice = position.entryPrice + (targetProfit / position.quantity);

    // Calculate quantity to exit at next target
    const targetIndex = thresholds.riskRewardLevels.indexOf(nextTarget);
    const targetQuantity = targetIndex >= 0 ?
      position.quantity * (thresholds.partialProfitTakes[targetIndex] / 100) : 0;

    return {
      nextTarget,
      targetPrice,
      targetQuantity,
      targetsHit,
      remainingTargets
    };
  }

  /**
   * Generate profit protection recommendations
   */
  private static generateProfitProtectionRecommendation(
    position: Position,
    profitMetrics: { currentPnL: number; currentPnLPercent: number; currentRMultiple: number },
    trailingStop: TrailingStopState,
    riskManagement: { positionRisk: string; rewardRiskRatio: number },
    profitTargets: { nextTarget: number; targetQuantity: number },
    thresholds: ProfitProtectionThresholds
  ): {
    action: 'HOLD' | 'TAKE_PROFIT' | 'MOVE_STOP' | 'EMERGENCY_EXIT' | 'SCALE_PARTIAL';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    executeImmediately: boolean;
    profitProtectionAction?: string;
    suggestedStopPrice?: number;
    exitQuantity?: number;
    confidence: number;
  } {
    // Emergency conditions
    if (riskManagement.positionRisk === 'CRITICAL' || profitMetrics.currentPnLPercent <= -thresholds.emergencyStopLoss) {
      return {
        action: 'EMERGENCY_EXIT',
        urgency: 'CRITICAL',
        reason: `Emergency: Loss exceeded ${(thresholds.emergencyStopLoss * 100).toFixed(0)}%`,
        executeImmediately: true,
        confidence: 100
      };
    }

    // High loss risk
    if (riskManagement.positionRisk === 'HIGH') {
      return {
        action: 'EMERGENCY_EXIT',
        urgency: 'HIGH',
        reason: `High loss risk: ${(profitMetrics.currentPnLPercent * 100).toFixed(1)}% loss`,
        executeImmediately: false,
        confidence: 85
      };
    }

    // Profit target reached - scale out
    if (profitTargets.nextTarget > 0 && profitMetrics.currentRMultiple >= profitTargets.nextTarget) {
      return {
        action: 'SCALE_PARTIAL',
        urgency: 'MEDIUM',
        reason: `Profit target reached: ${profitTargets.nextTarget}R - take partial profits`,
        executeImmediately: false,
        profitProtectionAction: 'Scale out at profit target',
        exitQuantity: profitTargets.targetQuantity,
        confidence: 90
      };
    }

    // Excellent profit - consider taking profits
    if (profitMetrics.currentRMultiple >= 3) {
      return {
        action: 'TAKE_PROFIT',
        urgency: 'MEDIUM',
        reason: `Excellent profit: ${profitMetrics.currentRMultiple.toFixed(1)}R achieved`,
        executeImmediately: false,
        profitProtectionAction: 'Lock in significant profits',
        exitQuantity: position.quantity * 0.5, // Take 50% profits
        confidence: 75
      };
    }

    // Moderate profit - ensure trailing stop is active
    if (profitMetrics.currentRMultiple >= 1 && !trailingStop.isActive) {
      return {
        action: 'MOVE_STOP',
        urgency: 'MEDIUM',
        reason: 'Move to breakeven and activate trailing stop',
        executeImmediately: false,
        profitProtectionAction: 'Protect profits with trailing stop',
        suggestedStopPrice: position.entryPrice,
        confidence: 80
      };
    }

    // Trailing stop adjustment needed
    if (trailingStop.isActive && trailingStop.adjustmentHistory.length > 0) {
      const lastAdjustment = trailingStop.adjustmentHistory[trailingStop.adjustmentHistory.length - 1];
      const minutesSinceAdjustment = (new Date().getTime() - lastAdjustment.timestamp.getTime()) / (1000 * 60);

      if (minutesSinceAdjustment > 5 && profitMetrics.currentRMultiple > lastAdjustment.profitLevel + 0.5) {
        return {
          action: 'MOVE_STOP',
          urgency: 'LOW',
          reason: 'Tighten trailing stop after additional profit',
          executeImmediately: false,
          profitProtectionAction: 'Tighten protection as profit increases',
          confidence: 70
        };
      }
    }

    // Hold with monitoring
    return {
      action: 'HOLD',
      urgency: 'LOW',
      reason: 'Position performing within normal parameters',
      executeImmediately: false,
      confidence: 60
    };
  }

  /**
   * Generate portfolio summary
   */
  static generatePortfolioSummary(analyses: ProfitProtectionAnalysis[]): ProfitProtectionPortfolioSummary {
    const totalPnL = analyses.reduce((sum, a) => sum + a.profitMetrics.currentPnL, 0);
    const protectedProfits = analyses.reduce((sum, a) => sum + (a.riskManagement.protectionLevel / 100) * Math.max(0, a.profitMetrics.currentPnL), 0);
    const unrealizedRisk = analyses.reduce((sum, a) => sum + a.riskManagement.riskAmount, 0);

    const winningPositions = analyses.filter(a => a.profitMetrics.currentPnL > 0).length;
    const winRate = analyses.length > 0 ? (winningPositions / analyses.length) * 100 : 0;

    const avgRMultiple = analyses.length > 0 ?
      analyses.reduce((sum, a) => sum + a.profitMetrics.currentRMultiple, 0) / analyses.length : 0;

    const riskDistribution = {
      lowRisk: analyses.filter(a => a.riskManagement.positionRisk === 'LOW').length,
      mediumRisk: analyses.filter(a => a.riskManagement.positionRisk === 'MEDIUM').length,
      highRisk: analyses.filter(a => a.riskManagement.positionRisk === 'HIGH').length,
      criticalRisk: analyses.filter(a => a.riskManagement.positionRisk === 'CRITICAL').length
    };

    return {
      totalPositions: analyses.length,
      totalPnL,
      totalProtectedProfits: protectedProfits,
      totalUnrealizedRisk: unrealizedRisk,
      portfolioMetrics: {
        averageRMultiple: avgRMultiple,
        winRate,
        profitFactor: totalPnL > 0 ? totalPnL / Math.abs(unrealizedRisk) : 0,
        maxDrawdown: 0, // Would need historical data
        profitProtectionRatio: totalPnL > 0 ? protectedProfits / totalPnL : 0
      },
      activeTrailingStops: analyses.filter(a => a.trailingStop.isActive).length,
      positionsAtRisk: analyses.filter(a => a.profitMetrics.currentPnL < 0).length,
      positionsProtected: analyses.filter(a => a.trailingStop.isActive || a.riskManagement.stopLossPrice > 0).length,
      riskDistribution,
      timestamp: new Date()
    };
  }

  /**
   * Convert analysis to exit signals
   */
  static toExitSignals(analyses: ProfitProtectionAnalysis[]): DynamicExitSignal[] {
    return analyses.map(analysis => {
      let shouldExit = false;
      let exitType: 'FULL' | 'PARTIAL' = 'FULL';
      let exitQuantity = 0;

      switch (analysis.recommendation.action) {
        case 'EMERGENCY_EXIT':
        case 'TAKE_PROFIT':
          shouldExit = true;
          exitType = analysis.recommendation.action === 'TAKE_PROFIT' ? 'PARTIAL' : 'FULL';
          exitQuantity = analysis.recommendation.exitQuantity || analysis.quantity;
          break;
        case 'SCALE_PARTIAL':
          shouldExit = true;
          exitType = 'PARTIAL';
          exitQuantity = analysis.recommendation.exitQuantity || 0;
          break;
        case 'MOVE_STOP':
        case 'HOLD':
        default:
          shouldExit = false;
          break;
      }

      return {
        shouldExit,
        exitType,
        exitQuantity,
        reason: `Profit Protection: ${analysis.recommendation.reason}`,
        urgency: analysis.recommendation.urgency,
        timestamp: analysis.timestamp,
        greeksRiskTriggered: false,
        trailingStopTriggered: analysis.trailingStop.isActive,
        timeExitTriggered: false,
        volumeExitTriggered: false,
        volatilityStopTriggered: false
      };
    });
  }

  /**
   * Update trailing stop state
   */
  private static updateTrailingStopState(positionId: string, state: TrailingStopState): void {
    this.trailingStopStates.set(positionId, state);
  }

  /**
   * Clear trailing stop state (when position is closed)
   */
  static clearTrailingStopState(positionId: string): void {
    this.trailingStopStates.delete(positionId);
  }

  /**
   * Get trailing stop state for a position
   */
  static getTrailingStopStateForPosition(positionId: string): TrailingStopState | undefined {
    return this.trailingStopStates.get(positionId);
  }

  // =================== UTILITY METHODS ===================

  /**
   * Get default thresholds
   */
  static getDefaultThresholds(): ProfitProtectionThresholds {
    return { ...this.DEFAULT_THRESHOLDS };
  }

  /**
   * Validate thresholds configuration
   */
  static validateThresholds(thresholds: Partial<ProfitProtectionThresholds>): string[] {
    const errors: string[] = [];

    if (thresholds.riskRewardLevels !== undefined) {
      if (!Array.isArray(thresholds.riskRewardLevels) || thresholds.riskRewardLevels.length === 0) {
        errors.push('riskRewardLevels must be a non-empty array');
      } else if (!thresholds.riskRewardLevels.every(level => level > 0)) {
        errors.push('All riskRewardLevels must be positive');
      }
    }

    if (thresholds.partialProfitTakes !== undefined) {
      const total = thresholds.partialProfitTakes.reduce((sum, pct) => sum + pct, 0);
      if (Math.abs(total - 100) > 1) {
        errors.push('partialProfitTakes must sum to approximately 100%');
      }
    }

    if (thresholds.maxLossPercent !== undefined && thresholds.maxLossPercent <= 0) {
      errors.push('maxLossPercent must be positive');
    }

    if (thresholds.emergencyStopLoss !== undefined && thresholds.emergencyStopLoss <= 0) {
      errors.push('emergencyStopLoss must be positive');
    }

    if (thresholds.trailingStopDistance !== undefined && thresholds.trailingStopDistance <= 0) {
      errors.push('trailingStopDistance must be positive');
    }

    return errors;
  }
}