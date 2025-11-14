/**
 * VOLUME PROFILE AGENT - OPTIMIZED VERSION
 *
 * Fast volume-at-price analysis for 0-DTE trading
 * Optimized for speed to prevent system hangs
 *
 * Analyzes:
 * - Point of Control (POC) - highest volume price level
 * - Value Area - price range containing 70% of volume
 * - Current price position relative to value area
 * - Support/resistance levels from volume nodes
 */

import { MarketData, OptionsChain, TradeSignal } from '../types';

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  volumePercentage: number;
  levelType: 'POC' | 'HVN' | 'LVN' | 'NORMAL';
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface QuickVolumeProfile {
  poc: { price: number; volume: number; volumePercentage: number };
  valueArea: { val: number; vah: number; volumePercentage: number };
  currentPricePosition: {
    price: number;
    position: 'ABOVE_VALUE_AREA' | 'IN_VALUE_AREA' | 'BELOW_VALUE_AREA';
    distanceFromPOC: number;
  };
  volumeLevels: VolumeProfileLevel[];
}

/**
 * Optimized Volume Profile Agent for fast 0-DTE analysis
 */
export class VolumeProfileAgentOptimized {
  /**
   * Fast volume profile analysis optimized for 0-DTE trading
   */
  static analyze(marketData: MarketData[], optionsChain: OptionsChain[]): AgentSignal {
    const reasoning: string[] = [];
    let signal: 'BUY_CALL' | 'BUY_PUT' | 'NO_TRADE' = 'NO_TRADE';
    let confidence = 50;

    console.log('📊 VOLUME PROFILE AGENT - INITIATING FAST ANALYSIS');
    console.log('===============================================');

    if (marketData.length < 20) {
      return {
        agent: 'VolumeProfile',
        signal: 'NO_TRADE',
        confidence: 0,
        reasoning: ['Insufficient data for volume profile analysis (need 20+ bars)'],
        data: null
      };
    }

    // ⚡ OPTIMIZED: Use only last 50 bars for performance
    const recentBars = marketData.slice(-50);
    const currentPrice = recentBars[recentBars.length - 1].close;

    // Fast volume profile calculation
    const volumeProfile = this.calculateQuickVolumeProfile(recentBars);

    reasoning.push(`Current Price: $${currentPrice.toFixed(2)}`);
    reasoning.push(`Point of Control: $${volumeProfile.poc.price.toFixed(2)} (${volumeProfile.poc.volumePercentage.toFixed(1)}% volume)`);
    reasoning.push(`Value Area: $${volumeProfile.valueArea.val.toFixed(2)} - $${volumeProfile.valueArea.vah.toFixed(2)}`);
    reasoning.push(`Price Position: ${volumeProfile.currentPricePosition.position}`);
    reasoning.push(`Distance from POC: ${volumeProfile.currentPricePosition.distanceFromPOC.toFixed(2)}%`);

    // ⚡ OPTIMIZED: Simplified signal generation
    const score = this.calculateOptimizedScore(volumeProfile, currentPrice);
    reasoning.push(`Volume Profile Score: ${score}/100`);

    // Generate signal based on optimized analysis
    if (score >= 70) {
      if (volumeProfile.currentPricePosition.position === 'BELOW_VALUE_AREA') {
        signal = 'BUY_CALL';
        confidence = Math.min(85, 60 + score * 0.25);
        reasoning.push('✅ BUY CALL: Price below value area with strong volume support');
      } else if (volumeProfile.currentPricePosition.position === 'ABOVE_VALUE_AREA') {
        signal = 'BUY_PUT';
        confidence = Math.min(85, 60 + score * 0.25);
        reasoning.push('✅ BUY PUT: Price above value area with strong volume resistance');
      }
    } else if (score >= 55) {
      if (volumeProfile.currentPricePosition.position === 'BELOW_VALUE_AREA') {
        signal = 'BUY_CALL';
        confidence = Math.min(75, 50 + score * 0.2);
        reasoning.push('✅ BUY CALL: Price below value area with moderate volume support');
      } else if (volumeProfile.currentPricePosition.position === 'ABOVE_VALUE_AREA') {
        signal = 'BUY_PUT';
        confidence = Math.min(75, 50 + score * 0.2);
        reasoning.push('✅ BUY PUT: Price above value area with moderate volume resistance');
      }
    } else {
      signal = 'NO_TRADE';
      confidence = 65;
      reasoning.push('❌ NO TRADE: Price in value area, no clear volume edge for 0-DTE');
    }

    console.log(`📊 VOLUME PROFILE ANALYSIS COMPLETE:`);
    console.log(`   Score: ${score.toFixed(1)}/100`);
    console.log(`   Signal: ${signal} (${confidence}% confidence)`);
    console.log(`   Position: ${volumeProfile.currentPricePosition.position}`);

    return {
      agent: 'VolumeProfile',
      signal,
      confidence,
      reasoning,
      data: volumeProfile
    };
  }

  /**
   * ⚡ OPTIMIZED: Fast volume profile calculation
   */
  private static calculateQuickVolumeProfile(marketData: MarketData[]): QuickVolumeProfile {
    const volumeAtPrice: { [price: string]: number } = {};
    let totalVolume = 0;

    // Aggregate volume by price levels (rounded to $0.05 for speed)
    for (const bar of marketData) {
      const priceRounded = Math.round(bar.close * 20) / 20; // Round to $0.05
      const volume = Number(bar.volume || 0);

      volumeAtPrice[priceRounded] = (volumeAtPrice[priceRounded] || 0) + volume;
      totalVolume += volume;
    }

    // Find Point of Control (highest volume price)
    let pocPrice = 0;
    let pocVolume = 0;

    for (const [priceStr, volume] of Object.entries(volumeAtPrice)) {
      if (volume > pocVolume) {
        pocVolume = volume;
        pocPrice = parseFloat(priceStr);
      }
    }

    const pocVolumePercentage = totalVolume > 0 ? (pocVolume / totalVolume) * 100 : 0;

    // Calculate simple value area (top 70% of volume)
    const sortedEntries = Object.entries(volumeAtPrice)
      .sort(([,a], [,b]) => b - a);

    let valueAreaVolume = 0;
    const valueAreaPrices: number[] = [];
    const targetVolume = totalVolume * 0.7;

    for (const [priceStr, volume] of sortedEntries) {
      if (valueAreaVolume >= targetVolume) break;
      valueAreaVolume += volume;
      valueAreaPrices.push(parseFloat(priceStr));
    }

    const valueAreaHigh = Math.max(...valueAreaPrices);
    const valueAreaLow = Math.min(...valueAreaPrices);
    const valueAreaPercentage = (valueAreaVolume / totalVolume) * 100;

    // Determine current price position
    const currentPrice = marketData[marketData.length - 1].close;
    let position: 'ABOVE_VALUE_AREA' | 'IN_VALUE_AREA' | 'BELOW_VALUE_AREA';

    if (currentPrice > valueAreaHigh) {
      position = 'ABOVE_VALUE_AREA';
    } else if (currentPrice < valueAreaLow) {
      position = 'BELOW_VALUE_AREA';
    } else {
      position = 'IN_VALUE_AREA';
    }

    const distanceFromPOC = Math.abs((currentPrice - pocPrice) / pocPrice) * 100;

    // Create volume levels array
    const volumeLevels: VolumeProfileLevel[] = sortedEntries.map(([priceStr, volume]) => {
      const price = parseFloat(priceStr);
      const volumePercentage = (volume / totalVolume) * 100;

      let levelType: 'POC' | 'HVN' | 'LVN' | 'NORMAL';
      let significance: 'HIGH' | 'MEDIUM' | 'LOW';

      if (price === pocPrice) {
        levelType = 'POC';
        significance = 'HIGH';
      } else if (volumePercentage > pocVolumePercentage * 0.7) {
        levelType = 'HVN';
        significance = volumePercentage > 10 ? 'HIGH' : 'MEDIUM';
      } else if (volumePercentage < pocVolumePercentage * 0.3) {
        levelType = 'LVN';
        significance = 'MEDIUM';
      } else {
        levelType = 'NORMAL';
        significance = 'LOW';
      }

      return { price, volume, volumePercentage, levelType, significance };
    });

    return {
      poc: { price: pocPrice, volume: pocVolume, volumePercentage: pocVolumePercentage },
      valueArea: { val: valueAreaLow, vah: valueAreaHigh, volumePercentage: valueAreaPercentage },
      currentPricePosition: { price: currentPrice, position, distanceFromPOC },
      volumeLevels
    };
  }

  /**
   * ⚡ OPTIMIZED: Fast scoring calculation
   */
  private static calculateOptimizedScore(profile: QuickVolumeProfile, currentPrice: number): number {
    let score = 50; // Base score

    // 1. Price position relative to value area (40% weight)
    if (profile.currentPricePosition.position === 'BELOW_VALUE_AREA') {
      score += 20; // Below value area = bullish
    } else if (profile.currentPricePosition.position === 'ABOVE_VALUE_AREA') {
      score -= 20; // Above value area = bearish
    }

    // 2. Distance from POC (30% weight)
    const distanceFromPOC = profile.currentPricePosition.distanceFromPOC;
    if (distanceFromPOC > 1.0) {
      score += profile.currentPricePosition.position === 'BELOW_VALUE_AREA' ? 15 : -15;
    } else if (distanceFromPOC > 0.5) {
      score += profile.currentPricePosition.position === 'BELOW_VALUE_AREA' ? 8 : -8;
    }

    // 3. POC strength (20% weight)
    if (profile.poc.volumePercentage > 20) {
      score += 10; // Very strong POC
    } else if (profile.poc.volumePercentage > 15) {
      score += 5; // Strong POC
    }

    // 4. Value area concentration (10% weight)
    if (profile.valueArea.volumePercentage > 75) {
      score += 5; // Well-defined value area
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