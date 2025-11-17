/**
 * SIMPLE REAL TRADING SYSTEM
 * Minimal version that compiles and runs with live Alpaca data
 */

import { alpacaClient } from './services/alpaca/alpaca-client';

interface TradingConfig {
  symbol: string;
  maxTrades: number;
}

class SimpleRealTrading {
  private config: TradingConfig;
  private tradesPlaced: number = 0;

  constructor(config: TradingConfig) {
    this.config = config;
  }

  async startTrading(): Promise<void> {
    console.log('🚀 Starting Simple Real Trading System');
    console.log('=====================================');

    // Test connection
    const connected = await alpacaClient.testConnection();
    if (!connected) {
      console.log('❌ Failed to connect to Alpaca');
      return;
    }

    console.log('✅ Connected to Alpaca Paper Trading');

    // Get account info
    const account = await alpacaClient.getAccount();
    console.log(`💰 Account Equity: $${account.equity || 'Unknown'}`);

    // Main trading loop
    while (this.tradesPlaced < this.config.maxTrades) {
      try {
        console.log(`\n📊 Trade ${this.tradesPlaced + 1}/${this.config.maxTrades}`);

        // Get current price
        const currentPrice = await alpacaClient.getCurrentPrice(this.config.symbol);
        console.log(`   Current ${this.config.symbol} price: $${currentPrice}`);

        // Get market data
        const marketData = await alpacaClient.getMarketData(
          this.config.symbol,
          '1Min',
          100
        );
        console.log(`   Market data: ${marketData.length} candles`);

        // Get options chain
        const optionsChain = await alpacaClient.getOptionsChain(this.config.symbol);
        console.log(`   Options available: ${optionsChain.length}`);

        // Filter for today's options
        const today = new Date();
        today.setHours(16, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayOptions = optionsChain.filter(opt => {
          const expDate = new Date(opt.expiration);
          return expDate <= tomorrow && expDate >= today;
        });

        console.log(`   0-DTE options: ${todayOptions.length}`);

        if (todayOptions.length > 0) {
          // Simple strategy: buy the OTM call with highest volume
          const callOptions = todayOptions.filter(opt =>
            opt.side === 'CALL' && opt.strike > currentPrice
          );

          if (callOptions.length > 0) {
            // Find the option with highest volume
            const bestOption = callOptions.reduce((best, current) =>
              (current.volume || 0) > (best.volume || 0) ? current : best
            );

            console.log(`🎯 Selected: ${bestOption.side} $${bestOption.strike} (Volume: ${bestOption.volume})`);

            // Execute trade
            await this.executeTrade(bestOption);
            this.tradesPlaced++;
          } else {
            console.log('❌ No suitable call options found');
          }
        }

        // Wait 5 minutes between trades
        console.log('⏳ Waiting 5 minutes...');
        await new Promise(resolve => setTimeout(resolve, 300000));

      } catch (error) {
        console.error('❌ Error in trading loop:', error);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    console.log('\n🏁 Trading session completed');
    console.log(`   Total trades placed: ${this.tradesPlaced}`);
  }

  private async executeTrade(option: any): Promise<void> {
    console.log(`💰 Executing trade: ${option.side} $${option.strike}`);

    try {
      const result = await alpacaClient.submitNakedOptionOrder({
        symbol: this.config.symbol,
        side: 'buy',
        orderType: 'market',
        quantity: 1,
        timeInForce: 'day',
        strike: option.strike,
        expiration: option.expiration,
        option_side: option.side.toLowerCase()
      });

      console.log(`✅ Order submitted: ${result.status}`);
      console.log(`   Order ID: ${result.id || 'pending'}`);

    } catch (error) {
      console.error('❌ Trade execution failed:', error);
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 SPY 0-DTE OPTIONS TRADING');
  console.log('=============================');
  console.log('📈 Trading Mode: REAL ALPACA PAPER TRADING');
  console.log('📊 Market Data: LIVE - No simulation');
  console.log('');

  const tradingSystem = new SimpleRealTrading({
    symbol: 'SPY',
    maxTrades: 3
  });

  try {
    await tradingSystem.startTrading();
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Start the system
main().catch(console.error);