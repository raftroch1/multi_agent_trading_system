/**
 * ENHANCED STRIKE SELECTOR
 *
 * Intelligent strike selection for 0-DTE SPY options using:
 * - Volume analysis for unusual activity detection
 * - Liquidity scoring for optimal execution
 * - OTM preference (0.3% - 2% out of the money)
 * - Greeks optimization for 0-DTE characteristics
 * - Smart money flow detection
 *
 * Focus: Slightly OTM options for optimal risk/reward on 0-DTE trades
 */

import { OptionsChain, MarketData } from './types';

export interface StrikeScore {
  strike: number;
  score: number;  // 0-100
  volumeScore: number;
  liquidityScore: number;
  greeksScore: number;
  unusualActivityScore: number;
  optimalityReason: string[];
}

export interface StrikeRecommendation {
  optimalStrike: number;
  alternativeStrikes: number[];
  confidence: number;
  reasoning: string[];
  metrics: {
    volume: number;
    openInterest: number;
    bidAskSpread: number;
    impliedVolatility: number | undefined;
    delta: number | undefined;
    distanceFromATM: number;  // Percentage
  };
  warnings: string[];
}

export interface StrikeSelectionParams {
  direction: 'CALL' | 'PUT';
  currentPrice: number;
  minOTMPercent: number;      // Minimum OTM distance (default: 0.3%)
  maxOTMPercent: number;      // Maximum OTM distance (default: 2.0%)
  minVolume: number;          // Minimum volume (default: 50)
  maxSpreadPercent: number;   // Maximum bid-ask spread % (default: 5%)
  targetDelta: number;        // Target delta range (default: 0.35-0.50)
  unusualActivityThreshold: number;  // Volume/OI ratio threshold (default: 1.5)
}

/**
 * Enhanced Strike Selector
 * Selects optimal strikes for 0-DTE trading with volume and flow analysis
 */
export class EnhancedStrikeSelector {
  private static readonly DEFAULT_PARAMS: StrikeSelectionParams = {
    direction: 'CALL',
    currentPrice: 0,
    minOTMPercent: 0.3,
    maxOTMPercent: 2.0,
    minVolume: 50,
    maxSpreadPercent: 5.0,
    targetDelta: 0.40,  // Target 0.35-0.50 delta for 0-DTE
    unusualActivityThreshold: 1.5
  };

  /**
   * Select optimal strike with volume analysis
   */
  static selectStrike(
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    params: Partial<StrikeSelectionParams>
  ): StrikeRecommendation {
    const fullParams = { ...this.DEFAULT_PARAMS, ...params };

    console.log('🎯 ENHANCED STRIKE SELECTOR - ANALYZING OPTIONS');
    console.log('============================================');
    console.log(`Direction: ${fullParams.direction}`);
    console.log(`Current Price: $${fullParams.currentPrice.toFixed(2)}`);
    console.log(`OTM Range: ${fullParams.minOTMPercent}% - ${fullParams.maxOTMPercent}%`);

    // Filter options by direction and OTM range
    const candidateOptions = this.filterCandidateOptions(optionsChain, fullParams);

    if (candidateOptions.length === 0) {
      return {
        optimalStrike: 0,
        alternativeStrikes: [],
        confidence: 0,
        reasoning: ['No suitable strikes found within OTM range'],
        metrics: {
          volume: 0,
          openInterest: 0,
          bidAskSpread: 0,
          impliedVolatility: undefined,
          delta: undefined,
          distanceFromATM: 0
        },
        warnings: ['No options available']
      };
    }

    console.log(`Found ${candidateOptions.length} candidate strikes`);

    // Score each candidate
    const scoredStrikes = candidateOptions.map(opt => 
      this.scoreStrike(opt, fullParams, marketData)
    );

    // Sort by total score
    scoredStrikes.sort((a, b) => b.score - a.score);

    // Select top strike
    const topStrike = scoredStrikes[0];
    const alternativeStrikes = scoredStrikes.slice(1, 4).map(s => s.strike);

    // Get the actual option for metrics
    const optimalOption = candidateOptions.find(opt => opt.strike === topStrike.strike)!;

    // Generate detailed reasoning
    const reasoning = this.generateReasoning(topStrike, optimalOption, fullParams);

    // Generate warnings
    const warnings = this.generateWarnings(optimalOption, fullParams);

    // Calculate confidence
    const confidence = this.calculateConfidence(topStrike, optimalOption, warnings);

    console.log(`\n✅ OPTIMAL STRIKE: $${topStrike.strike.toFixed(0)}`);
    console.log(`   Total Score: ${topStrike.score.toFixed(0)}/100`);
    console.log(`   Confidence: ${confidence}%`);

    return {
      optimalStrike: topStrike.strike,
      alternativeStrikes,
      confidence,
      reasoning,
      metrics: {
        volume: optimalOption.volume || 0,
        openInterest: optimalOption.openInterest || 0,
        bidAskSpread: ((optimalOption.ask - optimalOption.bid) / optimalOption.ask) * 100,
        impliedVolatility: optimalOption.impliedVolatility,
        delta: optimalOption.delta,
        distanceFromATM: ((optimalOption.strike - fullParams.currentPrice) / fullParams.currentPrice) * 100
      },
      warnings
    };
  }

  /**
   * Filter candidate options within OTM range
   */
  private static filterCandidateOptions(
    optionsChain: OptionsChain[],
    params: StrikeSelectionParams
  ): OptionsChain[] {
    return optionsChain.filter(opt => {
      // Filter by direction
      if (opt.side !== params.direction) return false;

      // Calculate OTM distance
      const distancePercent = params.direction === 'CALL'
        ? ((opt.strike - params.currentPrice) / params.currentPrice) * 100
        : ((params.currentPrice - opt.strike) / params.currentPrice) * 100;

      // Filter by OTM range
      if (distancePercent < params.minOTMPercent || distancePercent > params.maxOTMPercent) {
        return false;
      }

      // Basic liquidity filters
      const volume = opt.volume || 0;
      const spread = opt.ask - opt.bid;
      const spreadPercent = opt.ask > 0 ? (spread / opt.ask) * 100 : 100;

      // Must have minimum volume and acceptable spread
      if (volume < params.minVolume * 0.5) return false;  // Allow slightly lower than min
      if (spreadPercent > params.maxSpreadPercent * 1.5) return false;  // Allow slightly wider spread

      return true;
    });
  }

  /**
   * Score individual strike
   */
  private static scoreStrike(
    option: OptionsChain,
    params: StrikeSelectionParams,
    marketData: MarketData[]
  ): StrikeScore {
    const reasoning: string[] = [];
    
    // 1. Volume Score (30 points)
    const volumeScore = this.calculateVolumeScore(option, params, reasoning);

    // 2. Liquidity Score (25 points)
    const liquidityScore = this.calculateLiquidityScore(option, params, reasoning);

    // 3. Greeks Score (25 points)
    const greeksScore = this.calculateGreeksScore(option, params, reasoning);

    // 4. Unusual Activity Score (20 points)
    const unusualActivityScore = this.calculateUnusualActivityScore(option, params, reasoning);

    // Total score
    const totalScore = volumeScore + liquidityScore + greeksScore + unusualActivityScore;

    return {
      strike: option.strike,
      score: totalScore,
      volumeScore,
      liquidityScore,
      greeksScore,
      unusualActivityScore,
      optimalityReason: reasoning
    };
  }

  /**
   * Calculate volume score (0-30 points)
   */
  private static calculateVolumeScore(
    option: OptionsChain,
    params: StrikeSelectionParams,
    reasoning: string[]
  ): number {
    let score = 0;
    const volume = option.volume || 0;

    // Volume tiers
    if (volume >= 500) {
      score = 30;
      reasoning.push(`Excellent volume: ${volume.toLocaleString()}`);
    } else if (volume >= 200) {
      score = 24;
      reasoning.push(`Good volume: ${volume.toLocaleString()}`);
    } else if (volume >= 100) {
      score = 18;
      reasoning.push(`Adequate volume: ${volume.toLocaleString()}`);
    } else if (volume >= 50) {
      score = 12;
      reasoning.push(`Minimum volume: ${volume.toLocaleString()}`);
    } else {
      score = 6;
      reasoning.push(`Low volume: ${volume.toLocaleString()}`);
    }

    return score;
  }

  /**
   * Calculate liquidity score (0-25 points)
   */
  private static calculateLiquidityScore(
    option: OptionsChain,
    params: StrikeSelectionParams,
    reasoning: string[]
  ): number {
    let score = 0;

    // Bid-ask spread analysis
    const spread = option.ask - option.bid;
    const spreadPercent = option.ask > 0 ? (spread / option.ask) * 100 : 100;

    if (spreadPercent <= 1.0) {
      score += 15;
      reasoning.push(`Tight spread: ${spreadPercent.toFixed(2)}%`);
    } else if (spreadPercent <= 2.0) {
      score += 12;
      reasoning.push(`Good spread: ${spreadPercent.toFixed(2)}%`);
    } else if (spreadPercent <= 3.0) {
      score += 9;
      reasoning.push(`Acceptable spread: ${spreadPercent.toFixed(2)}%`);
    } else if (spreadPercent <= 5.0) {
      score += 6;
      reasoning.push(`Wide spread: ${spreadPercent.toFixed(2)}%`);
    } else {
      score += 3;
      reasoning.push(`Very wide spread: ${spreadPercent.toFixed(2)}%`);
    }

    // Open interest
    const openInterest = option.openInterest || 0;
    if (openInterest >= 1000) {
      score += 10;
      reasoning.push(`Strong open interest: ${openInterest.toLocaleString()}`);
    } else if (openInterest >= 500) {
      score += 7;
      reasoning.push(`Good open interest: ${openInterest.toLocaleString()}`);
    } else if (openInterest >= 100) {
      score += 4;
      reasoning.push(`Moderate open interest: ${openInterest.toLocaleString()}`);
    } else {
      score += 2;
      reasoning.push(`Low open interest: ${openInterest.toLocaleString()}`);
    }

    return score;
  }

  /**
   * Calculate Greeks score (0-25 points)
   */
  private static calculateGreeksScore(
    option: OptionsChain,
    params: StrikeSelectionParams,
    reasoning: string[]
  ): number {
    let score = 0;

    // Delta analysis (optimal for 0-DTE: 0.35-0.50)
    if (option.delta !== undefined) {
      const absDelta = Math.abs(option.delta);
      
      if (absDelta >= 0.35 && absDelta <= 0.50) {
        score += 15;
        reasoning.push(`Optimal delta for 0-DTE: ${absDelta.toFixed(3)}`);
      } else if (absDelta >= 0.30 && absDelta <= 0.60) {
        score += 12;
        reasoning.push(`Good delta: ${absDelta.toFixed(3)}`);
      } else if (absDelta >= 0.25 && absDelta <= 0.70) {
        score += 9;
        reasoning.push(`Acceptable delta: ${absDelta.toFixed(3)}`);
      } else {
        score += 5;
        reasoning.push(`Suboptimal delta: ${absDelta.toFixed(3)}`);
      }
    } else {
      score += 8;  // No delta data - give moderate score
    }

    // Gamma analysis (higher gamma = faster profit potential for 0-DTE)
    if (option.gamma !== undefined && option.gamma > 0) {
      if (option.gamma > 0.05) {
        score += 10;
        reasoning.push(`High gamma for quick profits: ${option.gamma.toFixed(3)}`);
      } else if (option.gamma > 0.03) {
        score += 7;
        reasoning.push(`Good gamma: ${option.gamma.toFixed(3)}`);
      } else {
        score += 4;
        reasoning.push(`Moderate gamma: ${option.gamma.toFixed(3)}`);
      }
    } else {
      score += 5;  // No gamma data - give moderate score
    }

    return score;
  }

  /**
   * Calculate unusual activity score (0-20 points)
   */
  private static calculateUnusualActivityScore(
    option: OptionsChain,
    params: StrikeSelectionParams,
    reasoning: string[]
  ): number {
    let score = 0;

    const volume = option.volume || 0;
    const openInterest = option.openInterest || 0;

    if (openInterest > 0) {
      const volumeOIRatio = volume / openInterest;

      if (volumeOIRatio > 3.0) {
        score = 20;
        reasoning.push(`🚨 Extreme unusual activity: ${volumeOIRatio.toFixed(1)}x OI`);
      } else if (volumeOIRatio > 2.0) {
        score = 16;
        reasoning.push(`🚨 High unusual activity: ${volumeOIRatio.toFixed(1)}x OI`);
      } else if (volumeOIRatio > params.unusualActivityThreshold) {
        score = 12;
        reasoning.push(`⚡ Unusual activity detected: ${volumeOIRatio.toFixed(1)}x OI`);
      } else if (volumeOIRatio > 0.5) {
        score = 8;
        reasoning.push(`Normal volume/OI ratio: ${volumeOIRatio.toFixed(1)}x`);
      } else {
        score = 4;
        reasoning.push(`Low volume/OI ratio: ${volumeOIRatio.toFixed(1)}x`);
      }
    } else {
      score = 5;  // No OI data - give low score
      reasoning.push('No open interest data available');
    }

    return score;
  }

  /**
   * Generate detailed reasoning
   */
  private static generateReasoning(
    topStrike: StrikeScore,
    option: OptionsChain,
    params: StrikeSelectionParams
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Strike: $${topStrike.strike.toFixed(0)} (${option.side})`);
    reasoning.push(`Total Score: ${topStrike.score.toFixed(0)}/100`);
    reasoning.push(`Distance from ATM: ${((option.strike - params.currentPrice) / params.currentPrice * 100).toFixed(2)}% OTM`);
    reasoning.push('');
    reasoning.push('Score Breakdown:');
    reasoning.push(`  Volume: ${topStrike.volumeScore.toFixed(0)}/30`);
    reasoning.push(`  Liquidity: ${topStrike.liquidityScore.toFixed(0)}/25`);
    reasoning.push(`  Greeks: ${topStrike.greeksScore.toFixed(0)}/25`);
    reasoning.push(`  Unusual Activity: ${topStrike.unusualActivityScore.toFixed(0)}/20`);
    reasoning.push('');
    reasoning.push('Detailed Analysis:');
    reasoning.push(...topStrike.optimalityReason);

    return reasoning;
  }

  /**
   * Generate warnings
   */
  private static generateWarnings(
    option: OptionsChain,
    params: StrikeSelectionParams
  ): string[] {
    const warnings: string[] = [];

    const volume = option.volume || 0;
    const spread = ((option.ask - option.bid) / option.ask) * 100;

    if (volume < params.minVolume) {
      warnings.push(`⚠️ Volume below recommended minimum (${volume} < ${params.minVolume})`);
    }

    if (spread > params.maxSpreadPercent) {
      warnings.push(`⚠️ Bid-ask spread wider than recommended (${spread.toFixed(2)}% > ${params.maxSpreadPercent}%)`);
    }

    if (option.delta !== undefined && (Math.abs(option.delta) < 0.25 || Math.abs(option.delta) > 0.70)) {
      warnings.push(`⚠️ Delta outside typical 0-DTE range (${Math.abs(option.delta).toFixed(3)})`);
    }

    if (option.impliedVolatility !== undefined && option.impliedVolatility > 0.5) {
      warnings.push(`⚠️ High implied volatility (${(option.impliedVolatility * 100).toFixed(1)}%)`);
    }

    if ((option.openInterest || 0) < 100) {
      warnings.push(`⚠️ Low open interest may impact exit liquidity`);
    }

    return warnings;
  }

  /**
   * Calculate confidence score
   */
  private static calculateConfidence(
    topStrike: StrikeScore,
    option: OptionsChain,
    warnings: string[]
  ): number {
    let confidence = topStrike.score;  // Start with total score

    // Reduce confidence for warnings
    confidence -= warnings.length * 5;

    // Boost for unusual activity
    if (topStrike.unusualActivityScore >= 16) {
      confidence += 5;
    }

    // Boost for excellent liquidity
    if (topStrike.liquidityScore >= 23) {
      confidence += 3;
    }

    return Math.max(50, Math.min(100, Math.round(confidence)));
  }

  /**
   * Batch analyze multiple directions
   */
  static analyzeAllDirections(
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    currentPrice: number
  ): {
    call: StrikeRecommendation;
    put: StrikeRecommendation;
    recommendation: 'CALL' | 'PUT' | 'NEUTRAL';
    reasoning: string;
  } {
    // Analyze calls
    const callRec = this.selectStrike(optionsChain, marketData, {
      direction: 'CALL',
      currentPrice
    });

    // Analyze puts
    const putRec = this.selectStrike(optionsChain, marketData, {
      direction: 'PUT',
      currentPrice
    });

    // Determine recommendation
    let recommendation: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
    let reasoning = '';

    if (callRec.confidence > putRec.confidence + 10) {
      recommendation = 'CALL';
      reasoning = `Call strike superior: ${callRec.confidence}% vs ${putRec.confidence}% confidence`;
    } else if (putRec.confidence > callRec.confidence + 10) {
      recommendation = 'PUT';
      reasoning = `Put strike superior: ${putRec.confidence}% vs ${callRec.confidence}% confidence`;
    } else {
      reasoning = `Both directions viable: Call ${callRec.confidence}%, Put ${putRec.confidence}%`;
    }

    return {
      call: callRec,
      put: putRec,
      recommendation,
      reasoning
    };
  }
}
