/**
 * DYNAMIC TRADING INTEGRATION LAYER
 *
 * Integrates the dynamic position management system with the existing
 * professional paper trading engine for seamless 0-DTE trading automation
 */

import {
  Position,
  DynamicPositionSettings,
  PositionManagementReport,
  MarketData,
  OptionsChain,
  TradeSignal,
  AlpacaOrder
} from './types';

import { DynamicPositionManager } from './dynamic-position-manager';
import { ProfessionalPaperTradingEngine } from './professional-paper-trading-engine';
import { TradeExecutionAgent } from './trade-execution-agent';

export interface DynamicTradingSettings {
  // Integration settings
  enableDynamicManagement: boolean;
  monitoringIntervalSeconds: number;
  autoExecutionEnabled: boolean;

  // Position settings
  positionSettings: DynamicPositionSettings;

  // Risk limits
  maxDailyLoss: number;
  maxConcurrentPositions: number;
  emergencyShutdownEnabled: boolean;
}

export interface DynamicTradingStatus {
  isActive: boolean;
  lastAnalysis: Date | null;
  positionsManaged: number;
  todayActions: {
    exits: number;
    partialExits: number;
    trailingStopsTriggered: number;
    emergencyExits: number;
  };
  performance: {
    dailyPnL: number;
    totalSavedByStops: number;
    totalProfitTaken: number;
  };
  riskMetrics: {
    currentRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    openPositions: number;
    riskExposure: number;
    dailyLoss: number;
  };
}

/**
 * Main integration class that coordinates dynamic trading
 */
export class DynamicTradingIntegration {
  private static isRunning = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static settings: DynamicTradingSettings;

  private static readonly DEFAULT_SETTINGS: DynamicTradingSettings = {
    enableDynamicManagement: true,
    monitoringIntervalSeconds: 5, // Check every 5 seconds
    autoExecutionEnabled: true,

    positionSettings: DynamicPositionManager.getDefaultSettings(),

    maxDailyLoss: 1000, // $1000 max daily loss
    maxConcurrentPositions: 5,
    emergencyShutdownEnabled: true
  };

  /**
   * Start dynamic trading management
   */
  static async startDynamicTrading(
    customSettings?: Partial<DynamicTradingSettings>
  ): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Dynamic trading is already running');
      return;
    }

    this.settings = { ...this.DEFAULT_SETTINGS, ...customSettings };

    console.log('🚀 STARTING DYNAMIC TRADING INTEGRATION');
    console.log('=======================================');
    console.log(`Dynamic Management: ${this.settings.enableDynamicManagement ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Auto Execution: ${this.settings.autoExecutionEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Monitoring Interval: ${this.settings.monitoringIntervalSeconds} seconds`);

    this.isRunning = true;

    // Start monitoring loop
    this.monitoringInterval = setInterval(
      () => this.runManagementCycle(),
      this.settings.monitoringIntervalSeconds * 1000
    );

    // Run initial analysis
    await this.runManagementCycle();

    console.log('✅ Dynamic trading integration started successfully');
  }

  /**
   * Stop dynamic trading management
   */
  static stopDynamicTrading(): void {
    if (!this.isRunning) {
      console.log('⚠️ Dynamic trading is not running');
      return;
    }

    console.log('🛑 STOPPING DYNAMIC TRADING INTEGRATION');

    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✅ Dynamic trading integration stopped');
  }

  /**
   * Main management cycle - runs continuously
   */
  private static async runManagementCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log(`🔄 Running management cycle at ${new Date().toLocaleTimeString()}`);

      // Get current positions from Alpaca
      const currentPositions = await this.getCurrentPositions();
      const marketData = await this.getCurrentMarketData();
      const optionsChain = await this.getCurrentOptionsChain();

      if (currentPositions.length === 0) {
        console.log('📊 No open positions to manage');
        return;
      }

      // Analyze positions with dynamic manager
      const reports = await DynamicPositionManager.analyzePositions(
        currentPositions,
        marketData,
        optionsChain,
        this.settings.positionSettings
      );

      // Execute management actions
      if (this.settings.autoExecutionEnabled) {
        await this.executeManagementActions(reports);
      } else {
        // Just log recommendations without execution
        this.logRecommendations(reports);
      }

      // Check for emergency shutdown conditions
      await this.checkEmergencyConditions(reports);

      console.log('✅ Management cycle completed');

    } catch (error) {
      console.error(`❌ Management cycle failed: ${error}`);
    }
  }

  /**
   * Get current positions from Alpaca
   */
  private static async getCurrentPositions(): Promise<Position[]> {
    try {
      const alpacaPositions = await ProfessionalPaperTradingEngine.getPositions();

      return alpacaPositions.map(pos => ({
        id: pos.asset_id,
        symbol: pos.symbol.replace(/_.*$/, ''), // Extract base symbol
        side: pos.symbol.includes('C') ? 'CALL' : 'PUT',
        strike: this.extractStrikeFromSymbol(pos.symbol),
        expiration: this.extractExpirationFromSymbol(pos.symbol),
        quantity: parseInt(pos.qty),
        entryPrice: parseFloat(pos.avg_entry_price),
        entryDate: new Date(), // Would need to track this properly
        status: 'OPEN' as const,
        alpacaPositionId: pos.asset_id,
        unrealizedPnL: (parseFloat(pos.current_price) - parseFloat(pos.avg_entry_price)) *
                       parseInt(pos.qty) * (pos.side === 'long' ? 1 : -1)
      }));

    } catch (error) {
      console.error(`❌ Failed to get current positions: ${error}`);
      return [];
    }
  }

  /**
   * Get current market data
   */
  private static async getCurrentMarketData(): Promise<MarketData[]> {
    try {
      // Get SPY data from the existing system
      const { SPYMarketDataAgent } = await import('./spy-market-data-agent');
      return await SPYMarketDataAgent.getMarketData('1Min', 100); // Last 100 minutes

    } catch (error) {
      console.error(`❌ Failed to get market data: ${error}`);
      return [];
    }
  }

  /**
   * Get current options chain
   */
  private static async getCurrentOptionsChain(): Promise<OptionsChain[]> {
    try {
      // Get options data from the existing system
      const { SPYOptionsAgent } = await import('./spy-options-agent');
      const optionsData = await SPYOptionsAgent.getOptionsChain();

      return optionsData.map(opt => ({
        symbol: opt.symbol,
        expiration: opt.expiration,
        strike: opt.strike,
        side: opt.side,
        bid: opt.bid,
        ask: opt.ask,
        last: opt.last,
        impliedVolatility: opt.impliedVolatility,
        delta: opt.delta,
        volume: opt.volume,
        openInterest: opt.openInterest,
        midPrice: (opt.bid + opt.ask) / 2
      }));

    } catch (error) {
      console.error(`❌ Failed to get options chain: ${error}`);
      return [];
    }
  }

  /**
   * Execute management actions based on analysis reports
   */
  private static async executeManagementActions(reports: PositionManagementReport[]): Promise<void> {
    console.log(`🎯 Executing management actions for ${reports.length} positions`);

    for (const report of reports) {
      try {
        switch (report.action) {
          case 'EXIT_FULL':
            await this.executeFullExit(report);
            break;

          case 'EXIT_PARTIAL':
            await this.executePartialExit(report);
            break;

          case 'ADJUST_STOPS':
            await this.adjustStops(report);
            break;

          case 'HOLD':
            console.log(`✋ HOLD ${report.symbol}: ${report.recommendation.reason}`);
            break;
        }

      } catch (error) {
        console.error(`❌ Failed to execute action for ${report.symbol}: ${error}`);
      }
    }
  }

  /**
   * Execute full position exit
   */
  private static async executeFullExit(report: PositionManagementReport): Promise<void> {
    console.log(`🚪 EXITING FULL POSITION ${report.symbol}: ${report.recommendation.reason}`);

    try {
      // Find the position
      const positions = await this.getCurrentPositions();
      const position = positions.find(p => p.symbol === report.symbol);

      if (!position) {
        console.error(`❌ Position not found: ${report.symbol}`);
        return;
      }

      // Create sell signal
      const sellSignal: TradeSignal = {
        action: position.side === 'CALL' ? 'SELL' : 'SELL', // Simplified
        confidence: 100,
        reason: report.recommendation.reason,
        indicators: {
          rsi: 50,
          macd: 0,
          macdSignal: 0,
          macdHistogram: 0,
          bbUpper: 0,
          bbMiddle: 0,
          bbLower: 0
        },
        timestamp: new Date()
      };

      // Execute through trade execution agent
      const result = await TradeExecutionAgent.executeTrades(
        [sellSignal],
        [position],
        [], // Market data
        [], // Options chain
        {
          autoPositionManagement: false, // Don't trigger recursive management
          autoStopLoss: false,
          autoProfitTaking: false
        }
      );

      console.log(`✅ Exit executed: ${result.executionResults[0]?.message || 'Success'}`);

    } catch (error) {
      console.error(`❌ Failed to execute full exit for ${report.symbol}: ${error}`);
    }
  }

  /**
   * Execute partial position exit
   */
  private static async executePartialExit(report: PositionManagementReport): Promise<void> {
    const exitQuantity = report.recommendation.exitQuantity;
    console.log(`📤 EXITING PARTIAL ${report.symbol}: ${exitQuantity} contracts - ${report.recommendation.reason}`);

    // Similar implementation to full exit but with partial quantity
    // This would need to be implemented based on specific position sizing logic
  }

  /**
   * Adjust trailing stops
   */
  private static async adjustStops(report: PositionManagementReport): Promise<void> {
    console.log(`🎚️ ADJUSTING STOPS ${report.symbol}: ${report.recommendation.reason}`);

    // This would update the trailing stop levels for the position
    // Implementation depends on how stops are managed in the system
  }

  /**
   * Log recommendations without executing
   */
  private static logRecommendations(reports: PositionManagementReport[]): void {
    console.log('\n📋 POSITION MANAGEMENT RECOMMENDATIONS:');
    console.log('==========================================');

    for (const report of reports) {
      const status = report.riskAssessment.overallRisk;
      const icon = status === 'CRITICAL' ? '🚨' : status === 'HIGH' ? '⚠️' : status === 'MEDIUM' ? '⚡' : '✅';

      console.log(`${icon} ${report.symbol} (${report.currentState.unrealizedPnLPercent.toFixed(1)}%) - ${report.action}`);
      console.log(`   Reason: ${report.recommendation.reason}`);
      console.log(`   Risk Level: ${status}`);

      if (report.riskAssessment.warnings.length > 0) {
        console.log(`   Warnings: ${report.riskAssessment.warnings.join(', ')}`);
      }
    }
  }

  /**
   * Check for emergency shutdown conditions
   */
  private static async checkEmergencyConditions(reports: PositionManagementReport[]): Promise<void> {
    if (!this.settings.emergencyShutdownEnabled) return;

    // Check daily loss limit
    const dailyLoss = reports.reduce((total, report) => {
      const pnl = report.currentState.unrealizedPnL;
      return total + (pnl < 0 ? Math.abs(pnl) : 0);
    }, 0);

    if (dailyLoss > this.settings.maxDailyLoss) {
      console.log(`🚨 EMERGENCY SHUTDOWN: Daily loss $${dailyLoss.toFixed(2)} exceeds limit $${this.settings.maxDailyLoss}`);

      // Liquidate all positions
      await this.emergencyLiquidation(reports);

      // Stop dynamic trading
      this.stopDynamicTrading();
      return;
    }

    // Check for critical risk concentration
    const criticalPositions = reports.filter(r => r.riskAssessment.overallRisk === 'CRITICAL');
    if (criticalPositions.length > 3) {
      console.log(`🚨 EMERGENCY SHUTDOWN: ${criticalPositions.length} critical positions detected`);
      await this.emergencyLiquidation(reports);
      this.stopDynamicTrading();
      return;
    }
  }

  /**
   * Emergency liquidation of all positions
   */
  private static async emergencyLiquidation(reports: PositionManagementReport[]): Promise<void> {
    console.log('🚨 EMERGENCY LIQUIDATION INITIATED');

    for (const report of reports) {
      try {
        await this.executeFullExit(report);
      } catch (error) {
        console.error(`❌ Emergency liquidation failed for ${report.symbol}: ${error}`);
      }
    }

    console.log('✅ Emergency liquidation completed');
  }

  /**
   * Get current trading status
   */
  static async getTradingStatus(): Promise<DynamicTradingStatus> {
    try {
      const reports = await this.getCurrentAnalysisResults();
      const executionStatus = await TradeExecutionAgent.getExecutionStatus();

      const todayActions = {
        exits: reports.filter(r => r.action === 'EXIT_FULL').length,
        partialExits: reports.filter(r => r.action === 'EXIT_PARTIAL').length,
        trailingStopsTriggered: reports.filter(r => r.recommendation.trailingStopTriggered).length,
        emergencyExits: reports.filter(r => r.recommendation.urgency === 'CRITICAL').length
      };

      const performance = {
        dailyPnL: executionStatus.dailyPnL,
        totalSavedByStops: 0, // Would need to track this over time
        totalProfitTaken: 0  // Would need to track this over time
      };

      const riskMetrics = {
        currentRisk: this.calculateOverallRisk(reports),
        openPositions: reports.length,
        riskExposure: executionStatus.riskExposure,
        dailyLoss: performance.dailyPnL < 0 ? Math.abs(performance.dailyPnL) : 0
      };

      return {
        isActive: this.isRunning,
        lastAnalysis: reports.length > 0 ? reports[0].timestamp : null,
        positionsManaged: reports.length,
        todayActions,
        performance,
        riskMetrics
      };

    } catch (error) {
      console.error(`❌ Failed to get trading status: ${error}`);

      return {
        isActive: false,
        lastAnalysis: null,
        positionsManaged: 0,
        todayActions: { exits: 0, partialExits: 0, trailingStopsTriggered: 0, emergencyExits: 0 },
        performance: { dailyPnL: 0, totalSavedByStops: 0, totalProfitTaken: 0 },
        riskMetrics: { currentRisk: 'LOW', openPositions: 0, riskExposure: 0, dailyLoss: 0 }
      };
    }
  }

  // =================== HELPER METHODS ===================

  private static async getCurrentAnalysisResults(): Promise<PositionManagementReport[]> {
    // This would cache the last analysis results
    // For now, return empty array
    return [];
  }

  private static calculateOverallRisk(reports: PositionManagementReport[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (reports.length === 0) return 'LOW';

    const criticalCount = reports.filter(r => r.riskAssessment.overallRisk === 'CRITICAL').length;
    const highCount = reports.filter(r => r.riskAssessment.overallRisk === 'HIGH').length;

    if (criticalCount > 0) return 'CRITICAL';
    if (highCount > reports.length / 2) return 'HIGH';
    if (highCount > 0) return 'MEDIUM';
    return 'LOW';
  }

  private static extractStrikeFromSymbol(symbol: string): number {
    // Extract strike from options symbol format
    const match = symbol.match(/C(\d+)$/);
    return match ? parseInt(match[1]) / 1000 : 0; // Convert back from strike*1000 format
  }

  private static extractExpirationFromSymbol(symbol: string): Date {
    // Extract expiration from options symbol format
    const match = symbol.match(/_(\d{8})_/);
    if (match) {
      const dateStr = match[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month - 1, day);
    }
    return new Date();
  }

  /**
   * Get current settings
   */
  static getSettings(): DynamicTradingSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  static updateSettings(newSettings: Partial<DynamicTradingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Dynamic trading settings updated');
  }
}