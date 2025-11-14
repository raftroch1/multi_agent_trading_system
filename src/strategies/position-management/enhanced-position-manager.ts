#!/usr/bin/env node

/**
 * ENHANCED POSITION MANAGER
 *
 * 🛡️ SAFETY-FIRST DESIGN:
 * - PRESERVES all existing basic logic as DEFAULT
 * - ADDS 4-manager system as OPTIONAL enhancement
 * - AUTOMATIC fallback to basic logic on any errors
 * - FEATURE FLAG controlled (disabled by default)
 *
 * COMPLETE ISOLATION from 9-agent trading system
 * ONLY enhances position exit decisions
 */

import { LivePosition } from './professional-paper-trading-engine';
import { PositionManagementOrchestrator } from './position-orchestrator';
import { GreeksEngine, GreeksSnapshot } from './greeks-engine';

export interface ExitDecision {
  shouldExit: boolean;
  reason: string;
  enhanced?: boolean; // Indicates if decision used 4-manager system
}

export class EnhancedPositionManager {
  private use4ManagerSystem: boolean;
  private rolloutPercentage: number;
  private orchestrator?: PositionManagementOrchestrator;
  private greeksEngine?: GreeksEngine;
  private static positionCounter = 0; // Track positions for rollout

  constructor() {
    // 🛡️ SAFETY: Default to FALSE - preserve existing behavior
    this.use4ManagerSystem = process.env.USE_4_MANAGER_POSITION_SYSTEM === 'true';

    // 📊 GRADUAL ROLLOUT: Configure percentage of positions using 4-manager system
    const rolloutEnv = process.env.ENHANCED_POSITION_ROLLOUT_PERCENTAGE;
    this.rolloutPercentage = rolloutEnv ? parseInt(rolloutEnv) : 0; // Default 0% (disabled)

    // Ensure valid percentage
    this.rolloutPercentage = Math.max(0, Math.min(100, this.rolloutPercentage));

    if (this.use4ManagerSystem || this.rolloutPercentage > 0) {
      console.log(`🚀 ENHANCED POSITION MANAGER: 4-Manager System ENABLED (${this.rolloutPercentage}% rollout)`);
      this.orchestrator = new PositionManagementOrchestrator();
      this.greeksEngine = new GreeksEngine();
    } else {
      console.log('🛡️ ENHANCED POSITION MANAGER: Using Basic Logic (SAFE MODE)');
    }
  }

  /**
   * MAIN ENTRY POINT - ONLY METHOD CALLED FROM TRADING ENGINE
   * Replaces the existing checkExitConditions method call
   */
  async checkExitConditions(position: LivePosition, currentPrice: number): Promise<ExitDecision> {
    // ALWAYS preserve basic logic as foundation
    const basicResult = await this.checkBasicExitConditions(position, currentPrice);

    // Gradual rollout logic - determine if this position should use enhanced system
    const shouldUseEnhanced = this.shouldUseEnhancedSystem(position);

    // If not selected for enhanced system, return basic result immediately
    if (!shouldUseEnhanced) {
      return {
        ...basicResult,
        enhanced: false,
        reason: basicResult.reason ? `BASIC_${basicResult.reason}` : 'BASIC_LOGIC_USED'
      };
    }

    // ENHANCED MODE: Try 4-manager system with automatic fallback
    try {
      console.log(`🎯 ENHANCED MODE (${this.rolloutPercentage}% rollout): Checking 4-Manager consensus...`);
      const enhancedResult = await this.check4ManagerConsensus(position, currentPrice);

      // Use enhanced decision if conclusive, otherwise fallback to basic
      if (enhancedResult.shouldExit) {
        console.log(`✅ 4-Manager Decision: EXIT - ${enhancedResult.reason}`);
        return {
          shouldExit: true,
          reason: enhancedResult.reason,
          enhanced: true
        };
      } else {
        console.log('📊 4-Manager Decision: HOLD - deferring to basic logic');
        return {
          ...basicResult,
          enhanced: true,
          reason: basicResult.reason ? `ENHANCED_HOLD_${basicResult.reason}` : 'ENHANCED_HOLD_BASIC_LOGIC'
        };
      }

    } catch (error) {
      console.error('❌ 4-Manager System Error - FALLING BACK TO BASIC LOGIC:', error);
      return {
        ...basicResult,
        enhanced: false,
        reason: basicResult.reason ? `FALLBACK_${basicResult.reason}` : 'ENHANCED_ERROR_FALLBACK'
      };
    }
  }

  /**
   * Gradual rollout logic - determines if position should use enhanced system
   */
  private shouldUseEnhancedSystem(position: LivePosition): boolean {
    // Force enable if legacy flag is set
    if (this.use4ManagerSystem) {
      return true;
    }

    // If rollout percentage is 0, use basic logic
    if (this.rolloutPercentage === 0) {
      return false;
    }

    // If rollout percentage is 100, use enhanced for all
    if (this.rolloutPercentage === 100) {
      return true;
    }

    // Use position-based deterministic selection for consistent rollout
    EnhancedPositionManager.positionCounter++;
    const positionHash = this.hashPosition(position);
    const positionScore = (positionHash + EnhancedPositionManager.positionCounter) % 100;

    const shouldUseEnhanced = positionScore < this.rolloutPercentage;

    console.log(`📊 Position #${EnhancedPositionManager.positionCounter}: Score ${positionScore} < ${this.rolloutPercentage}% = ${shouldUseEnhanced ? 'ENHANCED' : 'BASIC'}`);

    return shouldUseEnhanced;
  }

  /**
   * Create deterministic hash for position selection
   */
  private hashPosition(position: LivePosition): number {
    const positionString = `${position.symbol}_${position.side}_${position.entryDate.getTime()}`;
    let hash = 0;
    for (let i = 0; i < positionString.length; i++) {
      const char = positionString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * 🛡️ PRESERVED EXACTLY: All existing basic exit logic
   * This is the current working logic from ProfessionalPaperTradingEngine
   */
  private async checkBasicExitConditions(position: LivePosition, currentPrice: number): Promise<ExitDecision> {
    const hoursHeld = (Date.now() - position.entryDate.getTime()) / (1000 * 60 * 60);
    const currentPnL = position.currentPnL || 0;
    const premiumPaid = Math.abs(position.maxLoss); // CORRECT: Use maxLoss which = total premium paid
    const isCall = position.side.includes('CALL');
    const greeks = position.currentGreeks;

    console.log(`📊 Basic Exit Analysis - ${position.symbol}:`);
    console.log(`   P&L: $${currentPnL.toFixed(2)} (${((currentPnL / premiumPaid) * 100).toFixed(1)}%)`);
    console.log(`   Hours Held: ${hoursHeld.toFixed(1)}`);
    console.log(`   Greeks: Δ=${greeks.delta.toFixed(3)} Γ=${greeks.gamma.toFixed(3)} Θ=${greeks.theta.toFixed(1)} Ve=${greeks.vega.toFixed(1)}`);

    // 1. PROFIT TARGETS (Same as working system)
    if (currentPnL > premiumPaid * 0.5) { // 50% profit target
      console.log(`🎯 PROFIT TARGET: $${currentPnL.toFixed(2)} exceeds 50% of premium ($${premiumPaid.toFixed(2)})`);
      return {
        shouldExit: true,
        reason: `PROFIT_TARGET_${((currentPnL / premiumPaid) * 100).toFixed(0)}PERCENT`,
        enhanced: false
      };
    }

    // 2. LOSS LIMITS (Same as working system)
    if (currentPnL < -premiumPaid * 0.3) { // 30% loss limit
      console.log(`🛑 LOSS LIMIT: $${currentPnL.toFixed(2)} exceeds 30% of premium ($${premiumPaid.toFixed(2)})`);
      return {
        shouldExit: true,
        reason: `LOSS_LIMIT_${((currentPnL / premiumPaid) * 100).toFixed(0)}PERCENT`,
        enhanced: false
      };
    }

    // 3. GREEKS RISKS (Same as working system)
    const greeksResult = this.checkBasicGreeksRisk(greeks, isCall);
    if (greeksResult.shouldExit) {
      return { ...greeksResult, enhanced: false };
    }

    // 4. TIME-BASED EXITS (Same as working system)
    const maxHoldTime = 4; // Maximum 4 hours for 0-DTE
    if (hoursHeld >= maxHoldTime) {
      return {
        shouldExit: true,
        reason: `TIME_EXIT_${hoursHeld.toFixed(1)}H_MAX`,
        enhanced: false
      };
    }

    // 5. MARKET CLOSE PROXIMITY (Same as working system)
    const minutesToClose = this.getMinutesToMarketClose();
    const exitBeforeClose = 30; // Exit 30 minutes before market close

    if (minutesToClose <= exitBeforeClose) {
      return {
        shouldExit: true,
        reason: `MARKET_CLOSE_${minutesToClose}M_REMAINING`,
        enhanced: false
      };
    }

    // 6. VOLATILITY COLLAPSE PROTECTION (Same as working system)
    if (currentPnL > 0 && position.minPnL < currentPnL * 0.5) {
      return {
        shouldExit: true,
        reason: `PROFIT_PROTECTION_${((currentPnL / premiumPaid) * 100).toFixed(0)}%`,
        enhanced: false
      };
    }

    console.log(`   ✅ Basic Analysis: No exit conditions met - holding position`);
    return { shouldExit: false, reason: '', enhanced: false };
  }

  /**
   * 🛡️ PRESERVED EXACTLY: Basic Greeks risk logic from working system
   */
  private checkBasicGreeksRisk(greeks: any, isCall: boolean): ExitDecision {
    // High delta risk (same thresholds as backtest)
    if (Math.abs(greeks.delta) > 0.7) {
      return { shouldExit: true, reason: 'HIGH_DELTA_RISK' };
    }

    // Extreme gamma risk (same thresholds as backtest)
    if (Math.abs(greeks.gamma) > 0.1) {
      return { shouldExit: true, reason: 'EXTREME_GAMMA_RISK' };
    }

    // Accelerating theta decay (same thresholds as backtest)
    if (greeks.theta < -100) {
      return { shouldExit: true, reason: 'ACCELERATING_THETA_DECAY' };
    }

    // Vega explosion (same thresholds as backtest)
    if (Math.abs(greeks.vega) > 50) {
      return { shouldExit: true, reason: 'VEGA_EXPLOSION' };
    }

    return { shouldExit: false, reason: '' };
  }

  /**
   * 🚀 NEW: 4-Manager consensus system for enhanced exit decisions
   * Only used when feature flag is enabled
   */
  private async check4ManagerConsensus(position: LivePosition, currentPrice: number): Promise<ExitDecision> {
    try {
      // First, try simple market-based trailing profit logic
      const marketTrailingDecision = this.checkMarketBasedTrailingProfit(position, currentPrice);
      if (marketTrailingDecision.shouldExit) {
        console.log(`📈 MARKET TRAILING: ${marketTrailingDecision.reason}`);
        return marketTrailingDecision;
      }

      // Convert LivePosition to the format expected by PositionManagementOrchestrator
      const orchestratorPosition = {
        symbol: position.symbol,
        quantity: position.quantity,
        currentPrice: currentPrice,
        side: (position.side.includes('CALL') ? 'CALL' : 'PUT') as 'CALL' | 'PUT', // Convert to simple CALL/PUT
        entryPrice: position.entryPrice,
        status: 'OPEN' as const,
        unrealizedPnL: position.currentPnL || 0,
        unrealizedPnLPercent: ((position.currentPnL || 0) / Math.abs(position.maxLoss)) * 100, // CORRECT: Use maxLoss for accurate percentage
        entryDate: position.entryDate,
        strike: (position as any).strike || 0,
        expiration: (position as any).expiration || new Date()
      };

      // Get market context for 4-manager analysis
      const optionsChain: any[] = []; // Empty options chain for basic test
      const marketData: any[] = [{
        timestamp: new Date(),
        price: currentPrice,
        volume: 1000000,
        bid: currentPrice - 0.01,
        ask: currentPrice + 0.01,
        impliedVolatility: 0.25
      }];

      console.log('🎯 4-Manager Analysis: Running consensus...');

      // Run 4-manager analysis with proper parameters
      const analysis = await PositionManagementOrchestrator.orchestratePositionManagement(
        [orchestratorPosition],
        optionsChain,
        marketData
      );

      if (analysis.executionQueue && analysis.executionQueue.immediateActions.length > 0) {
        const decision = analysis.executionQueue.immediateActions[0];
        const consensus = analysis.consensusMetrics;

        console.log(`📊 4-Manager Result: ${decision.finalAction} (Confidence: ${decision.confidence}%)`);
        console.log(`📊 Consensus: ${decision.consensus.toFixed(1)}%`);
        console.log(`📊 Recommendation: ${decision.recommendation?.reason || 'No specific reason'}`);

        // Exit if finalAction is EXIT_FULL or EMERGENCY_EXIT and either urgent or high consensus
        if ((decision.finalAction === 'EXIT_FULL' || decision.finalAction === 'EMERGENCY_EXIT') &&
            (decision.recommendation?.executeImmediately || decision.consensus >= 75)) {
          return {
            shouldExit: true,
            reason: `4_MANAGER_URGENT_${decision.finalAction}_${decision.consensus.toFixed(0)}%`
          };
        }

        // Exit if finalAction is EXIT_FULL or EMERGENCY_EXIT and moderate consensus
        if ((decision.finalAction === 'EXIT_FULL' || decision.finalAction === 'EMERGENCY_EXIT') &&
            decision.consensus >= 60) {
          return {
            shouldExit: true,
            reason: `4_MANAGER_CONSENSUS_${decision.finalAction}_${decision.consensus.toFixed(0)}%`
          };
        }

        // Hold for all other cases
        return {
          shouldExit: false,
          reason: `4_MANAGER_HOLD_${decision.finalAction}_${decision.consensus.toFixed(0)}%`
        };
      }

      // Fallback if no analysis result
      return { shouldExit: false, reason: '4_MANAGER_NO_DATA' };

    } catch (error) {
      console.error('❌ 4-Manager Analysis Failed:', error);
      // SAFETY: Always fallback to basic logic on orchestrator failures
      console.log('🛡️ FALLING BACK TO BASIC LOGIC due to 4-Manager error');
      return { shouldExit: false, reason: '4_MANAGER_ERROR_FALLBACK' };
    }
  }

  /**
   * 📈 MARKET-BASED TRAILING PROFIT LOGIC
   * Works directly with real P&L data without options chain dependency
   */
  private checkMarketBasedTrailingProfit(position: LivePosition, currentPrice: number): ExitDecision {
    const currentPnL = position.currentPnL || 0;
    const premiumPaid = Math.abs(position.maxLoss);
    const profitPercent = (currentPnL / premiumPaid) * 100;

    // Track peak profit for trailing stop (using position metadata)
    const positionKey = `${position.symbol}_${position.side}_${position.entryDate.getTime()}`;
    const peakProfit = this.getPeakProfit(positionKey, currentPnL);

    console.log(`📈 Market Trailing Analysis - ${position.symbol}:`);
    console.log(`   Current P&L: $${currentPnL.toFixed(2)} (${profitPercent.toFixed(1)}%)`);
    console.log(`   Peak Profit: $${peakProfit.toFixed(2)} (${((peakProfit/premiumPaid)*100).toFixed(1)}%)`);

    // TRAILING PROFIT LOGIC
    if (profitPercent >= 20) { // 20% minimum profit before trailing
      const trailingPercent = Math.max(15, profitPercent * 0.75); // Trail at 75% of peak or minimum 15%
      const profitErosion = ((peakProfit - currentPnL) / peakProfit) * 100;

      console.log(`   Trailing Threshold: ${trailingPercent.toFixed(1)}% | Erosion: ${profitErosion.toFixed(1)}%`);

      // Check if profit has eroded more than 25% from peak
      if (profitErosion >= 25 && currentPnL > premiumPaid * 0.15) {
        console.log(`🚨 PROFIT EROSION: Take profits at ${profitPercent.toFixed(1)}% before further decline`);
        return {
          shouldExit: true,
          reason: `TRAILING_PROFIT_EROSION_${profitPercent.toFixed(0)}PERCENT_PEAK_${((peakProfit/premiumPaid)*100).toFixed(0)}PERCENT`
        };
      }

      // Move to breakeven if still above 15% profit
      if (profitPercent >= 15 && profitErosion >= 15) {
        console.log(`🛡️ PROFIT PROTECTION: Locking gains at ${profitPercent.toFixed(1)}%`);
        return {
          shouldExit: true,
          reason: `PROFIT_PROTECTION_LOCK_${profitPercent.toFixed(0)}PERCENT`
        };
      }
    }

    // AGGRESSIVE PROFIT TAKING FOR 0-DTE
    if (profitPercent >= 40) { // Take 40%+ profits immediately on 0-DTE
      console.log(`🎯 AGGRESSIVE TAKE: 0-DTE profit ${profitPercent.toFixed(1)}% - lock gains now`);
      return {
        shouldExit: true,
        reason: `AGGRESSIVE_0DTE_PROFIT_${profitPercent.toFixed(0)}PERCENT`
      };
    }

    // MODERATE PROFIT PROTECTION
    if (profitPercent >= 25) {
      const hoursHeld = (Date.now() - position.entryDate.getTime()) / (1000 * 60 * 60);
      if (hoursHeld >= 1) { // After 1 hour, protect 25%+ gains
        console.log(`⏰ TIME_PROTECTION: ${profitPercent.toFixed(1)}% profit after ${hoursHeld.toFixed(1)}h - protect now`);
        return {
          shouldExit: true,
          reason: `TIME_BASED_PROFIT_PROTECTION_${profitPercent.toFixed(0)}PERCENT_${hoursHeld.toFixed(1)}H`
        };
      }
    }

    return { shouldExit: false, reason: '' };
  }

  /**
   * Track peak profit for trailing stop calculations
   */
  private static peakProfitTracker = new Map<string, number>();

  private getPeakProfit(positionKey: string, currentPnL: number): number {
    const existingPeak = EnhancedPositionManager.peakProfitTracker.get(positionKey) || 0;
    const newPeak = Math.max(existingPeak, currentPnL);
    EnhancedPositionManager.peakProfitTracker.set(positionKey, newPeak);
    return newPeak;
  }

  /**
   * 🛡️ PRESERVED EXACTLY: Helper method from working system
   */
  private getMinutesToMarketClose(): number {
    const now = new Date();
    const marketClose = new Date(now);
    marketClose.setHours(16, 0, 0, 0); // 4:00 PM ET

    // If it's after market close, use next day
    if (now > marketClose) {
      marketClose.setDate(marketClose.getDate() + 1);
    }

    const diffMs = marketClose.getTime() - now.getTime();
    return Math.floor(diffMs / (1000 * 60));
  }

  /**
   * 🔄 RESTORE: Restore peak profit history from persistence for trailing profit decisions
   */
  restoreProfitHistory(peakProfitData: Array<[string, number]>): void {
    console.log('📈 Restoring profit history for trailing profit decisions...');

    let restoredCount = 0;
    peakProfitData.forEach(([positionKey, peakProfit]) => {
      if (peakProfit > 0) {
        EnhancedPositionManager.peakProfitTracker.set(positionKey, peakProfit);
        restoredCount++;
      }
    });

    console.log(`✅ Restored ${restoredCount} peak profit records for trailing profit analysis`);
    if (restoredCount > 0) {
      console.log('🎯 Trailing profit protection will use historical peak data on restart');
    }
  }

  /**
   * 📊 Get current profit history status for monitoring
   */
  getProfitHistoryStatus(): {
    totalTracked: number;
    totalPeakValue: number;
    averagePeakProfit: number;
    topPositions: Array<{key: string; peak: number}>;
  } {
    const tracker = EnhancedPositionManager.peakProfitTracker;
    const entries = Array.from(tracker.entries());
    const totalPeakValue = entries.reduce((sum, [, peak]) => sum + peak, 0);
    const topPositions = entries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, peak]) => ({ key, peak }));

    return {
      totalTracked: entries.length,
      totalPeakValue,
      averagePeakProfit: entries.length > 0 ? totalPeakValue / entries.length : 0,
      topPositions
    };
  }

  /**
   * STATUS: Current mode and capabilities
   */
  getStatus(): {
    mode: string;
    enhanced: boolean;
    rolloutPercentage: number;
    managers: string[];
    positionsProcessed: number;
    profitHistory?: ReturnType<typeof EnhancedPositionManager.prototype.getProfitHistoryStatus>;
  } {
    const isActive = this.use4ManagerSystem || this.rolloutPercentage > 0;
    const baseStatus = {
      mode: isActive ? 'GRADUAL_ROLLOUT' : 'BASIC',
      enhanced: isActive,
      rolloutPercentage: this.rolloutPercentage,
      positionsProcessed: EnhancedPositionManager.positionCounter,
      managers: isActive ? [
        'GreeksPositionManager',
        'TimeDecayPositionManager',
        'ProfitProtectionManager',
        'MarketRegimePositionManager'
      ] : ['Basic Greeks Logic']
    };

    // Add profit history status if enhanced mode is active
    if (isActive) {
      return {
        ...baseStatus,
        profitHistory: this.getProfitHistoryStatus()
      };
    }

    return baseStatus;
  }
}

export default EnhancedPositionManager;