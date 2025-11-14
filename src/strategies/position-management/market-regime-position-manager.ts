/**
 * MARKET REGIME POSITION MANAGER
 *
 * Specialized manager for market regime detection and adaptive position management
 * Analyzes market conditions, volatility, and trend for 0-DTE SPY options trading
 */

import {
  Position,
  OptionsChain,
  DynamicExitSignal,
  MarketData
} from '../../types';

export interface MarketRegimeThresholds {
  // Volatility thresholds
  lowVolatilityThreshold: number;     // VIX < 12 - calm markets
  normalVolatilityThreshold: number;  // VIX 12-25 - normal markets
  highVolatilityThreshold: number;    // VIX 25-35 - volatile markets
  extremeVolatilityThreshold: number; // VIX > 35 - extreme volatility

  // Trend thresholds
  uptrendThreshold: number;           // SPY above 20 SMA by X%
  downtrendThreshold: number;         // SPY below 20 SMA by X%
  sidewaysThreshold: number;          // Range within X% of 20 SMA

  // Volume thresholds
  highVolumeMultiplier: number;       // Volume > X * average
  unusualVolumeThreshold: number;     // Volume spike detection

  // Time-based thresholds
  marketSessionInfluence: number;     // Different rules for market open/close
  newsSensitivityFactor: number;      // How sensitive to news events
}

export interface MarketRegimeAnalysis {
  positionId: string;
  symbol: string;
  side: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  quantity: number;
  underlyingPrice: number;

  // Current market regime
  currentRegime: {
    volatility: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
    trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' | 'REVERSING';
    volume: 'NORMAL' | 'ELEVATED' | 'UNUSUAL';
    session: 'OPENING' | 'MIDDAY' | 'CLOSING';
    momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };

  // Risk assessment
  regimeRisk: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
    warningSignals: string[];
  };

  // Adaptation recommendations
  adaptation: {
    recommendedAction: 'HOLD' | 'ADJUST' | 'EXIT' | 'REDUCE';
    positionSizeAdjustment: number;    // Factor to adjust size (0-1)
    stopLossAdjustment: number;        // New stop loss distance
    profitTargetAdjustment: number;    // New profit target
    hedgeRecommendation: string[];
  };

  // Time and regime analysis
  timeAnalysis: {
    optimalExitTime: string;
    regimeDuration: number;            // How long current regime has persisted
    regimeStability: number;           // 0-100 stability score
    nextSessionOutlook: string;
  };

  // Market sentiment indicators
  sentiment: {
    putCallRatio: number;
    marketBreath: number;
    fearGreedIndex: number;
    moneyFlow: string;
  };

  // Action recommendations
  recommendation: {
    action: 'HOLD' | 'EXIT_PARTIAL' | 'EXIT_FULL' | 'ADJUST_STOPS';
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;                // 0-100
    reasoning: string[];
    regimeSpecificAdvice: string;
    timestamp: Date;
  };
}

export interface MarketRegimePortfolioSummary {
  totalPositions: number;
  positionsAtRisk: number;

  // Regime distribution
  regimeDistribution: {
    lowVolatilityPositions: number;
    normalVolatilityPositions: number;
    highVolatilityPositions: number;
    extremeVolatilityPositions: number;
  };

  // Risk distribution
  riskDistribution: {
    lowRiskPositions: number;
    mediumRiskPositions: number;
    highRiskPositions: number;
    criticalRiskPositions: number;
  };

  // Trend alignment
  trendAlignment: {
    alignedWithTrend: number;
    counterTrendPositions: number;
    neutralPositions: number;
  };

  // Portfolio recommendations
  portfolioRecommendations: {
    overallAction: 'MAINTAIN' | 'REDUCE' | 'EXPAND' | 'EXIT_ALL';
    riskAdjustment: 'REDUCE_RISK' | 'MAINTAIN_RISK' | 'INCREASE_RISK';
    regimeSpecificStrategy: string[];
    immediateActions: string[];
    forwardLookingAdjustments: string[];
  };

  // Market outlook
  marketOutlook: {
    shortTermRegime: string;
    mediumTermOutlook: string;
    keyRiskFactors: string[];
    opportunityAreas: string[];
  };

  // Metrics
  totalRegimeRisk: number;
  portfolioResilience: number;        // 0-100 score
  regimeAdaptabilityScore: number;    // 0-100 score

  timestamp: Date;
}

/**
 * Market Regime Position Manager
 * Analyzes market conditions and adapts position management accordingly
 */
export class MarketRegimePositionManager {
  private static readonly DEFAULT_THRESHOLDS: MarketRegimeThresholds = {
    lowVolatilityThreshold: 12,
    normalVolatilityThreshold: 25,
    highVolatilityThreshold: 35,
    extremeVolatilityThreshold: 999,

    uptrendThreshold: 0.02,           // 2% above 20 SMA
    downtrendThreshold: -0.02,        // 2% below 20 SMA
    sidewaysThreshold: 0.01,          // Within 1% of 20 SMA

    highVolumeMultiplier: 1.5,
    unusualVolumeThreshold: 2.0,

    marketSessionInfluence: 0.3,
    newsSensitivityFactor: 0.4
  };

  /**
   * Analyze positions based on market regime
   */
  static analyzePositions(
    positions: Position[],
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    thresholds?: Partial<MarketRegimeThresholds>
  ): MarketRegimeAnalysis[] {
    const fullThresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };

    console.log('🌡️  MARKET REGIME POSITION MANAGER - ANALYZING POSITIONS');
    console.log('=======================================================');
    console.log(`Positions to analyze: ${positions.length}`);

    return positions.map(position => {
      console.log(`\n📊 Analyzing position: ${position.symbol} ${position.side} $${position.strike}`);

      // Get relevant market data
      const relevantMarketData = marketData.find(md =>
        md.symbol === position.symbol &&
        md.date.getTime() === position.entryDate.getTime()
      );

      if (!relevantMarketData) {
        console.warn(`⚠️ No market data found for ${position.symbol}`);
        return this.createDefaultAnalysis(position, fullThresholds);
      }

      // Analyze current market regime
      const currentRegime = this.analyzeMarketRegime(relevantMarketData, marketData, fullThresholds);

      // Assess regime risk
      const regimeRisk = this.assessRegimeRisk(position, currentRegime, fullThresholds);

      // Generate adaptation recommendations
      const adaptation = this.generateAdaptation(position, currentRegime, regimeRisk, fullThresholds);

      // Time analysis
      const timeAnalysis = this.analyzeTimeFactors(position, currentRegime);

      // Market sentiment
      const sentiment = this.analyzeSentiment(position, optionsChain, marketData);

      // Generate final recommendation
      const recommendation = this.generateRegimeRecommendation(
        position, currentRegime, regimeRisk, adaptation, timeAnalysis
      );

      return {
        positionId: position.id || 'unknown',
        symbol: position.symbol,
        side: position.side,
        strike: position.strike,
        expiration: position.expiration,
        quantity: position.quantity,
        underlyingPrice: relevantMarketData.close,

        currentRegime,
        regimeRisk,
        adaptation,
        timeAnalysis,
        sentiment,
        recommendation
      };
    });
  }

  /**
   * Generate portfolio summary
   */
  static generatePortfolioSummary(analyses: MarketRegimeAnalysis[]): MarketRegimePortfolioSummary {
    const totalPositions = analyses.length;

    // Count by regime
    const regimeDistribution = {
      lowVolatilityPositions: analyses.filter(a => a.currentRegime.volatility === 'LOW').length,
      normalVolatilityPositions: analyses.filter(a => a.currentRegime.volatility === 'NORMAL').length,
      highVolatilityPositions: analyses.filter(a => a.currentRegime.volatility === 'HIGH').length,
      extremeVolatilityPositions: analyses.filter(a => a.currentRegime.volatility === 'EXTREME').length
    };

    // Count by risk
    const riskDistribution = {
      lowRiskPositions: analyses.filter(a => a.regimeRisk.overallRisk === 'LOW').length,
      mediumRiskPositions: analyses.filter(a => a.regimeRisk.overallRisk === 'MEDIUM').length,
      highRiskPositions: analyses.filter(a => a.regimeRisk.overallRisk === 'HIGH').length,
      criticalRiskPositions: analyses.filter(a => a.regimeRisk.overallRisk === 'CRITICAL').length
    };

    // Count by trend alignment
    const trendAlignment = {
      alignedWithTrend: analyses.filter(a =>
        (a.side === 'CALL' && a.currentRegime.trend === 'UPTREND') ||
        (a.side === 'PUT' && a.currentRegime.trend === 'DOWNTREND')
      ).length,
      counterTrendPositions: analyses.filter(a =>
        (a.side === 'CALL' && a.currentRegime.trend === 'DOWNTREND') ||
        (a.side === 'PUT' && a.currentRegime.trend === 'UPTREND')
      ).length,
      neutralPositions: analyses.filter(a => a.currentRegime.trend === 'SIDEWAYS').length
    };

    // Generate portfolio recommendations
    const portfolioRecommendations = this.generatePortfolioRecommendations(analyses);

    // Market outlook
    const marketOutlook = this.generateMarketOutlook(analyses);

    // Calculate metrics
    const totalRegimeRisk = analyses.reduce((sum, a) => {
      const riskScores = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
      return sum + riskScores[a.regimeRisk.overallRisk];
    }, 0);

    const portfolioResilience = Math.max(0, 100 - (totalRegimeRisk / totalPositions) * 25);
    const regimeAdaptabilityScore = this.calculateAdaptabilityScore(analyses);

    return {
      totalPositions,
      positionsAtRisk: analyses.filter(a => a.regimeRisk.overallRisk !== 'LOW').length,
      regimeDistribution,
      riskDistribution,
      trendAlignment,
      portfolioRecommendations,
      marketOutlook,
      totalRegimeRisk,
      portfolioResilience,
      regimeAdaptabilityScore,
      timestamp: new Date()
    };
  }

  /**
   * Analyze current market regime
   */
  private static analyzeMarketRegime(
    marketData: MarketData,
    allMarketData: MarketData[],
    thresholds: MarketRegimeThresholds
  ) {
    // For 0-DTE trading, we'll use simplified regime detection
    // In a real implementation, this would use VIX, moving averages, volume analysis, etc.

    const volatility = 'NORMAL'; // Default for 0-DTE
    const trend = 'SIDEWAYS';    // Default for intraday
    const volume = 'NORMAL';
    const session = 'MIDDAY';
    const momentum = 'NEUTRAL';

    return {
      volatility,
      trend,
      volume,
      session,
      momentum
    };
  }

  /**
   * Assess regime risk for position
   */
  private static assessRegimeRisk(
    position: Position,
    currentRegime: any,
    thresholds: MarketRegimeThresholds
  ) {
    const riskFactors: string[] = [];
    const warningSignals: string[] = [];

    // Simple risk assessment based on regime
    if (currentRegime.volatility === 'EXTREME') {
      riskFactors.push('Extreme market volatility');
      warningSignals.push('Consider reducing exposure');
    }

    if (position.side === 'CALL' && currentRegime.trend === 'DOWNTREND') {
      riskFactors.push('Call position in downtrend');
      warningSignals.push('Trend going against position');
    }

    if (position.side === 'PUT' && currentRegime.trend === 'UPTREND') {
      riskFactors.push('Put position in uptrend');
      warningSignals.push('Trend going against position');
    }

    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskFactors.length >= 3) overallRisk = 'CRITICAL';
    else if (riskFactors.length >= 2) overallRisk = 'HIGH';
    else if (riskFactors.length >= 1) overallRisk = 'MEDIUM';

    return {
      overallRisk,
      riskFactors,
      warningSignals
    };
  }

  /**
   * Generate adaptation recommendations
   */
  private static generateAdaptation(
    position: Position,
    currentRegime: any,
    regimeRisk: any,
    thresholds: MarketRegimeThresholds
  ) {
    let recommendedAction: 'HOLD' | 'ADJUST' | 'EXIT' | 'REDUCE' = 'HOLD';
    let positionSizeAdjustment = 1.0;
    let stopLossAdjustment = 0.3;  // Default 30% stop loss
    let profitTargetAdjustment = 0.5; // Default 50% profit target
    const hedgeRecommendation: string[] = [];

    if (regimeRisk.overallRisk === 'CRITICAL') {
      recommendedAction = 'EXIT';
      positionSizeAdjustment = 0.0;
    } else if (regimeRisk.overallRisk === 'HIGH') {
      recommendedAction = 'REDUCE';
      positionSizeAdjustment = 0.5;
      stopLossAdjustment = 0.2;  // Tighter stop
    }

    return {
      recommendedAction,
      positionSizeAdjustment,
      stopLossAdjustment,
      profitTargetAdjustment,
      hedgeRecommendation
    };
  }

  /**
   * Analyze time factors
   */
  private static analyzeTimeFactors(position: Position, currentRegime: any) {
    const now = new Date();
    const timeToExpiration = position.expiration.getTime() - now.getTime();
    const hoursToExpiration = timeToExpiration / (1000 * 60 * 60);

    return {
      optimalExitTime: hoursToExpiration < 2 ? 'Immediate' : 'Before close',
      regimeDuration: 30, // Default 30 minutes
      regimeStability: 75, // Default stability score
      nextSessionOutlook: 'Neutral'
    };
  }

  /**
   * Analyze market sentiment
   */
  private static analyzeSentiment(
    position: Position,
    optionsChain: OptionsChain[],
    marketData: MarketData[]
  ) {
    // Simplified sentiment analysis
    return {
      putCallRatio: 1.0,
      marketBreath: 0.5,
      fearGreedIndex: 50,
      moneyFlow: 'NEUTRAL'
    };
  }

  /**
   * Generate regime recommendation
   */
  private static generateRegimeRecommendation(
    position: Position,
    currentRegime: any,
    regimeRisk: any,
    adaptation: any,
    timeAnalysis: any
  ) {
    let action: 'HOLD' | 'EXIT_PARTIAL' | 'EXIT_FULL' | 'ADJUST_STOPS' = 'HOLD';
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let confidence = 75;
    const reasoning: string[] = [];
    let regimeSpecificAdvice = 'Monitor market conditions';

    if (regimeRisk.overallRisk === 'CRITICAL') {
      action = 'EXIT_FULL';
      urgency = 'CRITICAL';
      confidence = 95;
      reasoning.push('Critical regime risk detected');
      regimeSpecificAdvice = 'Exit position immediately due to extreme market conditions';
    } else if (regimeRisk.overallRisk === 'HIGH') {
      action = 'EXIT_PARTIAL';
      urgency = 'HIGH';
      confidence = 85;
      reasoning.push('High regime risk - partial reduction recommended');
      regimeSpecificAdvice = 'Reduce position size and tighten stops';
    }

    return {
      action,
      urgency,
      confidence,
      reasoning,
      regimeSpecificAdvice,
      timestamp: new Date()
    };
  }

  /**
   * Generate portfolio recommendations
   */
  private static generatePortfolioRecommendations(analyses: MarketRegimeAnalysis[]) {
    const criticalRiskCount = analyses.filter(a => a.regimeRisk.overallRisk === 'CRITICAL').length;

    let overallAction: 'MAINTAIN' | 'REDUCE' | 'EXPAND' | 'EXIT_ALL' = 'MAINTAIN';
    let riskAdjustment: 'REDUCE_RISK' | 'MAINTAIN_RISK' | 'INCREASE_RISK' = 'MAINTAIN_RISK';

    if (criticalRiskCount > 0) {
      overallAction = 'REDUCE';
      riskAdjustment = 'REDUCE_RISK';
    }

    return {
      overallAction,
      riskAdjustment,
      regimeSpecificStrategy: ['Monitor market volatility', 'Adjust stops based on regime'],
      immediateActions: ['Review high-risk positions', 'Tighten risk management'],
      forwardLookingAdjustments: ['Prepare for regime changes', 'Maintain flexibility']
    };
  }

  /**
   * Generate market outlook
   */
  private static generateMarketOutlook(analyses: MarketRegimeAnalysis[]) {
    return {
      shortTermRegime: 'Normal volatility with sideways trend',
      mediumTermOutlook: 'Monitor for trend changes',
      keyRiskFactors: ['Volatility spikes', 'Sudden trend reversals'],
      opportunityAreas: ['Range-bound trading', 'Quick profit targets']
    };
  }

  /**
   * Calculate adaptability score
   */
  private static calculateAdaptabilityScore(analyses: MarketRegimeAnalysis[]): number {
    const averageConfidence = analyses.reduce((sum, a) => sum + a.recommendation.confidence, 0) / analyses.length;
    return Math.min(100, averageConfidence);
  }

  /**
   * Create default analysis when no market data available
   */
  private static createDefaultAnalysis(
    position: Position,
    thresholds: MarketRegimeThresholds
  ): MarketRegimeAnalysis {
    return {
      positionId: position.id || 'unknown',
      symbol: position.symbol,
      side: position.side,
      strike: position.strike,
      expiration: position.expiration,
      quantity: position.quantity,
      underlyingPrice: 0,

      currentRegime: {
        volatility: 'NORMAL',
        trend: 'SIDEWAYS',
        volume: 'NORMAL',
        session: 'MIDDAY',
        momentum: 'NEUTRAL'
      },

      regimeRisk: {
        overallRisk: 'MEDIUM',
        riskFactors: ['No market data available'],
        warningSignals: ['Limited analysis capability']
      },

      adaptation: {
        recommendedAction: 'HOLD',
        positionSizeAdjustment: 1.0,
        stopLossAdjustment: 0.3,
        profitTargetAdjustment: 0.5,
        hedgeRecommendation: []
      },

      timeAnalysis: {
        optimalExitTime: 'Before close',
        regimeDuration: 0,
        regimeStability: 50,
        nextSessionOutlook: 'Unknown'
      },

      sentiment: {
        putCallRatio: 1.0,
        marketBreath: 0.5,
        fearGreedIndex: 50,
        moneyFlow: 'NEUTRAL'
      },

      recommendation: {
        action: 'HOLD',
        urgency: 'MEDIUM',
        confidence: 50,
        reasoning: ['Limited data - conservative approach'],
        regimeSpecificAdvice: 'Monitor position closely',
        timestamp: new Date()
      }
    };
  }
}