/**
 * SPY MARKET INTERNALS AGENT
 *
 * Specialized agent for SPY market internals analysis including:
 * - TICK/ADD (Advance/Decline) analysis
 * - TRIN (Arms Index) calculations
 * - Cumulative Delta Volume analysis
 * - VIX correlation and sentiment analysis
 * - Option contract specific volume analysis
 */

import { MarketData, OptionsChain, TradeSignal } from './types';

export interface MarketInternals {
  tick: number;
  trin: number;
  advanceDeclineRatio: number;
  cumulativeDeltaVolume: number;
  vixCorrelation: number;
  marketBreadth: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentiment: 'GREED' | 'FEAR' | 'NEUTRAL';
}

export interface OptionContractAnalysis {
  symbol: string;
  strike: number;
  type: 'CALL' | 'PUT';
  volume: number;
  openInterest: number;
  volumeRatio: number; // Current volume vs average
  liquidityScore: number;
  institutionalActivity: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * SPY Market Internals Agent
 * Analyzes market depth and institutional flow patterns
 */
export class SPYMarketInternalsAgent {
  /**
   * Analyze SPY market internals for comprehensive market analysis
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[], vixLevel?: number): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('🏛️ SPY MARKET INTERNALS ANALYSIS INITIATED');
    console.log('=====================================');

    // 1. TICK/ADD Analysis (simulated from price action and volume)
    const tickAnalysis = this.analyzeTickPattern(marketData);
    reasoning.push(`TICK Analysis: ${tickAnalysis.description} (${tickAnalysis.trend})`);

    // 2. TRIN Calculation (Arms Index)
    const trinAnalysis = this.calculateTRIN(marketData);
    reasoning.push(`TRIN (Arms Index): ${trinAnalysis.value.toFixed(3)} - ${trinAnalysis.signal}`);

    // 3. Cumulative Delta Volume Analysis
    const deltaVolumeAnalysis = this.analyzeCumulativeDeltaVolume(marketData);
    reasoning.push(`Cumulative Delta Volume: ${deltaVolumeAnalysis.delta.toFixed(0)}M (${deltaVolumeAnalysis.pressure})`);

    // 4. VIX Correlation Analysis
    const vixAnalysis = this.analyzeVIXCorrelation(marketData, vixLevel);
    reasoning.push(`VIX Correlation: ${vixAnalysis.correlation.toFixed(3)} - ${vixAnalysis.sentiment}`);

    // 5. Market Breadth Assessment
    const marketBreadth = this.assessMarketBreadth(tickAnalysis, trinAnalysis, deltaVolumeAnalysis);
    reasoning.push(`Market Breadth: ${marketBreadth}`);

    // 6. Overall Market Internals Consensus
    const internalsScore = this.calculateInternalsScore(tickAnalysis, trinAnalysis, deltaVolumeAnalysis, vixAnalysis);

    // Generate signal based on internals
    if (internalsScore >= 3) {
      signal = 'BUY_CALL';
      confidence = Math.min(90, 60 + internalsScore * 8);
      reasoning.push('✅ Strong bullish internals - institutional buying pressure');
    } else if (internalsScore <= -3) {
      signal = 'BUY_PUT';
      confidence = Math.min(90, 60 + Math.abs(internalsScore) * 8);
      reasoning.push('✅ Strong bearish internals - institutional selling pressure');
    } else if (Math.abs(internalsScore) >= 1) {
      // Weak signal - needs confirmation from other agents
      signal = internalsScore > 0 ? 'BUY_CALL' : 'BUY_PUT';
      confidence = 60;
      reasoning.push('⚠️ Moderate internals - requires agent consensus');
    } else {
      reasoning.push('❌ Neutral/Conflicting internals - no clear directional bias');
      confidence = 75;
    }

    console.log(`📊 INTERNALS SCORE: ${internalsScore}`);
    console.log(`🎯 INTERNALS SIGNAL: ${signal} (${confidence}% confidence)`);

    return {
      agent: 'SPYMarketInternals',
      signal,
      confidence,
      reasoning,
      data: {
        tick: tickAnalysis,
        trin: trinAnalysis,
        deltaVolume: deltaVolumeAnalysis,
        vixAnalysis: vixAnalysis,
        internalsScore,
        marketBreadth
      }
    };
  }

  /**
   * Analyze specific option contract for volume and liquidity
   */
  static analyzeOptionContract(
    targetOption: OptionsChain,
    allOptions: OptionsChain[],
    marketData: MarketData[]
  ): OptionContractAnalysis {
    console.log(`🎯 OPTION CONTRACT ANALYSIS: ${targetOption.symbol}`);
    console.log('=====================================');

    // Current contract data
    const volume = targetOption.volume || 0;
    const openInterest = targetOption.openInterest || 0;

    // Calculate volume ratio vs similar strikes
    const similarOptions = allOptions.filter(opt =>
      opt.side === targetOption.side &&
      Math.abs(opt.strike - targetOption.strike) <= 5
    );

    const avgSimilarVolume = similarOptions.reduce((sum, opt) => sum + (opt.volume || 0), 0) / similarOptions.length;
    const volumeRatio = avgSimilarVolume > 0 ? volume / avgSimilarVolume : 0;

    // Liquidity score calculation
    const bidAskSpread = targetOption.ask - targetOption.bid;
    const spreadPercent = targetOption.ask > 0 ? (bidAskSpread / targetOption.ask) * 100 : 100;

    const liquidityScore = this.calculateLiquidityScore(
      volume,
      openInterest,
      spreadPercent,
      volumeRatio
    );

    // Institutional activity assessment
    const institutionalActivity = this.assessInstitutionalActivity(
      volume,
      openInterest,
      volumeRatio,
      marketData
    );

    console.log(`📊 Volume: ${volume} (Ratio: ${volumeRatio.toFixed(1)}x avg)`);
    console.log(`📊 Open Interest: ${openInterest}`);
    console.log(`📊 Bid-Ask Spread: ${spreadPercent.toFixed(2)}%`);
    console.log(`📊 Liquidity Score: ${liquidityScore.toFixed(1)}/100`);
    console.log(`🏦 Institutional Activity: ${institutionalActivity}`);

    return {
      symbol: targetOption.symbol,
      strike: targetOption.strike,
      type: targetOption.side as 'CALL' | 'PUT',
      volume,
      openInterest,
      volumeRatio,
      liquidityScore,
      institutionalActivity
    };
  }

  /**
   * TICK Pattern Analysis (simulated from price/volume action)
   */
  private static analyzeTickPattern(marketData: MarketData[]): {
    tick: number;
    trend: string;
    description: string;
  } {
    if (marketData.length < 10) {
      return { tick: 0, trend: 'NEUTRAL', description: 'Insufficient data' };
    }

    // Simulate TICK from price movements and volume
    const recentBars = marketData.slice(-10);
    let tickScore = 0;
    let totalVolume = 0;

    for (let i = 1; i < recentBars.length; i++) {
      const priceChange = recentBars[i].close - recentBars[i-1].close;
      const volume = Number(recentBars[i].volume || 0);

      // Up moves on high volume = positive TICK
      if (priceChange > 0 && volume > 0) {
        tickScore += (priceChange / recentBars[i-1].close) * volume;
      }
      // Down moves on high volume = negative TICK
      else if (priceChange < 0 && volume > 0) {
        tickScore -= (Math.abs(priceChange) / recentBars[i-1].close) * volume;
      }

      totalVolume += volume;
    }

    // Normalize TICK
    const normalizedTick = totalVolume > 0 ? tickScore / totalVolume * 1000 : 0;

    let trend = 'NEUTRAL';
    let description = 'Balanced buying/selling pressure';

    if (normalizedTick > 200) {
      trend = 'STRONGLY_BULLISH';
      description = 'Aggressive buying pressure';
    } else if (normalizedTick > 50) {
      trend = 'BULLISH';
      description = 'Moderate buying pressure';
    } else if (normalizedTick < -200) {
      trend = 'STRONGLY_BEARISH';
      description = 'Aggressive selling pressure';
    } else if (normalizedTick < -50) {
      trend = 'BEARISH';
      description = 'Moderate selling pressure';
    }

    return {
      tick: Math.round(normalizedTick),
      trend,
      description
    };
  }

  /**
   * TRIN (Arms Index) Calculation
   */
  private static calculateTRIN(marketData: MarketData[]): {
    value: number;
    signal: string;
  } {
    if (marketData.length < 5) {
      return { value: 1.0, signal: 'NEUTRAL (insufficient data)' };
    }

    // Simulate TRIN using volume and price range relationships
    const recentBars = marketData.slice(-5);
    let avgRange = 0;
    let avgVolume = 0;
    let volumeVariance = 0;

    for (const bar of recentBars) {
      const range = bar.high - bar.low;
      avgRange += range;
      avgVolume += Number(bar.volume || 0);
    }

    avgRange /= recentBars.length;
    avgVolume /= recentBars.length;

    // Calculate volume variance (proxy for advancing/declining volume)
    for (const bar of recentBars) {
      const volumeDeviation = Math.abs(Number(bar.volume || 0) - avgVolume);
      volumeVariance += volumeDeviation;
    }

    volumeVariance /= recentBars.length;

    // TRIN formula: (Advancing Volume / Declining Volume) / (Advancing Issues / Declining Issues)
    // Simulated using range/volume relationship
    const volumeRatio = avgVolume > 0 ? volumeVariance / avgVolume : 1;
    const priceRatio = avgRange > 0 ? (recentBars[recentBars.length - 1].close - recentBars[0].close) / avgRange : 0;

    const trinValue = priceRatio > 0 ? volumeRatio / Math.abs(priceRatio) : 1.0;

    let signal = 'NEUTRAL';
    if (trinValue < 0.7) {
      signal = 'BULLISH (low TRIN - buying pressure)';
    } else if (trinValue > 1.3) {
      signal = 'BEARISH (high TRIN - selling pressure)';
    } else {
      signal = 'NEUTRAL (balanced)';
    }

    return {
      value: trinValue,
      signal
    };
  }

  /**
   * Cumulative Delta Volume Analysis
   */
  private static analyzeCumulativeDeltaVolume(marketData: MarketData[]): {
    delta: number;
    pressure: string;
    trend: string;
  } {
    if (marketData.length < 20) {
      return { delta: 0, pressure: 'NEUTRAL', trend: 'Insufficient data' };
    }

    let cumulativeDelta = 0;
    const recentBars = marketData.slice(-20);

    // Calculate delta based on price closes within bar ranges
    for (const bar of recentBars) {
      const barRange = bar.high - bar.low;
      const barMid = (bar.high + bar.low) / 2;
      const volume = Number(bar.volume || 0);

      if (barRange > 0) {
        // Close position in range (0 = low, 1 = high)
        const closePosition = (bar.close - bar.low) / barRange;

        // Calculate delta: positive if closes in upper half on high volume
        const barDelta = (closePosition - 0.5) * volume;
        cumulativeDelta += barDelta;
      }
    }

    // Convert to millions for readability
    const deltaInMillions = cumulativeDelta / 1000000;

    let pressure = 'NEUTRAL';
    let trend = 'Balanced';

    if (deltaInMillions > 50) {
      pressure = 'STRONGLY_BULLISH';
      trend = 'Significant institutional buying';
    } else if (deltaInMillions > 10) {
      pressure = 'BULLISH';
      trend = 'Moderate buying pressure';
    } else if (deltaInMillions < -50) {
      pressure = 'STRONGLY_BEARISH';
      trend = 'Significant institutional selling';
    } else if (deltaInMillions < -10) {
      pressure = 'BEARISH';
      trend = 'Moderate selling pressure';
    }

    return {
      delta: deltaInMillions,
      pressure,
      trend
    };
  }

  /**
   * VIX Correlation Analysis
   */
  private static analyzeVIXCorrelation(marketData: MarketData[], vixLevel?: number): {
    correlation: number;
    sentiment: string;
    fearGreed: string;
  } {
    if (!vixLevel) {
      return {
        correlation: 0,
        sentiment: 'NEUTRAL (no VIX data)',
        fearGreed: 'UNKNOWN'
      };
    }

    // Analyze recent price action vs VIX
    const recentPrice = marketData[marketData.length - 1].close;
    const priceChange = marketData.length > 1 ?
      (recentPrice - marketData[marketData.length - 2].close) / marketData[marketData.length - 2].close : 0;

    // VIX levels interpretation
    let sentiment = 'NEUTRAL';
    let fearGreed = 'NEUTRAL';
    let correlation = 0;

    if (vixLevel > 35) {
      sentiment = 'HIGH_FEAR';
      fearGreed = 'EXTREME_FEAR';
      correlation = -0.7; // High VIX typically correlates with market decline
    } else if (vixLevel > 25) {
      sentiment = 'MODERATE_FEAR';
      fearGreed = 'FEAR';
      correlation = -0.5;
    } else if (vixLevel < 12) {
      sentiment = 'COMPLACENCY';
      fearGreed = 'EXTREME_GREED';
      correlation = 0.3; // Low VIX can indicate complacency
    } else if (vixLevel < 18) {
      sentiment = 'LOW_FEAR';
      fearGreed = 'GREED';
      correlation = 0.1;
    }

    // Adjust correlation based on current price action
    if (priceChange < -0.01 && vixLevel > 20) {
      correlation = Math.max(correlation, -0.8); // Strengthen negative correlation
    } else if (priceChange > 0.01 && vixLevel < 20) {
      correlation = Math.min(correlation, 0.6); // Strengthen positive correlation
    }

    return {
      correlation,
      sentiment,
      fearGreed
    };
  }

  /**
   * Assess overall market breadth
   */
  private static assessMarketBreadth(
    tickAnalysis: any,
    trinAnalysis: any,
    deltaAnalysis: any
  ): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    let bullishScore = 0;
    let bearishScore = 0;

    // TICK contribution
    if (tickAnalysis.trend.includes('BULLISH')) bullishScore += 2;
    if (tickAnalysis.trend.includes('BEARISH')) bearishScore += 2;
    if (tickAnalysis.trend.includes('STRONGLY')) bullishScore += 1;
    if (tickAnalysis.trend.includes('STRONGLY')) bearishScore += 1;

    // TRIN contribution
    if (trinAnalysis.signal.includes('BULLISH')) bullishScore += 2;
    if (trinAnalysis.signal.includes('BEARISH')) bearishScore += 2;

    // Delta volume contribution
    if (deltaAnalysis.pressure.includes('BULLISH')) bullishScore += 2;
    if (deltaAnalysis.pressure.includes('BEARISH')) bearishScore += 2;
    if (deltaAnalysis.pressure.includes('STRONGLY')) bullishScore += 1;
    if (deltaAnalysis.pressure.includes('STRONGLY')) bearishScore += 1;

    if (bullishScore >= 4) return 'BULLISH';
    if (bearishScore >= 4) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate overall internals score
   */
  private static calculateInternalsScore(
    tickAnalysis: any,
    trinAnalysis: any,
    deltaAnalysis: any,
    vixAnalysis: any
  ): number {
    let score = 0;

    // TICK score (-3 to +3)
    if (tickAnalysis.trend.includes('STRONGLY_BULLISH')) score += 3;
    else if (tickAnalysis.trend.includes('BULLISH')) score += 1;
    else if (tickAnalysis.trend.includes('STRONGLY_BEARISH')) score -= 3;
    else if (tickAnalysis.trend.includes('BEARISH')) score -= 1;

    // TRIN score (-2 to +2)
    if (trinAnalysis.value < 0.7) score += 2;
    else if (trinAnalysis.value < 1.0) score += 1;
    else if (trinAnalysis.value > 1.3) score -= 2;
    else if (trinAnalysis.value > 1.0) score -= 1;

    // Delta volume score (-2 to +2)
    if (deltaAnalysis.delta > 50) score += 2;
    else if (deltaAnalysis.delta > 10) score += 1;
    else if (deltaAnalysis.delta < -50) score -= 2;
    else if (deltaAnalysis.delta < -10) score -= 1;

    // VIX sentiment score (-1 to +1)
    if (vixAnalysis.fearGreed.includes('FEAR')) score += 1; // Fear = bullish contrarian
    if (vixAnalysis.fearGreed.includes('GREED')) score -= 1; // Greed = bearish contrarian

    return Math.round(score);
  }

  /**
   * Calculate liquidity score for option contract
   */
  private static calculateLiquidityScore(
    volume: number,
    openInterest: number,
    spreadPercent: number,
    volumeRatio: number
  ): number {
    let score = 0;

    // Volume score (0-40 points)
    if (volume >= 1000) score += 40;
    else if (volume >= 500) score += 30;
    else if (volume >= 100) score += 20;
    else if (volume >= 50) score += 10;

    // Open interest score (0-30 points)
    if (openInterest >= 10000) score += 30;
    else if (openInterest >= 5000) score += 20;
    else if (openInterest >= 1000) score += 10;

    // Spread score (0-20 points)
    if (spreadPercent <= 0.5) score += 20;
    else if (spreadPercent <= 1.0) score += 15;
    else if (spreadPercent <= 2.0) score += 10;
    else if (spreadPercent <= 5.0) score += 5;

    // Volume ratio score (0-10 points)
    if (volumeRatio >= 2.0) score += 10;
    else if (volumeRatio >= 1.5) score += 7;
    else if (volumeRatio >= 1.0) score += 5;
    else if (volumeRatio >= 0.5) score += 3;

    return Math.min(100, score);
  }

  /**
   * Assess institutional activity in option contract
   */
  private static assessInstitutionalActivity(
    volume: number,
    openInterest: number,
    volumeRatio: number,
    marketData: MarketData[]
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    let score = 0;

    // High volume indicates institutional interest
    if (volume >= 1000) score += 3;
    else if (volume >= 500) score += 2;
    else if (volume >= 100) score += 1;

    // High open interest indicates institutional positions
    if (openInterest >= 10000) score += 3;
    else if (openInterest >= 5000) score += 2;
    else if (openInterest >= 1000) score += 1;

    // Volume ratio indicates relative interest
    if (volumeRatio >= 2.0) score += 2;
    else if (volumeRatio >= 1.5) score += 1;

    if (score >= 6) return 'HIGH';
    if (score >= 3) return 'MEDIUM';
    return 'LOW';
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