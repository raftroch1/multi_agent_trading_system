/**
 * VOLUME PROFILE ENHANCED AGENT
 *
 * Enhanced volume profile analysis with unusual activity detection for 0-DTE SPY options
 * Focuses on strike-level volume analysis to identify institutional footprints
 *
 * Key Features:
 * - Contract-level volume analysis for unusual activity detection
 * - Strike selection using volume profiles
 * - High-volume node (HVN) and low-volume node (LVN) identification
 * - Point of Control (POC) analysis for support/resistance
 * - Volume imbalance detection at key strikes
 */

import { MarketData, OptionsChain } from '../types';

export interface VolumeNode {
  strike: number;
  volume: number;
  volumePercentage: number;
  openInterest: number;
  volumeOIRatio: number;  // Volume / Open Interest (unusual activity indicator)
  nodeType: 'POC' | 'HVN' | 'LVN' | 'NORMAL';
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  unusualActivity: boolean;
}

export interface StrikeRecommendation {
  recommendedStrike: number;
  strikeType: 'CALL' | 'PUT';
  reasoning: string[];
  volumeScore: number;
  liquidityScore: number;
  unusualActivityScore: number;
  optimalityScore: number;  // Overall score (0-100)
  distanceFromATM: number;  // How far OTM (percentage)
}

export interface EnhancedVolumeProfile {
  poc: VolumeNode;  // Point of Control (highest volume)
  valueAreaHigh: number;
  valueAreaLow: number;
  highVolumeNodes: VolumeNode[];
  lowVolumeNodes: VolumeNode[];
  unusualActivityStrikes: VolumeNode[];
  volumeImbalance: {
    callVolume: number;
    putVolume: number;
    ratio: number;  // Call/Put ratio
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  strikeRecommendations: {
    call: StrikeRecommendation | null;
    put: StrikeRecommendation | null;
  };
}

/**
 * Volume Profile Enhanced Agent
 * Specialized in strike-level volume analysis for optimal entry selection
 */
export class VolumeProfileEnhancedAgent {
  /**
   * Analyze volume profile with focus on contract-level unusual activity
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 VOLUME PROFILE ENHANCED AGENT - ANALYZING STRIKE VOLUME');
    console.log('=======================================================');

    if (optionsChain.length < 5) {
      return {
        agent: 'VolumeProfileEnhanced',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient options data for volume profile analysis'],
        data: null
      };
    }

    const currentPrice = marketData[marketData.length - 1].close;
    const enhancedProfile = this.calculateEnhancedVolumeProfile(optionsChain, currentPrice);

    // Log POC analysis
    reasoning.push(`Point of Control: $${enhancedProfile.poc.strike.toFixed(0)} (${enhancedProfile.poc.volumePercentage.toFixed(1)}% volume)`);
    reasoning.push(`Value Area: $${enhancedProfile.valueAreaLow.toFixed(0)} - $${enhancedProfile.valueAreaHigh.toFixed(0)}`);

    // Log volume imbalance
    reasoning.push(`Call/Put Volume Ratio: ${enhancedProfile.volumeImbalance.ratio.toFixed(2)} (${enhancedProfile.volumeImbalance.bias})`);
    reasoning.push(`Call Volume: ${enhancedProfile.volumeImbalance.callVolume.toLocaleString()}`);
    reasoning.push(`Put Volume: ${enhancedProfile.volumeImbalance.putVolume.toLocaleString()}`);

    // Check for unusual activity
    if (enhancedProfile.unusualActivityStrikes.length > 0) {
      reasoning.push(`🚨 UNUSUAL ACTIVITY: ${enhancedProfile.unusualActivityStrikes.length} strikes with unusual volume`);
      enhancedProfile.unusualActivityStrikes.forEach(strike => {
        reasoning.push(`  - $${strike.strike.toFixed(0)}: ${strike.volume.toLocaleString()} volume (${strike.volumeOIRatio.toFixed(1)}x OI ratio)`);
      });
    }

    // Log high volume nodes
    if (enhancedProfile.highVolumeNodes.length > 0) {
      reasoning.push(`High Volume Nodes: ${enhancedProfile.highVolumeNodes.length} identified`);
      enhancedProfile.highVolumeNodes.slice(0, 3).forEach(node => {
        reasoning.push(`  - $${node.strike.toFixed(0)}: ${node.volumePercentage.toFixed(1)}% of total volume`);
      });
    }

    // Analyze strike recommendations
    const callRec = enhancedProfile.strikeRecommendations.call;
    const putRec = enhancedProfile.strikeRecommendations.put;

    if (callRec) {
      reasoning.push(`📈 CALL Strike Recommendation: $${callRec.recommendedStrike.toFixed(0)} (${callRec.distanceFromATM.toFixed(2)}% OTM)`);
      reasoning.push(`   Optimality Score: ${callRec.optimalityScore.toFixed(0)}/100`);
      reasoning.push(`   Volume Score: ${callRec.volumeScore.toFixed(0)}, Liquidity: ${callRec.liquidityScore.toFixed(0)}, Unusual Activity: ${callRec.unusualActivityScore.toFixed(0)}`);
    }

    if (putRec) {
      reasoning.push(`📉 PUT Strike Recommendation: $${putRec.recommendedStrike.toFixed(0)} (${putRec.distanceFromATM.toFixed(2)}% OTM)`);
      reasoning.push(`   Optimality Score: ${putRec.optimalityScore.toFixed(0)}/100`);
      reasoning.push(`   Volume Score: ${putRec.volumeScore.toFixed(0)}, Liquidity: ${putRec.liquidityScore.toFixed(0)}, Unusual Activity: ${putRec.unusualActivityScore.toFixed(0)}`);
    }

    // Generate signal based on volume profile analysis
    const score = this.calculateVolumeProfileScore(enhancedProfile, currentPrice);
    reasoning.push(`Overall Volume Profile Score: ${score.toFixed(0)}/100`);

    // Signal generation with volume bias and unusual activity consideration
    if (score >= 70) {
      // Strong volume signal
      if (enhancedProfile.volumeImbalance.bias === 'BULLISH' && callRec && callRec.optimalityScore >= 70) {
        signal = 'BUY_CALL';
        confidence = Math.min(90, 65 + score * 0.25);
        reasoning.push('✅ STRONG BUY CALL: Bullish volume bias with optimal strike identified');
      } else if (enhancedProfile.volumeImbalance.bias === 'BEARISH' && putRec && putRec.optimalityScore >= 70) {
        signal = 'BUY_PUT';
        confidence = Math.min(90, 65 + score * 0.25);
        reasoning.push('✅ STRONG BUY PUT: Bearish volume bias with optimal strike identified');
      } else if (enhancedProfile.unusualActivityStrikes.length >= 2) {
        // Unusual activity detected - follow the flow
        const unusualBias = this.getUnusualActivityBias(enhancedProfile.unusualActivityStrikes, currentPrice);
        signal = unusualBias;
        confidence = Math.min(85, 60 + score * 0.2);
        reasoning.push(`✅ UNUSUAL ACTIVITY: ${signal} based on institutional footprint detection`);
      }
    } else if (score >= 55) {
      // Moderate volume signal
      if (enhancedProfile.volumeImbalance.bias === 'BULLISH' && callRec) {
        signal = 'BUY_CALL';
        confidence = Math.min(80, 55 + score * 0.2);
        reasoning.push('✅ MODERATE BUY CALL: Bullish volume bias with acceptable strike');
      } else if (enhancedProfile.volumeImbalance.bias === 'BEARISH' && putRec) {
        signal = 'BUY_PUT';
        confidence = Math.min(80, 55 + score * 0.2);
        reasoning.push('✅ MODERATE BUY PUT: Bearish volume bias with acceptable strike');
      }
    } else {
      signal = 'NO_TRADE';
      confidence = 70;
      reasoning.push('❌ NO TRADE: Insufficient volume conviction or no optimal strikes');
    }

    console.log(`📊 VOLUME PROFILE ANALYSIS COMPLETE:`);
    console.log(`   Score: ${score.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Volume Bias: ${enhancedProfile.volumeImbalance.bias}`);
    console.log(`   Unusual Activity: ${enhancedProfile.unusualActivityStrikes.length} strikes`);

    return {
      agent: 'VolumeProfileEnhanced',
      signal,
      confidence,
      reasoning,
      data: enhancedProfile
    };
  }

  /**
   * Calculate enhanced volume profile with strike-level analysis
   */
  private static calculateEnhancedVolumeProfile(
    optionsChain: OptionsChain[],
    currentPrice: number
  ): EnhancedVolumeProfile {
    // Separate calls and puts
    const calls = optionsChain.filter(opt => opt.side === 'CALL');
    const puts = optionsChain.filter(opt => opt.side === 'PUT');

    // Calculate total volumes
    const totalCallVolume = calls.reduce((sum, opt) => sum + (opt.volume || 0), 0);
    const totalPutVolume = puts.reduce((sum, opt) => sum + (opt.volume || 0), 0);
    const totalVolume = totalCallVolume + totalPutVolume;

    // Create volume nodes for all strikes
    const allNodes: VolumeNode[] = optionsChain.map(opt => {
      const volume = opt.volume || 0;
      const openInterest = opt.openInterest || 0;
      const volumeOIRatio = openInterest > 0 ? volume / openInterest : 0;
      const volumePercentage = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

      // Detect unusual activity (Volume > 2x Open Interest is unusual)
      const unusualActivity = volumeOIRatio > 2.0 && volume > 100;

      return {
        strike: opt.strike,
        volume,
        volumePercentage,
        openInterest,
        volumeOIRatio,
        nodeType: 'NORMAL',
        significance: 'LOW',
        unusualActivity
      } as VolumeNode;
    });

    // Sort by volume to find POC and HVN/LVN
    const sortedByVolume = [...allNodes].sort((a, b) => b.volume - a.volume);

    // Point of Control (highest volume strike)
    const poc = sortedByVolume[0];
    poc.nodeType = 'POC';
    poc.significance = 'CRITICAL';

    // High Volume Nodes (top 20% of volume)
    const volumeThresholdHigh = sortedByVolume[Math.floor(sortedByVolume.length * 0.2)]?.volume || 0;
    const highVolumeNodes = allNodes.filter(node => node.volume >= volumeThresholdHigh && node.strike !== poc.strike);
    highVolumeNodes.forEach(node => {
      node.nodeType = 'HVN';
      node.significance = node.volumePercentage > 5 ? 'HIGH' : 'MEDIUM';
    });

    // Low Volume Nodes (bottom 20% of volume)
    const volumeThresholdLow = sortedByVolume[Math.floor(sortedByVolume.length * 0.8)]?.volume || 0;
    const lowVolumeNodes = allNodes.filter(node => node.volume <= volumeThresholdLow && node.volume > 0);
    lowVolumeNodes.forEach(node => {
      node.nodeType = 'LVN';
      node.significance = 'LOW';
    });

    // Value Area (70% of volume)
    let valueAreaVolume = 0;
    const valueAreaTarget = totalVolume * 0.7;
    const valueAreaStrikes: number[] = [];

    for (const node of sortedByVolume) {
      if (valueAreaVolume >= valueAreaTarget) break;
      valueAreaVolume += node.volume;
      valueAreaStrikes.push(node.strike);
    }

    const valueAreaHigh = Math.max(...valueAreaStrikes);
    const valueAreaLow = Math.min(...valueAreaStrikes);

    // Unusual activity strikes
    const unusualActivityStrikes = allNodes.filter(node => node.unusualActivity)
      .sort((a, b) => b.volumeOIRatio - a.volumeOIRatio);

    unusualActivityStrikes.forEach(node => {
      node.significance = 'HIGH';
    });

    // Volume imbalance analysis
    const callPutRatio = totalPutVolume > 0 ? totalCallVolume / totalPutVolume : 10;
    let volumeBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

    if (callPutRatio > 1.5) {
      volumeBias = 'BULLISH';  // More call volume = bullish
    } else if (callPutRatio < 0.67) {
      volumeBias = 'BEARISH';  // More put volume = bearish
    } else {
      volumeBias = 'NEUTRAL';
    }

    // Generate strike recommendations
    const callRecommendation = this.recommendStrike(calls, currentPrice, 'CALL', allNodes);
    const putRecommendation = this.recommendStrike(puts, currentPrice, 'PUT', allNodes);

    return {
      poc,
      valueAreaHigh,
      valueAreaLow,
      highVolumeNodes: highVolumeNodes.slice(0, 5),  // Top 5 HVN
      lowVolumeNodes: lowVolumeNodes.slice(0, 5),    // Top 5 LVN
      unusualActivityStrikes,
      volumeImbalance: {
        callVolume: totalCallVolume,
        putVolume: totalPutVolume,
        ratio: callPutRatio,
        bias: volumeBias
      },
      strikeRecommendations: {
        call: callRecommendation,
        put: putRecommendation
      }
    };
  }

  /**
   * Recommend optimal strike based on volume analysis
   */
  private static recommendStrike(
    options: OptionsChain[],
    currentPrice: number,
    type: 'CALL' | 'PUT',
    allNodes: VolumeNode[]
  ): StrikeRecommendation | null {
    if (options.length === 0) return null;

    // Filter for slightly OTM options (0.5% - 2% OTM for 0-DTE)
    const otmOptions = options.filter(opt => {
      const distancePercent = Math.abs((opt.strike - currentPrice) / currentPrice) * 100;
      if (type === 'CALL') {
        return opt.strike > currentPrice && distancePercent >= 0.3 && distancePercent <= 2.0;
      } else {
        return opt.strike < currentPrice && distancePercent >= 0.3 && distancePercent <= 2.0;
      }
    });

    if (otmOptions.length === 0) return null;

    // Score each OTM option
    const scoredOptions = otmOptions.map(opt => {
      const node = allNodes.find(n => n.strike === opt.strike);
      const volume = opt.volume || 0;
      const openInterest = opt.openInterest || 0;
      const spread = opt.ask - opt.bid;
      const spreadPercent = opt.ask > 0 ? (spread / opt.ask) * 100 : 100;

      // Volume score (0-40 points)
      let volumeScore = 0;
      if (volume >= 500) volumeScore = 40;
      else if (volume >= 200) volumeScore = 30;
      else if (volume >= 100) volumeScore = 20;
      else if (volume >= 50) volumeScore = 10;

      // Liquidity score (0-30 points)
      let liquidityScore = 0;
      if (spreadPercent <= 1.0) liquidityScore = 30;
      else if (spreadPercent <= 2.0) liquidityScore = 20;
      else if (spreadPercent <= 5.0) liquidityScore = 10;

      // Unusual activity score (0-30 points)
      let unusualActivityScore = 0;
      if (node) {
        if (node.unusualActivity) unusualActivityScore = 30;
        else if (node.volumeOIRatio > 1.0) unusualActivityScore = 15;
        else if (node.volumeOIRatio > 0.5) unusualActivityScore = 8;
      }

      const optimalityScore = volumeScore + liquidityScore + unusualActivityScore;
      const distanceFromATM = Math.abs((opt.strike - currentPrice) / currentPrice) * 100;

      return {
        option: opt,
        volumeScore,
        liquidityScore,
        unusualActivityScore,
        optimalityScore,
        distanceFromATM
      };
    });

    // Select best option
    scoredOptions.sort((a, b) => b.optimalityScore - a.optimalityScore);
    const best = scoredOptions[0];

    return {
      recommendedStrike: best.option.strike,
      strikeType: type,
      reasoning: [
        `Volume: ${best.option.volume || 0}`,
        `Open Interest: ${best.option.openInterest || 0}`,
        `Bid-Ask Spread: ${((best.option.ask - best.option.bid) / best.option.ask * 100).toFixed(2)}%`,
        `Distance from ATM: ${best.distanceFromATM.toFixed(2)}% OTM`
      ],
      volumeScore: best.volumeScore,
      liquidityScore: best.liquidityScore,
      unusualActivityScore: best.unusualActivityScore,
      optimalityScore: best.optimalityScore,
      distanceFromATM: best.distanceFromATM
    };
  }

  /**
   * Calculate overall volume profile score
   */
  private static calculateVolumeProfileScore(profile: EnhancedVolumeProfile, currentPrice: number): number {
    let score = 50;  // Base score

    // Volume imbalance contribution (30 points)
    if (profile.volumeImbalance.ratio > 2.0 || profile.volumeImbalance.ratio < 0.5) {
      score += 30;  // Strong imbalance
    } else if (profile.volumeImbalance.ratio > 1.5 || profile.volumeImbalance.ratio < 0.67) {
      score += 18;  // Moderate imbalance
    } else {
      score += 5;   // Weak imbalance
    }

    // Unusual activity contribution (25 points)
    if (profile.unusualActivityStrikes.length >= 3) {
      score += 25;
    } else if (profile.unusualActivityStrikes.length >= 1) {
      score += 15;
    }

    // Strike recommendation quality (25 points)
    const callQuality = profile.strikeRecommendations.call?.optimalityScore || 0;
    const putQuality = profile.strikeRecommendations.put?.optimalityScore || 0;
    const avgQuality = (callQuality + putQuality) / 2;
    score += (avgQuality / 100) * 25;

    // High volume nodes (20 points)
    if (profile.highVolumeNodes.length >= 3) {
      score += 20;
    } else if (profile.highVolumeNodes.length >= 1) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine bias from unusual activity strikes
   */
  private static getUnusualActivityBias(unusualStrikes: VolumeNode[], currentPrice: number): 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' {
    if (unusualStrikes.length === 0) return 'NO_TRADE';

    const aboveATM = unusualStrikes.filter(s => s.strike > currentPrice).length;
    const belowATM = unusualStrikes.filter(s => s.strike < currentPrice).length;

    if (aboveATM > belowATM * 1.5) {
      return 'BUY_CALL';  // Unusual activity above ATM = bullish
    } else if (belowATM > aboveATM * 1.5) {
      return 'BUY_PUT';   // Unusual activity below ATM = bearish
    }

    return 'NO_TRADE';
  }
}

// Agent Signal interface for consistency
interface AgentSignal {
  agent: string;
  signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  confidence: number;
  reasoning: string[];
  data: any;
}
