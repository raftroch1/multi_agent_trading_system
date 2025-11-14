#!/usr/bin/env node

/**
 * REAL TRADING MAIN ENTRY POINT
 *
 * Live 0-DTE SPY options trading with no mock data
 * Uses real Alpaca paper trading API and live market data
 */

import { RealTradingController } from './controllers/real-trading-controller';

async function main() {
  console.log('🚀 SPY 0-DTE OPTIONS TRADING SYSTEM');
  console.log('=================================');
  console.log('📈 Trading Mode: REAL ALPACA PAPER TRADING');
  console.log('📊 Market Data: LIVE - No simulation');
  console.log('⚠️  Risk: REAL paper trading with real market data');
  console.log('');

  try {
    // Initialize real trading controller
    const tradingController = new RealTradingController({
      symbol: 'SPY',
      minConfidenceThreshold: 70,  // High confidence for real trading
      maxPositionSize: 3,          // Conservative position size
      maxDailyTrades: 5,           // Limited daily trades
      riskManagementEnabled: true   // Enable all risk controls
    });

    // Add signal handlers for graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, stopping trading session...');
      tradingController.stopTradingSession();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, stopping trading session...');
      tradingController.stopTradingSession();
      process.exit(0);
    });

    // Start real trading session
    await tradingController.startTradingSession();

  } catch (error) {
    console.error('❌ Fatal error in trading system:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the trading system
main();