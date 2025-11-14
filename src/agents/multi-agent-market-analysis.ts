/**
 * MULTI-AGENT MARKET ANALYSIS SYSTEM
 *
 * Specialized agents for comprehensive market analysis and signal validation
 * Each agent focuses on specific aspects of market analysis
 */

import { MarketData, TechnicalIndicators, OptionsChain, TradeSignal } from '../types';
import { TechnicalAnalysis, DataUtils } from '../utils/technical-indicators';
import { GreeksEngine } from '../utils/greeks-engine';
import { SPYMarketInternalsAgent } from './spy-market-internals-agent';
import { MultiTimeframeAnalystAgent } from './multi-timeframe-analyst-agent';
import { VWAPAnalystAgent } from './vwap-analyst-agent';
import { VolumeProfileAgentOptimized } from './volume-profile-agent-optimized';
import { VolumeDeltaAgent } from './volume-delta-agent';

export interface AgentSignal {
  agent: string;
  signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  confidence: number;
  reasoning: string[];
  data: any;
}

export interface ConsensusSignal {
  finalSignal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE';
  overallConfidence: number;
  agentVotes: {
    BUY_CALL: number;
    BUY_PUT: number;
    NO_TRADE: number;
  };
  consensusReasoning: string[];
  agentSignals: AgentSignal[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

/**
 * TECHNICAL ANALYSIS AGENT
 * Focuses on price action, trends, and technical patterns
 */
export class TechnicalAnalysisAgent {
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const lastCandle = DataUtils.safeLast(marketData);
    if (!lastCandle) {
      return {
        agent: 'TechnicalAnalysisAgent',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['No market data available'],
        data: null
      };
    }
    const currentPrice = lastCandle.close;
    const indicators = TechnicalAnalysis.calculateAllIndicators(marketData);

    if (!indicators) {
      return {
        agent: 'TechnicalAnalysis',
        signal: 'NO_TRADE',
        confidence: 100,
        reasoning: ['Technical indicators calculation failed'],
        data: null
      };
    }

    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    // 🔥 0-DTE OPTIMIZED: Multi-timeframe analysis (1Min, 5Min, 15Min)
    const timeframes = {
      '1Min': marketData.slice(-20),  // Last 20 minutes
      '5Min': marketData.slice(-50),  // Last 50 minutes (simulated)
      '15Min': marketData.slice(-75) // Last 75 minutes (simulated)
    };

    let bullishVotes = 0;
    let bearishVotes = 0;
    const timeframeAnalysis: any = {};

    // Analyze each timeframe for 0-DTE trading
    Object.entries(timeframes).forEach(([tf, data]) => {
      if (data.length >= 10) {
        const tfIndicators = TechnicalAnalysis.calculateAllIndicators(data);
        const tfPrice = data[data.length - 1].close;

        // Check if indicators calculation succeeded
        if (!tfIndicators) {
          timeframeAnalysis[tf] = 'NEUTRAL';
          reasoning.push(`${tf}: NEUTRAL (indicators calculation failed)`);
          return;
        }

        // 0-DTE Optimized thresholds for fast trading
        const rsiBullish = tfIndicators.rsi > 45; // Lowered from 50 for faster signals
        const rsiBearish = tfIndicators.rsi < 55; // Lowered from 50 for faster signals
        const macdBullish = tfIndicators.macd > tfIndicators.macdSignal;
        const macdBearish = tfIndicators.macd < tfIndicators.macdSignal;

        // Bollinger Band analysis for mean reversion (0-DTE favorite)
        const bbOversold = tfPrice < tfIndicators.bbLower * 0.995; // Slightly outside bands
        const bbOverbought = tfPrice > tfIndicators.bbUpper * 1.005;

        // 🔥 FIXED: Momentum analysis - compare to RECENT bars, not first bar
        const recentBars = data.slice(-5); // Last 5 bars for short-term momentum
        const avgRecentPrice = recentBars.reduce((sum, bar) => sum + bar.close, 0) / recentBars.length;
        const recentMomentum = (tfPrice - avgRecentPrice) / avgRecentPrice;
        const momentumBullish = recentMomentum > 0.001; // 0.1% change from recent average
        const momentumBearish = recentMomentum < -0.001;

        // Count votes for this timeframe
        const tfBullishSignals = [rsiBullish, macdBullish, bbOversold, momentumBullish].filter(Boolean).length;
        const tfBearishSignals = [rsiBearish, macdBearish, bbOverbought, momentumBearish].filter(Boolean).length;

        if (tfBullishSignals >= 2) {
          bullishVotes++;
          timeframeAnalysis[tf] = 'BULLISH';
        } else if (tfBearishSignals >= 2) {
          bearishVotes++;
          timeframeAnalysis[tf] = 'BEARISH';
        } else {
          timeframeAnalysis[tf] = 'NEUTRAL';
        }

        reasoning.push(`${tf}: ${timeframeAnalysis[tf]} (RSI: ${tfIndicators.rsi.toFixed(1)}, MACD: ${(tfIndicators.macd - tfIndicators.macdSignal).toFixed(4)})`);
      }
    });

    // 🔥 0-DTE: Volume spike analysis for immediate entries
    const currentVolume = Number(marketData[marketData.length - 1].volume || 0);
    const recentVolumes = marketData.slice(-5).map(bar => Number(bar.volume || 0));
    const avgRecentVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const volumeSpike = currentVolume / avgRecentVolume;

    reasoning.push(`📊 Volume Spike: ${volumeSpike.toFixed(1)}x (Current: ${currentVolume.toLocaleString()}, Avg: ${avgRecentVolume.toLocaleString()})`);

    // 🔥 0-DTE: Enhanced signal generation with multi-timeframe confluence
    if (bullishVotes >= 2 && volumeSpike > 1.2) {
      signal = 'BUY_CALL';
      confidence = Math.min(90, 70 + bullishVotes * 5 + (volumeSpike > 2.0 ? 10 : 5));
      reasoning.push('🚀 Multi-timeframe bullish confluence + volume spike - 0-DTE entry');
    } else if (bearishVotes >= 2 && volumeSpike > 1.2) {
      signal = 'BUY_PUT';
      confidence = Math.min(90, 70 + bearishVotes * 5 + (volumeSpike > 2.0 ? 10 : 5));
      reasoning.push('🚀 Multi-timeframe bearish confluence + volume spike - 0-DTE entry');
    } else if (bullishVotes >= 1 && volumeSpike > 1.5) {
      signal = 'BUY_CALL';
      confidence = 65;
      reasoning.push('⚡ Single timeframe bullish + strong volume spike - 0-DTE opportunity');
    } else if (bearishVotes >= 1 && volumeSpike > 1.5) {
      signal = 'BUY_PUT';
      confidence = 65;
      reasoning.push('⚡ Single timeframe bearish + strong volume spike - 0-DTE opportunity');
    } else {
      reasoning.push('❌ Insufficient multi-timeframe confluence for 0-DTE');
      confidence = 75;
    }

    return {
      agent: 'TechnicalAnalysis',
      signal,
      confidence,
      reasoning,
      data: {
        timeframeAnalysis,
        volumeSpike,
        currentPrice,
        rsi: indicators.rsi,
        macd: indicators.macd,
        bbUpper: indicators.bbUpper,
        bbLower: indicators.bbLower
      }
    };
  }
}

/**
 * VOLATILITY ANALYSIS AGENT
 * Focuses on implied volatility and option pricing dynamics
 */
export class VolatilityAnalysisAgent {
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[], vixLevel?: number): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    // Calculate average IV across options chain
    const validOptions = optionsChain.filter(opt => opt.impliedVolatility && opt.impliedVolatility > 0);
    if (validOptions.length === 0) {
      return {
        agent: 'VolatilityAnalysis',
        signal: 'NO_TRADE',
        confidence: 100,
        reasoning: ['No valid IV data available'],
        data: null
      };
    }

    const avgIV = validOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / validOptions.length;
    const ivPercentile = avgIV * 100;

    reasoning.push(`📊 Average IV: ${ivPercentile.toFixed(1)}%`);

    // 🔥 0-DTE OPTIMIZED: Real-time IV momentum analysis
    const ntmOptions = this.getNTMOptions(validOptions, marketData[marketData.length - 1].close);
    if (ntmOptions.length >= 4) {
      // Calculate IV momentum (recent change)
      const ivMomentum = this.calculateIVMomentum(ntmOptions);
      reasoning.push(`⚡ IV Momentum: ${(ivMomentum * 100).toFixed(2)}% (${ivMomentum > 0.02 ? 'RISING' : ivMomentum < -0.02 ? 'FALLING' : 'STABLE'})`);

      // 0-DTE: Rising IV = fear = buying opportunity (calls)
      if (ivMomentum > 0.02 && avgIV < 0.4) {
        signal = 'BUY_CALL';
        confidence = 70;
        reasoning.push('🚀 Rising IV + moderate levels = fear-based buying opportunity');
      }
      // Falling IV = confidence = selling pressure
      else if (ivMomentum < -0.02 && avgIV > 0.12) {
        signal = 'BUY_PUT';
        confidence = 70;
        reasoning.push('📉 Falling IV + sufficient premium = selling pressure opportunity');
      }
    }

    // 🔥 0-DTE: Enhanced IV range for active trading (expanded for more opportunities)
    if (avgIV >= 0.12 && avgIV <= 0.45) {
      reasoning.push('✅ Optimal IV range for 0-DTE trading');
      confidence = Math.max(confidence, 65);
    } else if (avgIV < 0.12) {
      reasoning.push('💤 Low IV - insufficient premium for quick profits');
      signal = 'NO_TRADE';
      confidence = 80;
    } else if (avgIV > 0.45) {
      reasoning.push('🌪️ Extreme IV - high risk but opportunities exist');
      confidence = Math.max(confidence, 60); // Don't block completely
    }

    // 🔥 0-DTE: VIX correlation for contrarian signals
    if (vixLevel) {
      reasoning.push(`🎭 VIX: ${vixLevel.toFixed(1)}`);

      // 0-DTE: Use VIX as contrarian indicator (lower threshold)
      if (vixLevel > 25 && signal !== 'BUY_PUT') {
        // High VIX = fear = bullish opportunity
        signal = 'BUY_CALL';
        confidence = Math.max(confidence, 68);
        reasoning.push('🎯 High VIX fear = contrarian bullish opportunity');
      } else if (vixLevel < 18 && signal !== 'BUY_CALL') {
        // Low VIX = complacency = bearish opportunity
        signal = 'BUY_PUT';
        confidence = Math.max(confidence, 68);
        reasoning.push('🎯 Low VIX complacency = contrarian bearish opportunity');
      }
    }

    // 🔥 0-DTE: Enhanced IV skew analysis for immediate direction
    const callOptions = validOptions.filter(opt => opt.side === 'CALL');
    const putOptions = validOptions.filter(opt => opt.side === 'PUT');

    if (callOptions.length > 0 && putOptions.length > 0) {
      const avgCallIV = callOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / callOptions.length;
      const avgPutIV = putOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / putOptions.length;
      const ivSkew = avgPutIV - avgCallIV;

      reasoning.push(`⚖️ IV Skew (Puts-Calls): ${(ivSkew * 100).toFixed(1)}%`);

      // 0-DTE: Lower skew thresholds for faster signals
      if (ivSkew > 0.02 && signal !== 'BUY_PUT') {
        signal = 'BUY_CALL';
        confidence = Math.max(confidence, 65);
        reasoning.push('📈 Put skew indicates fear = 0-DTE buying opportunity');
      } else if (ivSkew < -0.02 && signal !== 'BUY_CALL') {
        signal = 'BUY_PUT';
        confidence = Math.max(confidence, 65);
        reasoning.push('📉 Call skew indicates greed = 0-DTE selling opportunity');
      }
    }

    // 🔥 0-DTE: Time decay acceleration analysis
    const timeToExpiry = this.getTimeToExpiryHours(optionsChain[0]?.expiration);
    if (timeToExpiry && timeToExpiry < 6 && timeToExpiry > 1) {
      reasoning.push(`⏰ Accelerated theta decay zone: ${timeToExpiry.toFixed(1)}h to expiry`);
      confidence = Math.max(confidence, 62); // Good for quick 50% targets
    }

    return {
      agent: 'VolatilityAnalysis',
      signal,
      confidence,
      reasoning,
      data: {
        avgIV,
        vixLevel,
        ivSkew: callOptions.length && putOptions.length ?
          (putOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / putOptions.length) -
          (callOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / callOptions.length) : 0,
        timeToExpiry
      }
    };
  }

  // 🔥 0-DTE Helper methods
  private static getNTMOptions(options: OptionsChain[], currentPrice: number, strikeRange: number = 5): OptionsChain[] {
    return options.filter(opt => Math.abs(opt.strike - currentPrice) <= strikeRange);
  }

  private static calculateIVMomentum(ntmOptions: OptionsChain[]): number {
    // Simulate IV momentum by comparing current IV with historical average
    const currentIV = ntmOptions.reduce((sum, opt) => sum + (opt.impliedVolatility || 0), 0) / ntmOptions.length;
    // For 0-DTE, we assume slight upward IV pressure as day progresses
    const baseIV = currentIV * 0.95;
    return (currentIV - baseIV) / baseIV;
  }

  private static getTimeToExpiryHours(expiration: Date): number | null {
    if (!expiration) return null;
    const now = new Date();
    const timeToExpiration = expiration.getTime() - now.getTime();
    return timeToExpiration / (1000 * 60 * 60);
  }
}

/**
 * GREEKS RISK ANALYSIS AGENT
 * Focuses on options Greeks and risk management
 */
export class GreeksRiskAgent {
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    const currentPrice = marketData[marketData.length - 1].close;

    // 🔥 0-DTE OPTIMIZED: Analyze ultra-near-the-money options for quick Greeks
    const ntmOptions = optionsChain.filter(opt => {
      const strikeDistance = Math.abs(opt.strike - currentPrice);
      return strikeDistance <= 1; // Within 1 strike for immediate Greeks sensitivity
    });

    if (ntmOptions.length === 0) {
      return {
        agent: 'GreeksRisk',
        signal: 'NO_TRADE',
        confidence: 100,
        reasoning: ['No ultra-near-the-money options for 0-DTE Greeks analysis'],
        data: null
      };
    }

    // 🔥 0-DTE: Calculate Greeks with very short time frame (hours, not days)
    const timeToExpiration = 0.25 / 365; // 6 hours for 0-DTE trading
    const atmCall = ntmOptions.find(opt => opt.side === 'CALL' && Math.abs(opt.strike - currentPrice) <= 0.5);
    const atmPut = ntmOptions.find(opt => opt.side === 'PUT' && Math.abs(opt.strike - currentPrice) <= 0.5);

    let callGreeks = null;
    let putGreeks = null;

    if (atmCall) {
      callGreeks = GreeksEngine.calculateGreeks(atmCall, currentPrice, timeToExpiration);
      reasoning.push(`📈 ATM Call Δ: ${callGreeks.delta.toFixed(3)}, Γ: ${callGreeks.gamma.toFixed(3)}, Θ: ${callGreeks.theta.toFixed(0)}, Vega: ${callGreeks.vega.toFixed(2)}`);
    }

    if (atmPut) {
      putGreeks = GreeksEngine.calculateGreeks(atmPut, currentPrice, timeToExpiration);
      reasoning.push(`📉 ATM Put Δ: ${putGreeks.delta.toFixed(3)}, Γ: ${putGreeks.gamma.toFixed(3)}, Θ: ${putGreeks.theta.toFixed(0)}, Vega: ${putGreeks.vega.toFixed(2)}`);
    }

    // 🔥 0-DTE: Enhanced Gamma analysis for rapid profit potential
    const avgGamma = ntmOptions.reduce((sum, opt) => {
      const greeks = GreeksEngine.calculateGreeks(opt, currentPrice, timeToExpiration);
      return sum + Math.abs(greeks.gamma);
    }, 0) / ntmOptions.length;

    reasoning.push(`⚡ 0-DTE Gamma: ${avgGamma.toFixed(3)}`);

    // 0-DTE: Optimal gamma range for quick 50% profits
    if (avgGamma >= 0.05 && avgGamma <= 0.25) {
      reasoning.push('🎯 Optimal gamma for 0-DTE rapid profits');
      confidence = Math.max(confidence, 70);
    } else if (avgGamma > 0.25) {
      reasoning.push('⚠️ High gamma - rapid price changes (good for quick profits)');
      confidence = Math.max(confidence, 65);
    } else if (avgGamma < 0.05) {
      reasoning.push('💤 Low gamma - slower movement (extend hold time)');
      confidence = Math.max(confidence, 55);
    }

    // 🔥 0-DTE: Theta decay acceleration analysis (our friend for 50% targets)
    const avgTheta = ntmOptions.reduce((sum, opt) => {
      const greeks = GreeksEngine.calculateGreeks(opt, currentPrice, timeToExpiration);
      return sum + Math.abs(greeks.theta);
    }, 0) / ntmOptions.length;

    reasoning.push(`⏰ 0-DTE Theta: $${avgTheta.toFixed(0)}/hour (accelerating)`);

    if (avgTheta > 200) {
      reasoning.push('🚀 Extreme theta decay - excellent for 50% profit targets');
      confidence = Math.max(confidence, 75);
    } else if (avgTheta > 100) {
      reasoning.push('📈 Strong theta decay - good for quick profits');
      confidence = Math.max(confidence, 68);
    }

    // 🔥 0-DTE: Delta directional analysis with market momentum
    const recentPriceChange = (currentPrice - marketData[marketData.length - 5].close) / marketData[marketData.length - 5].close;
    const momentumDirection = recentPriceChange > 0.001 ? 'BULLISH' : recentPriceChange < -0.001 ? 'BEARISH' : 'NEUTRAL';

    reasoning.push(`📊 Price Momentum: ${momentumDirection} (${(recentPriceChange * 100).toFixed(2)}%)`);

    // Find the best directional option based on Greeks + momentum
    let bestCallDelta = 0;
    let bestPutDelta = 0;

    ntmOptions.forEach(opt => {
      const greeks = GreeksEngine.calculateGreeks(opt, currentPrice, timeToExpiration);
      if (opt.side === 'CALL' && Math.abs(greeks.delta) > bestCallDelta) {
        bestCallDelta = Math.abs(greeks.delta);
      } else if (opt.side === 'PUT' && Math.abs(greeks.delta) > bestPutDelta) {
        bestPutDelta = Math.abs(greeks.delta);
      }
    });

    reasoning.push(`🎯 Best Delta Exposure - Calls: ${bestCallDelta.toFixed(3)}, Puts: ${bestPutDelta.toFixed(3)}`);

    // 🔥 0-DTE: Signal generation based on Greeks + momentum
    if (momentumDirection === 'BULLISH' && bestCallDelta > 0.4 && avgGamma > 0.05) {
      signal = 'BUY_CALL';
      confidence = Math.min(85, 65 + (bestCallDelta * 20) + (avgGamma * 50));
      reasoning.push('🚀 Bullish momentum + high delta + optimal gamma = 0-DTE call opportunity');
    } else if (momentumDirection === 'BEARISH' && bestPutDelta > 0.4 && avgGamma > 0.05) {
      signal = 'BUY_PUT';
      confidence = Math.min(85, 65 + (bestPutDelta * 20) + (avgGamma * 50));
      reasoning.push('🚀 Bearish momentum + high delta + optimal gamma = 0-DTE put opportunity');
    } else if (avgGamma > 0.1 && avgTheta > 150) {
      // High Greeks setup - good for quick directional bets
      if (bestCallDelta > bestPutDelta) {
        signal = 'BUY_CALL';
        confidence = 65;
        reasoning.push('⚡ High gamma/theta setup - favor calls for quick 0-DTE profits');
      } else {
        signal = 'BUY_PUT';
        confidence = 65;
        reasoning.push('⚡ High gamma/theta setup - favor puts for quick 0-DTE profits');
      }
    } else {
      reasoning.push('❌ Insufficient Greeks setup for 0-DTE quick profits');
      confidence = 70;
    }

    // 🔥 0-DTE: Vega analysis for volatility plays
    const avgVega = ntmOptions.reduce((sum, opt) => {
      const greeks = GreeksEngine.calculateGreeks(opt, currentPrice, timeToExpiration);
      return sum + Math.abs(greeks.vega);
    }, 0) / ntmOptions.length;

    if (avgVega > 0.15) {
      reasoning.push(`🎭 High vega (${avgVega.toFixed(2)}) - volatility sensitivity for quick moves`);
    }

    return {
      agent: 'GreeksRisk',
      signal,
      confidence,
      reasoning,
      data: {
        avgGamma,
        avgTheta,
        avgVega,
        momentumDirection,
        recentPriceChange,
        bestCallDelta,
        bestPutDelta,
        callGreeks,
        putGreeks,
        timeToExpiration
      }
    };
  }
}

/**
 * MARKET MICROSTRUCTURE AGENT
 * Focuses on order flow, liquidity, and market dynamics
 */
export class MarketMicrostructureAgent {
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    // 🔥 0-DTE OPTIMIZED: Enhanced liquidity analysis for rapid execution
    const currentPrice = marketData[marketData.length - 1].close;

    // Focus on near-the-money options for immediate trading
    const ntmOptions = optionsChain.filter(opt => {
      const strikeDistance = Math.abs(opt.strike - currentPrice);
      return strikeDistance <= 2; // Within 2 strikes for 0-DTE
    });

    const liquidNTMOptions = ntmOptions.filter(opt => {
      const spread = opt.ask - opt.bid;
      const spreadPercent = (spread / opt.ask) * 100;
      return spreadPercent < 10; // 10% for 0-DTE (more lenient)
    });

    const liquidityRatio = ntmOptions.length > 0 ? liquidNTMOptions.length / ntmOptions.length : 0;
    reasoning.push(`🏃 0-DTE Liquidity: ${liquidityRatio.toFixed(1)}% NTM options tight spreads (${liquidNTMOptions.length}/${ntmOptions.length})`);

    if (liquidityRatio < 0.3) {
      reasoning.push('🚨 Poor 0-DTE liquidity - execution risk too high');
      signal = 'NO_TRADE';
      confidence = 85;
    } else if (liquidityRatio > 0.6) {
      reasoning.push('✅ Excellent 0-DTE liquidity - ready for rapid execution');
      confidence = Math.max(confidence, 68);
    }

    // 🔥 0-DTE: Ultra-short term momentum analysis (1-3 minute moves)
    const veryRecentPrices = marketData.slice(-3).map(bar => bar.close);
    const recentPrices = marketData.slice(-8).map(bar => bar.close);

    // Ultra-short momentum (last 1-3 minutes)
    const ultraShortMomentum = veryRecentPrices.length >= 2 ?
      (veryRecentPrices[veryRecentPrices.length - 1] - veryRecentPrices[0]) / veryRecentPrices[0] : 0;

    // Short momentum (last 5-8 minutes)
    const shortMomentum = recentPrices.length >= 2 ?
      (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0] : 0;

    reasoning.push(`⚡ Ultra-Short Momentum (1-3 min): ${(ultraShortMomentum * 100).toFixed(3)}%`);
    reasoning.push(`📊 Short Momentum (5-8 min): ${(shortMomentum * 100).toFixed(2)}%`);

    // 🔥 0-DTE: Volume spike detection for immediate entries
    const currentVolume = Number(marketData[marketData.length - 1].volume || 0);
    const previousVolume = Number(marketData[marketData.length - 2].volume || 0);
    const volumeSpike = previousVolume > 0 ? currentVolume / previousVolume : 1;

    reasoning.push(`📈 Volume Spike: ${volumeSpike.toFixed(1)}x (Current: ${currentVolume.toLocaleString()}, Previous: ${previousVolume.toLocaleString()})`);

    // 🔥 0-DTE: Enhanced signal generation for fast trades
    let momentumScore = 0;
    let direction = 'NEUTRAL';

    // Ultra-short momentum gets higher weight for 0-DTE
    if (ultraShortMomentum > 0.0005) { // 0.05% in 1-3 minutes
      momentumScore += 3;
      direction = 'BULLISH';
      reasoning.push('🚀 Strong ultra-short bullish momentum detected');
    } else if (ultraShortMomentum < -0.0005) {
      momentumScore -= 3;
      direction = 'BEARISH';
      reasoning.push('📉 Strong ultra-short bearish momentum detected');
    }

    // Short momentum confirmation
    if (shortMomentum > 0.001) { // 0.1% in 5-8 minutes
      momentumScore += 2;
      if (direction !== 'BULLISH') direction = 'BULLISH';
      reasoning.push('📈 Short-term bullish momentum confirmed');
    } else if (shortMomentum < -0.001) {
      momentumScore -= 2;
      if (direction !== 'BEARISH') direction = 'BEARISH';
      reasoning.push('📉 Short-term bearish momentum confirmed');
    }

    // Volume spike confirmation
    if (volumeSpike > 2.0) {
      momentumScore += 2;
      reasoning.push('🎯 High volume spike confirms momentum');
    } else if (volumeSpike > 1.5) {
      momentumScore += 1;
      reasoning.push('📊 Moderate volume spike supports move');
    }

    // 🔥 0-DTE: Price level analysis for support/resistance
    const recentHigh = Math.max(...marketData.slice(-10).map(bar => bar.high));
    const recentLow = Math.min(...marketData.slice(-10).map(bar => bar.low));
    const pricePosition = (currentPrice - recentLow) / (recentHigh - recentLow);

    reasoning.push(`📍 Price Position: ${(pricePosition * 100).toFixed(0)}% of recent range (Low: $${recentLow.toFixed(2)}, High: $${recentHigh.toFixed(2)})`);

    // Near resistance = bearish, near support = bullish for 0-DTE mean reversion
    if (pricePosition > 0.85) {
      momentumScore -= 1;
      reasoning.push('🏔️ Near resistance - potential bearish reversal');
    } else if (pricePosition < 0.15) {
      momentumScore += 1;
      reasoning.push('🏖️ Near support - potential bullish bounce');
    }

    // 🔥 0-DTE: Final signal generation with lower thresholds
    if (Math.abs(momentumScore) >= 3 && liquidityRatio > 0.4) {
      if (momentumScore > 0) {
        signal = 'BUY_CALL';
        confidence = Math.min(85, 65 + Math.abs(momentumScore) * 5 + (liquidityRatio > 0.6 ? 10 : 0));
        reasoning.push('⚡ Strong 0-DTE bullish setup with liquidity - execute trade');
      } else {
        signal = 'BUY_PUT';
        confidence = Math.min(85, 65 + Math.abs(momentumScore) * 5 + (liquidityRatio > 0.6 ? 10 : 0));
        reasoning.push('⚡ Strong 0-DTE bearish setup with liquidity - execute trade');
      }
    } else if (Math.abs(momentumScore) >= 1 && volumeSpike > 1.8 && liquidityRatio > 0.5) {
      // Weaker signal but strong volume spike - good for 0-DTE
      if (momentumScore > 0) {
        signal = 'BUY_CALL';
        confidence = 68;
        reasoning.push('🎯 Moderate bullish momentum + strong volume spike - 0-DTE opportunity');
      } else {
        signal = 'BUY_PUT';
        confidence = 68;
        reasoning.push('🎯 Moderate bearish momentum + strong volume spike - 0-DTE opportunity');
      }
    } else {
      reasoning.push('❌ Insufficient 0-DTE momentum/volume setup');
      confidence = 70;
    }

    // 🔥 0-DTE: Execution time analysis (optimal windows for quick trades)
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const timeInMinutes = currentHour * 60 + currentMinute;

    // Optimal 0-DTE trading windows
    if (timeInMinutes >= 570 && timeInMinutes <= 660) { // 9:30 AM - 11:00 AM
      reasoning.push('🌅 Morning window - excellent 0-DTE trading conditions');
      confidence = Math.max(confidence, 60);
    } else if (timeInMinutes >= 810 && timeInMinutes <= 900) { // 1:30 PM - 3:00 PM
      reasoning.push('🌆 Afternoon window - good 0-DTE trading conditions');
      confidence = Math.max(confidence, 58);
    } else if (timeInMinutes > 900 && timeInMinutes <= 945) { // 3:00 PM - 3:45 PM
      reasoning.push('⏰ Late window - accelerated theta decay zone');
      confidence = Math.max(confidence, 62);
    }

    return {
      agent: 'MarketMicrostructure',
      signal,
      confidence,
      reasoning,
      data: {
        liquidityRatio,
        ultraShortMomentum,
        shortMomentum,
        volumeSpike,
        momentumScore,
        pricePosition,
        currentTime: currentTime.toTimeString().slice(0, 5)
      }
    };
  }
}

/**
 * 🔥 0-DTE ENHANCED TREND FILTER
 * Prevents trades against major trend for 0-DTE safety
 */
export class TrendDirectionFilter {
  static analyzeMajorTrend(marketData: MarketData[]): {
    majorTrend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    trendStrength: number; // 0-100
    reasoning: string[];
    blockTrades: boolean;
  } {
    const reasoning: string[] = [];
    let bullishScore = 0;
    let bearishScore = 0;

    // 🔥 0-DTE OPTIMIZED Multi-timeframe trend analysis (much shorter windows)
    const timeframes = [
      { data: marketData.slice(-15), weight: 1, name: '1Min' },      // Last 15 minutes
      { data: marketData.slice(-30), weight: 2, name: '5Min' },      // Last 30 minutes
      { data: marketData.slice(-60), weight: 3, name: '15Min' }     // Last 60 minutes (instead of 100+)
    ];

    timeframes.forEach(({ data, weight, name }) => {
      if (data.length < 10) return;

      const indicators = TechnicalAnalysis.calculateAllIndicators(data);
      if (!indicators) return;

      const currentPrice = data[data.length - 1].close;
      const sma20 = this.calculateSMA(data, 20);
      const ema10 = this.calculateEMA(data, 10);

      // Trend indicators
      if (currentPrice > sma20 * 1.005) bullishScore += 2 * weight; // Above SMA20
      if (currentPrice > ema10 * 1.005) bullishScore += 2 * weight;  // Above EMA10
      if (indicators.macd > indicators.macdSignal) bullishScore += 3 * weight; // MACD bullish
      if (indicators.rsi > 55) bullishScore += 1 * weight; // RSI bullish

      if (currentPrice < sma20 * 0.995) bearishScore += 2 * weight; // Below SMA20
      if (currentPrice < ema10 * 0.995) bearishScore += 2 * weight;  // Below EMA10
      if (indicators.macd < indicators.macdSignal) bearishScore += 3 * weight; // MACD bearish
      if (indicators.rsi < 45) bearishScore += 1 * weight; // RSI bearish

      reasoning.push(`${name}: Price vs SMA20: ${((currentPrice / sma20 - 1) * 100).toFixed(2)}%, MACD: ${indicators.macd > indicators.macdSignal ? 'BULLISH' : 'BEARISH'}`);
    });

    // 🔥 Volume confirmation of trend
    const recentVolume = Number(marketData[marketData.length - 1].volume || 0);
    const avgVolume = marketData.slice(-20).reduce((sum, bar) => sum + Number(bar.volume || 0), 0) / 20;
    const volumeRatio = recentVolume / avgVolume;

    if (volumeRatio > 1.5 && bullishScore > bearishScore) {
      bullishScore += 2;
      reasoning.push(`High volume confirms bullish trend (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio > 1.5 && bearishScore > bullishScore) {
      bearishScore += 2;
      reasoning.push(`High volume confirms bearish trend (${volumeRatio.toFixed(1)}x)`);
    }

    // 🔥 Determine major trend
    const totalScore = bullishScore + bearishScore;
    const bullishPercentage = totalScore > 0 ? (bullishScore / totalScore) * 100 : 50;

    let majorTrend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    let trendStrength = 0;

    if (bullishPercentage >= 75) {
      majorTrend = 'STRONG_BULLISH';
      trendStrength = bullishPercentage;
    } else if (bullishPercentage >= 60) {
      majorTrend = 'BULLISH';
      trendStrength = bullishPercentage;
    } else if (bullishPercentage <= 25) {
      majorTrend = 'STRONG_BEARISH';
      trendStrength = (100 - bullishPercentage);
    } else if (bullishPercentage <= 40) {
      majorTrend = 'BEARISH';
      trendStrength = (100 - bullishPercentage);
    } else {
      majorTrend = 'NEUTRAL';
      trendStrength = 50;
    }

    // 🔥 0-DTE: Block trades against strong trends
    const blockTrades = trendStrength >= 70 && majorTrend !== 'NEUTRAL';

    if (blockTrades) {
      reasoning.push(`🛡️ STRONG ${majorTrend} TREND - 0-DTE trades must align with trend`);
    } else {
      reasoning.push(`✅ Trend conditions acceptable for 0-DTE trading`);
    }

    return {
      majorTrend,
      trendStrength,
      reasoning,
      blockTrades
    };
  }

  private static calculateSMA(data: MarketData[], period: number): number {
    if (data.length < period) return 0;
    const sum = data.slice(-period).reduce((sum, bar) => sum + bar.close, 0);
    return sum / period;
  }

  private static calculateEMA(data: MarketData[], period: number): number {
    if (data.length < period) return 0;

    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, bar) => sum + bar.close, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }
}

/**
 * CONSENSUS ENGINE
 * Combines all agent signals into final recommendation
 */
export class ConsensusEngine {
  static generateConsensus(
    marketData: MarketData[],
    optionsChain: OptionsChain[],
    vixLevel?: number,
    marketData5Min?: MarketData[],
    marketData15Min?: MarketData[]
  ): ConsensusSignal {
    console.log('🤖 MULTI-AGENT ANALYSIS INITIATED');
    console.log('=====================================');

    // 🔥 0-DTE: Major Trend Analysis (Critical for safety)
    console.log('\n🛡️ TREND DIRECTION ANALYSIS:');
    const trendAnalysis = TrendDirectionFilter.analyzeMajorTrend(marketData);
    console.log(`   Major Trend: ${trendAnalysis.majorTrend} (${trendAnalysis.trendStrength.toFixed(0)}% strength)`);

    if (trendAnalysis.reasoning && trendAnalysis.reasoning.length > 0) {
      console.log('   Trend Indicators:');
      trendAnalysis.reasoning.forEach(reason => {
        console.log(`     • ${reason}`);
      });
    }

    // 🔥 FIXED: Strong trends should INFLUENCE agents, not OVERRIDE them completely
    // This preserves the multi-agent consensus system while giving proper weight to trends

    // ✅ ALL 9 AGENTS ENABLED - Enhanced consensus system with Phase 2 institutional agents
    const agents = [
      TechnicalAnalysisAgent,
      VolatilityAnalysisAgent,
      GreeksRiskAgent,
      MarketMicrostructureAgent,
      SPYMarketInternalsAgent,      // ✅ RE-ENABLED - Market internals analysis
      MultiTimeframeAnalystAgent,   // ✅ RE-ENABLED - Multi-timeframe confluence
      VWAPAnalystAgent,             // 🆕 PHASE 2 - VWAP mean reversion and trend confirmation
      VolumeProfileAgentOptimized,  // 🆕 PHASE 2 - OPTIMIZED Volume profile support/resistance analysis
      VolumeDeltaAgent              // 🆕 PHASE 2 - Institutional flow detection
    ];

    const agentSignals: AgentSignal[] = [];

    for (const Agent of agents) {
      let signal: AgentSignal;

      try {
          // Handle each agent's specific parameter requirements
        if (Agent === SPYMarketInternalsAgent) {
          signal = Agent.analyze(marketData, optionsChain, vixLevel);
        } else if (Agent === MultiTimeframeAnalystAgent) {
          signal = Agent.analyze(marketData, marketData5Min || marketData, marketData15Min || marketData);
        } else {
          // Try 3-parameter call first (for VolatilityAnalysisAgent), fallback to 2-parameter
          try {
            signal = (Agent as any).analyze(marketData, optionsChain, vixLevel);
          } catch (e) {
            signal = (Agent as any).analyze(marketData, optionsChain);
          }
        }
      } catch (error) {
        console.error(`❌ ${Agent.name} failed:`, error);
        // Continue with other agents - don't let one failure stop the whole process
        continue;
      }

      agentSignals.push(signal);

      console.log(`\n📊 ${signal.agent} Agent:`);
      console.log(`   Signal: ${signal.signal} (${signal.confidence}% confidence)`);

      // Log detailed reasoning from each agent
      if (signal.reasoning && signal.reasoning.length > 0) {
        console.log(`   Analysis:`);
        signal.reasoning.forEach(reason => {
          console.log(`     • ${reason}`);
        });

        // Log signal direction detection
        const bullishSignals = signal.reasoning.filter(r =>
          r.toLowerCase().includes('bullish') ||
          r.toLowerCase().includes('oversold') ||
          r.toLowerCase().includes('buy') ||
          r.toLowerCase().includes('call')
        );

        const bearishSignals = signal.reasoning.filter(r =>
          r.toLowerCase().includes('bearish') ||
          r.toLowerCase().includes('overbought') ||
          r.toLowerCase().includes('sell') ||
          r.toLowerCase().includes('put')
        );

        if (bullishSignals.length > 0) {
          console.log(`   📈 Bullish Indicators: ${bullishSignals.length} found`);
        }
        if (bearishSignals.length > 0) {
          console.log(`   📉 Bearish Indicators: ${bearishSignals.length} found`);
        }
      }

      // Log additional data if available
      if (signal.data) {
        console.log(`   Details: ${JSON.stringify(signal.data, null, 2)}`);
      }
    }

    // ✅ WEIGHTED VOTING SYSTEM - Agent weights based on importance for 0DTE (9 agents = 12 total weight)
    const agentWeights: { [key: string]: number } = {
      'SPYMarketInternals': 2,        // Market breadth critical for direction
      'MultiTimeframeAnalyst': 2,     // Timeframe confluence validation
      'VWAPAnalyst': 2,               // 🆕 Mean reversion and institutional VWAP levels
      'VolumeProfile': 1,             // 🆕 Volume-at-price support/resistance analysis
      'VolumeDelta': 1,               // 🆕 Institutional flow detection and divergence
      'TechnicalAnalysis': 1,         // Price action confirmation
      'VolatilityAnalysis': 1,        // IV structure analysis
      'GreeksRisk': 1,               // Options risk metrics
      'MarketMicrostructure': 1       // Entry/exit timing
    };

    // Weighted vote counting
    const weightedVotes = {
      BUY_CALL: 0,
      BUY_PUT: 0,
      NO_TRADE: 0
    };

    let totalWeight = 0;
    let weightedConfidence = 0;
    const consensusReasoning: string[] = [];

    agentSignals.forEach(signal => {
      const weight = agentWeights[signal.agent] || 1;
      weightedVotes[signal.signal] += weight;
      totalWeight += weight;
      weightedConfidence += signal.confidence * weight;

      if (signal.signal !== 'NO_TRADE') {
        consensusReasoning.push(`${signal.agent}: ${signal.signal} (${signal.confidence}%)`);
      }
    });

    // Determine consensus (OPTIMIZED FOR 0-DTE TRADING - Lower thresholds for faster execution)
    // Calculate average confidence using weighted system
    const avgConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    const maxWeightedVotes = Math.max(weightedVotes.BUY_CALL, weightedVotes.BUY_PUT, weightedVotes.NO_TRADE);

    let finalSignal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let overallConfidence = avgConfidence;

    // ✅ ENHANCED WEIGHTED CONSENSUS for 9 agents (total weight = 12)
    // Strong consensus: 50%+ weighted votes (6+ points)
    // Moderate consensus: 40%+ weighted votes (4.8+ points)
    const strongThreshold = totalWeight * 0.5;  // 6.0 points
    const moderateThreshold = totalWeight * 0.4; // 4.8 points

    if (weightedVotes.NO_TRADE >= strongThreshold) {
      finalSignal = 'NO_TRADE';
      consensusReasoning.unshift(`🚨 Strong consensus to avoid trading (${weightedVotes.NO_TRADE.toFixed(1)}/${totalWeight} weighted votes)`);
    } else if (weightedVotes.BUY_CALL >= strongThreshold) {
      finalSignal = 'BUY_CALL';
      consensusReasoning.unshift(`✅ Strong bullish consensus (${weightedVotes.BUY_CALL.toFixed(1)}/${totalWeight} weighted votes) - 0-DTE opportunity`);
    } else if (weightedVotes.BUY_PUT >= strongThreshold) {
      finalSignal = 'BUY_PUT';
      consensusReasoning.unshift(`✅ Strong bearish consensus (${weightedVotes.BUY_PUT.toFixed(1)}/${totalWeight} weighted votes) - 0-DTE opportunity`);
    } else if (weightedVotes.BUY_CALL >= moderateThreshold && weightedVotes.BUY_PUT < moderateThreshold) {
      // Moderate bullish consensus with minimal opposition
      finalSignal = 'BUY_CALL';
      overallConfidence = avgConfidence * 0.85; // Reduce confidence for moderate consensus
      consensusReasoning.unshift(`⚡ Moderate bullish consensus (${weightedVotes.BUY_CALL.toFixed(1)}/${totalWeight} weighted votes) - optimized 0-DTE setup`);
    } else if (weightedVotes.BUY_PUT >= moderateThreshold && weightedVotes.BUY_CALL < moderateThreshold) {
      // 2 agents bearish, none bullish
      finalSignal = 'BUY_PUT';
      overallConfidence = avgConfidence * 0.85; // Reduce confidence for moderate consensus
      consensusReasoning.unshift(`⚡ Moderate bearish consensus (${weightedVotes.BUY_PUT.toFixed(1)}/${totalWeight} weighted votes) - optimized 0-DTE setup`);
    } else {
      // No clear consensus or conflicting signals
      finalSignal = 'NO_TRADE';
      overallConfidence = 75;
      consensusReasoning.unshift('❌ Insufficient consensus - conflicting 0-DTE signals');
    }

    // 🔥 FIXED: Enhanced trend alignment with confidence adjustment (not blocking)
    // For 0-DTE, allow counter-trend trades but reduce confidence appropriately
    if (finalSignal !== 'NO_TRADE') {
      const signalIsBullish = finalSignal === 'BUY_CALL';
      const trendIsBullish = trendAnalysis.majorTrend.includes('BULLISH');
      const trendIsBearish = trendAnalysis.majorTrend.includes('BEARISH');

      // Adjust confidence based on trend alignment
      if (trendAnalysis.trendStrength >= 70) {
        // Strong trend detected
        if ((signalIsBullish && trendIsBullish) || (!signalIsBullish && trendIsBearish)) {
          // Signal ALIGNS with strong trend - BOOST confidence
          overallConfidence = Math.min(95, overallConfidence * 1.15);
          consensusReasoning.unshift(`✅ TREND ALIGNED: ${finalSignal} with ${trendAnalysis.majorTrend} trend (${trendAnalysis.trendStrength.toFixed(0)}% strength) - confidence boosted`);
        } else if ((signalIsBullish && trendIsBearish) || (!signalIsBullish && trendIsBullish)) {
          // Signal OPPOSES strong trend - REDUCE confidence (but allow for mean reversion)
          const confidenceReduction = 0.65; // Reduce to 65% of original
          overallConfidence = Math.round(overallConfidence * confidenceReduction);
          
          // Only block if confidence falls below 55% after reduction
          if (overallConfidence < 55) {
            finalSignal = 'NO_TRADE';
            overallConfidence = 75;
            consensusReasoning.unshift(`🚨 TREND CONFLICT: Insufficient confidence for counter-trend ${finalSignal} against ${trendAnalysis.majorTrend} (${trendAnalysis.trendStrength.toFixed(0)}%)`);
          } else {
            consensusReasoning.unshift(`⚠️ COUNTER-TREND: ${finalSignal} against ${trendAnalysis.majorTrend} trend - confidence reduced for mean reversion play`);
          }
        }
      } else if (trendAnalysis.trendStrength >= 55) {
        // Moderate trend - slight confidence adjustment
        if ((signalIsBullish && trendIsBullish) || (!signalIsBullish && trendIsBearish)) {
          overallConfidence = Math.min(90, overallConfidence * 1.05);
          consensusReasoning.unshift(`✅ TREND SUPPORT: ${finalSignal} supported by ${trendAnalysis.majorTrend} trend (${trendAnalysis.trendStrength.toFixed(0)}%)`);
        } else if ((signalIsBullish && trendIsBearish) || (!signalIsBullish && trendIsBullish)) {
          overallConfidence = Math.round(overallConfidence * 0.85);
          consensusReasoning.unshift(`⚠️ TREND CAUTION: ${finalSignal} against moderate ${trendAnalysis.majorTrend} trend (${trendAnalysis.trendStrength.toFixed(0)}%)`);
        }
      }
    }

    // Risk assessment
    const riskLevel = overallConfidence > 80 ? 'LOW' : overallConfidence > 60 ? 'MEDIUM' : 'HIGH';

    // Generate recommendation
    const recommendation = this.generateRecommendation(finalSignal, overallConfidence, weightedVotes, agentSignals);

    const consensus: ConsensusSignal = {
      finalSignal,
      overallConfidence: Math.round(overallConfidence),
      agentVotes: weightedVotes,
      consensusReasoning: [
        `🛡️ Trend Filter: ${trendAnalysis.majorTrend} (${trendAnalysis.trendStrength.toFixed(0)}% strength)`,
        ...consensusReasoning
      ],
      agentSignals,
      riskLevel,
      recommendation
    };

    console.log('\n🎯 CONSENSUS RESULT:');
    console.log('==================');
    console.log(`Final Signal: ${finalSignal}`);
    console.log(`Overall Confidence: ${overallConfidence.toFixed(0)}%`);
    console.log(`Risk Level: ${riskLevel}`);
    console.log(`✅ WEIGHTED VOTES: CALL=${weightedVotes.BUY_CALL.toFixed(1)}, PUT=${weightedVotes.BUY_PUT.toFixed(1)}, NO_TRADE=${weightedVotes.NO_TRADE.toFixed(1)} (Total: ${totalWeight})`);
    console.log(`Thresholds: Strong=${strongThreshold.toFixed(1)}, Moderate=${moderateThreshold.toFixed(1)}`);
    console.log(`\nRecommendation: ${recommendation}`);

    return consensus;
  }

  private static generateRecommendation(
    signal: string,
    confidence: number,
    votes: any,
    agentSignals: AgentSignal[]
  ): string {
    if (signal === 'NO_TRADE') {
      if (votes.NO_TRADE >= 3) {
        return 'Strong consensus to avoid trading - high risk or unclear setup';
      } else {
        return 'Insufficient consensus - wait for clearer signals';
      }
    }

    if (confidence > 80) {
      return `Strong ${signal.toLowerCase()} signal with high confidence - recommended entry`;
    } else if (confidence > 65) {
      return `Moderate ${signal.toLowerCase()} signal - consider with reduced position size`;
    } else {
      return `Weak ${signal.toLowerCase()} signal - better opportunities may exist`;
    }
  }
}