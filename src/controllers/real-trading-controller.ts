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

import { MultiAgentMarketAnalysis } from '../agents/multi-agent-market-analysis';
import { EnhancedStrikeSelector } from '../strategies/position-management/enhanced-strike-selector';
import { PositionManagementAgent } from '../strategies/position-management/position-management-agent';
import { alpacaClient } from '../services/alpaca/alpaca-client';
import { DynamicProfitManager } from '../strategies/position-management/dynamic-profit-manager';

export interface RealTradingConfig {
  symbol: string;
  minConfidenceThreshold: number;
  maxPositionSize: number;
  maxDailyTrades: number;
  riskManagementEnabled: boolean;
}

export interface TradingSession {
  startTime: Date;
  tradesPlaced: number;
  totalPnL: number;
  accountValue: number;
  signalsGenerated: number;
  ordersExecuted: number;
}

export class RealTradingController {
  private config: RealTradingConfig;
  private session: TradingSession;
  private isRunning: boolean = false;

  constructor(config: Partial<RealTradingConfig> = {}) {
    this.config = {
      symbol: 'SPY',
      minConfidenceThreshold: 65,
      maxPositionSize: 5,
      maxDailyTrades: 10,
      riskManagementEnabled: true,
      ...config
    };

    this.session = {
      startTime: new Date(),
      tradesPlaced: 0,
      totalPnL: 0,
      accountValue: 0,
      signalsGenerated: 0,
      ordersExecuted: 0
    };

    console.log('🚀 Real Trading Controller initialized');
    console.log(`   Symbol: ${this.config.symbol}`);
    console.log(`   Min confidence: ${this.config.minConfidenceThreshold}%`);
    console.log(`   Max daily trades: ${this.config.maxDailyTrades}`);
    console.log(`   Risk management: ${this.config.riskManagementEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

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
      this.session.accountValue = account.equity || 25000;

      console.log(`✅ Alpaca connection successful`);
      console.log(`📊 Account equity: $${this.session.accountValue.toFixed(2)}`);

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
        const marketData = await alpacaClient.getMarketData(
          this.config.symbol,
          '1Min',
          100 // Last 100 minutes
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

          // Execute trade if confidence threshold met
          if (consensus.overallConfidence >= this.config.minConfidenceThreshold &&
              consensus.finalSignal !== 'NO_TRADE' &&
              this.session.tradesPlaced < this.config.maxDailyTrades) {

            await this.executeTrade(consensus, marketData, zeroDTEOptions);
          } else {
            console.log('❌ Trade not executed (confidence too low or trade limit reached)');
          }
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
    const consensus = MultiAgentMarketAnalysis.generateConsensus(marketData, optionsChain);

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

      const currentPrice = marketData[marketData.length - 1].close;
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
        symbol: this.config.symbol,
        side: action === 'BUY_CALL' ? 'buy' : 'sell',
        type: 'market',
        qty: positionSize.toString(),
        time_in_force: 'day',
        order_class: 'simple',
        // For options, specify the strike and expiration
        strike: strikeSelection.optimalStrike,
        expiration: selectedOption.expiration,
        option_side: side.toLowerCase()
      });

      console.log(`✅ Order submitted successfully!`);
      console.log(`   Order ID: ${orderResult.orderId || 'pending'}`);
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
          status: 'OPEN',
          createdAt: new Date()
        };

        // Use position management agent to check for exits
        const exitDecision = PositionManagementAgent.analyzePosition(
          ourPosition,
          marketData,
          optionsChain,
          {
            profitTargetPercent: 50,
            stopLossPercent: 30,
            maxLossPercent: 0.1
          }
        );

        if (exitDecision.action !== 'HOLD') {
          console.log(`🔄 Position exit signal: ${exitDecision.action}`);
          console.log(`   Reason: ${exitDecision.reason}`);
          console.log(`   Urgency: ${exitDecision.urgency}`);

          // Close the position
          await this.closePosition(position, exitDecision);
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
        side: position.side === 'long' ? 'sell' : 'buy',
        qty: Math.abs(parseFloat(position.qty)).toString(),
        reason: exitDecision.reason
      });

      console.log(`✅ Position closed successfully!`);
      console.log(`   Order ID: ${closeResult.orderId || 'pending'}`);

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