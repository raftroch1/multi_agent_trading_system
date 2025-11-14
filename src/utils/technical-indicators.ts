
import { MarketData, TechnicalIndicators } from './types';

export class TechnicalAnalysis {
  
  static calculateRSI(data: MarketData[], period: number = 14): number[] {
    if (data.length < period + 1) return [];
    
    const rsiValues: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate first RSI
    let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    
    let rs = avgGain / (avgLoss || 0.01);
    rsiValues.push(100 - (100 / (1 + rs)));
    
    // Calculate subsequent RSI values using smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      rs = avgGain / (avgLoss || 0.01);
      rsiValues.push(100 - (100 / (1 + rs)));
    }
    
    return rsiValues;
  }
  
  static calculateMACD(
    data: MarketData[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    
    const fastEMA = this.calculateEMA(data.map(d => d.close), fastPeriod);
    const slowEMA = this.calculateEMA(data.map(d => d.close), slowPeriod);
    
    const macd: number[] = [];
    for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram: number[] = [];
    
    for (let i = 0; i < Math.min(macd.length, signal.length); i++) {
      histogram.push(macd[i] - signal[i]);
    }
    
    return { macd, signal, histogram };
  }
  
  static calculateBollingerBands(
    data: MarketData[], 
    period: number = 20, 
    stdDev: number = 2
  ): { upper: number[]; middle: number[]; lower: number[] } {
    
    const closes = data.map(d => d.close);
    const sma = this.calculateSMA(closes, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, val) => sum + val, 0) / period;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const standardDev = Math.sqrt(variance);
      
      upper.push(sma[i - period + 1] + (stdDev * standardDev));
      lower.push(sma[i - period + 1] - (stdDev * standardDev));
    }
    
    return { 
      upper, 
      middle: sma, 
      lower 
    };
  }
  
  static calculateAllIndicators(
    data: MarketData[],
    rsiPeriod: number = 14,
    macdFast: number = 12,
    macdSlow: number = 26,
    macdSignal: number = 9,
    bbPeriod: number = 20,
    bbStdDev: number = 2
  ): TechnicalIndicators | null {
    
    if (data.length < Math.max(rsiPeriod, macdSlow, bbPeriod) + 1) {
      return null;
    }
    
    const rsi = this.calculateRSI(data, rsiPeriod);
    const macd = this.calculateMACD(data, macdFast, macdSlow, macdSignal);
    const bb = this.calculateBollingerBands(data, bbPeriod, bbStdDev);
    
    // Return the most recent values
    return {
      rsi: rsi[rsi.length - 1] || 0,
      macd: macd.macd[macd.macd.length - 1] || 0,
      macdSignal: macd.signal[macd.signal.length - 1] || 0,
      macdHistogram: macd.histogram[macd.histogram.length - 1] || 0,
      bbUpper: bb.upper[bb.upper.length - 1] || 0,
      bbMiddle: bb.middle[bb.middle.length - 1] || 0,
      bbLower: bb.lower[bb.lower.length - 1] || 0
    };
  }
  
  private static calculateEMA(data: number[], period: number): number[] {
    if (data.length < period) return [];
    
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema.push(sum / period);
    
    // Calculate EMA for remaining periods
    for (let i = period; i < data.length; i++) {
      ema.push((data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    
    return ema;
  }
  
  private static calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) return [];
    
    const sma: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const average = slice.reduce((sum, val) => sum + val, 0) / period;
      sma.push(average);
    }
    
    return sma;
  }
}
