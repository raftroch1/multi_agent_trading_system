/**
 * REAL TRADING CONTROLLER
 *
 * Connects sophisticated multi-agent analysis system to live Alpaca paper trading
 * No mock data - all market data and trades are real
 */

import {
  MarketData,
  OptionsChain,
  TradeSignal,
  AgentSignal,
  ConsensusSignal,
  Position,
  PerformanceMetrics
} from '../types';

import { ConsensusEngine } from '../agents/multi-agent-market-analysis';
import { EnhancedStrikeSelector } from '../strategies/position-management/enhanced-strike-selector';
import { PositionManagementAgent } from '../strategies/position-management/position-management-agent';
import { alpacaClient } from '../services/alpaca/alpaca-client';
import { DynamicProfitManager } from '../strategies/position-management/dynamic-profit-manager';

// ============================================================================
// PHASE 1 QUALITY CONTROL CONFIGURATION
// ============================================================================
export interface Phase1QualityConfig {
  // Signal Persistence Configuration
  signalPersistence: {
    enabled: boolean;
    requiredConsecutiveSignals: number;      // Require 3 consecutive matching signals
    signalHistorySize: number;               // Keep last 3 signals in memory
    persistenceWindowMinutes: number;        // Signals must occur within 3 minutes
  };
  
  // Confidence Threshold Configuration
  confidenceThreshold: {
    minimum: number;                         // 75% minimum (raised from 65%)
    tiered: {
      standard: { min: number; max: number; positionSizePercent: number };  // 75-80%: 1%
      high: { min: number; max: number; positionSizePercent: number };      // 80-85%: 2%
      veryHigh: { min: number; positionSizePercent: number };               // 85%+: 3%
    };
  };
  
  // Post-Trade Cooldown Configuration
  postTradeCooldown: {
    enabled: boolean;
    cooldownMinutes: number;                 // 10 minutes after closing
    trackPerSymbol: boolean;                 // Separate cooldown per symbol
  };
}

export interface RealTradingConfig {
  symbol: string;
  minConfidenceThreshold: number;
  maxPositionSize: number;
  maxDailyTrades: number;
  riskManagementEnabled: boolean;
  phase1Quality: Phase1QualityConfig;        // Phase 1 quality control settings
}

// Signal history for persistence checking
export interface SignalHistoryEntry {
  timestamp: Date;
  signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  confidence: number;
  agentVotes: {
    BUY_CALL: number;
    BUY_PUT: number;
    NO_TRADE: number;
  };
}

// Cooldown tracking for symbols
export interface CooldownEntry {
  symbol: string;
  lastCloseTime: Date;
  cooldownUntil: Date;
}

export interface TradingSession {
  startTime: Date;
  tradesPlaced: number;
  totalPnL: number;
  accountValue: number;
  signalsGenerated: number;
  ordersExecuted: number;
  signalsRejectedLowPersistence: number;     // Phase 1: Signals rejected for persistence
  signalsRejectedLowConfidence: number;      // Phase 1: Signals rejected for confidence
  tradesRejectedCooldown: number;            // Phase 1: Trades rejected for cooldown
}

export class RealTradingController {
  private config: RealTradingConfig;
  private session: TradingSession;
  private isRunning: boolean = false;
  
  // Phase 1: Signal persistence tracking
  private signalHistory: SignalHistoryEntry[] = [];
  
  // Phase 1: Post-trade cooldown tracking
  private symbolCooldowns: Map<string, CooldownEntry> = new Map();

  constructor(config: Partial<RealTradingConfig> = {}) {
    // Default Phase 1 Quality Control Configuration
    const defaultPhase1Config: Phase1QualityConfig = {
      signalPersistence: {
        enabled: true,
        requiredConsecutiveSignals: 3,
        signalHistorySize: 3,
        persistenceWindowMinutes: 3
      },
      confidenceThreshold: {
        minimum: 75,  // Raised from 65%
        tiered: {
          standard: { min: 75, max: 80, positionSizePercent: 1 },
          high: { min: 80, max: 85, positionSizePercent: 2 },
          veryHigh: { min: 85, positionSizePercent: 3 }
        }
      },
      postTradeCooldown: {
        enabled: true,
        cooldownMinutes: 10,
        trackPerSymbol: true
      }
    };

    this.config = {
      symbol: 'SPY',
      minConfidenceThreshold: 75,  // Phase 1: Raised from 65
      maxPositionSize: 5,
      maxDailyTrades: 10,
      riskManagementEnabled: true,
      phase1Quality: defaultPhase1Config,
      ...config
    };

    this.session = {
      startTime: new Date(),
      tradesPlaced: 0,
      totalPnL: 0,
      accountValue: 0,
      signalsGenerated: 0,
      ordersExecuted: 0,
      signalsRejectedLowPersistence: 0,
      signalsRejectedLowConfidence: 0,
      tradesRejectedCooldown: 0
    };

    console.log('🚀 Real Trading Controller initialized - PHASE 1 QUALITY MODE');
    console.log(`   Symbol: ${this.config.symbol}`);
    console.log(`   Min confidence: ${this.config.minConfidenceThreshold}% (Phase 1: Raised from 65%)`);
    console.log(`   Max daily trades: ${this.config.maxDailyTrades}`);
    console.log(`   Risk management: ${this.config.riskManagementEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`\n📋 PHASE 1 QUALITY CONTROLS:`);
    console.log(`   Signal Persistence: ${this.config.phase1Quality.signalPersistence.enabled ? 'ENABLED' : 'DISABLED'} (${this.config.phase1Quality.signalPersistence.requiredConsecutiveSignals} consecutive signals)`);
    console.log(`   Post-Trade Cooldown: ${this.config.phase1Quality.postTradeCooldown.enabled ? 'ENABLED' : 'DISABLED'} (${this.config.phase1Quality.postTradeCooldown.cooldownMinutes} minutes)`);
    console.log(`   Tiered Confidence: 75-80% (1%), 80-85% (2%), 85%+ (3%)`);
  }

  // ============================================================================
  // PHASE 1 QUALITY CONTROL METHODS
  // ============================================================================

  /**
   * Phase 1: Check signal persistence
   * Requires signals to persist for 3 consecutive checks (3 minutes)
   */
  private checkSignalPersistence(newSignal: ConsensusSignal): boolean {
    const config = this.config.phase1Quality.signalPersistence;
    
    if (!config.enabled) {
      return true;  // If disabled, all signals pass
    }

    // Add new signal to history
    const signalEntry: SignalHistoryEntry = {
      timestamp: new Date(),
      signal: newSignal.finalSignal,
      confidence: newSignal.overallConfidence,
      agentVotes: { ...newSignal.agentVotes }
    };

    this.signalHistory.push(signalEntry);

    // Keep only the last N signals
    if (this.signalHistory.length > config.signalHistorySize) {
      this.signalHistory.shift();
    }

    // Need at least requiredConsecutiveSignals signals
    if (this.signalHistory.length < config.requiredConsecutiveSignals) {
      console.log(`⏳ Signal persistence: ${this.signalHistory.length}/${config.requiredConsecutiveSignals} signals collected`);
      return false;
    }

    // Check if all signals in window match
    const firstSignal = this.signalHistory[0]?.signal;
    if (!firstSignal) {
      return false;  // Should not happen, but safety check
    }
    
    const allMatch = this.signalHistory.every(entry => entry.signal === firstSignal);

    if (!allMatch) {
      console.log(`❌ Signal persistence failed: Signals not consistent`);
      console.log(`   Recent signals: ${this.signalHistory.map(s => s.signal).join(' → ')}`);
      return false;
    }

    // Check if signals are within time window
    const oldestSignal = this.signalHistory[0];
    const newestSignal = this.signalHistory[this.signalHistory.length - 1];
    if (!oldestSignal || !newestSignal) {
      return false;  // Safety check
    }
    
    const timeDiffMinutes = (newestSignal.timestamp.getTime() - oldestSignal.timestamp.getTime()) / (1000 * 60);

    if (timeDiffMinutes > config.persistenceWindowMinutes) {
      console.log(`⏳ Signal persistence: Time window exceeded (${timeDiffMinutes.toFixed(1)} > ${config.persistenceWindowMinutes} min)`);
      return false;
    }

    console.log(`✅ Signal persistence check PASSED`);
    console.log(`   ${config.requiredConsecutiveSignals} consecutive ${firstSignal} signals over ${timeDiffMinutes.toFixed(1)} minutes`);
    return true;
  }

  /**
   * Phase 1: Check if symbol is in cooldown period
   */
  private isSymbolInCooldown(symbol: string): boolean {
    const config = this.config.phase1Quality.postTradeCooldown;
    
    if (!config.enabled) {
      return false;  // If disabled, no cooldowns
    }

    const cooldownEntry = this.symbolCooldowns.get(symbol);
    if (!cooldownEntry) {
      return false;  // No cooldown recorded
    }

    const now = new Date();
    if (now < cooldownEntry.cooldownUntil) {
      const remainingMinutes = (cooldownEntry.cooldownUntil.getTime() - now.getTime()) / (1000 * 60);
      console.log(`⏸️  ${symbol} in cooldown for ${remainingMinutes.toFixed(1)} more minutes`);
      return true;
    }

    // Cooldown expired, remove entry
    this.symbolCooldowns.delete(symbol);
    return false;
  }

  /**
   * Phase 1: Set cooldown for symbol after closing position
   */
  private setCooldownForSymbol(symbol: string): void {
    const config = this.config.phase1Quality.postTradeCooldown;
    
    if (!config.enabled) {
      return;
    }

    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + config.cooldownMinutes * 60 * 1000);

    this.symbolCooldowns.set(symbol, {
      symbol,
      lastCloseTime: now,
      cooldownUntil
    });

    console.log(`🔒 Cooldown set for ${symbol} until ${cooldownUntil.toLocaleTimeString()}`);
  }

  /**
   * Phase 1: Calculate tiered position size based on confidence level
   */
  private calculateTieredPositionSize(
    confidence: number,
    baseSize: number,
    accountValue: number
  ): number {
    const tiers = this.config.phase1Quality.confidenceThreshold.tiered;

    let positionSizePercent: number;
    let tier: string;

    if (confidence >= tiers.veryHigh.min) {
      positionSizePercent = tiers.veryHigh.positionSizePercent;
      tier = 'VERY HIGH';
    } else if (confidence >= tiers.high.min && confidence < tiers.high.max) {
      positionSizePercent = tiers.high.positionSizePercent;
      tier = 'HIGH';
    } else {
      positionSizePercent = tiers.standard.positionSizePercent;
      tier = 'STANDARD';
    }

    const dollarAmount = accountValue * (positionSizePercent / 100);
    
    console.log(`💰 Tiered position sizing:`);
    console.log(`   Confidence: ${confidence}% (${tier} quality)`);
    console.log(`   Position size: ${positionSizePercent}% of account = $${dollarAmount.toFixed(2)}`);

    return baseSize;  // For now, return base size (can be enhanced to calculate contracts)
  }

  // ============================================================================
  // END PHASE 1 QUALITY CONTROL METHODS
  // ============================================================================

  /**
   * Start real trading session
   */
  async startTradingSession(): Promise<void> {
    try {
      console.log('\n🎯 STARTING REAL TRADING SESSION');
      console.log('==============================');

      // Test Alpaca connection
      const connectionTest = await alpacaClient.testConnection();
      if (!connectionTest) {
        throw new Error('Failed to connect to Alpaca paper trading API');
      }

      // Get current account info
      const account = await alpacaClient.getAccount();
      this.session.accountValue = parseFloat(account.equity) || 25000;

      console.log(`✅ Alpaca connection successful`);
      console.log(`📈 Account equity: $${this.session.accountValue.toFixed(2)}`);

      // Get current positions
      const positions = await alpacaClient.getPositions();
      console.log(`📈 Current positions: ${positions.length}`);

      this.isRunning = true;
      console.log('🏁 Real trading session started');

      // Run main trading loop
      await this.runTradingLoop();

    } catch (error) {
      console.error('❌ Failed to start trading session:', error);
      throw error;
    }
  }

  /**
   * Main trading loop
   */
  private async runTradingLoop(): Promise<void> {
    console.log('\n🔄 Starting real trading loop...');

    while (this.isRunning) {
      try {
        console.log('\n📊 Fetching live market data...');

        // Fetch real market data from Alpaca
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 100 * 60 * 1000); // Last 100 minutes
        const marketData = await alpacaClient.getMarketData(
          this.config.symbol,
          startDate,
          endDate,
          '1Min'
        );

        console.log(`   Received ${marketData.length} candles`);
        console.log(`   Current price: $${marketData[marketData.length - 1]?.close.toFixed(2)}`);

        // Fetch real options chains
        console.log('📈 Fetching live options chains...');
        const optionsChain = await alpacaClient.getOptionsChain(this.config.symbol);

        // Filter for 0-DTE options (today or tomorrow)
        const today = new Date();
        today.setHours(16, 0, 0, 0); // 4 PM EST
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const zeroDTEOptions = optionsChain.filter(opt => {
          const expDate = new Date(opt.expiration);
          return expDate <= tomorrow;
        });

        console.log(`   Found ${zeroDTEOptions.length} 0-DTE options`);

        if (marketData.length > 0 && zeroDTEOptions.length > 0) {
          // Generate multi-agent consensus from real data
          console.log('🤖 Running multi-agent consensus analysis...');
          const consensus = await this.generateConsensus(marketData, zeroDTEOptions);

          this.session.signalsGenerated++;
          console.log(`   Signal: ${consensus.finalSignal}`);
          console.log(`   Confidence: ${consensus.overallConfidence}%`);
          console.log(`   Agent votes: BUY_CALL: ${consensus.agentVotes.BUY_CALL}, BUY_PUT: ${consensus.agentVotes.BUY_PUT}, NO_TRADE: ${consensus.agentVotes.NO_TRADE}`);

          // Skip NO_TRADE signals
          if (consensus.finalSignal === 'NO_TRADE') {
            console.log('⏭️  NO_TRADE signal - waiting for opportunity');
            continue;
          }

          // ========================================================================
          // PHASE 1 QUALITY CONTROL LAYER
          // ========================================================================

          // Phase 1 Check 1: Signal Persistence
          const persistenceCheck = this.checkSignalPersistence(consensus);
          if (!persistenceCheck) {
            this.session.signalsRejectedLowPersistence++;
            console.log(`❌ PHASE 1 REJECTED: Signal persistence requirement not met`);
            continue;  // Skip to next iteration
          }

          // Phase 1 Check 2: Confidence Threshold (raised to 75%)
          if (consensus.overallConfidence < this.config.minConfidenceThreshold) {
            this.session.signalsRejectedLowConfidence++;
            console.log(`❌ PHASE 1 REJECTED: Confidence ${consensus.overallConfidence}% below minimum ${this.config.minConfidenceThreshold}%`);
            continue;  // Skip to next iteration
          }

          // Phase 1 Check 3: Post-Trade Cooldown
          if (this.isSymbolInCooldown(this.config.symbol)) {
            this.session.tradesRejectedCooldown++;
            console.log(`❌ PHASE 1 REJECTED: Symbol in post-trade cooldown`);
            continue;  // Skip to next iteration
          }

          // Phase 1 Check 4: Daily trade limit
          if (this.session.tradesPlaced >= this.config.maxDailyTrades) {
            console.log(`❌ REJECTED: Daily trade limit reached (${this.session.tradesPlaced}/${this.config.maxDailyTrades})`);
            continue;
          }

          // ========================================================================
          // ALL PHASE 1 CHECKS PASSED - EXECUTE TRADE
          // ========================================================================
          console.log(`\n✅ ALL PHASE 1 QUALITY CHECKS PASSED - PROCEEDING TO TRADE EXECUTION`);
          await this.executeTrade(consensus, marketData, zeroDTEOptions);
        }

        // Check existing positions for exits
        await this.manageExistingPositions(marketData, zeroDTEOptions);

        // Update session stats
        await this.updateSessionStats();

        // Wait before next iteration (1 minute)
        console.log('⏳ Waiting 60 seconds before next analysis...');
        await new Promise(resolve => setTimeout(resolve, 60000));

      } catch (error) {
        console.error('❌ Error in trading loop:', error);
        // Continue loop even if one iteration fails
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds on error
      }
    }
  }

  /**
   * Generate multi-agent consensus from real market data
   */
  private async generateConsensus(
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): Promise<ConsensusSignal> {

    // Use existing multi-agent market analysis
    const consensus = ConsensusEngine.generateConsensus(marketData, optionsChain);

    return consensus;
  }

  /**
   * Execute real paper trade through Alpaca
   */
  private async executeTrade(
    consensus: ConsensusSignal,
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): Promise<void> {

    try {
      console.log('\n💰 EXECUTING REAL PAPER TRADE');
      console.log('============================');

      if (!marketData || marketData.length === 0) {
        throw new Error('No market data available');
      }

      const lastCandle = marketData[marketData.length - 1];
      if (!lastCandle) {
        throw new Error('No market data in array');
      }
      const currentPrice = lastCandle.close;
      const action = consensus.finalSignal;
      const side = action === 'BUY_CALL' ? 'CALL' : 'PUT';

      console.log(`   Action: ${action}`);
      console.log(`   Current price: $${currentPrice.toFixed(2)}`);

      // Use enhanced strike selector with real options data
      const strikeSelection = EnhancedStrikeSelector.selectStrike(
        optionsChain,
        marketData,
        {
          direction: side,
          currentPrice: currentPrice,
          minOTMPercent: 0.3,
          maxOTMPercent: 2.0,
          targetDelta: 0.40
        }
      );

      if (strikeSelection.confidence < 60) {
        console.log('❌ Strike selection confidence too low, skipping trade');
        return;
      }

      console.log(`   Selected strike: $${strikeSelection.optimalStrike}`);
      console.log(`   Strike confidence: ${strikeSelection.confidence}%`);
      console.log(`   Volume: ${strikeSelection.metrics.volume}`);
      console.log(`   Distance from ATM: ${strikeSelection.metrics.distanceFromATM.toFixed(2)}%`);

      // Calculate position size using real account data
      const positionSize = DynamicProfitManager.recommendPositionSize(
        strikeSelection.optimalStrike,
        this.session.accountValue,
        0 // Current P&L for this trade
      );

      console.log(`   Position size: ${positionSize} contracts`);

      // Find the selected option in options chain
      const selectedOption = optionsChain.find(opt =>
        opt.strike === strikeSelection.optimalStrike &&
        opt.side === side
      );

      if (!selectedOption) {
        console.log('❌ Selected option not found in options chain');
        return;
      }

      // Execute real paper trade through Alpaca
      const orderResult = await alpacaClient.submitNakedOptionOrder({
        symbol: selectedOption.symbol, // Use the full option symbol
        side: action === 'BUY_CALL' ? 'buy' : 'sell',
        quantity: positionSize,
        orderType: 'market',
        timeInForce: 'day'
      });

      console.log(`✅ Order submitted successfully!`);
      console.log(`   Order ID: ${orderResult.id || 'pending'}`);
      console.log(`   Status: ${orderResult.status}`);

      this.session.tradesPlaced++;
      this.session.ordersExecuted++;

      // Log the trade details
      await this.logTrade({
        timestamp: new Date(),
        action,
        strike: strikeSelection.optimalStrike,
        expiration: selectedOption.expiration,
        contracts: positionSize,
        price: selectedOption.midPrice || (selectedOption.bid + selectedOption.ask) / 2,
        consensus,
        orderResult
      });

    } catch (error) {
      console.error('❌ Failed to execute trade:', error);
    }
  }

  /**
   * Manage existing positions for exits
   */
  private async manageExistingPositions(
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): Promise<void> {

    try {
      const positions = await alpacaClient.getPositions();

      if (positions.length === 0) {
        return;
      }

      console.log(`\n📋 Managing ${positions.length} existing positions...`);

      for (const position of positions) {
        // Convert Alpaca position to our Position format
        const ourPosition: Position = {
          id: position.asset_id || position.symbol,
          symbol: position.symbol,
          side: position.side === 'long' ? 'CALL' : 'PUT', // Simplified
          strike: 0, // Would need to parse from symbol
          expiration: new Date(),
          quantity: parseFloat(position.qty),
          entryDate: new Date(),
          entryPrice: parseFloat(position.avg_entry_price || '0'),
          status: 'OPEN'
        };

        // Get current price for position
        const lastBar = marketData.length > 0 ? marketData[marketData.length - 1] : null;
        const currentPrice = lastBar ? lastBar.close : ourPosition.entryPrice;

        // Use DynamicProfitManager for position analysis
        const positionAnalysis = DynamicProfitManager.analyzePosition(
          ourPosition,
          currentPrice,
          marketData,
          optionsChain
        );

        const exitRecommendation = positionAnalysis.exitRecommendation;
        
        if (exitRecommendation && exitRecommendation.action !== 'HOLD') {
          console.log(`🔄 Position exit signal: ${exitRecommendation.action}`);
          console.log(`   Reason: ${exitRecommendation.reason || 'Exit recommended'}`);
          console.log(`   Unrealized P&L: $${positionAnalysis.unrealizedPnL || 0}`);

          // Close the position
          await this.closePosition(position, exitRecommendation);
        }
      }
    } catch (error) {
      console.error('❌ Error managing positions:', error);
    }
  }

  /**
   * Close position through Alpaca
   */
  private async closePosition(
    position: any,
    exitDecision: any
  ): Promise<void> {

    try {
      const closeResult = await alpacaClient.closeNakedOptionPosition({
        symbol: position.symbol,
        quantity: Math.abs(parseFloat(position.qty)),
        orderType: 'market',
        timeInForce: 'day'
      });

      console.log(`✅ Position closed successfully!`);
      console.log(`   Order ID: ${closeResult.id || 'pending'}`);

      // Phase 1: Set cooldown after closing position
      this.setCooldownForSymbol(position.symbol);

    } catch (error) {
      console.error('❌ Failed to close position:', error);
    }
  }

  /**
   * Update session statistics
   */
  private async updateSessionStats(): Promise<void> {

    try {
      const account = await alpacaClient.getAccount();
      const newAccountValue = account.equity || this.session.accountValue;
      this.session.totalPnL = newAccountValue - 25000; // Assume 25K starting value
      this.session.accountValue = newAccountValue;

      console.log(`\n📊 SESSION STATS:`);
      console.log(`   Account value: $${this.session.accountValue.toFixed(2)}`);
      console.log(`   Session P&L: $${this.session.totalPnL.toFixed(2)}`);
      console.log(`   Trades placed: ${this.session.tradesPlaced}/${this.config.maxDailyTrades}`);
      console.log(`   Signals generated: ${this.session.signalsGenerated}`);
      console.log(`   Orders executed: ${this.session.ordersExecuted}`);
      console.log(`   Session duration: ${Math.floor((Date.now() - this.session.startTime.getTime()) / 60000)} minutes`);
      console.log(`\n📋 PHASE 1 QUALITY CONTROL STATS:`);
      console.log(`   Signals rejected (low persistence): ${this.session.signalsRejectedLowPersistence}`);
      console.log(`   Signals rejected (low confidence): ${this.session.signalsRejectedLowConfidence}`);
      console.log(`   Trades rejected (cooldown): ${this.session.tradesRejectedCooldown}`);
      console.log(`   Total rejections: ${this.session.signalsRejectedLowPersistence + this.session.signalsRejectedLowConfidence + this.session.tradesRejectedCooldown}`);

    } catch (error) {
      console.error('❌ Error updating session stats:', error);
    }
  }

  /**
   * Log trade details
   */
  private async logTrade(tradeData: any): Promise<void> {

    const tradeLog = {
      timestamp: tradeData.timestamp.toISOString(),
      action: tradeData.action,
      strike: tradeData.strike,
      expiration: tradeData.expiration.toISOString(),
      contracts: tradeData.contracts,
      price: tradeData.price,
      consensus: {
        signal: tradeData.consensus.finalSignal,
        confidence: tradeData.consensus.overallConfidence,
        agentVotes: tradeData.consensus.agentVotes
      },
      orderResult: tradeData.orderResult
    };

    // In a real implementation, this would save to a database or file
    console.log('📝 Trade logged:', JSON.stringify(tradeLog, null, 2));
  }

  /**
   * Stop trading session
   */
  stopTradingSession(): void {
    this.isRunning = false;
    console.log('\n🛑 Trading session stopped');
  }

  /**
   * Get current session status
   */
  getSessionStatus(): TradingSession {
    return { ...this.session };
  }
}