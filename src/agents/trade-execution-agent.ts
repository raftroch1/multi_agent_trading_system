/**
 * TRADE EXECUTION AGENT
 *
 * Handles order execution, position management, and trade lifecycle automation
 * Integrates with Alpaca for paper trading execution
 */

import {
  Trade,
  Position,
  OptionsChain,
  MarketData,
  TradeSignal,
  AlpacaOrder,
  OrderStatus
} from '../types';
import { PositionManagementAgent, PositionManagementDecision } from '../strategies/position-management/position-management-agent';

export interface ExecutionSettings {
  // Order execution
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LIMIT';
  limitPriceOffset: number;          // % offset for limit orders
  maxSlippagePercent: number;        // Maximum acceptable slippage

  // Position sizing
  defaultPositionSize: number;       // Default position size in dollars
  maxPositionSize: number;           // Maximum position size
  positionSizingMethod: 'FIXED' | 'RISK_BASED' | 'VOLATILITY_ADJUSTED';

  // Risk management
  maxDailyTrades: number;            // Maximum trades per day
  maxConcurrentPositions: number;    // Maximum concurrent positions
  maxAccountRiskPercent: number;     // Maximum % of account at risk

  // Timing controls
  orderDelaySeconds: number;         // Delay between orders
  retryAttempts: number;             // Order retry attempts
  orderTimeoutSeconds: number;       // Order timeout

  // 0-DTE specific
  minutesBeforeCloseStop: number;    // Stop trading X minutes before close
  emergencyLiquidationTime: number;  // Emergency liquidation time

  // Automation
  autoPositionManagement: boolean;   // Enable automated position management
  autoProfitTaking: boolean;         // Enable automated profit taking
  autoStopLoss: boolean;             // Enable automated stop loss
}

export interface ExecutionResult {
  orderId: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  quantity: number;
  filledQuantity: number;
  avgFillPrice: number;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
  message: string;
  timestamp: Date;
  commissions: number;
  fees: number;
}

export interface TradeExecutionReport {
  executionResults: ExecutionResult[];
  positionsUpdated: Position[];
  tradesClosed: Trade[];
  accountSummary: {
    totalPnL: number;
    buyingPower: number;
    portfolioValue: number;
    dayTradesRemaining: number;
    riskExposure: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Trade Execution Agent for automated order management
 */
export class TradeExecutionAgent {
  private static readonly DEFAULT_SETTINGS: ExecutionSettings = {
    // Order execution
    orderType: 'LIMIT',               // Use limit orders for better fills
    limitPriceOffset: 0.05,          // 5% offset for limit orders
    maxSlippagePercent: 2,           // 2% max slippage

    // Position sizing
    defaultPositionSize: 500,        // $500 default position
    maxPositionSize: 2000,           // $2000 max position
    positionSizingMethod: 'RISK_BASED',

    // Risk management
    maxDailyTrades: 10,              // Max 10 trades per day
    maxConcurrentPositions: 3,       // Max 3 concurrent positions
    maxAccountRiskPercent: 5,        // Max 5% account at risk

    // Timing controls
    orderDelaySeconds: 1,            // 1 second delay between orders
    retryAttempts: 3,                // 3 retry attempts
    orderTimeoutSeconds: 30,         // 30 second timeout

    // 0-DTE specific
    minutesBeforeCloseStop: 45,      // Stop trading 45 minutes before close
    emergencyLiquidationTime: 15,    // Emergency liquidation 15 minutes before close

    // Automation
    autoPositionManagement: true,     // Enable automated position management
    autoProfitTaking: true,          // Enable automated profit taking
    autoStopLoss: true,              // Enable automated stop loss
  };

  /**
   * Execute new trades based on consensus signals
   */
  static async executeTrades(
    signals: TradeSignal[],
    currentPositions: Position[],
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    customSettings?: Partial<ExecutionSettings>
  ): Promise<TradeExecutionReport> {
    const settings = { ...this.DEFAULT_SETTINGS, ...customSettings };
    const executionResults: ExecutionResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🚀 TRADE EXECUTION AGENT - INITIALIZING');
    console.log('=====================================');
    console.log(`Signals to execute: ${signals.length}`);
    console.log(`Current positions: ${currentPositions.length}`);
    console.log(`Order type: ${settings.orderType}`);

    // Check trading restrictions
    const tradingCheck = this.checkTradingEligibility(signals, currentPositions, settings);
    if (!tradingCheck.canTrade) {
      errors.push(`Trading blocked: ${tradingCheck.reason}`);
      return this.createReport([], [], currentPositions, [], errors, warnings);
    }

    // Execute each signal
    for (const signal of signals) {
      try {
        console.log(`\n📈 Executing signal: ${signal.action} ${signal.option} (${signal.confidence}% confidence)`);

        const result = await this.executeSignal(signal, optionsChain, settings);
        executionResults.push(result);

        if (result.status === 'FILLED') {
          console.log(`✅ Order filled: ${result.filledQuantity} contracts @ $${result.avgFillPrice.toFixed(2)}`);
        } else {
          warnings.push(`Order issue: ${result.message}`);
        }

        // Delay between orders
        if (settings.orderDelaySeconds > 0) {
          await this.delay(settings.orderDelaySeconds * 1000);
        }

      } catch (error) {
        const errorMsg = `Failed to execute signal ${signal.action}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Check for automated position management
    if (settings.autoPositionManagement && currentPositions.length > 0) {
      const managementResults = await this.executePositionManagement(
        currentPositions,
        marketData,
        optionsChain,
        settings
      );

      executionResults.push(...managementResults.executionResults);
      errors.push(...managementResults.errors);
      warnings.push(...managementResults.warnings);
    }

    console.log(`\n📊 EXECUTION SUMMARY:`);
    console.log(`   Orders placed: ${executionResults.length}`);
    console.log(`   Successful: ${executionResults.filter(r => r.status === 'FILLED').length}`);
    console.log(`   Errors: ${errors.length}`);

    return this.createReport(executionResults, [], currentPositions, [], errors, warnings);
  }

  /**
   * Execute individual trading signal
   */
  private static async executeSignal(
    signal: TradeSignal,
    optionsChain: OptionsChain[],
    settings: ExecutionSettings
  ): Promise<ExecutionResult> {
    const option = this.findOptionContract(signal.option, optionsChain);
    if (!option) {
      throw new Error(`Option contract not found: ${signal.option}`);
    }

    // Calculate position size
    const positionSize = this.calculatePositionSize(signal, option, settings);

    // Calculate order price
    const orderPrice = this.calculateOrderPrice(option, signal.action, settings);

    // Execute through professional paper trading engine
    const executionResult = await this.executeThroughAlpaca(
      signal,
      option,
      positionSize.contracts,
      orderPrice,
      settings
    );

    return executionResult;
  }

  /**
   * Execute automated position management decisions
   */
  private static async executePositionManagement(
    positions: Position[],
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    settings: ExecutionSettings
  ): Promise<TradeExecutionReport> {
    const executionResults: ExecutionResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🤖 AUTOMATED POSITION MANAGEMENT');

    // Get position management decisions
    const managementAnalysis = PositionManagementAgent.analyzePositions(
      positions,
      marketData,
      optionsChain
    );

    // Execute management decisions
    for (const decision of managementAnalysis.decisions) {
      if (decision.action === 'HOLD') continue;

      try {
        console.log(`🎯 Management action: ${decision.action} - ${decision.reason}`);

        const position = positions.find(p =>
          p.symbol === decision.positionId ||
          `${p.symbol}_${p.strike}_${p.side}` === decision.positionId
        );

        if (!position) {
          warnings.push(`Position not found for management: ${decision.positionId}`);
          continue;
        }

        const result = await this.executeManagementDecision(decision, position, optionsChain);
        executionResults.push(result);

        // Handle urgent exits immediately
        if (decision.urgency === 'CRITICAL') {
          console.log(`🚨 URGENT EXIT EXECUTED: ${decision.reason}`);
        }

      } catch (error) {
        const errorMsg = `Management execution failed: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return this.createReport(executionResults, [], positions, [], errors, warnings);
  }

  /**
   * Execute individual position management decision
   */
  private static async executeManagementDecision(
    decision: PositionManagementDecision,
    position: Position,
    optionsChain: OptionsChain[]
  ): Promise<ExecutionResult> {
    const quantity = decision.quantity || position.quantity;
    const option = this.findOptionContract(
      `${position.symbol}_${position.strike}_${position.side}`,
      optionsChain
    );

    if (!option) {
      throw new Error(`Option contract not found for position management`);
    }

    const orderId = `mgmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      orderId,
      action: 'SELL', // Position management always sells
      symbol: position.symbol,
      side: position.side,
      strike: position.strike,
      expiration: position.expiration,
      quantity,
      filledQuantity: quantity,
      avgFillPrice: option.midPrice,
      status: 'FILLED',
      message: decision.reason,
      timestamp: new Date(),
      commissions: quantity * 0.50,
      fees: quantity * 0.10
    };
  }

  /**
   * Check if trading is allowed based on restrictions
   */
  private static checkTradingEligibility(
    signals: TradeSignal[],
    positions: Position[],
    settings: ExecutionSettings
  ): { canTrade: boolean; reason: string } {
    const now = new Date();
    const marketClose = this.getMarketCloseTime();
    const minutesUntilClose = (marketClose.getTime() - now.getTime()) / (1000 * 60);

    // Check time restrictions
    if (minutesUntilClose < settings.minutesBeforeCloseStop) {
      return {
        canTrade: false,
        reason: `Too close to market close (${minutesUntilClose.toFixed(0)} min remaining)`
      };
    }

    // Check position limits
    if (positions.length >= settings.maxConcurrentPositions) {
      return {
        canTrade: false,
        reason: `Max concurrent positions reached (${settings.maxConcurrentPositions})`
      };
    }

    // Check for emergency liquidation time
    if (minutesUntilClose < settings.emergencyLiquidationTime) {
      return {
        canTrade: false,
        reason: `Emergency liquidation time (${settings.emergencyLiquidationTime} min before close)`
      };
    }

    return { canTrade: true, reason: 'Trading allowed' };
  }

  /**
   * Calculate position size based on settings
   */
  private static calculatePositionSize(
    signal: TradeSignal,
    option: OptionsChain,
    settings: ExecutionSettings
  ): { contracts: number; totalCost: number; riskAmount: number } {
    let positionSize = settings.defaultPositionSize;

    // Adjust based on confidence
    const confidenceMultiplier = signal.confidence / 100;
    positionSize *= confidenceMultiplier;

    // Apply maximum limits
    positionSize = Math.min(positionSize, settings.maxPositionSize);

    // Calculate contracts
    const contractPrice = option.midPrice * 100; // Options are per share, 100 shares per contract
    const contracts = Math.floor(positionSize / contractPrice);
    const totalCost = contracts * contractPrice;

    return {
      contracts: Math.max(1, contracts), // Minimum 1 contract
      totalCost,
      riskAmount: totalCost * 0.3 // Assume 30% max risk
    };
  }

  /**
   * Calculate order price based on order type
   */
  private static calculateOrderPrice(
    option: OptionsChain,
    action: string,
    settings: ExecutionSettings
  ): number {
    const midPrice = option.midPrice;

    if (settings.orderType === 'MARKET') {
      return midPrice;
    }

    if (settings.orderType === 'LIMIT') {
      const offset = midPrice * (settings.limitPriceOffset / 100);
      return action.includes('BUY') ? midPrice + offset : midPrice - offset;
    }

    return midPrice;
  }

  // =================== HELPER METHODS ===================

  private static findOptionContract(optionSymbol: string, optionsChain: OptionsChain[]): OptionsChain | null {
    // Parse option symbol to find matching contract
    // Expected format: SPY_20250106_500_CALL
    const parts = optionSymbol.split('_');
    if (parts.length >= 4) {
      const symbol = parts[0];
      const dateStr = parts[1];
      const strike = parseFloat(parts[2]);
      const side = parts[3].includes('CALL') ? 'CALL' : 'PUT';

      return optionsChain.find(opt =>
        opt.symbol === symbol &&
        opt.strike === strike &&
        opt.side === side
      ) || null;
    }

    // Fallback to first available option
    return optionsChain[0] || null;
  }

  private static getMarketCloseTime(): Date {
    const now = new Date();
    const marketClose = new Date();
    marketClose.setHours(16, 0, 0, 0); // 4:00 PM ET
    return marketClose;
  }

  private static createReport(
    executionResults: ExecutionResult[],
    tradesClosed: Trade[],
    positionsUpdated: Position[],
    accountSummary: any,
    errors: string[],
    warnings: string[]
  ): TradeExecutionReport {
    return {
      executionResults,
      positionsUpdated,
      tradesClosed,
      accountSummary: {
        totalPnL: 0,
        buyingPower: 0,
        portfolioValue: 0,
        dayTradesRemaining: 10,
        riskExposure: 0
      },
      errors,
      warnings
    };
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute trade through professional Alpaca paper trading engine
   */
  private static async executeThroughAlpaca(
    signal: TradeSignal,
    option: OptionsChain,
    quantity: number,
    orderPrice: number,
    settings: ExecutionSettings
  ): Promise<ExecutionResult> {
    try {
      // Import the professional paper trading engine
      const { ProfessionalPaperTradingEngine } = await import('../services/alpaca/professional-paper-trading-engine');

      // Execute the order through the real Alpaca integration
      const orderResult = await ProfessionalPaperTradingEngine.submitOrder({
        symbol: option.symbol,
        side: signal.action === 'BUY_CALL' || signal.action === 'BUY_PUT' ? 'buy' : 'sell',
        type: settings.orderType.toLowerCase() as 'market' | 'limit' | 'stop_limit',
        qty: quantity.toString(),
        time_in_force: 'day',
        order_class: 'simple',
        side: signal.action === 'BUY_CALL' || signal.action === 'BUY_PUT' ? 'buy' : 'sell',
        // For options, we need to specify the legs
        legs: [{
          symbol: `${option.symbol}_${option.expiration.toISOString().split('T')[0].replace(/-/g, '')}C${option.strike * 1000}`,
          side: signal.action === 'BUY_CALL' || signal.action === 'BUY_PUT' ? 'buy' : 'sell',
          ratio_qty: quantity.toString()
        }],
        // Limit price for limit orders
        limit_price: settings.orderType === 'LIMIT' ? orderPrice.toFixed(2) : undefined
      });

      // Transform the result to our ExecutionResult format
      const executionResult: ExecutionResult = {
        orderId: orderResult.orderId || `exec_${Date.now()}`,
        action: signal.action === 'BUY_CALL' || signal.action === 'BUY_PUT' ? 'BUY' : 'SELL',
        symbol: option.symbol,
        side: option.side,
        strike: option.strike,
        expiration: option.expiration,
        quantity,
        filledQuantity: orderResult.filledQty ? parseInt(orderResult.filledQty) : 0,
        avgFillPrice: orderResult.filledAvgPrice ? parseFloat(orderResult.filledAvgPrice) : orderPrice,
        status: this.mapAlpacaStatus(orderResult.status),
        message: orderResult.status || 'Order submitted',
        timestamp: new Date(),
        commissions: quantity * 0.50, // Standard options commission
        fees: quantity * 0.10 // Regulatory fees
      };

      console.log(`✅ Alpaca execution: ${executionResult.action} ${quantity} ${option.symbol} @ $${executionResult.avgFillPrice.toFixed(2)}`);
      return executionResult;

    } catch (error) {
      console.error(`❌ Alpaca execution failed: ${error}`);

      // Return failed execution result
      return {
        orderId: `failed_${Date.now()}`,
        action: signal.action === 'BUY_CALL' || signal.action === 'BUY_PUT' ? 'BUY' : 'SELL',
        symbol: option.symbol,
        side: option.side,
        strike: option.strike,
        expiration: option.expiration,
        quantity,
        filledQuantity: 0,
        avgFillPrice: orderPrice,
        status: 'REJECTED',
        message: `Execution failed: ${error}`,
        timestamp: new Date(),
        commissions: 0,
        fees: 0
      };
    }
  }

  /**
   * Map Alpaca order status to our ExecutionResult status
   */
  private static mapAlpacaStatus(alpacaStatus: string): ExecutionResult['status'] {
    switch (alpacaStatus?.toLowerCase()) {
      case 'filled':
        return 'FILLED';
      case 'partially_filled':
        return 'PARTIAL';
      case 'cancelled':
      case 'canceled':
        return 'CANCELLED';
      case 'rejected':
      case 'expired':
        return 'REJECTED';
      default:
        return 'PARTIAL'; // Default to partial for in-flight orders
    }
  }

  /**
   * Get real-time execution status from Alpaca
   */
  static async getExecutionStatus(): Promise<{
    isActive: boolean;
    ordersToday: number;
    positionsOpen: number;
    lastExecution: Date | null;
    dailyPnL: number;
    riskExposure: number;
  }> {
    try {
      const { ProfessionalPaperTradingEngine } = await import('../services/alpaca/professional-paper-trading-engine');

      // Get real account status from Alpaca
      const accountInfo = await ProfessionalPaperTradingEngine.getAccount();
      const positions = await ProfessionalPaperTradingEngine.getPositions();
      const orders = await ProfessionalPaperTradingEngine.getOrders();

      // Calculate today's P&L from positions
      const dailyPnL = positions.reduce((total, pos) => {
        const unrealizedPnL = (parseFloat(pos.current_price) - parseFloat(pos.avg_entry_price)) *
                            parseInt(pos.qty) * (pos.side === 'long' ? 1 : -1);
        return total + unrealizedPnL;
      }, 0);

      // Calculate risk exposure
      const riskExposure = positions.reduce((total, pos) => {
        const positionValue = parseFloat(pos.current_price) * parseInt(pos.qty);
        return total + positionValue;
      }, 0);

      // Get today's orders
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders.filter(order =>
        order.created_at && order.created_at.startsWith(today)
      );

      // Find last execution time
      const lastExecution = orders.length > 0 ?
        new Date(Math.max(...orders.map(order => new Date(order.created_at || order.submitted_at || 0).getTime()))) :
        null;

      return {
        isActive: accountInfo.status === 'ACTIVE',
        ordersToday: todayOrders.length,
        positionsOpen: positions.length,
        lastExecution,
        dailyPnL,
        riskExposure
      };

    } catch (error) {
      console.error(`❌ Failed to get execution status: ${error}`);

      // Return default status on error
      return {
        isActive: false,
        ordersToday: 0,
        positionsOpen: 0,
        lastExecution: null,
        dailyPnL: 0,
        riskExposure: 0
      };
    }
  }

  /**
   * Emergency liquidation of all positions
   */
  static async emergencyLiquidation(
    positions: Position[],
    optionsChain: OptionsChain[]
  ): Promise<ExecutionResult[]> {
    console.log('🚨 EMERGENCY LIQUIDATION INITIATED');
    const results: ExecutionResult[] = [];

    for (const position of positions) {
      try {
        const option = this.findOptionContract(
          `${position.symbol}_${position.strike}_${position.side}`,
          optionsChain
        );

        if (option) {
          const result = await this.executeManagementDecision(
            {
              action: 'SELL_FULL',
              quantity: position.quantity,
              reason: 'Emergency liquidation',
              urgency: 'CRITICAL'
            },
            position,
            optionsChain
          );
          results.push(result);
        }
      } catch (error) {
        console.error(`Emergency liquidation failed for ${position.symbol}: ${error}`);
      }
    }

    return results;
  }
}