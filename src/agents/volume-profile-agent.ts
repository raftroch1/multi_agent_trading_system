/**
 * VOLUME PROFILE AGENT
 *
 * Volume-at-price analysis for institutional support/resistance identification
 * Critical for 0-DTE trading where precise entry/exit levels determine success
 *
 * Analyzes:
 * - Volume-at-price levels and distribution
 * - High-Volume Nodes (HVN) and Low-Volume Nodes (LVN)
 * - Point of Control (POC) significance
 * - Value Area and its implications
 * - Volume gaps and unfilled regions
 * - Price rejection and acceptance zones
 */

import { MarketData, OptionsChain, TradeSignal } from './types';

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  volumePercentage: number;
  cumulativeVolume: number;
  cumulativePercentage: number;
  levelType: 'HVN' | 'LVN' | 'NORMAL';
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface VolumeProfileAnalysis {
  profileLevels: VolumeProfileLevel[];
  poc: { price: number; volume: number; volumePercentage: number };
  valueArea: {
    high: number;
    low: number;
    range: number;
    volumePercentage: number;
  };
  currentPricePosition: {
    price: number;
    currentLevel?: VolumeProfileLevel;
    position: 'ABOVE_VA_HIGH' | 'IN_VALUE_AREA' | 'BELOW_VA_LOW' | 'AT_POC';
    distanceToPOC: number;
    nearestHVN?: VolumeProfileLevel;
    nearestLVN?: VolumeProfileLevel;
  };
  volumeGaps: Array<{
    gapLow: number;
    gapHigh: number;
    gapSize: number;
    significance: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  rejectionZones: {
    above: Array<{ price: number; volume: number; strength: number }>;
    below: Array<{ price: number; volume: number; strength: number }>;
  };
  marketStructure: 'BALANCED' | 'TRENDING' | 'ROTATIONAL' | 'DISTRIBUTIVE';
  tradingImplications: {
    supportLevels: VolumeProfileLevel[];
    resistanceLevels: VolumeProfileLevel[];
    fairValueZone: { low: number; high: number };
    volumeImbalance: number; // -100 to +100
  };
}

/**
 * Volume Profile Agent
 * Provides institutional-grade volume-at-price analysis for precise S/R levels
 */
export class VolumeProfileAgent {
  /**
   * Analyze volume profile for support/resistance and market structure
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 VOLUME PROFILE AGENT - INITIATING MARKET STRUCTURE ANALYSIS');
    console.log('========================================================');

    if (marketData.length < 100) {
      return {
        agent: 'VolumeProfile',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient data for volume profile analysis (need 100+ bars)'],
        data: null
      };
    }

    // Build volume profile
    const profileAnalysis = this.buildVolumeProfile(marketData);

    reasoning.push(`Current Price: $${profileAnalysis.currentPricePosition.price.toFixed(2)}`);
    reasoning.push(`Point of Control (POC): $${profileAnalysis.poc.price.toFixed(2)} (${profileAnalysis.poc.volumePercentage.toFixed(1)}% of volume)`);
    reasoning.push(`Value Area: $${profileAnalysis.valueArea.low.toFixed(2)} - $${profileAnalysis.valueArea.high.toFixed(2)} (${profileAnalysis.valueArea.volumePercentage.toFixed(1)}% of volume)`);
    reasoning.push(`Price Position: ${profileAnalysis.currentPricePosition.position}`);
    reasoning.push(`Distance to POC: ${profileAnalysis.currentPricePosition.distanceToPOC.toFixed(2)}%`);
    reasoning.push(`Market Structure: ${profileAnalysis.marketStructure}`);

    // Identify key volume levels
    const hvnCount = profileAnalysis.profileLevels.filter(level => level.levelType === 'HVN').length;
    const lvnCount = profileAnalysis.profileLevels.filter(level => level.levelType === 'LVN').length;
    reasoning.push(`High-Volume Nodes: ${hvnCount}, Low-Volume Nodes: ${lvnCount}`);

    // Analyze volume gaps
    if (profileAnalysis.volumeGaps.length > 0) {
      const significantGaps = profileAnalysis.volumeGaps.filter(gap => gap.significance === 'HIGH');
      reasoning.push(`Volume Gaps: ${profileAnalysis.volumeGaps.length} total, ${significantGaps.length} significant`);
    }

    // 1. Support/Resistance Analysis
    const supportResistanceScore = this.analyzeSupportResistance(profileAnalysis);
    reasoning.push(`Support/Resistance Score: ${supportResistanceScore}/100`);

    // 2. Market Structure Analysis
    const structureScore = this.analyzeMarketStructure(profileAnalysis);
    reasoning.push(`Market Structure Score: ${structureScore}/100`);

    // 3. Volume Imbalance Analysis
    const imbalanceScore = this.analyzeVolumeImbalance(profileAnalysis);
    reasoning.push(`Volume Imbalance Score: ${imbalanceScore}/100`);

    // 4. Fair Value Deviation Analysis
    const fairValueScore = this.analyzeFairValueDeviation(profileAnalysis);
    reasoning.push(`Fair Value Deviation Score: ${fairValueScore}/100`);

    // Calculate overall signal
    const overallScore = (supportResistanceScore * 0.3) +     // 30% S/R levels
                           (structureScore * 0.25) +          // 25% market structure
                           (imbalanceScore * 0.25) +           // 25% volume imbalance
                           (fairValueScore * 0.2);             // 20% fair value

    // Generate signal based on volume profile analysis
    if (overallScore >= 70) {
      if (profileAnalysis.currentPricePosition.position === 'BELOW_VA_LOW' ||
          (profileAnalysis.currentPricePosition.position === 'IN_VALUE_AREA' && profileAnalysis.tradingImplications.volumeImbalance > 20)) {
        signal = 'BUY_CALL';
        confidence = Math.min(90, 60 + overallScore * 0.3);
        reasoning.push('✅ STRONG BUY CALL: Price below value area with strong volume support');
      } else if (profileAnalysis.currentPricePosition.position === 'ABOVE_VA_HIGH' ||
                 (profileAnalysis.currentPricePosition.position === 'IN_VALUE_AREA' && profileAnalysis.tradingImplications.volumeImbalance < -20)) {
        signal = 'BUY_PUT';
        confidence = Math.min(90, 60 + overallScore * 0.3);
        reasoning.push('✅ STRONG BUY PUT: Price above value area with strong volume resistance');
      }
    } else if (overallScore >= 55) {
      if (profileAnalysis.currentPricePosition.position === 'BELOW_VA_LOW') {
        signal = 'BUY_CALL';
        confidence = Math.min(80, 50 + overallScore * 0.25);
        reasoning.push('✅ BUY CALL: Price below value area with moderate volume support');
      } else if (profileAnalysis.currentPricePosition.position === 'ABOVE_VA_HIGH') {
        signal = 'BUY_PUT';
        confidence = Math.min(80, 50 + overallScore * 0.25);
        reasoning.push('✅ BUY PUT: Price above value area with moderate volume resistance');
      }
    } else if (overallScore <= 30) {
      signal = 'NO_TRADE';
      confidence = 70;
      reasoning.push('❌ NO TRADE: Weak volume profile signals, unclear market structure');
    } else {
      signal = 'NO_TRADE';
      confidence = 60;
      reasoning.push('❌ NO TRADE: Price in value area with balanced volume, no clear edge');
    }

    console.log(`📊 VOLUME PROFILE ANALYSIS COMPLETE:`);
    console.log(`   Overall Score: ${overallScore.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Market Structure: ${profileAnalysis.marketStructure}`);
    console.log(`   Volume Imbalance: ${profileAnalysis.tradingImplications.volumeImbalance.toFixed(1)}`);

    return {
      agent: 'VolumeProfile',
      signal,
      confidence,
      reasoning,
      data: profileAnalysis
    };
  }

  /**
   * Build volume profile from price data
   */
  private static buildVolumeProfile(marketData: MarketData[]): VolumeProfileAnalysis {
    const recentBars = marketData.slice(-200); // Use last 200 bars for detailed profile
    const priceVolumeMap = new Map<number, number>();
    let totalVolume = 0;

    // Aggregate volume at each price level
    for (const bar of recentBars) {
      const volume = Number(bar.volume || 0);
      const high = bar.high;
      const low = bar.low;
      const close = bar.close;

      // Distribute volume across the price range
      const priceRange = high - low;
      const priceStep = priceRange / 10; // Divide each bar into 10 price levels

      for (let price = low; price <= high; price += priceStep) {
        const roundedPrice = Math.round(price * 100) / 100; // Round to 2 decimal places
        const currentVolume = priceVolumeMap.get(roundedPrice) || 0;
        priceVolumeMap.set(roundedPrice, currentVolume + (volume / 10));
        totalVolume += volume / 10;
      }
    }

    // Convert to array and sort by price
    const profileLevels: VolumeProfileLevel[] = Array.from(priceVolumeMap.entries())
      .map(([price, volume]) => ({
        price,
        volume,
        volumePercentage: (volume / totalVolume) * 100,
        cumulativeVolume: 0,
        cumulativePercentage: 0,
        levelType: 'NORMAL' as const,
        significance: 'LOW' as const
      }))
      .sort((a, b) => a.price - b.price);

    // Calculate cumulative volumes and identify HVN/LVN
    let cumulativeVolume = 0;
    const volumeThresholds = this.calculateVolumeThresholds(profileLevels);

    profileLevels.forEach((level, index) => {
      cumulativeVolume += level.volume;
      level.cumulativeVolume = cumulativeVolume;
      level.cumulativePercentage = (cumulativeVolume / totalVolume) * 100;

      // Identify HVN and LVN
      if (level.volumePercentage > volumeThresholds.hvn) {
        level.levelType = 'HVN';
        level.significance = level.volumePercentage > volumeThresholds.hvn * 1.5 ? 'HIGH' : 'MEDIUM';
      } else if (level.volumePercentage < volumeThresholds.lvn) {
        level.levelType = 'LVN';
        level.significance = 'MEDIUM';
      }
    });

    // Find Point of Control (highest volume level)
    const poc = profileLevels.reduce((max, level) =>
      level.volume > max.volume ? level : max, profileLevels[0]);

    // Calculate Value Area (70% of volume)
    const valueArea = this.calculateValueArea(profileLevels, totalVolume);

    // Analyze current price position
    const currentPrice = recentBars[recentBars.length - 1].close;
    const currentPricePosition = this.analyzeCurrentPricePosition(currentPrice, profileLevels, poc, valueArea);

    // Identify volume gaps
    const volumeGaps = this.identifyVolumeGaps(profileLevels);

    // Identify rejection zones
    const rejectionZones = this.identifyRejectionZones(profileLevels, poc);

    // Determine market structure
    const marketStructure = this.determineMarketStructure(profileLevels, valueArea, currentPricePosition);

    // Analyze trading implications
    const tradingImplications = this.analyzeTradingImplications(profileLevels, valueArea, currentPricePosition);

    return {
      profileLevels,
      poc: {
        price: poc.price,
        volume: poc.volume,
        volumePercentage: poc.volumePercentage
      },
      valueArea,
      currentPricePosition,
      volumeGaps,
      rejectionZones,
      marketStructure,
      tradingImplications
    };
  }

  /**
   * Calculate volume thresholds for HVN/LVN identification
   */
  private static calculateVolumeThresholds(levels: VolumeProfileLevel[]): { hvn: number; lvn: number; average: number } {
    const volumes = levels.map(level => level.volumePercentage);
    volumes.sort((a, b) => b - a);

    const top10Percentile = volumes[Math.floor(volumes.length * 0.1)];
    const bottom10Percentile = volumes[Math.floor(volumes.length * 0.9)];
    const average = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;

    return {
      hvn: top10Percentile,
      lvn: bottom10Percentile,
      average
    };
  }

  /**
   * Calculate Value Area (70% of total volume)
   */
  private static calculateValueArea(levels: VolumeProfileLevel[], totalVolume: number): {
    high: number;
    low: number;
    range: number;
    volumePercentage: number;
  } {
    const targetVolume = totalVolume * 0.7;
    let currentVolume = 0;
    let startIndex = 0;
    let endIndex = levels.length - 1;

    // Find the range that contains 70% of volume with the smallest price range
    let bestRange = { start: 0, end: levels.length - 1, volume: 0, range: Infinity };

    for (let i = 0; i < levels.length; i++) {
      for (let j = i; j < levels.length; j++) {
        const rangeVolume = levels.slice(i, j + 1).reduce((sum, level) => sum + level.volume, 0);

        if (rangeVolume >= targetVolume) {
          const range = levels[j].price - levels[i].price;
          if (range < bestRange.range) {
            bestRange = { start: i, end: j, volume: rangeVolume, range };
          }
          break;
        }
      }
    }

    const valueAreaLevels = levels.slice(bestRange.start, bestRange.end + 1);
    const low = valueAreaLevels[0].price;
    const high = valueAreaLevels[valueAreaLevels.length - 1].price;

    return {
      low,
      high,
      range: high - low,
      volumePercentage: (bestRange.volume / totalVolume) * 100
    };
  }

  /**
   * Analyze current price position relative to volume profile
   */
  private static analyzeCurrentPricePosition(
    price: number,
    levels: VolumeProfileLevel[],
    poc: { price: number; volumePercentage: number },
    valueArea: { high: number; low: number }
  ): VolumeProfileAnalysis['currentPricePosition'] {
    let position: 'ABOVE_VA_HIGH' | 'IN_VALUE_AREA' | 'BELOW_VA_LOW' | 'AT_POC';

    if (Math.abs(price - poc.price) < poc.price * 0.001) {
      position = 'AT_POC';
    } else if (price > valueArea.high) {
      position = 'ABOVE_VA_HIGH';
    } else if (price < valueArea.low) {
      position = 'BELOW_VA_LOW';
    } else {
      position = 'IN_VALUE_AREA';
    }

    const distanceToPOC = Math.abs((price - poc.price) / poc.price) * 100;

    // Find nearest HVN and LVN
    const currentLevel = levels.find(level =>
      Math.abs(level.price - price) < 0.01
    );

    const hvnLevels = levels.filter(level => level.levelType === 'HVN');
    const lvnLevels = levels.filter(level => level.levelType === 'LVN');

    const nearestHVN = hvnLevels.reduce((nearest, level) => {
      const distance = Math.abs(level.price - price);
      const nearestDistance = Math.abs(nearest.price - price);
      return distance < nearestDistance ? level : nearest;
    }, hvnLevels[0]);

    const nearestLVN = lvnLevels.reduce((nearest, level) => {
      const distance = Math.abs(level.price - price);
      const nearestDistance = Math.abs(nearest.price - price);
      return distance < nearestDistance ? level : nearest;
    }, lvnLevels[0]);

    return {
      price,
      currentLevel,
      position,
      distanceToPOC,
      nearestHVN,
      nearestLVN
    };
  }

  /**
   * Identify volume gaps in the profile
   */
  private static identifyVolumeGaps(levels: VolumeProfileLevel[]): Array<{
    gapLow: number;
    gapHigh: number;
    gapSize: number;
    significance: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    const gaps: Array<{
    gapLow: number;
    gapHigh: number;
    gapSize: number;
    significance: 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];
    const avgVolume = levels.reduce((sum, level) => sum + level.volume, 0) / levels.length;

    for (let i = 1; i < levels.length; i++) {
      const prevLevel = levels[i - 1];
      const currLevel = levels[i];
      const priceGap = currLevel.price - prevLevel.price;

      // Check if there's a significant price gap with low volume
      if (priceGap > 0.5 && (prevLevel.volume < avgVolume * 0.3 || currLevel.volume < avgVolume * 0.3)) {
        const gapVolume = Math.min(prevLevel.volume, currLevel.volume);
        const significance = gapVolume < avgVolume * 0.1 ? 'HIGH' :
                           gapVolume < avgVolume * 0.2 ? 'MEDIUM' : 'LOW';

        gaps.push({
          gapLow: prevLevel.price,
          gapHigh: currLevel.price,
          gapSize: priceGap,
          significance
        });
      }
    }

    return gaps;
  }

  /**
   * Identify rejection zones (areas with low volume that rejected price)
   */
  private static identifyRejectionZones(levels: VolumeProfileLevel[], poc: { price: number; volumePercentage: number }): {
    above: Array<{ price: number; volume: number; strength: number }>;
    below: Array<{ price: number; volume: number; strength: number }>;
  } {
    const avgVolume = levels.reduce((sum, level) => sum + level.volume, 0) / levels.length;
    const threshold = avgVolume * 0.2; // 20% of average volume

    const above = levels
      .filter(level => level.price > poc.price && level.volume < threshold)
      .map(level => ({
        price: level.price,
        volume: level.volume,
        strength: 1 - (level.volume / threshold)
      }))
      .sort((a, b) => a.strength - b.strength)
      .slice(0, 5);

    const below = levels
      .filter(level => level.price < poc.price && level.volume < threshold)
      .map(level => ({
        price: level.price,
        volume: level.volume,
        strength: 1 - (level.volume / threshold)
      }))
      .sort((a, b) => a.strength - b.strength)
      .slice(0, 5);

    return { above, below };
  }

  /**
   * Determine market structure from volume profile
   */
  private static determineMarketStructure(
    levels: VolumeProfileLevel[],
    valueArea: { high: number; low: number; range: number },
    currentPosition: VolumeProfileAnalysis['currentPricePosition']
  ): 'BALANCED' | 'TRENDING' | 'ROTATIONAL' | 'DISTRIBUTIVE' {
    const priceRange = levels[levels.length - 1].price - levels[0].price;
    const valueAreaRatio = valueArea.range / priceRange;
    const pocPosition = (levels.findIndex(level => level.price === currentPosition.price) / levels.length) * 100;

    // Count HVN above and below POC
    const pocIndex = levels.findIndex(level => Math.abs(level.price - currentPosition.price) < 0.01);
    const hvnAbove = levels.slice(pocIndex).filter(level => level.levelType === 'HVN').length;
    const hvnBelow = levels.slice(0, pocIndex).filter(level => level.levelType === 'HVN').length;

    if (valueAreaRatio < 0.15) {
      return 'TRENDING';
    } else if (valueAreaRatio > 0.5 && Math.abs(hvnAbove - hvnBelow) <= 1) {
      return 'BALANCED';
    } else if (pocPosition < 30 || pocPosition > 70) {
      return 'DISTRIBUTIVE';
    } else {
      return 'ROTATIONAL';
    }
  }

  /**
   * Analyze trading implications
   */
  private static analyzeTradingImplications(
    levels: VolumeProfileLevel[],
    valueArea: { high: number; low: number },
    currentPosition: VolumeProfileAnalysis['currentPricePosition']
  ): VolumeProfileAnalysis['tradingImplications'] {
    // Find support and resistance levels
    const supportLevels = levels
      .filter(level => level.levelType === 'HVN' && level.price < currentPosition.price)
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);

    const resistanceLevels = levels
      .filter(level => level.levelType === 'HVN' && level.price > currentPosition.price)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);

    // Calculate fair value zone (value area)
    const fairValueZone = { low: valueArea.low, high: valueArea.high };

    // Calculate volume imbalance
    const volumeBelow = levels
      .filter(level => level.price <= currentPosition.price)
      .reduce((sum, level) => sum + level.volume, 0);

    const volumeAbove = levels
      .filter(level => level.price > currentPosition.price)
      .reduce((sum, level) => sum + level.volume, 0);

    const volumeImbalance = ((volumeBelow - volumeAbove) / (volumeBelow + volumeAbove)) * 100;

    return {
      supportLevels,
      resistanceLevels,
      fairValueZone,
      volumeImbalance
    };
  }

  /**
   * Analyze support and resistance levels
   */
  private static analyzeSupportResistance(analysis: VolumeProfileAnalysis): number {
    let score = 50; // Base score

    const { supportLevels, resistanceLevels } = analysis.tradingImplications;
    const { currentPricePosition } = analysis;

    // Proximity to strong support/resistance
    const nearestSupport = supportLevels[0];
    const nearestResistance = resistanceLevels[0];

    if (nearestSupport && currentPricePosition.price - nearestSupport.price < 1.0) {
      score += 20; // Near strong support
    }

    if (nearestResistance && nearestResistance.price - currentPricePosition.price < 1.0) {
      score -= 20; // Near strong resistance
    }

    // Number of S/R levels
    if (supportLevels.length >= 2 && resistanceLevels.length >= 2) {
      score += 15; // Well-defined S/R levels
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze market structure implications
   */
  private static analyzeMarketStructure(analysis: VolumeProfileAnalysis): number {
    let score = 50; // Base score

    const { marketStructure, valueArea } = analysis;

    if (marketStructure === 'BALANCED') {
      score += 20; // Balanced market good for range trading
    } else if (marketStructure === 'TRENDING') {
      score -= 10; // Trending market requires different approach
    } else if (marketStructure === 'ROTATIONAL') {
      score += 15; // Rotational market good for mean reversion
    }

    // Value area characteristics
    const valueAreaRatio = valueArea.range / (analysis.profileLevels[analysis.profileLevels.length - 1].price - analysis.profileLevels[0].price);

    if (valueAreaRatio > 0.3 && valueAreaRatio < 0.5) {
      score += 10; // Well-defined value area
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze volume imbalance
   */
  private static analyzeVolumeImbalance(analysis: VolumeProfileAnalysis): number {
    let score = 50; // Base score

    const imbalance = analysis.tradingImplications.volumeImbalance;
    const { currentPricePosition } = analysis;

    // Strong imbalance in direction of price position
    if (currentPricePosition.position === 'BELOW_VA_LOW' && imbalance > 30) {
      score += 25; // Strong buying pressure below value area
    } else if (currentPricePosition.position === 'ABOVE_VA_HIGH' && imbalance < -30) {
      score += 25; // Strong selling pressure above value area
    } else if (Math.abs(imbalance) > 20) {
      score += 15; // Moderate imbalance
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze fair value deviation
   */
  private static analyzeFairValueDeviation(analysis: VolumeProfileAnalysis): number {
    let score = 50; // Base score

    const { currentPricePosition, poc } = analysis;
    const { fairValueZone } = analysis.tradingImplications;

    // Distance from POC
    if (currentPricePosition.distanceToPOC > 2.0) {
      score += 20; // Far from POC, potential for reversion
    } else if (currentPricePosition.distanceToPOC < 0.5) {
      score -= 10; // At POC, fair value reached
    }

    // Position relative to value area
    if (currentPricePosition.position === 'IN_VALUE_AREA') {
      score += 10; // In value area, fair price
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