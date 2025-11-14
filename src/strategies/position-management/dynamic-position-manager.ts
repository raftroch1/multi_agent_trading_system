/**
 * DYNAMIC POSITION MANAGEMENT SYSTEM
 *
 * Advanced position management with trailing stops, progressive exits,
 * volume profile analysis, and real-time Greeks monitoring for 0-DTE trading
 */

import {
  Position,
  DynamicPositionSettings,
  TrailingStopState,
  VolumeProfileData,
  GreeksRiskProfile,
  DynamicExitSignal,
  PositionManagementReport,
  MarketData,
  OptionsChain
} from '../../types';

import { GreeksEngine, GreeksSnapshot } from '../../utils/greeks-engine';

export interface DynamicPositionManagerSettings {
  // Real-time monitoring
  monitoringIntervalMs: number;
  priceUpdateThreshold: number;       // Minimum price change to trigger re-evaluation

  // 0-DTE specific optimizations
  zeroDTEMode: boolean;
  acceleratedExitTime: number;        // Minutes before close for 0-DTE

  // Risk tolerances
  maxSlippagePercent: number;
  emergencyExitThreshold: number;

  // Performance optimization
  batchProcessingEnabled: boolean;
  maxConcurrentAnalysis: number;
}

export class DynamicPositionManager {
  private static readonly DEFAULT_SETTINGS: DynamicPositionManagerSettings = {
    monitoringIntervalMs: 1000,         // 1 second monitoring
    priceUpdateThreshold: 0.01,         // 1 cent minimum
    zeroDTEMode: true,
    acceleratedExitTime: 60,            // 60 minutes for 0-DTE
    maxSlippagePercent: 2,
    emergencyExitThreshold: 50,         // 50% loss triggers emergency exit
    batchProcessingEnabled: true,
    maxConcurrentAnalysis: 10
  };

  private static readonly DEFAULT_POSITION_SETTINGS: DynamicPositionSettings = {
    // Trailing stops (optimized for 0-DTE)
    trailingStopEnabled: true,
    trailingStopPercent: 15,            // 15% trailing stop
    trailingStopActivationPercent: 10,  // Activate after 10% profit

    // Progressive exits (0-DTE specific)
    progressiveExitEnabled: true,
    profitLevels: [25, 50, 75, 100],    // Take profits at 25%, 50%, 75%, 100%
    exitFractions: [0.4, 0.3, 0.2, 0.1], // Sell 40%, 30%, 20%, keep 10% for home run

    // Time-based exits
    timeExitEnabled: true,
    minutesBeforeClose: 45,             // Exit 45 minutes before close
    maxHoldTimeMinutes: 240,            // Max 4 hours

    // Greeks-based exits
    greeksExitEnabled: true,
    maxDeltaExposure: 80,               // Higher for 0-DTE
    maxThetaBurnRate: 8000,             // $8000/min acceptable for 0-DTE
    maxGammaExposure: 5,                // High gamma expected in 0-DTE

    // Volume profile exits
    volumeProfileExitEnabled: true,
    volumeThresholdMultiplier: 3.0,     // Exit on 3x average volume

    // Volatility stops
    volatilityStopEnabled: true,
    volatilityLookbackPeriod: 20,
    volatilityMultiplier: 2.5,

    // Risk management
    maxPositionRiskPercent: 8,
    emergencyExitConditions: {
      maxLossPercent: 60,
      minTimeToExit: 5,
      unusualVolumeRatio: 10
    }
  };

  private static trailingStopStates: Map<string, TrailingStopState> = new Map();
  private static volumeProfiles: Map<string, VolumeProfileData> = new Map();
  private static lastAnalysisTime: Map<string, Date> = new Map();

  /**
   * Analyze positions and provide dynamic management recommendations
   */
  static async analyzePositions(
    positions: Position[],
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    customSettings?: Partial<DynamicPositionSettings>
  ): Promise<PositionManagementReport[]> {
    const settings = { ...this.DEFAULT_POSITION_SETTINGS, ...customSettings };
    const reports: PositionManagementReport[] = [];

    console.log('🎯 DYNAMIC POSITION MANAGER - ANALYZING POSITIONS');
    console.log('==================================================');
    console.log(`Positions to analyze: ${positions.length}`);
    console.log(`0-DTE Mode: ${this.DEFAULT_SETTINGS.zeroDTEMode}`);
    console.log(`Progressive Exits: ${settings.progressiveExitEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Trailing Stops: ${settings.trailingStopEnabled ? 'ENABLED' : 'DISABLED'}`);

    for (const position of positions) {
      if (position.status !== 'OPEN') continue;

      try {
        const report = await this.analyzePosition(
          position,
          marketData,
          optionsChain,
          settings
        );
        reports.push(report);

        // Update tracking data
        this.updateTrackingData(position, report);

      } catch (error) {
        console.error(`❌ Failed to analyze position ${position.id}: ${error}`);

        // Create error report
        reports.push(this.createErrorReport(position, error));
      }
    }

    console.log(`\n📊 ANALYSIS COMPLETE:`);
    console.log(`   Positions analyzed: ${reports.length}`);
    console.log(`   Exit recommendations: ${reports.filter(r => r.action !== 'HOLD').length}`);
    console.log(`   Critical risks: ${reports.filter(r => r.riskAssessment.overallRisk === 'CRITICAL').length}`);

    return reports;
  }

  /**
   * Analyze individual position with dynamic management
   */
  private static async analyzePosition(
    position: Position,
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    settings: DynamicPositionSettings
  ): Promise<PositionManagementReport> {
    const now = new Date();
    const currentPrice = this.getCurrentOptionPrice(position, optionsChain);
    const unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
    const unrealizedPnLPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Time to expiration (critical for 0-DTE)
    const timeToExpiration = this.getTimeToExpiration(position.expiration, now);

    // Get volume profile data
    const volumeProfile = this.getVolumeProfileData(position, marketData, settings);

    // Calculate Greeks
    const greeksProfile = this.getGreeksProfile(position, currentPrice, timeToExpiration, settings);

    // Get trailing stop state
    const trailingStop = this.getTrailingStopState(position, currentPrice, settings);

    // Generate exit signal
    const recommendation = this.generateExitSignal(
      position,
      currentPrice,
      unrealizedPnLPercent,
      timeToExpiration,
      volumeProfile,
      greeksProfile,
      trailingStop,
      settings
    );

    // Assess overall risk
    const riskAssessment = this.assessOverallRisk(
      unrealizedPnLPercent,
      timeToExpiration,
      greeksProfile,
      volumeProfile,
      settings
    );

    // Determine action
    const action = this.determineAction(recommendation, riskAssessment);

    return {
      positionId: position.id || `${position.symbol}_${position.strike}_${position.side}`,
      symbol: position.symbol,
      action,
      recommendation,
      currentState: {
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent,
        timeToExpiration,
        volumeProfile,
        greeksProfile,
        trailingStop
      },
      riskAssessment,
      timestamp: now
    };
  }

  /**
   * Generate dynamic exit signal based on all factors
   */
  private static generateExitSignal(
    position: Position,
    currentPrice: number,
    pnlPercent: number,
    timeToExpiration: number,
    volumeProfile: VolumeProfileData,
    greeksProfile: GreeksRiskProfile,
    trailingStop: TrailingStopState,
    settings: DynamicPositionSettings
  ): DynamicExitSignal {
    const signals: {
      type: string;
      shouldExit: boolean;
      exitType: 'FULL' | 'PARTIAL';
      urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      reason: string;
      exitQuantity?: number;
    }[] = [];

    // 1. Emergency conditions (highest priority)
    if (pnlPercent <= -settings.emergencyExitConditions.maxLossPercent) {
      signals.push({
        type: 'EMERGENCY_LOSS',
        shouldExit: true,
        exitType: 'FULL',
        urgency: 'CRITICAL',
        reason: `Emergency exit: ${pnlPercent.toFixed(1)}% loss exceeds threshold`
      });
    }

    // 2. Time-based exits (critical for 0-DTE)
    const isZeroDTE = timeToExpiration < 1;
    const timeThreshold = isZeroDTE ? 60 : settings.minutesBeforeClose; // 60 min for 0-DTE

    if (timeToExpiration < timeThreshold) {
      signals.push({
        type: 'TIME_EXIT',
        shouldExit: true,
        exitType: 'FULL',
        urgency: timeToExpiration < 15 ? 'CRITICAL' : 'HIGH',
        reason: `Time exit: ${timeToExpiration.toFixed(0)} minutes until expiration`
      });
    }

    // 3. Trailing stop exits
    if (trailingStop.isActive && currentPrice <= trailingStop.currentStopPrice) {
      signals.push({
        type: 'TRAILING_STOP',
        shouldExit: true,
        exitType: 'FULL',
        urgency: 'HIGH',
        reason: `Trailing stop triggered at $${trailingStop.currentStopPrice.toFixed(2)}`
      });
    }

    // 4. Greeks risk exits
    if (greeksProfile.riskLevel === 'CRITICAL') {
      signals.push({
        type: 'GREEKS_RISK',
        shouldExit: true,
        exitType: 'FULL',
        urgency: 'HIGH',
        reason: `Critical Greeks risk: ${greeksProfile.riskFactors.join('; ')}`
      });
    }

    // 5. Volume spike exits
    if (volumeProfile.unusualVolumeDetected && volumeProfile.volumeRatio > settings.volumeThresholdMultiplier) {
      signals.push({
        type: 'VOLUME_SPIKE',
        shouldExit: true,
        exitType: 'PARTIAL',
        urgency: 'MEDIUM',
        reason: `Unusual volume detected: ${volumeProfile.volumeRatio.toFixed(1)}x average`,
        exitQuantity: Math.floor(position.quantity * 0.5) // Sell 50% on volume spike
      });
    }

    // 6. Progressive profit taking
    if (settings.progressiveExitEnabled && pnlPercent > 0) {
      for (let i = 0; i < settings.profitLevels.length; i++) {
        if (Math.abs(pnlPercent) >= settings.profitLevels[i]) {
          signals.push({
            type: 'PROFIT_TAKING',
            shouldExit: true,
            exitType: 'PARTIAL',
            urgency: 'MEDIUM',
            reason: `Progressive profit taking at ${settings.profitLevels[i]}% gain`,
            exitQuantity: Math.floor(position.quantity * settings.exitFractions[i])
          });
        }
      }
    }

    // Select highest priority signal
    const prioritizedSignals = signals.sort((a, b) => {
      const urgencyOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });

    const selectedSignal = prioritizedSignals[0];

    return {
      shouldExit: selectedSignal?.shouldExit || false,
      exitType: selectedSignal?.exitType || 'FULL',
      exitQuantity: selectedSignal?.exitQuantity,
      reason: selectedSignal?.reason || 'Hold position - no exit conditions met',
      urgency: selectedSignal?.urgency || 'LOW',
      timestamp: new Date(),
      trailingStopTriggered: selectedSignal?.type === 'TRAILING_STOP',
      greeksRiskTriggered: selectedSignal?.type === 'GREEKS_RISK',
      timeExitTriggered: selectedSignal?.type === 'TIME_EXIT',
      volumeExitTriggered: selectedSignal?.type === 'VOLUME_SPIKE',
      volatilityStopTriggered: selectedSignal?.type === 'VOLATILITY_STOP'
    };
  }

  /**
   * Update trailing stop state based on current price
   */
  private static getTrailingStopState(
    position: Position,
    currentPrice: number,
    settings: DynamicPositionSettings
  ): TrailingStopState {
    const positionKey = position.id || `${position.symbol}_${position.strike}_${position.side}`;
    const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    let currentState = this.trailingStopStates.get(positionKey);

    // Initialize if not exists
    if (!currentState) {
      currentState = {
        isActive: false,
        highestPrice: currentPrice,
        lowestPrice: currentPrice,
        currentStopPrice: 0,
        lastUpdated: new Date(),
        direction: 'LONG' // Assuming long calls for simplicity
      };
    }

    // Check if trailing stop should be activated
    const shouldActivate = pnlPercent >= settings.trailingStopActivationPercent;

    if (shouldActivate && !currentState.isActive) {
      console.log(`🎯 Activating trailing stop for ${position.symbol}: ${pnlPercent.toFixed(1)}% profit`);
      currentState.isActive = true;
      currentState.highestPrice = currentPrice;
    }

    // Update trailing stop if active
    if (currentState.isActive) {
      if (currentPrice > currentState.highestPrice) {
        currentState.highestPrice = currentPrice;
        // Update stop price to trail behind new high
        const trailAmount = currentState.highestPrice * (settings.trailingStopPercent / 100);
        currentState.currentStopPrice = currentState.highestPrice - trailAmount;
        console.log(`⬆️ Raised trailing stop to $${currentState.currentStopPrice.toFixed(2)} (high: $${currentState.highestPrice.toFixed(2)})`);
      }
    }

    this.trailingStopStates.set(positionKey, currentState);
    return currentState;
  }

  /**
   * Calculate volume profile data for position
   */
  private static getVolumeProfileData(
    position: Position,
    marketData: MarketData[],
    settings: DynamicPositionSettings
  ): VolumeProfileData {
    const positionKey = position.id || `${position.symbol}_${position.strike}_${position.side}`;

    // Get recent market data for volume analysis
    const recentData = marketData.slice(-settings.volatilityLookbackPeriod);
    const currentVolume = recentData[recentData.length - 1]?.volume ? Number(recentData[recentData.length - 1].volume) : 0;

    // Calculate average volume
    const averageVolume = recentData.reduce((sum, bar) => sum + Number(bar.volume), 0) / recentData.length || 1;

    // Calculate volume ratio
    const volumeRatio = currentVolume / averageVolume;

    // Detect unusual volume
    const unusualVolumeDetected = volumeRatio > settings.volumeThresholdMultiplier;

    // Calculate moving averages
    const volumeMovingAverage = recentData.map((bar, index) => {
      const slice = recentData.slice(Math.max(0, index - 4), index + 1);
      return slice.reduce((sum, bar) => sum + Number(bar.volume), 0) / slice.length;
    });

    const volumeProfile: VolumeProfileData = {
      currentVolume,
      averageVolume,
      volumeRatio,
      unusualVolumeDetected,
      volumeMovingAverage,
      volumeSpikeThreshold: averageVolume * settings.volumeThresholdMultiplier
    };

    this.volumeProfiles.set(positionKey, volumeProfile);
    return volumeProfile;
  }

  /**
   * Calculate Greeks risk profile
   */
  private static getGreeksProfile(
    position: Position,
    currentPrice: number,
    timeToExpiration: number,
    settings: DynamicPositionSettings
  ): GreeksRiskProfile {
    // Create mock option contract for Greeks calculation
    const optionContract: OptionsChain = {
      symbol: position.symbol,
      expiration: position.expiration,
      strike: position.strike,
      side: position.side,
      bid: currentPrice * 0.95,
      ask: currentPrice * 1.05,
      impliedVolatility: 2.0 // High IV for 0-DTE
    };

    // Calculate Greeks
    const greeks = GreeksEngine.calculateGreeks(
      optionContract,
      currentPrice,
      timeToExpiration / (365 * 24 * 60), // Convert minutes to years
      optionContract.impliedVolatility
    );

    // Assess risk factors
    const riskFactors: string[] = [];

    if (Math.abs(greeks.delta) > settings.maxDeltaExposure) {
      riskFactors.push(`High delta: ${greeks.delta.toFixed(2)}`);
    }

    if (Math.abs(greeks.theta) > settings.maxThetaBurnRate) {
      riskFactors.push(`High theta decay: $${greeks.theta.toFixed(0)}/day`);
    }

    if (Math.abs(greeks.gamma) > settings.maxGammaExposure) {
      riskFactors.push(`High gamma: ${greeks.gamma.toFixed(3)}`);
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskFactors.length >= 3 || timeToExpiration < 30) {
      riskLevel = 'CRITICAL';
    } else if (riskFactors.length >= 2 || timeToExpiration < 60) {
      riskLevel = 'HIGH';
    } else if (riskFactors.length >= 1) {
      riskLevel = 'MEDIUM';
    }

    return {
      currentGreeks: {
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega
      },
      riskThresholds: {
        maxDelta: settings.maxDeltaExposure,
        maxGamma: settings.maxGammaExposure,
        maxTheta: settings.maxThetaBurnRate,
        maxVega: 200
      },
      riskFactors,
      riskLevel
    };
  }

  /**
   * Assess overall position risk
   */
  private static assessOverallRisk(
    pnlPercent: number,
    timeToExpiration: number,
    greeksProfile: GreeksRiskProfile,
    volumeProfile: VolumeProfileData,
    settings: DynamicPositionSettings
  ): {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
    warnings: string[];
  } {
    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Loss risk
    if (pnlPercent <= -settings.emergencyExitConditions.maxLossPercent) {
      riskFactors.push(`Critical loss: ${pnlPercent.toFixed(1)}%`);
    } else if (pnlPercent <= -20) {
      warnings.push(`Significant loss: ${pnlPercent.toFixed(1)}%`);
    }

    // Time risk
    if (timeToExpiration < 15) {
      riskFactors.push(`Critical time: ${timeToExpiration.toFixed(0)} minutes`);
    } else if (timeToExpiration < 60) {
      warnings.push(`Limited time: ${timeToExpiration.toFixed(0)} minutes`);
    }

    // Greeks risk
    riskFactors.push(...greeksProfile.riskFactors);

    // Volume risk
    if (volumeProfile.unusualVolumeDetected) {
      warnings.push(`Unusual volume: ${volumeProfile.volumeRatio.toFixed(1)}x average`);
    }

    // Determine overall risk
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    if (riskFactors.length >= 2 || greeksProfile.riskLevel === 'CRITICAL') {
      overallRisk = 'CRITICAL';
    } else if (riskFactors.length >= 1 || greeksProfile.riskLevel === 'HIGH') {
      overallRisk = 'HIGH';
    } else if (warnings.length >= 2 || greeksProfile.riskLevel === 'MEDIUM') {
      overallRisk = 'MEDIUM';
    }

    return { overallRisk, riskFactors, warnings };
  }

  /**
   * Determine action based on recommendation and risk
   */
  private static determineAction(
    recommendation: DynamicExitSignal,
    riskAssessment: { overallRisk: string; riskFactors: string[]; warnings: string[] }
  ): 'HOLD' | 'EXIT_PARTIAL' | 'EXIT_FULL' | 'ADJUST_STOPS' {
    if (recommendation.shouldExit) {
      return recommendation.exitType === 'PARTIAL' ? 'EXIT_PARTIAL' : 'EXIT_FULL';
    }

    if (riskAssessment.overallRisk === 'CRITICAL') {
      return 'EXIT_FULL';
    }

    if (riskAssessment.overallRisk === 'HIGH' && recommendation.urgency === 'MEDIUM') {
      return 'EXIT_PARTIAL';
    }

    return 'HOLD';
  }

  // =================== HELPER METHODS ===================

  private static getCurrentOptionPrice(position: Position, optionsChain: OptionsChain[]): number {
    const option = optionsChain.find(
      opt => opt.strike === position.strike &&
             opt.side === position.side &&
             opt.expiration.getTime() === position.expiration.getTime()
    );

    if (option) {
      // Calculate mid-price if not already present
      if (!option.midPrice) {
        option.midPrice = (option.bid + option.ask) / 2;
      }
      return option.midPrice;
    }

    return position.entryPrice;
  }

  private static getTimeToExpiration(expiration: Date, now: Date): number {
    return (expiration.getTime() - now.getTime()) / (1000 * 60); // Minutes
  }

  private static updateTrackingData(position: Position, report: PositionManagementReport): void {
    const positionKey = position.id || `${position.symbol}_${position.strike}_${position.side}`;
    this.lastAnalysisTime.set(positionKey, new Date());
  }

  private static createErrorReport(position: Position, error: any): PositionManagementReport {
    return {
      positionId: position.id || `${position.symbol}_${position.strike}_${position.side}`,
      symbol: position.symbol,
      action: 'HOLD',
      recommendation: {
        shouldExit: false,
        exitType: 'FULL',
        reason: `Analysis error: ${error}`,
        urgency: 'LOW',
        timestamp: new Date()
      },
      currentState: {
        currentPrice: position.entryPrice,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        timeToExpiration: 0,
        volumeProfile: {
          currentVolume: 0,
          averageVolume: 0,
          volumeRatio: 0,
          unusualVolumeDetected: false,
          volumeMovingAverage: [],
          volumeSpikeThreshold: 0
        },
        greeksProfile: {
          currentGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
          riskThresholds: { maxDelta: 0, maxGamma: 0, maxTheta: 0, maxVega: 0 },
          riskFactors: [`Analysis error: ${error}`],
          riskLevel: 'CRITICAL'
        },
        trailingStop: {
          isActive: false,
          highestPrice: 0,
          lowestPrice: 0,
          currentStopPrice: 0,
          lastUpdated: new Date(),
          direction: 'LONG'
        }
      },
      riskAssessment: {
        overallRisk: 'CRITICAL',
        riskFactors: [`Analysis error: ${error}`],
        warnings: []
      },
      timestamp: new Date()
    };
  }

  /**
   * Get default position settings
   */
  static getDefaultSettings(): DynamicPositionSettings {
    return { ...this.DEFAULT_POSITION_SETTINGS };
  }

  /**
   * Reset tracking data (for testing or new session)
   */
  static resetTrackingData(): void {
    this.trailingStopStates.clear();
    this.volumeProfiles.clear();
    this.lastAnalysisTime.clear();
  }

  /**
   * Get performance metrics for the position manager
   */
  static getPerformanceMetrics(): {
    positionsTracked: number;
    trailingStopsActive: number;
    volumeSpikeDetections: number;
    lastUpdateTime: Date | null;
  } {
    return {
      positionsTracked: this.lastAnalysisTime.size,
      trailingStopsActive: Array.from(this.trailingStopStates.values()).filter(state => state.isActive).length,
      volumeSpikeDetections: Array.from(this.volumeProfiles.values()).filter(profile => profile.unusualVolumeDetected).length,
      lastUpdateTime: this.lastAnalysisTime.size > 0 ?
        Array.from(this.lastAnalysisTime.values()).reduce((latest, current) =>
          current > latest ? current : latest) : null
    };
  }
}