/**
 * TIME-DECAY POSITION MANAGER
 *
 * Specialized manager for 0-DTE options time-decay optimization
 * Focuses on theta management, time-based exit strategies, and expiration risk mitigation
 */

import {
  Position,
  OptionsChain,
  DynamicExitSignal,
  MarketData
} from '../../types';

export interface TimeDecayThresholds {
  // Time-based thresholds (minutes)
  criticalTimeThreshold: number;    // Critical: exit before X minutes
  warningTimeThreshold: number;     // Warning: review position before X minutes
  optimalExitTime: number;          // Optimal: start scaling at X minutes

  // Theta decay thresholds
  maxThetaDecayRate: number;        // Maximum theta decay per minute ($)
  thetaAccelerationThreshold: number; // Theta acceleration multiplier
  thetaWarningRate: number;         // Warning theta decay rate

  // Time-based profit/loss thresholds
  timeBasedProfitTarget: number;    // Profit target based on time held
  timeBasedStopLoss: number;        // Stop loss based on time decay

  // Market hours considerations
  preMarketExitMinutes: number;     // Exit X minutes before market close
  liquidityThresholdMinutes: number; // Exit when liquidity dries up

  // Volatility time considerations
  ivCrushTimeThreshold: number;     // IV crush risk timeframe
  volatilityTimeAdjustment: number; // Time adjustment for volatility changes
}

export interface TimeDecayAnalysis {
  positionId: string;
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;

  // Time metrics
  timeMetrics: {
    timeToExpiration: number;       // Minutes until expiration
    timeSinceEntry: number;         // Minutes since position entry
    timeToMarketClose: number;      // Minutes until market close
    holdingPeriodRatio: number;     // timeSinceEntry / timeToExpiration
    urgencyScore: number;           // 0-100 urgency score
  };

  // Theta analysis
  thetaAnalysis: {
    currentTheta: number;           // Current theta per position
    thetaDecayRate: number;         // Theta decay per minute
    thetaAcceleration: number;      // Theta acceleration factor
    projectedThetaBurn: number;     // Projected theta burn to expiration
    thetaRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timeValueErosion: number;       // Percentage of time value lost
  };

  // Time-based performance
  performanceMetrics: {
    timeBasedReturn: number;        // Return adjusted for time held
    thetaAdjustedReturn: number;    // Return after theta costs
    holdingEfficiency: number;      // Profit per minute held
    timeValueRemaining: number;     // Percentage of time value left
    decayVelocity: number;          // Speed of time decay (0-1)
  };

  // Exit timing recommendations
  timingRecommendations: {
    optimalExitTime: Date;          // Recommended exit time
    scalingSchedule: ScalingPoint[]; // Progressive exit schedule
    emergencyExitTime: Date;        // Latest possible exit time
    liquidityWindow: { start: Date; end: Date }; // Optimal liquidity window
  };

  // Action recommendation
  recommendation: {
    action: 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    executeImmediately: boolean;
    scalingStrategy?: string;
    timingJustification: string;
  };

  timestamp: Date;
}

export interface ScalingPoint {
  time: Date;                       // When to scale
  timeToExpiration: number;         // Minutes to expiration at scaling point
  percentage: number;               // Percentage to exit at this point
  reason: string;                   // Reason for scaling at this point
  thetaTarget: number;              // Target theta threshold
}

export interface TimeDecayPortfolioSummary {
  totalPositions: number;
  positionsByUrgency: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  portfolioTimeMetrics: {
    averageTimeToExpiration: number;
    weightedThetaDecay: number;
    totalThetaBurnPerMinute: number;
    portfolioUrgencyScore: number;
    liquidityRiskScore: number;
  };

  immediateActions: {
    emergencyExits: number;
    scalingRequired: number;
    reviewsNeeded: number;
  };

  marketTimingFactors: {
    minutesToMarketClose: number;
    preMarketPressure: boolean;
    liquidityConditions: 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL';
    ivEnvironment: 'LOW' | 'NORMAL' | 'ELEVATED' | 'EXTREME';
  };

  timestamp: Date;
}

/**
 * Time-Decay Position Manager
 *
 * Optimized for 0-DTE options trading with sophisticated time-based risk management
 * Focuses on theta decay acceleration and liquidity preservation near expiration
 */
export class TimeDecayPositionManager {
  private static readonly DEFAULT_THRESHOLDS: TimeDecayThresholds = {
    // Time-based thresholds optimized for 0-DTE
    criticalTimeThreshold: 15,      // 15 minutes to expiration - critical
    warningTimeThreshold: 30,       // 30 minutes - warning level
    optimalExitTime: 45,            // 45 minutes - start scaling

    // Theta decay thresholds
    maxThetaDecayRate: 0.05,        // 5 cents per minute max decay
    thetaAccelerationThreshold: 2.0, // Theta accelerates 2x near expiration
    thetaWarningRate: 0.03,         // 3 cents per minute warning

    // Time-based P/L thresholds
    timeBasedProfitTarget: 0.15,    // 15% profit target adjusted for time
    timeBasedStopLoss: 0.08,        // 8% stop loss considering time decay

    // Market hours considerations
    preMarketExitMinutes: 10,       // Exit 10 minutes before close
    liquidityThresholdMinutes: 5,   // Exit when 5 minutes of liquidity left

    // Volatility considerations
    ivCrushTimeThreshold: 60,       // IV crush risk within 60 minutes
    volatilityTimeAdjustment: 1.5   // Time multiplier for high volatility
  };

  /**
   * Analyze positions from time-decay perspective
   */
  static async analyzePositions(
    positions: Position[],
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    customThresholds?: Partial<TimeDecayThresholds>
  ): Promise<TimeDecayAnalysis[]> {
    const thresholds = { ...this.DEFAULT_THRESHOLDS, ...customThresholds };

    console.log(`⏰ TIME-DECAY ANALYSIS: Analyzing ${positions.length} positions`);

    const analyses: TimeDecayAnalysis[] = [];

    for (const position of positions) {
      try {
        const analysis = await this.analyzePosition(position, optionsChain, marketData, thresholds);
        analyses.push(analysis);
      } catch (error) {
        console.error(`❌ Time-decay analysis failed for ${position.symbol}: ${error}`);
      }
    }

    return analyses;
  }

  /**
   * Analyze single position for time-decay factors
   */
  private static async analyzePosition(
    position: Position,
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    thresholds: TimeDecayThresholds
  ): Promise<TimeDecayAnalysis> {
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

    // Time metrics calculation
    const timeMetrics = this.calculateTimeMetrics(position, marketData, thresholds);

    // Theta analysis
    const thetaAnalysis = this.analyzeTheta(position, optionData, timeMetrics, thresholds);

    // Performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(
      position,
      currentPrice,
      thetaAnalysis,
      timeMetrics
    );

    // Timing recommendations
    const timingRecommendations = this.generateTimingRecommendations(
      position,
      timeMetrics,
      thetaAnalysis,
      thresholds
    );

    // Generate recommendation
    const recommendation = this.generateTimeBasedRecommendation(
      position,
      timeMetrics,
      thetaAnalysis,
      performanceMetrics,
      timingRecommendations,
      thresholds
    );

    return {
      positionId: position.id || '',
      symbol: position.symbol,
      side: position.side,
      strike: position.strike,
      expiration: position.expiration,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      currentPrice,
      timeMetrics,
      thetaAnalysis,
      performanceMetrics,
      timingRecommendations,
      recommendation,
      timestamp: new Date()
    };
  }

  /**
   * Calculate comprehensive time metrics
   */
  private static calculateTimeMetrics(
    position: Position,
    marketData: MarketData[],
    thresholds: TimeDecayThresholds
  ): {
    timeToExpiration: number;
    timeSinceEntry: number;
    timeToMarketClose: number;
    holdingPeriodRatio: number;
    urgencyScore: number;
  } {
    const now = new Date();

    // Time to expiration
    const timeToExpiration = Math.max(0, Math.floor(
      (position.expiration.getTime() - now.getTime()) / (1000 * 60)
    ));

    // Time since entry
    const timeSinceEntry = Math.floor(
      (now.getTime() - position.entryDate.getTime()) / (1000 * 60)
    );

    // Time to market close (assuming 4:00 PM EST close)
    const marketClose = new Date(now);
    marketClose.setHours(16, 0, 0, 0);
    if (marketClose < now) {
      marketClose.setDate(marketClose.getDate() + 1);
    }
    const timeToMarketClose = Math.max(0, Math.floor(
      (marketClose.getTime() - now.getTime()) / (1000 * 60)
    ));

    // Holding period ratio
    const totalExpectedLife = 6.5 * 60; // 6.5 hours in minutes (typical trading day)
    const holdingPeriodRatio = Math.min(1, timeSinceEntry / totalExpectedLife);

    // Urgency score (0-100)
    let urgencyScore = 0;

    // Time-based urgency
    if (timeToExpiration <= thresholds.criticalTimeThreshold) {
      urgencyScore += 40;
    } else if (timeToExpiration <= thresholds.warningTimeThreshold) {
      urgencyScore += 25;
    } else if (timeToExpiration <= thresholds.optimalExitTime) {
      urgencyScore += 15;
    }

    // Market close urgency
    if (timeToMarketClose <= thresholds.preMarketExitMinutes) {
      urgencyScore += 30;
    }

    // Holding period urgency (longer holds = higher urgency)
    urgencyScore += Math.min(20, holdingPeriodRatio * 30);

    return {
      timeToExpiration,
      timeSinceEntry,
      timeToMarketClose,
      holdingPeriodRatio,
      urgencyScore: Math.min(100, urgencyScore)
    };
  }

  /**
   * Analyze theta decay characteristics
   */
  private static analyzeTheta(
    position: Position,
    optionData: OptionsChain,
    timeMetrics: { timeToExpiration: number },
    thresholds: TimeDecayThresholds
  ): {
    currentTheta: number;
    thetaDecayRate: number;
    thetaAcceleration: number;
    projectedThetaBurn: number;
    thetaRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timeValueErosion: number;
  } {
    // Get theta from options data or calculate approximation
    const currentTheta = optionData.theta || this.approximateTheta(optionData, position);

    // Theta decay rate (absolute value, per minute)
    const thetaDecayRate = Math.abs(currentTheta * position.quantity);

    // Theta acceleration (increases near expiration)
    const accelerationMultiplier = timeMetrics.timeToExpiration < 60 ?
      Math.max(1, thresholds.thetaAccelerationThreshold * (1 - timeMetrics.timeToExpiration / 60)) :
      1;
    const thetaAcceleration = thetaDecayRate * accelerationMultiplier;

    // Projected theta burn to expiration
    const projectedThetaBurn = thetaAcceleration * timeMetrics.timeToExpiration;

    // Time value erosion percentage
    const timeValueRemaining = optionData.midPrice || ((optionData.bid + optionData.ask) / 2);
    const timeValueErosion = timeValueRemaining > 0 ?
      Math.min(100, (projectedThetaBurn / timeValueRemaining) * 100) : 0;

    // Theta risk level
    let thetaRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (thetaAcceleration > thresholds.maxThetaDecayRate * 2) {
      thetaRiskLevel = 'CRITICAL';
    } else if (thetaAcceleration > thresholds.maxThetaDecayRate) {
      thetaRiskLevel = 'HIGH';
    } else if (thetaDecayRate > thresholds.thetaWarningRate) {
      thetaRiskLevel = 'MEDIUM';
    } else {
      thetaRiskLevel = 'LOW';
    }

    return {
      currentTheta,
      thetaDecayRate,
      thetaAcceleration,
      projectedThetaBurn,
      thetaRiskLevel,
      timeValueErosion
    };
  }

  /**
   * Calculate time-based performance metrics
   */
  private static calculatePerformanceMetrics(
    position: Position,
    currentPrice: number,
    thetaAnalysis: { projectedThetaBurn: number },
    timeMetrics: { timeSinceEntry: number }
  ): {
    timeBasedReturn: number;
    thetaAdjustedReturn: number;
    holdingEfficiency: number;
    timeValueRemaining: number;
    decayVelocity: number;
  } {
    const priceReturn = ((currentPrice - position.entryPrice) / position.entryPrice);
    const timeBasedReturn = timeMetrics.timeSinceEntry > 0 ? priceReturn / (timeMetrics.timeSinceEntry / 60) : 0; // Return per hour
    const thetaAdjustedReturn = priceReturn - (thetaAnalysis.projectedThetaBurn / position.entryPrice);
    const holdingEfficiency = timeMetrics.timeSinceEntry > 0 ? priceReturn / timeMetrics.timeSinceEntry : 0; // Profit per minute
    const timeValueRemaining = Math.max(0, currentPrice - Math.max(0, currentPrice - position.entryPrice));
    const decayVelocity = Math.min(1, thetaAnalysis.projectedThetaBurn / currentPrice);

    return {
      timeBasedReturn,
      thetaAdjustedReturn,
      holdingEfficiency,
      timeValueRemaining,
      decayVelocity
    };
  }

  /**
   * Generate timing recommendations with scaling schedule
   */
  private static generateTimingRecommendations(
    position: Position,
    timeMetrics: { timeToExpiration: number },
    thetaAnalysis: { thetaAcceleration: number; thetaRiskLevel: string },
    thresholds: TimeDecayThresholds
  ): {
    optimalExitTime: Date;
    scalingSchedule: ScalingPoint[];
    emergencyExitTime: Date;
    liquidityWindow: { start: Date; end: Date };
  } {
    const now = new Date();

    // Emergency exit time
    const emergencyExitTime = new Date(position.expiration.getTime() -
      (thresholds.criticalTimeThreshold * 60 * 1000));

    // Optimal exit time
    let optimalExitMinutes = thresholds.optimalExitTime;
    if (thetaAnalysis.thetaRiskLevel === 'HIGH' || thetaAnalysis.thetaRiskLevel === 'CRITICAL') {
      optimalExitMinutes = thresholds.warningTimeThreshold;
    }
    const optimalExitTime = new Date(now.getTime() + (optimalExitMinutes * 60 * 1000));

    // Scaling schedule (progressive exit strategy)
    const scalingSchedule: ScalingPoint[] = [];

    if (timeMetrics.timeToExpiration > thresholds.optimalExitTime) {
      // First scaling point
      scalingSchedule.push({
        time: new Date(position.expiration.getTime() - (thresholds.optimalExitTime * 60 * 1000)),
        timeToExpiration: thresholds.optimalExitTime,
        percentage: 30,
        reason: 'Begin scaling - optimal exit window',
        thetaTarget: thresholds.maxThetaDecayRate
      });

      // Second scaling point
      scalingSchedule.push({
        time: new Date(position.expiration.getTime() - (thresholds.warningTimeThreshold * 60 * 1000)),
        timeToExpiration: thresholds.warningTimeThreshold,
        percentage: 40,
        reason: 'Accelerated theta decay - increase scaling',
        thetaTarget: thresholds.thetaWarningRate
      });

      // Final scaling point
      scalingSchedule.push({
        time: new Date(position.expiration.getTime() - (thresholds.criticalTimeThreshold * 60 * 1000)),
        timeToExpiration: thresholds.criticalTimeThreshold,
        percentage: 30,
        reason: 'Critical time threshold - final exit',
        thetaTarget: 0
      });
    }

    // Liquidity window (when there's still good liquidity)
    const liquidityWindow = {
      start: new Date(position.expiration.getTime() - (thresholds.liquidityThresholdMinutes * 60 * 1000 * 3)),
      end: new Date(position.expiration.getTime() - (thresholds.liquidityThresholdMinutes * 60 * 1000))
    };

    return {
      optimalExitTime,
      scalingSchedule,
      emergencyExitTime,
      liquidityWindow
    };
  }

  /**
   * Generate time-based action recommendations
   */
  private static generateTimeBasedRecommendation(
    position: Position,
    timeMetrics: { timeToExpiration: number; urgencyScore: number; timeToMarketClose: number },
    thetaAnalysis: { thetaRiskLevel: string; timeValueErosion: number },
    performanceMetrics: { thetaAdjustedReturn: number },
    timingRecommendations: { scalingSchedule: ScalingPoint[] },
    thresholds: TimeDecayThresholds
  ): {
    action: 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    executeImmediately: boolean;
    scalingStrategy?: string;
    timingJustification: string;
  } {
    // Emergency conditions
    if (timeMetrics.timeToExpiration <= thresholds.criticalTimeThreshold ||
        timeMetrics.timeToMarketClose <= thresholds.preMarketExitMinutes ||
        thetaAnalysis.thetaRiskLevel === 'CRITICAL') {
      return {
        action: 'EMERGENCY_EXIT',
        urgency: 'CRITICAL',
        reason: 'Critical time threshold or market close approaching',
        executeImmediately: true,
        timingJustification: `Time to expiration: ${timeMetrics.timeToExpiration}min, Market close: ${timeMetrics.timeToMarketClose}min`
      };
    }

    // High urgency conditions
    if (timeMetrics.timeToExpiration <= thresholds.warningTimeThreshold ||
        thetaAnalysis.thetaRiskLevel === 'HIGH' ||
        timeMetrics.urgencyScore >= 75) {
      if (timingRecommendations.scalingSchedule.length > 0) {
        return {
          action: 'SCALE_OUT',
          urgency: 'HIGH',
          reason: 'Time decay acceleration - begin scaling out',
          executeImmediately: false,
          scalingStrategy: 'Follow predefined scaling schedule',
          timingJustification: `${timeMetrics.timeToExpiration} minutes to expiration, theta risk: ${thetaAnalysis.thetaRiskLevel}`
        };
      } else {
        return {
          action: 'EXIT_FULL',
          urgency: 'HIGH',
          reason: 'High time decay risk with no scaling opportunity',
          executeImmediately: false,
          timingJustification: `Theta erosion: ${thetaAnalysis.timeValueErosion.toFixed(1)}%`
        };
      }
    }

    // Medium urgency - consider scaling
    if (timeMetrics.urgencyScore >= 50 ||
        thetaAnalysis.timeValueErosion > 30) {
      return {
        action: 'SCALE_OUT',
        urgency: 'MEDIUM',
        reason: 'Moderate time decay - consider partial exits',
        executeImmediately: false,
        scalingStrategy: 'Light scaling - take partial profits',
        timingJustification: `Urgency score: ${timeMetrics.urgencyScore}, Time value erosion: ${thetaAnalysis.timeValueErosion.toFixed(1)}%`
      };
    }

    // Low urgency but theta losses mounting
    if (performanceMetrics.thetaAdjustedReturn < -thresholds.timeBasedStopLoss) {
      return {
        action: 'EXIT_FULL',
        urgency: 'MEDIUM',
        reason: 'Theta losses exceeding time-based stop loss',
        executeImmediately: false,
        timingJustification: `Theta-adjusted return: ${(performanceMetrics.thetaAdjustedReturn * 100).toFixed(1)}%`
      };
    }

    // Good conditions with scaling opportunity
    if (performanceMetrics.thetaAdjustedReturn > thresholds.timeBasedProfitTarget &&
        timingRecommendations.scalingSchedule.length > 1) {
      return {
        action: 'SCALE_OUT',
        urgency: 'LOW',
        reason: 'Profit target reached with favorable scaling conditions',
        executeImmediately: false,
        scalingStrategy: 'Take partial profits while maintaining position',
        timingJustification: `Theta-adjusted return: ${(performanceMetrics.thetaAdjustedReturn * 100).toFixed(1)}%`
      };
    }

    // Hold conditions
    return {
      action: 'HOLD',
      urgency: 'LOW',
      reason: 'Time decay within acceptable parameters',
      executeImmediately: false,
      timingJustification: `${timeMetrics.timeToExpiration} minutes to expiration with manageable theta risk`
    };
  }

  /**
   * Generate portfolio summary
   */
  static generatePortfolioSummary(analyses: TimeDecayAnalysis[]): TimeDecayPortfolioSummary {
    const positionsByUrgency = {
      critical: analyses.filter(a => a.recommendation.urgency === 'CRITICAL').length,
      high: analyses.filter(a => a.recommendation.urgency === 'HIGH').length,
      medium: analyses.filter(a => a.recommendation.urgency === 'MEDIUM').length,
      low: analyses.filter(a => a.recommendation.urgency === 'LOW').length
    };

    const totalThetaBurn = analyses.reduce((sum, a) => sum + a.thetaAnalysis.thetaAcceleration, 0);
    const avgTimeToExpiration = analyses.length > 0 ?
      analyses.reduce((sum, a) => sum + a.timeMetrics.timeToExpiration, 0) / analyses.length : 0;

    const portfolioUrgencyScore = analyses.length > 0 ?
      analyses.reduce((sum, a) => sum + a.timeMetrics.urgencyScore, 0) / analyses.length : 0;

    const immediateActions = {
      emergencyExits: analyses.filter(a => a.recommendation.action === 'EMERGENCY_EXIT').length,
      scalingRequired: analyses.filter(a => a.recommendation.action === 'SCALE_OUT').length,
      reviewsNeeded: analyses.filter(a => a.recommendation.urgency === 'HIGH').length
    };

    // Market timing factors
    const now = new Date();
    const marketClose = new Date(now);
    marketClose.setHours(16, 0, 0, 0);
    const minutesToMarketClose = marketClose > now ?
      Math.floor((marketClose.getTime() - now.getTime()) / (1000 * 60)) : 0;

    return {
      totalPositions: analyses.length,
      positionsByUrgency,
      portfolioTimeMetrics: {
        averageTimeToExpiration: avgTimeToExpiration,
        weightedThetaDecay: totalThetaBurn,
        totalThetaBurnPerMinute: totalThetaBurn,
        portfolioUrgencyScore,
        liquidityRiskScore: Math.min(100, avgTimeToExpiration < 30 ? 100 - avgTimeToExpiration * 3 : 0)
      },
      immediateActions,
      marketTimingFactors: {
        minutesToMarketClose,
        preMarketPressure: minutesToMarketClose < 30,
        liquidityConditions: avgTimeToExpiration < 15 ? 'CRITICAL' :
                            avgTimeToExpiration < 30 ? 'POOR' :
                            avgTimeToExpiration < 60 ? 'GOOD' : 'EXCELLENT',
        ivEnvironment: 'NORMAL' // Would need IV data to determine accurately
      },
      timestamp: new Date()
    };
  }

  /**
   * Convert analysis to exit signals
   */
  static toExitSignals(analyses: TimeDecayAnalysis[]): DynamicExitSignal[] {
    return analyses.map(analysis => {
      let exitQuantity = 0;
      let shouldExit = false;
      let exitType: 'FULL' | 'PARTIAL' = 'FULL';

      switch (analysis.recommendation.action) {
        case 'EMERGENCY_EXIT':
        case 'EXIT_FULL':
          shouldExit = true;
          exitType = 'FULL';
          exitQuantity = analysis.quantity;
          break;
        case 'SCALE_OUT':
          shouldExit = true;
          exitType = 'PARTIAL';
          // Use first scaling point or default 30%
          exitQuantity = analysis.quantity *
            (analysis.timingRecommendations.scalingSchedule[0]?.percentage || 30) / 100;
          break;
        case 'HOLD':
        default:
          shouldExit = false;
          break;
      }

      return {
        shouldExit,
        exitType,
        exitQuantity,
        reason: `Time Decay: ${analysis.recommendation.reason}`,
        urgency: analysis.recommendation.urgency,
        timestamp: analysis.timestamp,
        greeksRiskTriggered: false,
        trailingStopTriggered: false,
        timeExitTriggered: shouldExit,
        volumeExitTriggered: false,
        volatilityStopTriggered: false
      };
    });
  }

  // =================== UTILITY METHODS ===================

  private static approximateTheta(optionData: OptionsChain, position: Position): number {
    // Simplified theta approximation for 0-DTE options
    const daysToExp = 0.003; // ~4.3 minutes for 0-DTE
    const timeValue = optionData.midPrice || ((optionData.bid + optionData.ask) / 2);

    // Theta scales with time value and time to expiration
    // Higher premium options have higher theta
    return -timeValue * 0.8 / daysToExp * (position.side === 'CALL' ? 1 : -1);
  }

  /**
   * Get default thresholds
   */
  static getDefaultThresholds(): TimeDecayThresholds {
    return { ...this.DEFAULT_THRESHOLDS };
  }

  /**
   * Validate thresholds configuration
   */
  static validateThresholds(thresholds: Partial<TimeDecayThresholds>): string[] {
    const errors: string[] = [];

    if (thresholds.criticalTimeThreshold !== undefined && thresholds.criticalTimeThreshold <= 0) {
      errors.push('criticalTimeThreshold must be positive');
    }

    if (thresholds.warningTimeThreshold !== undefined &&
        thresholds.warningTimeThreshold <= (thresholds.criticalTimeThreshold || 15)) {
      errors.push('warningTimeThreshold must be greater than criticalTimeThreshold');
    }

    if (thresholds.maxThetaDecayRate !== undefined && thresholds.maxThetaDecayRate <= 0) {
      errors.push('maxThetaDecayRate must be positive');
    }

    if (thresholds.timeBasedProfitTarget !== undefined && thresholds.timeBasedProfitTarget <= 0) {
      errors.push('timeBasedProfitTarget must be positive');
    }

    return errors;
  }
}