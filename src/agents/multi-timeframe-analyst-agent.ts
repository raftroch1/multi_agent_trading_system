/**
 * MULTI-TIMEFRAME CONFLUENCE ANALYST AGENT
 *
 * Specialized agent for analyzing confluence across multiple timeframes
 * Critical for 0-DTE trading where 1Min entries need higher timeframe confirmation
 *
 * Analyzes:
 * - 1Min timeframe (execution timeframe)
 * - 5Min timeframe (short-term trend confirmation)
 * - 15Min timeframe (medium-term trend alignment)
 * - Volume confluence across timeframes
 * - Trend alignment and momentum confluence
 */

import { MarketData, OptionsChain, TradeSignal } from './types';
import { TechnicalAnalysis } from './technical-indicators';

export interface TimeframeAnalysis {
  timeframe: '1Min' | '5Min' | '15Min';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  volume: 'HIGH' | 'NORMAL' | 'LOW';
  confidence: number;
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bbPosition: 'OVERBOUGHT' | 'UPPER' | 'MIDDLE' | 'LOWER' | 'OVERSOLD';
    smaTrend: 'ABOVE' | 'BELOW' | 'CROSSING';
  };
  reasoning: string[];
}

export interface MultiTimeframeConsensus {
  confluenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICTING';
  primaryTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  overallConfidence: number;
  trendAlignment: number; // -100 to +100
  momentumAlignment: number; // -100 to +100
  volumeConfluence: number; // 0 to 100
  recommendation: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confluenceReasoning: string[];
}

/**
 * Multi-Timeframe Confluence Analyst Agent
 * Provides institutional-grade multi-timeframe analysis for 0-DTE trading
 */
export class MultiTimeframeAnalystAgent {
  /**
   * Analyze market confluence across multiple timeframes
   */
  static analyze(marketData1Min: MarketData[], marketData5Min: MarketData[], marketData15Min: MarketData[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('⏰ MULTI-TIMEFRAME CONFLUENCE ANALYSIS INITIATED');
    console.log('==========================================');

    // Analyze each timeframe
    const tf1Min = this.analyzeTimeframe(marketData1Min, '1Min');
    const tf5Min = this.analyzeTimeframe(marketData5Min, '5Min');
    const tf15Min = this.analyzeTimeframe(marketData15Min, '15Min');

    console.log(`\n📊 1Min Analysis: ${tf1Min.trend} (${tf1Min.confidence}% confidence)`);
    console.log(`📊 5Min Analysis: ${tf5Min.trend} (${tf5Min.confidence}% confidence)`);
    console.log(`📊 15Min Analysis: ${tf15Min.trend} (${tf15Min.confidence}% confidence)`);

    // Generate consensus
    const consensus = this.generateTimeframeConsensus(tf1Min, tf5Min, tf15Min);

    reasoning.push(`Confluence Strength: ${consensus.confluenceStrength}`);
    reasoning.push(`Primary Trend: ${consensus.primaryTrend} (${consensus.overallConfidence}% confidence)`);
    reasoning.push(`Trend Alignment: ${consensus.trendAlignment.toFixed(0)}%`);
    reasoning.push(`Momentum Alignment: ${consensus.momentumAlignment.toFixed(0)}%`);
    reasoning.push(`Volume Confluence: ${consensus.volumeConfluence.toFixed(0)}%`);

    // Add detailed reasoning from consensus
    reasoning.push(...consensus.confluenceReasoning);

    // Generate signal based on multi-timeframe confluence
    if (consensus.confluenceStrength === 'STRONG' && consensus.overallConfidence >= 75) {
      signal = consensus.recommendation;
      confidence = consensus.overallConfidence;

      if (signal === 'BUY_CALL') {
        reasoning.push('✅ STRONG BULLISH CONFLUENCE across all timeframes');
      } else if (signal === 'BUY_PUT') {
        reasoning.push('✅ STRONG BEARISH CONFLUENCE across all timeframes');
      }
    } else if (consensus.confluenceStrength === 'MODERATE' && consensus.overallConfidence >= 65) {
      signal = consensus.recommendation;
      confidence = consensus.overallConfidence * 0.8; // Reduce confidence for moderate confluence

      reasoning.push('⚠️ MODERATE CONFLUENCE - acceptable but requires caution');
    } else if (consensus.confluenceStrength === 'CONFLICTING') {
      signal = 'NO_TRADE';
      confidence = 80;
      reasoning.push('❌ CONFLICTING SIGNALS - timeframe divergence detected');
    } else {
      signal = 'NO_TRADE';
      confidence = 70;
      reasoning.push('❌ WEAK CONFLUENCE - insufficient alignment');
    }

    console.log(`\n🎯 MULTI-TIMEFRAME CONSENSUS:`);
    console.log(`   Confluence: ${consensus.confluenceStrength}`);
    console.log(`   Primary Trend: ${consensus.primaryTrend}`);
    console.log(`   Overall Confidence: ${consensus.overallConfidence}%`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Risk Level: ${consensus.riskLevel}`);

    return {
      agent: 'MultiTimeframeAnalyst',
      signal,
      confidence,
      reasoning,
      data: {
        timeframeAnalysis: { tf1Min, tf5Min, tf15Min },
        consensus
      }
    };
  }

  /**
   * Analyze a single timeframe
   */
  private static analyzeTimeframe(marketData: MarketData[], timeframe: '1Min' | '5Min' | '15Min'): TimeframeAnalysis {
    const reasoning: string[] = [];

    if (marketData.length < 20) {
      return {
        timeframe,
        trend: 'NEUTRAL',
        momentum: 'WEAK',
        volume: 'LOW',
        confidence: 0,
        indicators: { rsi: 50, macd: { macd: 0, signal: 0, histogram: 0 }, bbPosition: 'MIDDLE', smaTrend: 'BELOW' },
        reasoning: ['Insufficient data for analysis']
      };
    }

    const indicators = TechnicalAnalysis.calculateAllIndicators(marketData);
    if (!indicators) {
      return {
        timeframe,
        trend: 'NEUTRAL',
        momentum: 'WEAK',
        volume: 'LOW',
        confidence: 0,
        indicators: { rsi: 50, macd: { macd: 0, signal: 0, histogram: 0 }, bbPosition: 'MIDDLE', smaTrend: 'BELOW' },
        reasoning: ['Technical indicators calculation failed']
      };
    }

    const currentPrice = marketData[marketData.length - 1].close;
    const sma20 = this.calculateSMA(marketData, 20);

    // Trend analysis
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let smaTrend: 'ABOVE' | 'BELOW' | 'CROSSING' = 'BELOW';

    if (currentPrice > sma20 * 1.01) {
      trend = 'BULLISH';
      smaTrend = 'ABOVE';
      reasoning.push(`Price ${(currentPrice / sma20).toFixed(3)}x above SMA20`);
    } else if (currentPrice < sma20 * 0.99) {
      trend = 'BEARISH';
      smaTrend = 'BELOW';
      reasoning.push(`Price ${(currentPrice / sma20).toFixed(3)}x below SMA20`);
    } else {
      smaTrend = 'CROSSING';
      reasoning.push(`Price near SMA20 - potential trend change`);
    }

    // Momentum analysis
    let momentum: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';
    const macdHistogram = indicators.macd - indicators.macdSignal;
    const macdStrength = Math.abs(macdHistogram);

    if (macdStrength > 0.001) {
      momentum = 'STRONG';
      reasoning.push(`Strong MACD momentum (${macdHistogram.toFixed(4)})`);
    } else if (macdStrength > 0.0005) {
      momentum = 'MODERATE';
      reasoning.push(`Moderate MACD momentum (${macdHistogram.toFixed(4)})`);
    } else {
      reasoning.push(`Weak MACD momentum (${macdHistogram.toFixed(4)})`);
    }

    // Volume analysis
    const currentVolume = Number(marketData[marketData.length - 1].volume || 0);
    const avgVolume = marketData.slice(-20).reduce((sum, bar) => sum + Number(bar.volume || 0), 0) / 20;
    const volumeRatio = currentVolume / avgVolume;

    let volume: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
    if (volumeRatio > 1.5) {
      volume = 'HIGH';
      reasoning.push(`High volume (${volumeRatio.toFixed(1)}x average)`);
    } else if (volumeRatio < 0.7) {
      volume = 'LOW';
      reasoning.push(`Low volume (${volumeRatio.toFixed(1)}x average)`);
    } else {
      reasoning.push(`Normal volume (${volumeRatio.toFixed(1)}x average)`);
    }

    // Bollinger Bands position
    let bbPosition: 'OVERBOUGHT' | 'UPPER' | 'MIDDLE' | 'LOWER' | 'OVERSOLD' = 'MIDDLE';
    if (currentPrice > indicators.bbUpper * 1.02) {
      bbPosition = 'OVERBOUGHT';
      reasoning.push('Price above upper Bollinger Band');
    } else if (currentPrice > indicators.bbUpper) {
      bbPosition = 'UPPER';
      reasoning.push('Price in upper Bollinger Band range');
    } else if (currentPrice < indicators.bbLower * 0.98) {
      bbPosition = 'OVERSOLD';
      reasoning.push('Price below lower Bollinger Band');
    } else if (currentPrice < indicators.bbLower) {
      bbPosition = 'LOWER';
      reasoning.push('Price in lower Bollinger Band range');
    } else {
      reasoning.push('Price within Bollinger Bands');
    }

    // Calculate confidence based on signal strength
    let confidence = 50;
    if (trend !== 'NEUTRAL') confidence += 15;
    if (momentum === 'STRONG') confidence += 15;
    if (volume === 'HIGH') confidence += 10;
    if (bbPosition === 'OVERSOLD' || bbPosition === 'OVERBOUGHT') confidence += 10;

    // Reduce confidence if signals conflict
    if (trend === 'BULLISH' && bbPosition === 'OVERBOUGHT') confidence -= 10;
    if (trend === 'BEARISH' && bbPosition === 'OVERSOLD') confidence -= 10;
    if (trend === 'BULLISH' && indicators.macd < indicators.macdSignal) confidence -= 15;
    if (trend === 'BEARISH' && indicators.macd > indicators.macdSignal) confidence -= 15;

    confidence = Math.max(0, Math.min(100, confidence));

    return {
      timeframe,
      trend,
      momentum,
      volume,
      confidence: Math.round(confidence),
      indicators: {
        rsi: indicators.rsi,
        macd: {
          macd: indicators.macd,
          signal: indicators.macdSignal,
          histogram: macdHistogram
        },
        bbPosition,
        smaTrend
      },
      reasoning
    };
  }

  /**
   * Generate consensus across timeframes
   */
  private static generateTimeframeConsensus(
    tf1Min: TimeframeAnalysis,
    tf5Min: TimeframeAnalysis,
    tf15Min: TimeframeAnalysis
  ): MultiTimeframeConsensus {
    const timeframes = [tf1Min, tf5Min, tf15Min];

    // Count trend votes
    const trendVotes = {
      BUY_CALL: timeframes.filter(tf => tf.trend === 'BULLISH').length,
      BUY_PUT: timeframes.filter(tf => tf.trend === 'BEARISH').length,
      NO_TRADE: timeframes.filter(tf => tf.trend === 'NEUTRAL').length
    };

    // Calculate trend alignment (-100 to +100)
    let trendAlignment = 0;
    timeframes.forEach(tf => {
      if (tf.trend === 'BULLISH') trendAlignment += (100 / 3);
      if (tf.trend === 'BEARISH') trendAlignment -= (100 / 3);
    });

    // Calculate momentum alignment (-100 to +100)
    let momentumAlignment = 0;
    timeframes.forEach(tf => {
      const macdAlignment = tf.indicators.macd.histogram > 0 ? 1 : -1;
      const momentumWeight = tf.momentum === 'STRONG' ? 1.5 : tf.momentum === 'MODERATE' ? 1 : 0.5;
      momentumAlignment += macdAlignment * momentumWeight * (100 / 3);
    });

    // Calculate volume confluence (0 to 100)
    const volumeScores = timeframes.map(tf => {
      if (tf.volume === 'HIGH') return 100;
      if (tf.volume === 'NORMAL') return 66;
      return 33;
    });
    const volumeConfluence = volumeScores.reduce((sum, score) => sum + score, 0) / 3;

    // Determine confluence strength
    let confluenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICTING';
    const maxTrendVotes = Math.max(trendVotes.BUY_CALL, trendVotes.BUY_PUT);

    if (maxTrendVotes === 3 && Math.abs(trendAlignment) > 80) {
      confluenceStrength = 'STRONG';
    } else if (maxTrendVotes === 2 && Math.abs(trendAlignment) > 40) {
      confluenceStrength = 'MODERATE';
    } else if (maxTrendVotes === 1 && Math.abs(trendAlignment) > 20) {
      confluenceStrength = 'WEAK';
    } else {
      confluenceStrength = 'CONFLICTING';
    }

    // Determine primary trend and recommendation
    let primaryTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let recommendation: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';

    if (trendVotes.BUY_CALL >= trendVotes.BUY_PUT && trendVotes.BUY_CALL >= trendVotes.NO_TRADE) {
      primaryTrend = 'BULLISH';
      recommendation = 'BUY_CALL';
    } else if (trendVotes.BUY_PUT > trendVotes.BUY_CALL && trendVotes.BUY_PUT >= trendVotes.NO_TRADE) {
      primaryTrend = 'BEARISH';
      recommendation = 'BUY_PUT';
    }

    // Calculate overall confidence
    const avgConfidence = timeframes.reduce((sum, tf) => sum + tf.confidence, 0) / 3;
    const confluenceMultiplier = confluenceStrength === 'STRONG' ? 1.2 :
                            confluenceStrength === 'MODERATE' ? 1.0 :
                            confluenceStrength === 'WEAK' ? 0.7 : 0.3;

    const overallConfidence = Math.round(avgConfidence * confluenceMultiplier);

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (confluenceStrength === 'STRONG' && overallConfidence > 80) {
      riskLevel = 'LOW';
    } else if (confluenceStrength === 'CONFLICTING' || overallConfidence < 60) {
      riskLevel = 'HIGH';
    }

    // Generate confluence reasoning
    const confluenceReasoning: string[] = [];

    if (trendVotes.BUY_CALL >= 2) {
      confluenceReasoning.push(`Bullish bias across ${trendVotes.BUY_CALL}/3 timeframes`);
    } else if (trendVotes.BUY_PUT >= 2) {
      confluenceReasoning.push(`Bearish bias across ${trendVotes.BUY_PUT}/3 timeframes`);
    }

    if (Math.abs(trendAlignment) > 80) {
      confluenceReasoning.push(`Strong trend alignment (${trendAlignment.toFixed(0)}%)`);
    } else if (Math.abs(trendAlignment) > 40) {
      confluenceReasoning.push(`Moderate trend alignment (${trendAlignment.toFixed(0)}%)`);
    }

    if (momentumAlignment > 60) {
      confluenceReasoning.push(`Bullish momentum confluence (${momentumAlignment.toFixed(0)}%)`);
    } else if (momentumAlignment < -60) {
      confluenceReasoning.push(`Bearish momentum confluence (${Math.abs(momentumAlignment).toFixed(0)}%)`);
    }

    if (volumeConfluence > 80) {
      confluenceReasoning.push(`High volume confluence (${volumeConfluence.toFixed(0)}%)`);
    } else if (volumeConfluence < 50) {
      confluenceReasoning.push(`Low volume confluence (${volumeConfluence.toFixed(0)}%)`);
    }

    return {
      confluenceStrength,
      primaryTrend,
      overallConfidence,
      trendAlignment: Math.round(trendAlignment),
      momentumAlignment: Math.round(momentumAlignment),
      volumeConfluence: Math.round(volumeConfluence),
      recommendation,
      riskLevel,
      confluenceReasoning
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private static calculateSMA(marketData: MarketData[], period: number): number {
    if (marketData.length < period) return 0;

    const sum = marketData.slice(-period).reduce((sum, bar) => sum + bar.close, 0);
    return sum / period;
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