/**
 * VOLUME DELTA AGENT
 *
 * Volume delta analysis for institutional flow detection and order imbalance tracking
 * Critical for 0-DTE trading where institutional movements determine short-term direction
 *
 * Analyzes:
 * - Buying vs selling pressure (cumulative delta)
 * - Delta divergence patterns (price vs delta)
 * - Volume absorption and exhaustion signals
 * - Institutional footprints in order flow
 * - Delta momentum and acceleration
 * - Hidden buying/selling pressure
 */

import { MarketData, OptionsChain, TradeSignal } from './types';

export interface DeltaBar {
  close: number;
  volume: number;
  barDelta: number; // Volume at bid vs ask (buying - selling)
  cumulativeDelta: number;
  deltaChange: number; // Change in delta from previous bar
  deltaAcceleration: number; // Change in delta change (momentum)
  deltaIntensity: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  flowDirection: 'BUYING' | 'SELLING' | 'NEUTRAL';
}

export interface DeltaAnalysis {
  currentBar: DeltaBar;
  cumulativeDelta: number;
  deltaTrend: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
  deltaMomentum: 'ACCELERATING' | 'DECELERATING' | 'CONSISTENT' | 'REVERSING';
  volumeImbalance: {
    buyingPressure: number; // 0-100
    sellingPressure: number; // 0-100
    netImbalance: number; // -100 to +100
    imbalanceTrend: 'IMPROVING' | 'WORSENING' | 'STABLE';
  };
  divergenceSignals: Array<{
    type: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'HIDDEN_BUYING' | 'HIDDEN_SELLING';
    strength: 'WEAK' | 'MODERATE' | 'STRONG';
    description: string;
    confidence: number;
  }>;
  absorptionSignals: {
    buyingAbsorption: boolean;
    sellingAbsorption: boolean;
    absorptionStrength: number; // 0-100
    location: 'AT_SUPPORT' | 'AT_RESISTANCE' | 'IN_RANGE';
  };
  institutionalFootprint: {
    detected: boolean;
    confidence: number;
    activity: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
    size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'INSTITUTIONAL';
  };
}

/**
 * Volume Delta Agent
 * Provides institutional-grade order flow analysis for detecting smart money movements
 */
export class VolumeDeltaAgent {
  /**
   * Analyze volume delta for institutional flow signals
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 VOLUME DELTA AGENT - INITIATING INSTITUTIONAL FLOW ANALYSIS');
    console.log('============================================================');

    if (marketData.length < 20) {
      return {
        agent: 'VolumeDelta',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient data for delta analysis (need 20+ bars)'],
        data: null
      };
    }

    // Calculate delta analysis
    const deltaAnalysis = this.calculateDeltaAnalysis(marketData);

    reasoning.push(`Current Price: $${deltaAnalysis.currentBar.close.toFixed(2)}`);
    reasoning.push(`Cumulative Delta: ${deltaAnalysis.cumulativeDelta.toFixed(0)}`);
    reasoning.push(`Delta Trend: ${deltaAnalysis.deltaTrend}`);
    reasoning.push(`Delta Momentum: ${deltaAnalysis.deltaMomentum}`);
    reasoning.push(`Net Imbalance: ${deltaAnalysis.volumeImbalance.netImbalance.toFixed(1)}%`);

    // Analyze flow components
    reasoning.push(`Buying Pressure: ${deltaAnalysis.volumeImbalance.buyingPressure.toFixed(1)}%`);
    reasoning.push(`Selling Pressure: ${deltaAnalysis.volumeImbalance.sellingPressure.toFixed(1)}%`);
    reasoning.push(`Imbalance Trend: ${deltaAnalysis.volumeImbalance.imbalanceTrend}`);

    // Check for divergence signals
    if (deltaAnalysis.divergenceSignals.length > 0) {
      reasoning.push(`Divergence Signals: ${deltaAnalysis.divergenceSignals.length} detected`);
      deltaAnalysis.divergenceSignals.forEach(signal => {
        reasoning.push(`  - ${signal.type}: ${signal.description} (${signal.strength}, ${signal.confidence}% confidence)`);
      });
    }

    // Check absorption signals
    if (deltaAnalysis.absorptionSignals.buyingAbsorption || deltaAnalysis.absorptionSignals.sellingAbsorption) {
      reasoning.push(`Absorption Detected: ${deltaAnalysis.absorptionSignals.absorptionStrength.toFixed(1)}% strength`);
    }

    // Check institutional footprint
    if (deltaAnalysis.institutionalFootprint.detected) {
      reasoning.push(`Institutional Activity: ${deltaAnalysis.institutionalFootprint.activity} (${deltaAnalysis.institutionalFootprint.size}, ${deltaAnalysis.institutionalFootprint.confidence}% confidence)`);
    }

    // 1. Delta Trend Analysis
    const trendScore = this.analyzeDeltaTrend(deltaAnalysis);
    reasoning.push(`Delta Trend Score: ${trendScore}/100`);

    // 2. Momentum Analysis
    const momentumScore = this.analyzeDeltaMomentum(deltaAnalysis);
    reasoning.push(`Delta Momentum Score: ${momentumScore}/100`);

    // 3. Divergence Analysis
    const divergenceScore = this.analyzeDivergence(deltaAnalysis);
    reasoning.push(`Divergence Score: ${divergenceScore}/100`);

    // 4. Absorption Analysis
    const absorptionScore = this.analyzeAbsorption(deltaAnalysis);
    reasoning.push(`Absorption Score: ${absorptionScore}/100`);

    // 5. Institutional Footprint Analysis
    const institutionalScore = this.analyzeInstitutionalFootprint(deltaAnalysis);
    reasoning.push(`Institutional Score: ${institutionalScore}/100`);

    // Calculate overall signal
    const overallScore = (trendScore * 0.3) +      // 30% delta trend
                           (momentumScore * 0.25) +     // 25% momentum
                           (divergenceScore * 0.2) +     // 20% divergences
                           (absorptionScore * 0.15) +      // 15% absorption
                           (institutionalScore * 0.1);   // 10% institutional activity

    // Generate signal based on delta analysis
    if (overallScore >= 75) {
      if (deltaAnalysis.volumeImbalance.netImbalance > 20) {
        signal = 'BUY_CALL';
        confidence = Math.min(95, 65 + overallScore * 0.3);
        reasoning.push('✅ STRONG BUY CALL: Strong institutional buying pressure detected');
      } else if (deltaAnalysis.volumeImbalance.netImbalance < -20) {
        signal = 'BUY_PUT';
        confidence = Math.min(95, 65 + overallScore * 0.3);
        reasoning.push('✅ STRONG BUY PUT: Strong institutional selling pressure detected');
      }
    } else if (overallScore >= 60) {
      if (deltaAnalysis.volumeImbalance.netImbalance > 10) {
        signal = 'BUY_CALL';
        confidence = Math.min(85, 55 + overallScore * 0.25);
        reasoning.push('✅ BUY CALL: Moderate institutional buying pressure');
      } else if (deltaAnalysis.volumeImbalance.netImbalance < -10) {
        signal = 'BUY_PUT';
        confidence = Math.min(85, 55 + overallScore * 0.25);
        reasoning.push('✅ BUY PUT: Moderate institutional selling pressure');
      }
    } else if (overallScore <= 30) {
      signal = 'NO_TRADE';
      confidence = 70;
      reasoning.push('❌ NO TRADE: Weak or conflicting delta signals');
    } else {
      signal = 'NO_TRADE';
      confidence = 60;
      reasoning.push('❌ NO TRADE: Neutral delta flow, insufficient institutional activity');
    }

    console.log(`📊 VOLUME DELTA ANALYSIS COMPLETE:`);
    console.log(`   Overall Score: ${overallScore.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Delta Trend: ${deltaAnalysis.deltaTrend}`);
    console.log(`   Institutional Footprint: ${deltaAnalysis.institutionalFootprint.detected ? 'Yes' : 'No'}`);

    return {
      agent: 'VolumeDelta',
      signal,
      confidence,
      reasoning,
      data: deltaAnalysis
    };
  }

  /**
   * Calculate volume delta and related metrics
   */
  private static calculateDeltaAnalysis(marketData: MarketData[]): DeltaAnalysis {
    const recentBars = marketData.slice(-50); // Use last 50 bars
    const deltaBars: DeltaBar[] = [];
    let cumulativeDelta = 0;
    let previousDeltaChange = 0;

    // Calculate delta for each bar (simulated from price action and volume)
    for (let i = 1; i < recentBars.length; i++) {
      const currentBar = recentBars[i];
      const previousBar = recentBars[i - 1];

      // Simulate bar delta based on price action and volume characteristics
      const priceChange = currentBar.close - previousBar.close;
      const barRange = currentBar.high - currentBar.low;
      const volume = Number(currentBar.volume || 0);
      const closePosition = (currentBar.close - currentBar.low) / barRange;

      // Calculate bar delta (buying vs selling pressure)
      let barDelta: number;

      if (priceChange > 0) {
        // Up bar - calculate buying pressure
        if (closePosition > 0.7) {
          // Close near high - strong buying
          barDelta = volume * 0.8;
        } else if (closePosition > 0.3) {
          // Close in upper half - moderate buying
          barDelta = volume * 0.5;
        } else {
          // Close in lower half but up bar - weak buying
          barDelta = volume * 0.2;
        }
      } else if (priceChange < 0) {
        // Down bar - calculate selling pressure
        if (closePosition < 0.3) {
          // Close near low - strong selling
          barDelta = -volume * 0.8;
        } else if (closePosition < 0.7) {
          // Close in lower half - moderate selling
          barDelta = -volume * 0.5;
        } else {
          // Close in upper half but down bar - weak selling
          barDelta = -volume * 0.2;
        }
      } else {
        // Doji bar - neutral
        barDelta = 0;
      }

      cumulativeDelta += barDelta;
      const deltaChange = barDelta - (deltaBars.length > 0 ? deltaBars[deltaBars.length - 1].barDelta : 0);
      const deltaAcceleration = deltaChange - previousDeltaChange;

      // Determine delta intensity
      let deltaIntensity: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
      const deltaMagnitude = Math.abs(barDelta);
      const avgVolume = recentBars.slice(-10).reduce((sum, bar) => sum + Number(bar.volume || 0), 0) / 10;

      if (deltaMagnitude > avgVolume * 0.8) {
        deltaIntensity = 'EXTREME';
      } else if (deltaMagnitude > avgVolume * 0.5) {
        deltaIntensity = 'HIGH';
      } else if (deltaMagnitude > avgVolume * 0.2) {
        deltaIntensity = 'MODERATE';
      } else {
        deltaIntensity = 'LOW';
      }

      // Determine flow direction
      let flowDirection: 'BUYING' | 'SELLING' | 'NEUTRAL';
      if (barDelta > avgVolume * 0.1) {
        flowDirection = 'BUYING';
      } else if (barDelta < -avgVolume * 0.1) {
        flowDirection = 'SELLING';
      } else {
        flowDirection = 'NEUTRAL';
      }

      deltaBars.push({
        close: currentBar.close,
        volume,
        barDelta,
        cumulativeDelta,
        deltaChange,
        deltaAcceleration,
        deltaIntensity,
        flowDirection
      });

      previousDeltaChange = deltaChange;
    }

    const currentBar = deltaBars[deltaBars.length - 1];

    // Analyze delta trend
    const deltaTrend = this.analyzeDeltaTrendFromBars(deltaBars);

    // Analyze delta momentum
    const deltaMomentum = this.analyzeDeltaMomentumFromBars(deltaBars);

    // Calculate volume imbalance
    const volumeImbalance = this.calculateVolumeImbalance(deltaBars);

    // Identify divergence signals
    const divergenceSignals = this.identifyDivergenceSignals(deltaBars, marketData);

    // Identify absorption signals
    const absorptionSignals = this.identifyAbsorptionSignals(deltaBars);

    // Detect institutional footprint
    const institutionalFootprint = this.detectInstitutionalFootprint(deltaBars);

    return {
      currentBar,
      cumulativeDelta,
      deltaTrend,
      deltaMomentum,
      volumeImbalance,
      divergenceSignals,
      absorptionSignals,
      institutionalFootprint
    };
  }

  /**
   * Analyze delta trend from delta bars
   */
  private static analyzeDeltaTrendFromBars(deltaBars: DeltaBar[]):
    'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH' {
    if (deltaBars.length < 10) return 'NEUTRAL';

    const recentBars = deltaBars.slice(-20);
    const positiveDelta = recentBars.filter(bar => bar.barDelta > 0).length;
    const negativeDelta = recentBars.filter(bar => bar.barDelta < 0).length;

    const bullishRatio = positiveDelta / recentBars.length;
    const netDelta = recentBars.reduce((sum, bar) => sum + bar.barDelta, 0);

    if (bullishRatio > 0.7 && netDelta > 0) {
      return 'STRONGLY_BULLISH';
    } else if (bullishRatio > 0.6) {
      return 'BULLISH';
    } else if (bullishRatio < 0.3 && netDelta < 0) {
      return 'STRONGLY_BEARISH';
    } else if (bullishRatio < 0.4) {
      return 'BEARISH';
    } else {
      return 'NEUTRAL';
    }
  }

  /**
   * Analyze delta momentum from delta bars
   */
  private static analyzeDeltaMomentumFromBars(deltaBars: DeltaBar[]):
    'ACCELERATING' | 'DECELERATING' | 'CONSISTENT' | 'REVERSING' {
    if (deltaBars.length < 10) return 'CONSISTENT';

    const recentBars = deltaBars.slice(-10);
    const positiveAccelerations = recentBars.filter(bar => bar.deltaAcceleration > 0).length;
    const negativeAccelerations = recentBars.filter(bar => bar.deltaAcceleration < 0).length;

    if (positiveAccelerations > 7) {
      return 'ACCELERATING';
    } else if (negativeAccelerations > 7) {
      return 'DECELERATING';
    } else if (recentBars.every(bar => Math.abs(bar.deltaAcceleration) < recentBars[0].volume * 0.1)) {
      return 'CONSISTENT';
    } else {
      return 'REVERSING';
    }
  }

  /**
   * Calculate volume imbalance metrics
   */
  private static calculateVolumeImbalance(deltaBars: DeltaBar[]): {
    buyingPressure: number;
    sellingPressure: number;
    netImbalance: number;
    imbalanceTrend: 'IMPROVING' | 'WORSENING' | 'STABLE';
  } {
    if (deltaBars.length < 5) {
      return {
        buyingPressure: 50,
        sellingPressure: 50,
        netImbalance: 0,
        imbalanceTrend: 'STABLE'
      };
    }

    const recentBars = deltaBars.slice(-20);
    const totalVolume = recentBars.reduce((sum, bar) => sum + bar.volume, 0);
    const totalBuyingDelta = recentBars
      .filter(bar => bar.barDelta > 0)
      .reduce((sum, bar) => sum + bar.barDelta, 0);
    const totalSellingDelta = Math.abs(recentBars
      .filter(bar => bar.barDelta < 0)
      .reduce((sum, bar) => sum + bar.barDelta, 0));

    const buyingPressure = totalVolume > 0 ? (totalBuyingDelta / totalVolume) * 100 : 50;
    const sellingPressure = totalVolume > 0 ? (totalSellingDelta / totalVolume) * 100 : 50;
    const netImbalance = buyingPressure - sellingPressure;

    // Analyze trend in imbalance
    const firstHalf = recentBars.slice(0, Math.floor(recentBars.length / 2));
    const secondHalf = recentBars.slice(Math.floor(recentBars.length / 2));

    const firstImbalance = this.calculateNetImbalance(firstHalf);
    const secondImbalance = this.calculateNetImbalance(secondHalf);

    let imbalanceTrend: 'IMPROVING' | 'WORSENING' | 'STABLE';
    if (secondImbalance > firstImbalance + 10) {
      imbalanceTrend = 'IMPROVING';
    } else if (secondImbalance < firstImbalance - 10) {
      imbalanceTrend = 'WORSENING';
    } else {
      imbalanceTrend = 'STABLE';
    }

    return {
      buyingPressure,
      sellingPressure,
      netImbalance,
      imbalanceTrend
    };
  }

  /**
   * Helper to calculate net imbalance
   */
  private static calculateNetImbalance(bars: DeltaBar[]): number {
    if (bars.length === 0) return 0;

    const totalVolume = bars.reduce((sum, bar) => sum + bar.volume, 0);
    const totalDelta = bars.reduce((sum, bar) => sum + bar.barDelta, 0);

    return totalVolume > 0 ? (totalDelta / totalVolume) * 100 : 0;
  }

  /**
   * Identify divergence signals between price and delta
   */
  private static identifyDivergenceSignals(deltaBars: DeltaBar[], marketData: MarketData[]): Array<{
    type: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'HIDDEN_BUYING' | 'HIDDEN_SELLING';
    strength: 'STRONG' | 'MODERATE' | 'WEAK';
    description: string;
    confidence: number;
  }> {
    const signals: Array<{
    type: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'HIDDEN_BUYING' | 'HIDDEN_SELLING';
    strength: 'STRONG' | 'MODERATE' | 'WEAK';
    description: string;
    confidence: number;
  }> = [];

    if (deltaBars.length < 20 || marketData.length < 20) return signals;

    const recentDeltaBars = deltaBars.slice(-20);
    const recentPrices = marketData.slice(-20).map(bar => bar.close);

    // Check for price/delta divergences
    const priceTrend = this.calculateTrend(recentPrices);
    const deltaTrend = this.calculateTrend(recentDeltaBars.map(bar => bar.cumulativeDelta));

    // Bullish divergence: Price making lower lows, delta making higher lows
    if (priceTrend < -0.5 && deltaTrend > 0.3) {
      signals.push({
        type: 'BULLISH_DIVERGENCE',
        strength: Math.abs(deltaTrend) > 0.6 ? 'STRONG' : 'MODERATE',
        description: 'Price declining while delta shows buying pressure',
        confidence: Math.min(90, 50 + Math.abs(deltaTrend) * 50)
      });
    }

    // Bearish divergence: Price making higher highs, delta making lower lows
    if (priceTrend > 0.5 && deltaTrend < -0.3) {
      signals.push({
        type: 'BEARISH_DIVERGENCE',
        strength: Math.abs(deltaTrend) > 0.6 ? 'STRONG' : 'MODERATE',
        description: 'Price rising while delta shows selling pressure',
        confidence: Math.min(90, 50 + Math.abs(deltaTrend) * 50)
      });
    }

    // Hidden buying: Price range-bound with positive delta accumulation
    const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
    const avgPrice = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const priceVolatility = priceRange / avgPrice;

    if (priceVolatility < 0.02 && deltaTrend > 0.2) {
      signals.push({
        type: 'HIDDEN_BUYING',
        strength: deltaTrend > 0.5 ? 'STRONG' : 'MODERATE',
        description: 'Price stable with strong underlying buying',
        confidence: Math.min(85, 45 + deltaTrend * 40)
      });
    }

    // Hidden selling: Price range-bound with negative delta accumulation
    if (priceVolatility < 0.02 && deltaTrend < -0.2) {
      signals.push({
        type: 'HIDDEN_SELLING',
        strength: Math.abs(deltaTrend) > 0.5 ? 'STRONG' : 'MODERATE',
        description: 'Price stable with strong underlying selling',
        confidence: Math.min(85, 45 + Math.abs(deltaTrend) * 40)
      });
    }

    return signals;
  }

  /**
   * Identify absorption signals
   */
  private static identifyAbsorptionSignals(deltaBars: DeltaBar[]): {
    buyingAbsorption: boolean;
    sellingAbsorption: boolean;
    absorptionStrength: number;
    location: 'AT_SUPPORT' | 'AT_RESISTANCE' | 'IN_RANGE';
  } {
    if (deltaBars.length < 10) {
      return {
        buyingAbsorption: false,
        sellingAbsorption: false,
        absorptionStrength: 0,
        location: 'IN_RANGE'
      };
    }

    const recentBars = deltaBars.slice(-10);
    const avgVolume = recentBars.reduce((sum, bar) => sum + bar.volume, 0) / recentBars.length;

    // Check for buying absorption (high volume, small price movement, positive delta)
    const buyingAbsorptionBars = recentBars.filter(bar =>
      bar.volume > avgVolume * 1.5 &&
      Math.abs(bar.deltaChange) < avgVolume * 0.1 &&
      bar.barDelta > 0
    );

    // Check for selling absorption (high volume, small price movement, negative delta)
    const sellingAbsorptionBars = recentBars.filter(bar =>
      bar.volume > avgVolume * 1.5 &&
      Math.abs(bar.deltaChange) < avgVolume * 0.1 &&
      bar.barDelta < 0
    );

    const buyingAbsorption = buyingAbsorptionBars.length >= 3;
    const sellingAbsorption = sellingAbsorptionBars.length >= 3;

    const absorptionBars = buyingAbsorption ? buyingAbsorptionBars : sellingAbsorptionBars;
    const absorptionStrength = absorptionBars.length > 0 ?
      (absorptionBars.reduce((sum, bar) => sum + bar.volume, 0) / absorptionBars.length) / avgVolume * 100 : 0;

    // Determine location based on price position
    let location: 'AT_SUPPORT' | 'AT_RESISTANCE' | 'IN_RANGE' = 'IN_RANGE';
    const currentPrice = recentBars[recentBars.length - 1].close;
    const recentPrices = recentBars.map(bar => bar.close);
    const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);

    if (currentPrice < Math.min(...recentPrices) + priceRange * 0.2) {
      location = 'AT_SUPPORT';
    } else if (currentPrice > Math.max(...recentPrices) - priceRange * 0.2) {
      location = 'AT_RESISTANCE';
    }

    return {
      buyingAbsorption,
      sellingAbsorption,
      absorptionStrength: Math.min(100, absorptionStrength),
      location
    };
  }

  /**
   * Detect institutional footprint in delta data
   */
  private static detectInstitutionalFootprint(deltaBars: DeltaBar[]): {
    detected: boolean;
    confidence: number;
    activity: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
    size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'INSTITUTIONAL';
  } {
    if (deltaBars.length < 20) {
      return {
        detected: false,
        confidence: 0,
        activity: 'NEUTRAL',
        size: 'SMALL'
      };
    }

    const recentBars = deltaBars.slice(-20);
    const avgVolume = recentBars.reduce((sum, bar) => sum + bar.volume, 0) / recentBars.length;

    // Look for unusually large delta bars (institutional activity)
    const largeDeltaBars = recentBars.filter(bar =>
      Math.abs(bar.barDelta) > avgVolume * 0.6
    );

    const extremeDeltaBars = recentBars.filter(bar =>
      Math.abs(bar.barDelta) > avgVolume * 0.8
    );

    const detected = largeDeltaBars.length >= 3 || extremeDeltaBars.length >= 1;

    if (!detected) {
      return {
        detected: false,
        confidence: 0,
        activity: 'NEUTRAL',
        size: 'SMALL'
      };
    }

    // Determine activity by delta direction
    const netDelta = recentBars.reduce((sum, bar) => sum + bar.barDelta, 0);
    const activity = netDelta > 0 ? 'ACCUMULATION' : 'DISTRIBUTION';

    // Determine size by magnitude of delta bars
    const maxDelta = Math.max(...recentBars.map(bar => Math.abs(bar.barDelta)));
    const size = maxDelta > avgVolume * 0.8 ? 'INSTITUTIONAL' :
                maxDelta > avgVolume * 0.6 ? 'LARGE' :
                maxDelta > avgVolume * 0.4 ? 'MEDIUM' : 'SMALL';

    // Calculate confidence based on consistency
    const extremeRatio = extremeDeltaBars.length / largeDeltaBars.length;
    const confidence = Math.min(95, 30 + (largeDeltaBars.length * 5) + (extremeDeltaBars.length * 10));

    return {
      detected,
      confidence,
      activity,
      size
    };
  }

  /**
   * Helper to calculate trend
   */
  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < values.length; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const n = values.length;
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Analyze delta trend
   */
  private static analyzeDeltaTrend(analysis: DeltaAnalysis): number {
    let score = 50;

    switch (analysis.deltaTrend) {
      case 'STRONGLY_BULLISH':
        score += 40;
        break;
      case 'BULLISH':
        score += 25;
        break;
      case 'STRONGLY_BEARISH':
        score -= 40;
        break;
      case 'BEARISH':
        score -= 25;
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze delta momentum
   */
  private static analyzeDeltaMomentum(analysis: DeltaAnalysis): number {
    let score = 50;

    switch (analysis.deltaMomentum) {
      case 'ACCELERATING':
        score += 30;
        break;
      case 'CONSISTENT':
        score += 15;
        break;
      case 'DECELERATING':
        score -= 15;
        break;
      case 'REVERSING':
        score -= 30;
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze divergence signals
   */
  private static analyzeDivergence(analysis: DeltaAnalysis): number {
    let score = 50;

    analysis.divergenceSignals.forEach(signal => {
      const signalScore = signal.confidence;
      const strengthMultiplier = signal.strength === 'STRONG' ? 1.5 :
                               signal.strength === 'MODERATE' ? 1.0 : 0.5;

      if (signal.type === 'BULLISH_DIVERGENCE' || signal.type === 'HIDDEN_BUYING') {
        score += signalScore * strengthMultiplier * 0.3;
      } else if (signal.type === 'BEARISH_DIVERGENCE' || signal.type === 'HIDDEN_SELLING') {
        score += signalScore * strengthMultiplier * 0.3;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze absorption signals
   */
  private static analyzeAbsorption(analysis: DeltaAnalysis): number {
    let score = 50;

    const { buyingAbsorption, sellingAbsorption, absorptionStrength } = analysis.absorptionSignals;

    if (buyingAbsorption || sellingAbsorption) {
      score += absorptionStrength * 0.4;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze institutional footprint
   */
  private static analyzeInstitutionalFootprint(analysis: DeltaAnalysis): number {
    let score = 50;

    const { detected, confidence, activity, size } = analysis.institutionalFootprint;

    if (!detected) {
      return score;
    }

    score += confidence * 0.4;

    if (activity === 'ACCUMULATION' || activity === 'DISTRIBUTION') {
      score += 10; // Clear institutional activity
    }

    if (size === 'INSTITUTIONAL' || size === 'LARGE') {
      score += 15; // Significant size
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