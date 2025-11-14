/**
 * GREEKS-BASED POSITION MANAGER
 *
 * Specialized manager for real-time options Greeks analysis and risk management
 * Optimized for 0-DTE SPY options trading with dynamic delta, gamma, theta, and vega monitoring
 */

import {
  Position,
  OptionsChain,
  DynamicExitSignal,
  GreeksRiskProfile,
  MarketData
} from './types';

export interface GreeksThresholds {
  // Delta thresholds
  maxDelta: number;           // Maximum absolute delta exposure
  deltaWarning: number;       // Delta warning level
  neutralDeltaRange: number; // Range for delta-neutral positions [-X, X]

  // Gamma thresholds
  maxGamma: number;           // Maximum gamma exposure
  gammaWarning: number;       // Gamma warning level
  gammaRiskMultiplier: number; // Risk multiplier for gamma calculations

  // Theta thresholds
  maxThetaDecay: number;      // Maximum theta decay per minute
  thetaWarning: number;       // Theta warning level
  thetaUrgency: number;       // Urgent theta level requiring action

  // Vega thresholds
  maxVega: number;            // Maximum vega exposure
  vegaWarning: number;        // Vega warning level
  ivSpikeThreshold: number;   // IV spike detection threshold

  // Combined risk thresholds
  maxTotalGreeksRisk: number; // Combined Greeks risk score
  riskConcentration: number;  // Maximum risk in single position
}

export interface GreeksPositionAnalysis {
  positionId: string;
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  quantity: number;
  underlyingPrice: number;

  // Current Greeks
  currentGreeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    impliedVolatility: number;
  };

  // Risk assessment
  riskProfile: GreeksRiskProfile;

  // Time-based analysis
  timeMetrics: {
    timeToExpiration: number;      // Minutes
    thetaDecayRate: number;        // Theta per minute
    gammaAcceleration: number;     // Gamma increase as expiration approaches
    deltaGammaImpact: number;      // Delta sensitivity to gamma changes
  };

  // Price sensitivity
  priceSensitivity: {
    deltaPer$1Move: number;        // Delta change for $1 SPY move
    gammaScalpingOpportunity: boolean;
    thetaBurnAccelerating: boolean;
    vegaLiquidityRisk: boolean;
  };

  // Action recommendations
  recommendation: {
    action: 'HOLD' | 'REDUCE' | 'EXIT_FULL' | 'ADJUST_HEDGE';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    suggestedHedge?: string;
    targetReduction: number;       // Percentage to reduce if REDUCE
  };

  timestamp: Date;
}

export interface GreeksPortfolioSummary {
  totalPositions: number;
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;

  portfolioRiskScore: number;     // 0-100 risk score
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  riskDistribution: {
    deltaRisk: number;
    gammaRisk: number;
    thetaRisk: number;
    vegaRisk: number;
  };

  urgentActions: number;          // Positions requiring immediate attention
  warningActions: number;         // Positions with warnings
  optimalHedges: string[];        // Suggested hedge positions

  timestamp: Date;
}

/**
 * Greeks-Based Position Manager
 *
 * Provides real-time analysis of options Greeks for 0-DTE trading
 * Focuses on delta-neutral strategies and gamma risk management
 */
export class GreeksBasedPositionManager {
  private static readonly DEFAULT_THRESHOLDS: GreeksThresholds = {
    // Delta thresholds - optimized for 0-DTE
    maxDelta: 50,                 // $50 delta per position
    deltaWarning: 30,             // Warning at $30 delta
    neutralDeltaRange: 5,         // ±5 delta for neutral positions

    // Gamma thresholds - critical for 0-DTE
    maxGamma: 0.5,                // 0.5 gamma max
    gammaWarning: 0.3,            // Warning at 0.3 gamma
    gammaRiskMultiplier: 2.0,     // Risk multiplier for gamma

    // Theta thresholds - accelerated decay
    maxThetaDecay: 0.1,           // 10 cents per minute max decay
    thetaWarning: 0.05,           // 5 cents per minute warning
    thetaUrgency: 0.15,           // 15 cents per minute urgency

    // Vega thresholds - volatility risk
    maxVega: 2.0,                 // $2 vega max
    vegaWarning: 1.5,             // $1.5 vega warning
    ivSpikeThreshold: 0.25,       // 25% IV spike threshold

    // Combined risk
    maxTotalGreeksRisk: 75,       // Risk score max 75
    riskConcentration: 0.3        // Max 30% in single position
  };

  /**
   * Analyze positions from Greeks perspective
   */
  static async analyzePositions(
    positions: Position[],
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    customThresholds?: Partial<GreeksThresholds>
  ): Promise<GreeksPositionAnalysis[]> {
    const thresholds = { ...this.DEFAULT_THRESHOLDS, ...customThresholds };

    console.log(`🔢 GREEKS ANALYSIS: Analyzing ${positions.length} positions`);

    const analyses: GreeksPositionAnalysis[] = [];

    for (const position of positions) {
      try {
        const analysis = await this.analyzePosition(position, optionsChain, marketData, thresholds);
        analyses.push(analysis);
      } catch (error) {
        console.error(`❌ Greeks analysis failed for ${position.symbol}: ${error}`);
      }
    }

    return analyses;
  }

  /**
   * Analyze single position
   */
  private static async analyzePosition(
    position: Position,
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    thresholds: GreeksThresholds
  ): Promise<GreeksPositionAnalysis> {
    // Get current options data
    const optionData = optionsChain.find(opt =>
      opt.symbol === position.symbol &&
      opt.strike === position.strike &&
      Math.abs(opt.expiration.getTime() - position.expiration.getTime()) < 86400000
    );

    if (!optionData) {
      throw new Error(`Options data not found for ${position.symbol} ${position.strike} ${position.expiration}`);
    }

    // Get underlying price
    const underlyingPrice = marketData[marketData.length - 1]?.close || 0;

    // Calculate current Greeks (using Black-Scholes approximation)
    const currentGreeks = this.calculateGreeks(optionData, underlyingPrice, position);

    // Time-based metrics
    const timeToExpiration = this.getTimeToExpiration(position.expiration);
    const timeMetrics = this.calculateTimeMetrics(currentGreeks, timeToExpiration);

    // Price sensitivity analysis
    const priceSensitivity = this.calculatePriceSensitivity(currentGreeks, timeMetrics);

    // Risk assessment
    const riskProfile = this.assessGreeksRisk(currentGreeks, thresholds);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      position,
      currentGreeks,
      riskProfile,
      timeMetrics,
      thresholds
    );

    return {
      positionId: position.id || '',
      symbol: position.symbol,
      side: position.side,
      strike: position.strike,
      expiration: position.expiration,
      quantity: position.quantity,
      underlyingPrice,
      currentGreeks,
      riskProfile,
      timeMetrics,
      priceSensitivity,
      recommendation,
      timestamp: new Date()
    };
  }

  /**
   * Calculate options Greeks using Black-Scholes approximation
   */
  private static calculateGreeks(
    optionData: OptionsChain,
    underlyingPrice: number,
    position: Position
  ): { delta: number; gamma: number; theta: number; vega: number; impliedVolatility: number } {
    // Use provided Greeks if available
    if (optionData.delta && optionData.gamma && optionData.theta && optionData.vega) {
      return {
        delta: optionData.delta * position.quantity,
        gamma: optionData.gamma * position.quantity,
        theta: optionData.theta * position.quantity,
        vega: optionData.vega * position.quantity,
        impliedVolatility: optionData.impliedVolatility || 0
      };
    }

    // Fallback calculation (simplified Black-Scholes)
    const timeToExp = this.getTimeToExpiration(optionData.expiration) / (365 * 24 * 60); // Years
    const moneyness = underlyingPrice / optionData.strike;
    const iv = optionData.impliedVolatility || 0.25;

    // Simplified Greeks calculation
    const d1 = (Math.log(moneyness) + (0.5 * iv * iv * timeToExp)) / (iv * Math.sqrt(timeToExp));
    const sqrtTimeToExp = Math.sqrt(timeToExp);

    // Delta approximation
    const deltaPerOption = this.normalCDF(d1) * (position.side === 'CALL' ? 1 : -1);
    const delta = deltaPerOption * position.quantity;

    // Gamma approximation
    const gammaPerOption = this.normalPDF(d1) / (underlyingPrice * iv * sqrtTimeToExp);
    const gamma = gammaPerOption * position.quantity;

    // Theta approximation (per day, converted to per minute)
    const thetaPerOption = -(underlyingPrice * iv * this.normalPDF(d1) / (2 * sqrtTimeToExp) -
                             0.05 * optionData.strike * timeToExp * this.normalCDF(d1 * (position.side === 'CALL' ? 1 : -1)));
    const theta = (thetaPerOption / (365 * 24 * 60)) * position.quantity;

    // Vega approximation
    const vegaPerOption = underlyingPrice * sqrtTimeToExp * this.normalPDF(d1);
    const vega = vegaPerOption * 0.01 * position.quantity; // Per 1% vol change

    return {
      delta,
      gamma,
      theta,
      vega,
      impliedVolatility: iv
    };
  }

  /**
   * Calculate time-based metrics for 0-DTE
   */
  private static calculateTimeMetrics(
    greeks: { delta: number; gamma: number; theta: number; vega: number },
    timeToExpiration: number
  ): { timeToExpiration: number; thetaDecayRate: number; gammaAcceleration: number; deltaGammaImpact: number } {
    return {
      timeToExpiration,
      thetaDecayRate: Math.abs(greeks.theta), // Theta burn per minute
      gammaAcceleration: greeks.gamma * Math.max(1, 60 / timeToExpiration), // Gamma accelerates near expiration
      deltaGammaImpact: Math.abs(greeks.delta * greeks.gamma * 100) // Delta sensitivity to gamma
    };
  }

  /**
   * Calculate price sensitivity metrics
   */
  private static calculatePriceSensitivity(
    greeks: { delta: number; gamma: number; theta: number; vega: number },
    timeMetrics: { timeToExpiration: number; thetaDecayRate: number; gammaAcceleration: number }
  ): { deltaPer$1Move: number; gammaScalpingOpportunity: boolean; thetaBurnAccelerating: boolean; vegaLiquidityRisk: boolean } {
    return {
      deltaPer$1Move: Math.abs(greeks.delta),
      gammaScalpingOpportunity: Math.abs(greeks.gamma) > 0.2 && timeMetrics.timeToExpiration > 30,
      thetaBurnAccelerating: timeMetrics.thetaDecayRate > 0.05,
      vegaLiquidityRisk: Math.abs(greeks.vega) > 1.5
    };
  }

  /**
   * Assess Greeks-based risk
   */
  private static assessGreeksRisk(
    greeks: { delta: number; gamma: number; theta: number; vega: number },
    thresholds: GreeksThresholds
  ): GreeksRiskProfile {
    const riskFactors: string[] = [];

    // Delta risk
    const deltaRisk = Math.abs(greeks.delta) / thresholds.maxDelta;
    if (deltaRisk > 1) riskFactors.push('Excessive delta exposure');

    // Gamma risk (multiplied for 0-DTE)
    const gammaRisk = (Math.abs(greeks.gamma) * thresholds.gammaRiskMultiplier) / thresholds.maxGamma;
    if (gammaRisk > 1) riskFactors.push('High gamma risk');

    // Theta risk
    const thetaRisk = Math.abs(greeks.theta) / thresholds.thetaUrgency;
    if (thetaRisk > 1) riskFactors.push('Accelerating theta decay');

    // Vega risk
    const vegaRisk = Math.abs(greeks.vega) / thresholds.maxVega;
    if (vegaRisk > 1) riskFactors.push('High vega exposure');

    // Overall risk level
    const maxRisk = Math.max(deltaRisk, gammaRisk, thetaRisk, vegaRisk);
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (maxRisk >= 1) riskLevel = 'CRITICAL';
    else if (maxRisk >= 0.8) riskLevel = 'HIGH';
    else if (maxRisk >= 0.5) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    return {
      currentGreeks: greeks,
      riskThresholds: {
        maxDelta: thresholds.maxDelta,
        maxGamma: thresholds.maxGamma,
        maxTheta: thresholds.thetaUrgency,
        maxVega: thresholds.maxVega
      },
      riskFactors,
      riskLevel
    };
  }

  /**
   * Generate action recommendations based on Greeks analysis
   */
  private static generateRecommendation(
    position: Position,
    greeks: { delta: number; gamma: number; theta: number; vega: number },
    riskProfile: GreeksRiskProfile,
    timeMetrics: { timeToExpiration: number; thetaDecayRate: number },
    thresholds: GreeksThresholds
  ): { action: 'HOLD' | 'REDUCE' | 'EXIT_FULL' | 'ADJUST_HEDGE'; urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reason: string; suggestedHedge?: string; targetReduction: number } {

    // Critical conditions - immediate exit
    if (riskProfile.riskLevel === 'CRITICAL') {
      return {
        action: 'EXIT_FULL',
        urgency: 'CRITICAL',
        reason: `Critical Greeks risk: ${riskProfile.riskFactors.join(', ')}`,
        targetReduction: 100
      };
    }

    // High theta decay near expiration
    if (timeMetrics.timeToExpiration < 30 && timeMetrics.thetaDecayRate > thresholds.thetaUrgency) {
      return {
        action: 'REDUCE',
        urgency: 'HIGH',
        reason: 'Accelerating theta decay within 30 minutes of expiration',
        targetReduction: 50
      };
    }

    // High gamma exposure
    if (Math.abs(greeks.gamma) > thresholds.gammaWarning) {
      return {
        action: 'REDUCE',
        urgency: 'MEDIUM',
        reason: 'High gamma risk - position sensitive to underlying moves',
        targetReduction: 30
      };
    }

    // Delta imbalance
    if (Math.abs(greeks.delta) > thresholds.deltaWarning) {
      const hedgeSuggestion = greeks.delta > 0 ? 'Consider buying puts or selling calls' : 'Consider buying calls or selling puts';
      return {
        action: 'ADJUST_HEDGE',
        urgency: 'MEDIUM',
        reason: `Delta imbalance: ${greeks.delta.toFixed(2)}`,
        suggestedHedge: hedgeSuggestion,
        targetReduction: 0
      };
    }

    // Low risk conditions
    if (riskProfile.riskLevel === 'LOW') {
      return {
        action: 'HOLD',
        urgency: 'LOW',
        reason: 'Greeks within acceptable parameters',
        targetReduction: 0
      };
    }

    // Default moderate action
    return {
      action: 'REDUCE',
      urgency: 'MEDIUM',
      reason: 'Moderate Greeks risk - reduce position size',
      targetReduction: 25
    };
  }

  /**
   * Generate portfolio summary
   */
  static generatePortfolioSummary(analyses: GreeksPositionAnalysis[]): GreeksPortfolioSummary {
    const totalDelta = analyses.reduce((sum, a) => sum + a.currentGreeks.delta, 0);
    const totalGamma = analyses.reduce((sum, a) => sum + a.currentGreeks.gamma, 0);
    const totalTheta = analyses.reduce((sum, a) => sum + a.currentGreeks.theta, 0);
    const totalVega = analyses.reduce((sum, a) => sum + a.currentGreeks.vega, 0);

    const urgentActions = analyses.filter(a => a.recommendation.urgency === 'CRITICAL' || a.recommendation.urgency === 'HIGH').length;
    const warningActions = analyses.filter(a => a.recommendation.urgency === 'MEDIUM').length;

    // Calculate risk distribution
    const maxDelta = this.DEFAULT_THRESHOLDS.maxDelta * analyses.length;
    const maxGamma = this.DEFAULT_THRESHOLDS.maxGamma * analyses.length;
    const maxTheta = this.DEFAULT_THRESHOLDS.thetaUrgency * analyses.length;
    const maxVega = this.DEFAULT_THRESHOLDS.maxVega * analyses.length;

    const deltaRisk = (Math.abs(totalDelta) / maxDelta) * 25;
    const gammaRisk = (Math.abs(totalGamma) / maxGamma) * 25;
    const thetaRisk = (Math.abs(totalTheta) / maxTheta) * 25;
    const vegaRisk = (Math.abs(totalVega) / maxVega) * 25;

    const portfolioRiskScore = Math.min(100, deltaRisk + gammaRisk + thetaRisk + vegaRisk);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (portfolioRiskScore >= 75) riskLevel = 'CRITICAL';
    else if (portfolioRiskScore >= 50) riskLevel = 'HIGH';
    else if (portfolioRiskScore >= 25) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // Generate hedge suggestions
    const optimalHedges: string[] = [];
    if (Math.abs(totalDelta) > this.DEFAULT_THRESHOLDS.deltaWarning) {
      optimalHedges.push(totalDelta > 0 ? 'Reduce delta exposure with puts or covered calls' : 'Reduce negative delta with calls or protective puts');
    }
    if (Math.abs(totalGamma) > this.DEFAULT_THRESHOLDS.gammaWarning) {
      optimalHedges.push('Consider gamma scalping strategies or calendar spreads');
    }
    if (Math.abs(totalTheta) < -this.DEFAULT_THRESHOLDS.thetaWarning) {
      optimalHedges.push('Theta decay favorable - consider selling premium');
    }

    return {
      totalPositions: analyses.length,
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
      portfolioRiskScore,
      riskLevel,
      riskDistribution: {
        deltaRisk,
        gammaRisk,
        thetaRisk,
        vegaRisk
      },
      urgentActions,
      warningActions,
      optimalHedges,
      timestamp: new Date()
    };
  }

  /**
   * Convert analysis to exit signal for integration
   */
  static toExitSignals(analyses: GreeksPositionAnalysis[]): DynamicExitSignal[] {
    return analyses.map(analysis => ({
      shouldExit: analysis.recommendation.action === 'EXIT_FULL' ||
                 (analysis.recommendation.action === 'REDUCE' && analysis.recommendation.targetReduction >= 75),
      exitType: analysis.recommendation.action === 'REDUCE' ? 'PARTIAL' : 'FULL',
      exitQuantity: analysis.recommendation.action === 'REDUCE' ?
                   analysis.quantity * (analysis.recommendation.targetReduction / 100) :
                   analysis.quantity,
      reason: `Greeks Analysis: ${analysis.recommendation.reason}`,
      urgency: analysis.recommendation.urgency,
      timestamp: analysis.timestamp,
      greeksRiskTriggered: analysis.riskProfile.riskLevel === 'HIGH' || analysis.riskProfile.riskLevel === 'CRITICAL',
      trailingStopTriggered: false,
      timeExitTriggered: analysis.timeMetrics.timeToExpiration < 30,
      volumeExitTriggered: false,
      volatilityStopTriggered: false
    }));
  }

  // =================== UTILITY METHODS ===================

  private static getTimeToExpiration(expiration: Date): number {
    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60))); // Minutes
  }

  private static normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private static normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private static erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Get default thresholds
   */
  static getDefaultThresholds(): GreeksThresholds {
    return { ...this.DEFAULT_THRESHOLDS };
  }

  /**
   * Validate thresholds configuration
   */
  static validateThresholds(thresholds: Partial<GreeksThresholds>): string[] {
    const errors: string[] = [];

    if (thresholds.maxDelta !== undefined && thresholds.maxDelta <= 0) {
      errors.push('maxDelta must be positive');
    }

    if (thresholds.maxGamma !== undefined && thresholds.maxGamma <= 0) {
      errors.push('maxGamma must be positive');
    }

    if (thresholds.thetaUrgency !== undefined && thresholds.thetaUrgency <= 0) {
      errors.push('thetaUrgency must be positive');
    }

    if (thresholds.maxVega !== undefined && thresholds.maxVega <= 0) {
      errors.push('maxVega must be positive');
    }

    if (thresholds.maxTotalGreeksRisk !== undefined && (thresholds.maxTotalGreeksRisk < 0 || thresholds.maxTotalGreeksRisk > 100)) {
      errors.push('maxTotalGreeksRisk must be between 0 and 100');
    }

    return errors;
  }
}