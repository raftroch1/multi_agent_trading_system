/**
 * ORDER FLOW AGENT
 *
 * Real-time order flow analysis for 0-DTE SPY options trading
 * Tracks buying vs selling pressure through price action and volume analysis
 *
 * Key Features:
 * - Aggressive buying/selling detection
 * - Order absorption at key levels
 * - Smart money vs retail flow identification
 * - Tape reading simulation from OHLCV data
 * - Real-time flow momentum tracking
 */

import { MarketData, OptionsChain } from '../types';

export interface OrderFlowBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyingPressure: number;    // 0-100 (percentage)
  sellingPressure: number;   // 0-100 (percentage)
  netFlow: number;           // -100 to +100
  flowType: 'AGGRESSIVE_BUY' | 'PASSIVE_BUY' | 'NEUTRAL' | 'PASSIVE_SELL' | 'AGGRESSIVE_SELL';
  absorption: boolean;       // True if absorption detected
  smartMoneySignal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NONE';
}

export interface OrderFlowAnalysis {
  currentBar: OrderFlowBar;
  recentBars: OrderFlowBar[];
  cumulativeFlow: {
    netBuying: number;
    netSelling: number;
    flowBalance: number;  // -100 to +100
    trend: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  };
  absorption: {
    detected: boolean;
    location: 'SUPPORT' | 'RESISTANCE' | 'NONE';
    strength: number;  // 0-100
    outcome: 'HELD' | 'FAILED' | 'PENDING';
  };
  smartMoney: {
    detected: boolean;
    action: 'ACCUMULATING' | 'DISTRIBUTING' | 'NEUTRAL';
    confidence: number;  // 0-100
    characteristics: string[];
  };
  momentum: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;  // 0-100
    acceleration: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  };
}

/**
 * Order Flow Agent
 * Specialized in real-time flow analysis for 0-DTE trading
 */
export class OrderFlowAgent {
  /**
   * Analyze order flow from market data
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 ORDER FLOW AGENT - ANALYZING BUYING/SELLING PRESSURE');
    console.log('===================================================');

    if (marketData.length < 10) {
      return {
        agent: 'OrderFlow',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient data for order flow analysis (need 10+ bars)'],
        data: null
      };
    }

    // Calculate order flow analysis
    const flowAnalysis = this.calculateOrderFlow(marketData);

    // Log current flow conditions
    reasoning.push(`Current Flow: ${flowAnalysis.currentBar.flowType} (Net: ${flowAnalysis.currentBar.netFlow.toFixed(1)})`);
    reasoning.push(`Buying Pressure: ${flowAnalysis.currentBar.buyingPressure.toFixed(1)}%`);
    reasoning.push(`Selling Pressure: ${flowAnalysis.currentBar.sellingPressure.toFixed(1)}%`);
    reasoning.push(`Cumulative Flow: ${flowAnalysis.cumulativeFlow.trend} (Balance: ${flowAnalysis.cumulativeFlow.flowBalance.toFixed(1)})`);

    // Log absorption if detected
    if (flowAnalysis.absorption.detected) {
      reasoning.push(`🛡️ ABSORPTION DETECTED at ${flowAnalysis.absorption.location} (${flowAnalysis.absorption.strength.toFixed(0)}% strength)`);
      reasoning.push(`   Outcome: ${flowAnalysis.absorption.outcome}`);
    }

    // Log smart money activity
    if (flowAnalysis.smartMoney.detected) {
      reasoning.push(`💰 SMART MONEY: ${flowAnalysis.smartMoney.action} (${flowAnalysis.smartMoney.confidence.toFixed(0)}% confidence)`);
      flowAnalysis.smartMoney.characteristics.forEach(char => {
        reasoning.push(`   - ${char}`);
      });
    }

    // Log momentum
    reasoning.push(`Flow Momentum: ${flowAnalysis.momentum.direction} (${flowAnalysis.momentum.strength.toFixed(0)}% strength)`);
    reasoning.push(`Acceleration: ${flowAnalysis.momentum.acceleration}`);

    // Calculate overall score
    const score = this.calculateOrderFlowScore(flowAnalysis);
    reasoning.push(`Order Flow Score: ${score.toFixed(0)}/100`);

    // Generate signal based on order flow analysis
    if (score >= 75) {
      // Strong order flow signal
      if (flowAnalysis.cumulativeFlow.flowBalance > 30) {
        signal = 'BUY_CALL';
        confidence = Math.min(92, 65 + score * 0.3);
        reasoning.push('✅ STRONG BUY CALL: Aggressive buying pressure with flow momentum');
      } else if (flowAnalysis.cumulativeFlow.flowBalance < -30) {
        signal = 'BUY_PUT';
        confidence = Math.min(92, 65 + score * 0.3);
        reasoning.push('✅ STRONG BUY PUT: Aggressive selling pressure with flow momentum');
      }
    } else if (score >= 60) {
      // Moderate order flow signal
      if (flowAnalysis.cumulativeFlow.flowBalance > 15) {
        signal = 'BUY_CALL';
        confidence = Math.min(82, 55 + score * 0.25);
        reasoning.push('✅ MODERATE BUY CALL: Positive flow with building momentum');
      } else if (flowAnalysis.cumulativeFlow.flowBalance < -15) {
        signal = 'BUY_PUT';
        confidence = Math.min(82, 55 + score * 0.25);
        reasoning.push('✅ MODERATE BUY PUT: Negative flow with building momentum');
      }
    } else if (flowAnalysis.smartMoney.detected && flowAnalysis.smartMoney.confidence >= 70) {
      // Smart money signal overrides moderate scoring
      if (flowAnalysis.smartMoney.action === 'ACCUMULATING') {
        signal = 'BUY_CALL';
        confidence = Math.min(85, 60 + flowAnalysis.smartMoney.confidence * 0.25);
        reasoning.push('✅ SMART MONEY ACCUMULATION: Following institutional flow');
      } else if (flowAnalysis.smartMoney.action === 'DISTRIBUTING') {
        signal = 'BUY_PUT';
        confidence = Math.min(85, 60 + flowAnalysis.smartMoney.confidence * 0.25);
        reasoning.push('✅ SMART MONEY DISTRIBUTION: Following institutional flow');
      }
    } else {
      signal = 'NO_TRADE';
      confidence = 68;
      reasoning.push('❌ NO TRADE: Insufficient order flow conviction');
    }

    console.log(`📊 ORDER FLOW ANALYSIS COMPLETE:`);
    console.log(`   Score: ${score.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Flow Balance: ${flowAnalysis.cumulativeFlow.flowBalance.toFixed(1)}`);
    console.log(`   Smart Money: ${flowAnalysis.smartMoney.detected ? flowAnalysis.smartMoney.action : 'None'}`);

    return {
      agent: 'OrderFlow',
      signal,
      confidence,
      reasoning,
      data: flowAnalysis
    };
  }

  /**
   * Calculate order flow from market data
   */
  private static calculateOrderFlow(marketData: MarketData[]): OrderFlowAnalysis {
    const recentBars = marketData.slice(-20);
    const flowBars: OrderFlowBar[] = [];

    // Calculate flow for each bar
    for (let i = 0; i < recentBars.length; i++) {
      const bar = recentBars[i];
      const previousBar = i > 0 ? recentBars[i - 1] : bar;

      const flowBar = this.analyzeBarFlow(bar, previousBar);
      flowBars.push(flowBar);
    }

    const currentBar = flowBars[flowBars.length - 1];

    // Calculate cumulative flow
    const totalBuying = flowBars.reduce((sum, bar) => sum + bar.buyingPressure, 0);
    const totalSelling = flowBars.reduce((sum, bar) => sum + bar.sellingPressure, 0);
    const flowBalance = totalBuying - totalSelling;

    let flowTrend: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    if (flowBalance > 500) flowTrend = 'STRONG_BUY';
    else if (flowBalance > 200) flowTrend = 'BUY';
    else if (flowBalance < -500) flowTrend = 'STRONG_SELL';
    else if (flowBalance < -200) flowTrend = 'SELL';
    else flowTrend = 'NEUTRAL';

    // Detect absorption
    const absorption = this.detectAbsorption(flowBars, recentBars);

    // Detect smart money activity
    const smartMoney = this.detectSmartMoney(flowBars);

    // Calculate momentum
    const momentum = this.calculateFlowMomentum(flowBars);

    return {
      currentBar,
      recentBars: flowBars.slice(-10),
      cumulativeFlow: {
        netBuying: totalBuying,
        netSelling: totalSelling,
        flowBalance,
        trend: flowTrend
      },
      absorption,
      smartMoney,
      momentum
    };
  }

  /**
   * Analyze individual bar for order flow
   */
  private static analyzeBarFlow(bar: MarketData, previousBar: MarketData): OrderFlowBar {
    const range = bar.high - bar.low;
    const volume = Number(bar.volume || 0);
    
    // Calculate where price closed in the range
    const closePosition = range > 0 ? (bar.close - bar.low) / range : 0.5;
    
    // Calculate buying/selling pressure based on close position and volume
    let buyingPressure: number;
    let sellingPressure: number;
    let flowType: 'AGGRESSIVE_BUY' | 'PASSIVE_BUY' | 'NEUTRAL' | 'PASSIVE_SELL' | 'AGGRESSIVE_SELL';

    // Aggressive buying: Close near high on high volume
    if (closePosition > 0.75 && volume > 0) {
      buyingPressure = 60 + (closePosition - 0.75) * 160;  // 60-100%
      sellingPressure = 100 - buyingPressure;
      flowType = closePosition > 0.9 ? 'AGGRESSIVE_BUY' : 'PASSIVE_BUY';
    }
    // Aggressive selling: Close near low on high volume
    else if (closePosition < 0.25 && volume > 0) {
      sellingPressure = 60 + (0.25 - closePosition) * 160;  // 60-100%
      buyingPressure = 100 - sellingPressure;
      flowType = closePosition < 0.1 ? 'AGGRESSIVE_SELL' : 'PASSIVE_SELL';
    }
    // Neutral: Close in middle
    else {
      buyingPressure = closePosition * 100;
      sellingPressure = (1 - closePosition) * 100;
      flowType = 'NEUTRAL';
    }

    const netFlow = buyingPressure - sellingPressure;

    // Detect absorption (high volume, small price movement)
    const priceChange = Math.abs(bar.close - bar.open);
    const avgRecentVolume = volume; // Simplified
    const absorption = volume > avgRecentVolume * 1.5 && priceChange / bar.close < 0.002;

    // Detect smart money characteristics
    let smartMoneySignal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NONE' = 'NONE';
    
    // Accumulation: Price stable/down on high volume with buying pressure
    if (absorption && buyingPressure > 60 && bar.close <= previousBar.close) {
      smartMoneySignal = 'ACCUMULATION';
    }
    // Distribution: Price stable/up on high volume with selling pressure
    else if (absorption && sellingPressure > 60 && bar.close >= previousBar.close) {
      smartMoneySignal = 'DISTRIBUTION';
    }

    return {
      timestamp: new Date(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume,
      buyingPressure,
      sellingPressure,
      netFlow,
      flowType,
      absorption,
      smartMoneySignal
    };
  }

  /**
   * Detect absorption at key levels
   */
  private static detectAbsorption(
    flowBars: OrderFlowBar[],
    marketBars: MarketData[]
  ): {
    detected: boolean;
    location: 'SUPPORT' | 'RESISTANCE' | 'NONE';
    strength: number;
    outcome: 'HELD' | 'FAILED' | 'PENDING';
  } {
    if (flowBars.length < 5) {
      return { detected: false, location: 'NONE', strength: 0, outcome: 'PENDING' };
    }

    // Check last 5 bars for absorption
    const recentBars = flowBars.slice(-5);
    const absorptionBars = recentBars.filter(bar => bar.absorption);

    if (absorptionBars.length < 2) {
      return { detected: false, location: 'NONE', strength: 0, outcome: 'PENDING' };
    }

    // Determine location
    const currentPrice = recentBars[recentBars.length - 1].close;
    const recentLow = Math.min(...marketBars.slice(-10).map(b => b.low));
    const recentHigh = Math.max(...marketBars.slice(-10).map(b => b.high));
    const priceRange = recentHigh - recentLow;

    let location: 'SUPPORT' | 'RESISTANCE' | 'NONE' = 'NONE';
    if (currentPrice < recentLow + priceRange * 0.3) {
      location = 'SUPPORT';
    } else if (currentPrice > recentHigh - priceRange * 0.3) {
      location = 'RESISTANCE';
    }

    // Calculate absorption strength
    const totalVolume = absorptionBars.reduce((sum, bar) => sum + bar.volume, 0);
    const avgVolume = flowBars.reduce((sum, bar) => sum + bar.volume, 0) / flowBars.length;
    const strength = Math.min(100, (totalVolume / avgVolume / absorptionBars.length) * 50);

    // Determine outcome
    let outcome: 'HELD' | 'FAILED' | 'PENDING' = 'PENDING';
    if (location === 'SUPPORT') {
      // Check if price bounced after absorption
      const priceAfter = recentBars[recentBars.length - 1].close;
      const priceAtAbsorption = absorptionBars[0].close;
      if (priceAfter > priceAtAbsorption * 1.002) outcome = 'HELD';
      else if (priceAfter < priceAtAbsorption * 0.998) outcome = 'FAILED';
    } else if (location === 'RESISTANCE') {
      // Check if price rejected after absorption
      const priceAfter = recentBars[recentBars.length - 1].close;
      const priceAtAbsorption = absorptionBars[0].close;
      if (priceAfter < priceAtAbsorption * 0.998) outcome = 'HELD';
      else if (priceAfter > priceAtAbsorption * 1.002) outcome = 'FAILED';
    }

    return {
      detected: true,
      location,
      strength,
      outcome
    };
  }

  /**
   * Detect smart money activity
   */
  private static detectSmartMoney(flowBars: OrderFlowBar[]): {
    detected: boolean;
    action: 'ACCUMULATING' | 'DISTRIBUTING' | 'NEUTRAL';
    confidence: number;
    characteristics: string[];
  } {
    if (flowBars.length < 10) {
      return { detected: false, action: 'NEUTRAL', confidence: 0, characteristics: [] };
    }

    const recentBars = flowBars.slice(-10);
    const characteristics: string[] = [];
    let score = 0;

    // Characteristic 1: High volume with controlled price action
    const highVolumeBars = recentBars.filter(bar => bar.volume > 0);
    const avgVolume = highVolumeBars.reduce((sum, bar) => sum + bar.volume, 0) / highVolumeBars.length;
    const highVolumeCount = recentBars.filter(bar => bar.volume > avgVolume * 1.5).length;
    
    if (highVolumeCount >= 3) {
      score += 25;
      characteristics.push(`High volume activity (${highVolumeCount} bars above average)`);
    }

    // Characteristic 2: Absorption patterns
    const absorptionCount = recentBars.filter(bar => bar.absorption).length;
    if (absorptionCount >= 2) {
      score += 20;
      characteristics.push(`Absorption detected (${absorptionCount} bars)`);
    }

    // Characteristic 3: Consistent directional flow
    const accumulationBars = recentBars.filter(bar => bar.smartMoneySignal === 'ACCUMULATION').length;
    const distributionBars = recentBars.filter(bar => bar.smartMoneySignal === 'DISTRIBUTION').length;

    let action: 'ACCUMULATING' | 'DISTRIBUTING' | 'NEUTRAL' = 'NEUTRAL';
    if (accumulationBars >= 3) {
      score += 35;
      action = 'ACCUMULATING';
      characteristics.push(`Multiple accumulation signals (${accumulationBars} bars)`);
    } else if (distributionBars >= 3) {
      score += 35;
      action = 'DISTRIBUTING';
      characteristics.push(`Multiple distribution signals (${distributionBars} bars)`);
    }

    // Characteristic 4: Price/flow divergence
    const priceChange = recentBars[recentBars.length - 1].close - recentBars[0].close;
    const netFlow = recentBars.reduce((sum, bar) => sum + bar.netFlow, 0);

    if (priceChange < 0 && netFlow > 0) {
      score += 20;
      characteristics.push('Buying on dips (bullish divergence)');
      if (action === 'NEUTRAL') action = 'ACCUMULATING';
    } else if (priceChange > 0 && netFlow < 0) {
      score += 20;
      characteristics.push('Selling on rallies (bearish divergence)');
      if (action === 'NEUTRAL') action = 'DISTRIBUTING';
    }

    const detected = score >= 50;
    const confidence = Math.min(100, score);

    return {
      detected,
      action,
      confidence,
      characteristics
    };
  }

  /**
   * Calculate flow momentum
   */
  private static calculateFlowMomentum(flowBars: OrderFlowBar[]): {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    acceleration: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  } {
    if (flowBars.length < 5) {
      return { direction: 'NEUTRAL', strength: 0, acceleration: 'STABLE' };
    }

    const recentBars = flowBars.slice(-10);
    
    // Calculate recent momentum
    const recentFlow = recentBars.slice(-5).reduce((sum, bar) => sum + bar.netFlow, 0) / 5;
    const earlierFlow = recentBars.slice(0, 5).reduce((sum, bar) => sum + bar.netFlow, 0) / 5;

    // Determine direction and strength
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    let strength = Math.abs(recentFlow);

    if (recentFlow > 15) {
      direction = 'BULLISH';
    } else if (recentFlow < -15) {
      direction = 'BEARISH';
    } else {
      direction = 'NEUTRAL';
    }

    // Determine acceleration
    let acceleration: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
    const flowChange = Math.abs(recentFlow) - Math.abs(earlierFlow);

    if (flowChange > 10) {
      acceleration = 'ACCELERATING';
    } else if (flowChange < -10) {
      acceleration = 'DECELERATING';
    } else {
      acceleration = 'STABLE';
    }

    return {
      direction,
      strength: Math.min(100, strength),
      acceleration
    };
  }

  /**
   * Calculate overall order flow score
   */
  private static calculateOrderFlowScore(analysis: OrderFlowAnalysis): number {
    let score = 50;  // Base score

    // Cumulative flow contribution (30 points)
    const flowBalance = Math.abs(analysis.cumulativeFlow.flowBalance);
    if (flowBalance > 600) {
      score += 30;
    } else if (flowBalance > 300) {
      score += 20;
    } else if (flowBalance > 100) {
      score += 10;
    }

    // Smart money contribution (25 points)
    if (analysis.smartMoney.detected) {
      score += (analysis.smartMoney.confidence / 100) * 25;
    }

    // Momentum contribution (25 points)
    if (analysis.momentum.strength > 70) {
      score += 25;
    } else if (analysis.momentum.strength > 50) {
      score += 18;
    } else if (analysis.momentum.strength > 30) {
      score += 10;
    }

    // Absorption contribution (20 points)
    if (analysis.absorption.detected && analysis.absorption.outcome === 'HELD') {
      score += 20;
    } else if (analysis.absorption.detected) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
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
