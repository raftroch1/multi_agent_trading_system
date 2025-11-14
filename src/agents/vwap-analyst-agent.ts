/**
 * VWAP ANALYST AGENT
 *
 * Volume Weighted Average Price analysis for institutional-grade trading
 * Critical for 0-DTE trading where mean reversion and trend confirmation are essential
 *
 * Analyzes:
 * - Price vs VWAP relationship (mean reversion signals)
 * - VWAP-based support/resistance levels
 * - Volume-weighted trend strength
 * - VWAP slope and momentum
 * - Standard deviation bands around VWAP
 */

import { MarketData, OptionsChain, TradeSignal } from '../types';

export interface VWAPAnalysis {
  vwap: number;
  currentPrice: number;
  priceToVWAPRatio: number; // Current price / VWAP
  vwapSlope: number; // VWAP trend direction
  distanceFromVWAP: number; // Absolute distance in percentage
  vwapPosition: 'ABOVE' | 'BELOW' | 'AT_VWAP';
  meanReversionSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  trendConfirmation: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volumeWeightedStrength: number; // 0-100 strength metric
  supportResistanceLevels: {
    support: number;
    resistance: number;
    vwapAsSupport: boolean;
    vwapAsResistance: boolean;
  };
  standardDeviations: {
    upper1: number;
    upper2: number;
    lower1: number;
    lower2: number;
    currentPosition: 'ABOVE_UPPER2' | 'ABOVE_UPPER1' | 'ABOVE_VWAP' | 'BELOW_VWAP' | 'BELOW_LOWER1' | 'BELOW_LOWER2';
  };
}

/**
 * VWAP Analyst Agent
 * Provides institutional-grade VWAP analysis for 0-DTE trading decisions
 */
export class VWAPAnalystAgent {
  /**
   * Analyze VWAP relationship for trading signals
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 VWAP ANALYST AGENT - INITIATING INSTITUTIONAL ANALYSIS');
    console.log('==================================================');

    if (marketData.length < 50) {
      return {
        agent: 'VWAPAnalyst',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient data for VWAP calculation (need 50+ bars)'],
        data: null
      };
    }

    // Calculate VWAP analysis
    const vwapAnalysis = this.calculateVWAP(marketData);
    reasoning.push(`Current Price: $${vwapAnalysis.currentPrice.toFixed(2)}`);
    reasoning.push(`VWAP: $${vwapAnalysis.vwap.toFixed(2)}`);
    reasoning.push(`Price/VWAP Ratio: ${vwapAnalysis.priceToVWAPRatio.toFixed(3)}`);
    reasoning.push(`Distance from VWAP: ${vwapAnalysis.distanceFromVWAP.toFixed(2)}%`);
    reasoning.push(`VWAP Position: ${vwapAnalysis.vwapPosition}`);
    reasoning.push(`Mean Reversion Signal: ${vwapAnalysis.meanReversionSignal}`);
    reasoning.push(`Trend Confirmation: ${vwapAnalysis.trendConfirmation}`);

    // Analyze VWAP standard deviation bands
    reasoning.push(`Standard Deviation Position: ${vwapAnalysis.standardDeviations.currentPosition}`);
    reasoning.push(`Support Level: $${vwapAnalysis.supportResistanceLevels.support.toFixed(2)}`);
    reasoning.push(`Resistance Level: $${vwapAnalysis.supportResistanceLevels.resistance.toFixed(2)}`);

    // 1. Mean Reversion Analysis (Primary for 0-DTE)
    const meanReversionScore = this.analyzeMeanReversion(vwapAnalysis);
    reasoning.push(`Mean Reversion Score: ${meanReversionScore}/100`);

    // 2. VWAP Trend Confirmation (Secondary validation)
    const trendConfirmationScore = this.analyzeTrendConfirmation(vwapAnalysis);
    reasoning.push(`Trend Confirmation Score: ${trendConfirmationScore}/100`);

    // 3. Volume-Weighted Strength Analysis
    const volumeStrengthScore = vwapAnalysis.volumeWeightedStrength;
    reasoning.push(`Volume-Weighted Strength: ${volumeStrengthScore}/100`);

    // 4. Support/Resistance Analysis
    const supportResistanceScore = this.analyzeSupportResistance(vwapAnalysis);
    reasoning.push(`Support/Resistance Score: ${supportResistanceScore}/100`);

    // Calculate overall signal
    const overallScore = (meanReversionScore * 0.4) +     // 40% mean reversion (primary for 0-DTE)
                           (trendConfirmationScore * 0.3) +  // 30% trend confirmation
                           (volumeStrengthScore * 0.2) +    // 20% volume strength
                           (supportResistanceScore * 0.1);   // 10% S/R levels

    // Generate signal based on VWAP analysis
    if (overallScore >= 70) {
      if (vwapAnalysis.currentPrice < vwapAnalysis.vwap) {
        signal = 'BUY_CALL';
        confidence = Math.min(95, 60 + overallScore * 0.35);
        reasoning.push('✅ STRONG BUY CALL: Price below VWAP with strong mean reversion potential');
      } else {
        signal = 'BUY_PUT';
        confidence = Math.min(95, 60 + overallScore * 0.35);
        reasoning.push('✅ STRONG BUY PUT: Price above VWAP with strong mean reversion potential');
      }
    } else if (overallScore >= 55) {
      if (vwapAnalysis.currentPrice < vwapAnalysis.vwap) {
        signal = 'BUY_CALL';
        confidence = Math.min(85, 50 + overallScore * 0.3);
        reasoning.push('✅ BUY CALL: Price below VWAP with moderate mean reversion potential');
      } else {
        signal = 'BUY_PUT';
        confidence = Math.min(85, 50 + overallScore * 0.3);
        reasoning.push('✅ BUY PUT: Price above VWAP with moderate mean reversion potential');
      }
    } else if (overallScore <= 30) {
      signal = 'NO_TRADE';
      confidence = 70;
      reasoning.push('❌ NO TRADE: Weak VWAP signals, conflicting mean reversion patterns');
    } else {
      signal = 'NO_TRADE';
      confidence = 60;
      reasoning.push('❌ NO TRADE: Neutral VWAP position, insufficient edge for 0-DTE');
    }

    console.log(`📊 VWAP ANALYSIS COMPLETE:`);
    console.log(`   Overall Score: ${overallScore.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Mean Reversion: ${vwapAnalysis.meanReversionSignal}`);
    console.log(`   Trend: ${vwapAnalysis.trendConfirmation}`);

    return {
      agent: 'VWAPAnalyst',
      signal,
      confidence,
      reasoning,
      data: vwapAnalysis
    };
  }

  /**
   * Calculate Volume Weighted Average Price and related metrics
   */
  private static calculateVWAP(marketData: MarketData[]): VWAPAnalysis {
    const recentBars = marketData.slice(-100); // Use last 100 bars for VWAP
    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;
    let sumX = 0; // Sum of volume
    let sumY = 0; // Sum of typical price * volume
    let sumXY = 0; // Sum of bar number * typical price * volume
    let sumX2 = 0; // Sum of bar number squared
    let n = 0;

    for (let i = 0; i < recentBars.length; i++) {
      const bar = recentBars[i];
      const volume = Number(bar.volume || 0);
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;

      cumulativeTypicalPriceVolume += typicalPrice * volume;
      cumulativeVolume += volume;

      // For linear regression (trend calculation)
      sumX += volume;
      sumY += typicalPrice * volume;
      sumXY += (i + 1) * typicalPrice * volume;
      sumX2 += Math.pow(i + 1, 2) * volume;
      n += volume;
    }

    const vwap = cumulativeVolume > 0 ? cumulativeTypicalPriceVolume / cumulativeVolume : recentBars[recentBars.length - 1].close;
    const currentPrice = recentBars[recentBars.length - 1].close;
    const priceToVWAPRatio = currentPrice / vwap;
    const distanceFromVWAP = Math.abs((currentPrice - vwap) / vwap) * 100;

    // Calculate VWAP slope (trend direction)
    const slope = n > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    const vwapSlope = slope * 100; // Convert to percentage

    // Determine VWAP position
    let vwapPosition: 'ABOVE' | 'BELOW' | 'AT_VWAP';
    let meanReversionSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

    if (currentPrice > vwap * 1.005) {
      vwapPosition = 'ABOVE';
    } else if (currentPrice < vwap * 0.995) {
      vwapPosition = 'BELOW';
    } else {
      vwapPosition = 'AT_VWAP';
    }

    // Calculate mean reversion signal based on distance from VWAP
    if (distanceFromVWAP > 2.0) {
      meanReversionSignal = currentPrice > vwap ? 'STRONG_SELL' : 'STRONG_BUY';
    } else if (distanceFromVWAP > 1.0) {
      meanReversionSignal = currentPrice > vwap ? 'SELL' : 'BUY';
    } else {
      meanReversionSignal = 'NEUTRAL';
    }

    // Trend confirmation based on VWAP slope
    let trendConfirmation: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (vwapSlope > 0.1) {
      trendConfirmation = 'BULLISH';
    } else if (vwapSlope < -0.1) {
      trendConfirmation = 'BEARISH';
    } else {
      trendConfirmation = 'NEUTRAL';
    }

    // Calculate volume-weighted strength
    const avgVolume = cumulativeVolume / recentBars.length;
    const currentVolume = Number(recentBars[recentBars.length - 1].volume || 0);
    const volumeRatio = currentVolume / avgVolume;
    const volumeWeightedStrength = Math.min(100, Math.max(0, volumeRatio * 50));

    // Calculate support and resistance levels using VWAP standard deviations
    const standardDeviation = this.calculateStandardDeviation(recentBars, vwap);
    const support = vwap - standardDeviation * 1.5;
    const resistance = vwap + standardDeviation * 1.5;

    const supportResistanceLevels = {
      support,
      resistance,
      vwapAsSupport: Math.abs(currentPrice - vwap) < Math.abs(currentPrice - support),
      vwapAsResistance: Math.abs(currentPrice - vwap) < Math.abs(currentPrice - resistance)
    };

    // Calculate standard deviation bands
    const standardDeviations = {
      upper1: vwap + standardDeviation,
      upper2: vwap + (standardDeviation * 2),
      lower1: vwap - standardDeviation,
      lower2: vwap - (standardDeviation * 2),
      currentPosition: this.getStandardDeviationPosition(currentPrice, vwap, standardDeviation)
    };

    return {
      vwap,
      currentPrice,
      priceToVWAPRatio,
      vwapSlope,
      distanceFromVWAP,
      vwapPosition,
      meanReversionSignal,
      trendConfirmation,
      volumeWeightedStrength,
      supportResistanceLevels,
      standardDeviations
    };
  }

  /**
   * Calculate standard deviation for VWAP bands
   */
  private static calculateStandardDeviation(marketData: MarketData[], vwap: number): number {
    if (marketData.length === 0) return 0;

    let sumSquaredDifferences = 0;
    let totalVolume = 0;

    for (const bar of marketData) {
      const volume = Number(bar.volume || 0);
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      const difference = typicalPrice - vwap;
      sumSquaredDifferences += Math.pow(difference, 2) * volume;
      totalVolume += volume;
    }

    return totalVolume > 0 ? Math.sqrt(sumSquaredDifferences / totalVolume) : 0;
  }

  /**
   * Determine position relative to VWAP standard deviation bands
   */
  private static getStandardDeviationPosition(price: number, vwap: number, stdDev: number):
    'ABOVE_UPPER2' | 'ABOVE_UPPER1' | 'ABOVE_VWAP' | 'BELOW_VWAP' | 'BELOW_LOWER1' | 'BELOW_LOWER2' {

    const upper2 = vwap + (stdDev * 2);
    const upper1 = vwap + stdDev;
    const lower1 = vwap - stdDev;
    const lower2 = vwap - (stdDev * 2);

    if (price > upper2) return 'ABOVE_UPPER2';
    if (price > upper1) return 'ABOVE_UPPER1';
    if (price > vwap) return 'ABOVE_VWAP';
    if (price > lower1) return 'BELOW_VWAP';
    if (price > lower2) return 'BELOW_LOWER1';
    return 'BELOW_LOWER2';
  }

  /**
   * Analyze mean reversion potential
   */
  private static analyzeMeanReversion(analysis: VWAPAnalysis): number {
    let score = 50; // Base score

    // Distance from VWAP (primary factor)
    if (analysis.distanceFromVWAP > 2.0) {
      score += 30; // Strong mean reversion signal
    } else if (analysis.distanceFromVWAP > 1.0) {
      score += 15; // Moderate mean reversion signal
    } else if (analysis.distanceFromVWAP < 0.3) {
      score -= 20; // Too close to VWAP, no clear edge
    }

    // Standard deviation position
    if (analysis.standardDeviations.currentPosition === 'ABOVE_UPPER2' ||
        analysis.standardDeviations.currentPosition === 'BELOW_LOWER2') {
      score += 20; // Extreme position, strong mean reversion
    } else if (analysis.standardDeviations.currentPosition === 'ABOVE_UPPER1' ||
               analysis.standardDeviations.currentPosition === 'BELOW_LOWER1') {
      score += 10; // Moderate deviation
    }

    // VWAP slope (trend strength)
    if (Math.abs(analysis.vwapSlope) < 0.05) {
      score += 10; // Flat VWAP favors mean reversion
    } else if (Math.abs(analysis.vwapSlope) > 0.5) {
      score -= 15; // Strong trend opposes mean reversion
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze trend confirmation from VWAP
   */
  private static analyzeTrendConfirmation(analysis: VWAPAnalysis): number {
    let score = 50; // Base score

    // VWAP slope
    if (analysis.vwapSlope > 0.3) {
      score += 25; // Strong bullish VWAP trend
    } else if (analysis.vwapSlope > 0.1) {
      score += 12; // Moderate bullish VWAP trend
    } else if (analysis.vwapSlope < -0.3) {
      score -= 25; // Strong bearish VWAP trend
    } else if (analysis.vwapSlope < -0.1) {
      score -= 12; // Moderate bearish VWAP trend
    }

    // Price vs VWAP consistency with trend
    if (analysis.vwapSlope > 0 && analysis.currentPrice > analysis.vwap) {
      score += 15; // Bullish trend confirmed by price above VWAP
    } else if (analysis.vwapSlope < 0 && analysis.currentPrice < analysis.vwap) {
      score += 15; // Bearish trend confirmed by price below VWAP
    } else if (Math.abs(analysis.vwapSlope) > 0.1) {
      score -= 20; // Divergence between price and VWAP trend
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze support and resistance levels
   */
  private static analyzeSupportResistance(analysis: VWAPAnalysis): number {
    let score = 50; // Base score

    // VWAP as support/resistance
    if (analysis.supportResistanceLevels.vwapAsSupport ||
        analysis.supportResistanceLevels.vwapAsResistance) {
      score += 15; // VWAP acting as S/R level
    }

    // Price proximity to calculated S/R levels
    const supportDistance = Math.abs(analysis.currentPrice - analysis.supportResistanceLevels.support) / analysis.currentPrice * 100;
    const resistanceDistance = Math.abs(analysis.currentPrice - analysis.supportResistanceLevels.resistance) / analysis.currentPrice * 100;

    if (supportDistance < 0.5) {
      score += 10; // Near support level
    } else if (resistanceDistance < 0.5) {
      score -= 10; // Near resistance level
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Import types for consistency
interface AgentSignal {
  agent: string;
  signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  confidence: number;
  reasoning: string[];
  data: any;
}