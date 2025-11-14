/**
 * SPY TRADING SYSTEM - MAIN ENTRY POINT
 *
 * 0-DTE Naked Options Trading System
 * Multi-agent consensus + Alpaca integration
 *
 * Architecture:
 * - Sophisticated multi-agent analysis (preserved)
 * - Clean execution layer (naked options)
 * - Real Alpaca paper trading integration
 */

import { alpacaClient } from './services/alpaca/alpaca-client';
import { MarketData, OptionsChain, ConsensusSignal } from './types';

// Import your sophisticated agents
import { ConsensusEngine } from './agents/multi-agent-market-analysis';

// Import position management (excellent system)
import { DynamicProfitManager } from './strategies/position-management/dynamic-profit-manager';
import { EnhancedStrikeSelector } from './strategies/position-management/enhanced-strike-selector';

export interface TradingSystemConfig {
  accountSize: number;
  dailyTarget: number;
  maxRiskPerTrade: number;
  paperTrading: boolean;
}

export class SpyTradingSystem {
  private config: TradingSystemConfig;
  private isInitialized: boolean = false;

  constructor(config: TradingSystemConfig) {
    this.config = {
      accountSize: 25000,
      dailyTarget: 300,
      maxRiskPerTrade: 0.03, // 3%
      paperTrading: true,
      ...config
    };
  }

  /**
   * Initialize the trading system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing SPY Trading System...');
      console.log(`   Account Size: $${this.config.accountSize.toLocaleString()}`);
      console.log(`   Daily Target: $${this.config.dailyTarget}`);
      console.log(`   Max Risk/Trade: ${(this.config.maxRiskPerTrade * 100).toFixed(1)}%`);

      // Test Alpaca connection
      if (this.config.paperTrading) {
        const connectionTest = await alpacaClient.testConnection();
        if (!connectionTest) {
          throw new Error('Failed to connect to Alpaca paper trading');
        }
        console.log('✅ Alpaca paper trading connected');
      }

      // Initialize position management
      DynamicProfitManager.resetDaily();

      this.isInitialized = true;
      console.log('✅ SPY Trading System initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize trading system:', error);
      return false;
    }
  }

  /**
   * Run complete trading cycle
   */
  async runTradingCycle(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      console.log('\n🔄 Running trading cycle...');

      // 1. Get current market data
      const marketData = await this.getMarketData();
      const currentPrice = marketData[marketData.length - 1].close;
      console.log(`   Current SPY: $${currentPrice.toFixed(2)}`);

      // 2. Get options chain
      const optionsChain = await this.getOptionsChain();

      // 3. Generate multi-agent consensus signal
      console.log('   🤖 Analyzing with multi-agent consensus...');
      const consensus = await this.generateConsensusSignal(marketData, optionsChain);
      console.log(`   Consensus: ${consensus.finalSignal} (${consensus.overallConfidence}% confidence)`);
      console.log(`   Reasoning: ${consensus.consensusReasoning.slice(0, 2).join(', ')}`);

      // 4. Execute trade if signal is strong
      if (consensus.finalSignal !== 'NO_TRADE' && consensus.overallConfidence >= 65) {
        await this.executeTrade(consensus, marketData, optionsChain);
      } else {
        console.log('   ⏸️ No trade signal - waiting for next opportunity');
      }

      // 5. Monitor existing positions
      await this.monitorPositions();

    } catch (error) {
      console.error('❌ Error in trading cycle:', error);
    }
  }

  /**
   * Get current market data for SPY
   */
  private async getMarketData(): Promise<MarketData[]> {
    // For now, return mock data - integrate with real data feed later
    const now = new Date();
    return [{
      id: 'spy_1',
      symbol: 'SPY',
      date: now,
      open: 450,
      high: 452,
      low: 448,
      close: 451,
      volume: BigInt(1000000),
      createdAt: now
    }];
  }

  /**
   * Get 0-DTE options chain
   */
  private async getOptionsChain(): Promise<OptionsChain[]> {
    try {
      return await alpacaClient.getOptionsChain('SPY');
    } catch (error) {
      console.error('Error getting options chain:', error);
      return [];
    }
  }

  /**
   * Generate consensus signal from multi-agent system
   */
  private async generateConsensusSignal(
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): Promise<ConsensusSignal> {
    // Use your existing sophisticated multi-agent system
    return ConsensusEngine.generateConsensus(marketData, optionsChain, 0.25);
  }

  /**
   * Execute trade based on consensus signal
   */
  private async executeTrade(
    consensus: ConsensusSignal,
    marketData: MarketData[],
    optionsChain: OptionsChain[]
  ): Promise<void> {
    try {
      console.log(`🎯 Executing ${consensus.finalSignal} trade...`);

      // Select optimal strike using your existing selector
      const currentPrice = marketData[marketData.length - 1].close;
      const strikeSelection = EnhancedStrikeSelector.selectStrike(
        optionsChain.filter(opt => opt.side === (consensus.finalSignal === 'BUY_CALL' ? 'CALL' : 'PUT')),
        marketData,
        {
          direction: consensus.finalSignal === 'BUY_CALL' ? 'CALL' : 'PUT',
          currentPrice,
          minOTMPercent: 0.003,
          maxOTMPercent: 0.02
        }
      );

      if (!strikeSelection) {
        console.log('❌ No suitable strike found');
        return;
      }

      console.log(`   Selected: $${strikeSelection.optimalStrike} (Score: ${strikeSelection.confidence}%)`);

      // Calculate position size
      const positionSize = DynamicProfitManager.recommendPositionSize(
        strikeSelection.optimalStrike,
        this.config.accountSize,
        0 // current P&L
      );

      console.log(`   Position size: ${positionSize} contracts`);

      // TODO: Execute actual trade with Alpaca
      console.log('   🚀 Trade execution planned (implement actual execution)');

    } catch (error) {
      console.error('❌ Error executing trade:', error);
    }
  }

  /**
   * Monitor existing positions
   */
  private async monitorPositions(): Promise<void> {
    try {
      const positions = await this.getCurrentPositions();

      if (positions.length > 0) {
        console.log(`📊 Monitoring ${positions.length} position(s)`);

        for (const position of positions) {
          // Use your existing position management system
          const analysis = DynamicProfitManager.analyzePosition(
            position,
            451, // current price (mock for now)
            null, // market data
            null  // options chain
          );

          console.log(`   ${position.symbol}: ${analysis.exitRecommendation.action} - ${analysis.exitRecommendation.reason}`);
        }
      }

    } catch (error) {
      console.error('❌ Error monitoring positions:', error);
    }
  }

  /**
   * Get current positions
   */
  private async getCurrentPositions(): Promise<any[]> {
    try {
      return await alpacaClient.getPositions();
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  /**
   * Get daily progress summary
   */
  getDailyProgress(): any {
    return DynamicProfitManager.getDailyProgressSummary();
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down SPY Trading System...');
    // Close any open connections, save state, etc.
    this.isInitialized = false;
    console.log('✅ System shutdown complete');
  }
}

// Export for easy usage
export default SpyTradingSystem;

// Convenience function for quick start
export async function startTrading(config?: Partial<TradingSystemConfig>): Promise<SpyTradingSystem> {
  const system = new SpyTradingSystem({
    accountSize: 25000,
    dailyTarget: 300,
    maxRiskPerTrade: 0.03,
    paperTrading: true,
    ...config
  });

  const initialized = await system.initialize();
  if (!initialized) {
    throw new Error('Failed to initialize trading system');
  }

  return system;
}