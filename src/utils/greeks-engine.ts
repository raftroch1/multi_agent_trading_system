/**
 * ADVANCED GREEKS CALCULATION ENGINE
 * Dynamic tracking of option Greeks throughout trade lifecycle
 */

import { OptionsChain, MarketData } from '../types';

export interface GreeksSnapshot {
  timestamp: Date;
  underlyingPrice: number;
  timeToExpiration: number; // Years
  impliedVolatility: number;
  riskFreeRate: number;
  // Primary Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  // Advanced Greeks
  lambda: number; // Leverage factor
  epsilon: number; // Psi - elasticity
  vomma: number; // Vega convexity
  charm: number; // Delta decay
  speed: number; // Gamma decay
  color: number; // Gamma convexity
  // Portfolio Greeks (for spreads)
  netDelta?: number;
  netGamma?: number;
  netTheta?: number;
  netVega?: number;
}

export interface GreeksSensitivity {
  priceMove1Dollar: GreeksSnapshot;
  priceMove5Dollar: GreeksSnapshot;
  volMove1Percent: GreeksSnapshot;
  timeDecay1Day: GreeksSnapshot;
}

export class GreeksEngine {
  private static readonly RISK_FREE_RATE = 0.05; // 5% risk-free rate
  private static readonly TRADING_DAYS_PER_YEAR = 252;

  /**
   * Calculate comprehensive Greeks for a single option
   */
  static calculateGreeks(
    option: OptionsChain,
    underlyingPrice: number,
    timeToExpiration: number, // In years
    impliedVolatility: number = option.impliedVolatility || 0.2,
    riskFreeRate: number = this.RISK_FREE_RATE
  ): GreeksSnapshot {
    const optionType = option.side === 'CALL' ? 'call' : 'put';
    const strike = option.strike;

    // Black-Scholes components
    const d1 = this.calculateD1(
      underlyingPrice,
      strike,
      timeToExpiration,
      impliedVolatility,
      riskFreeRate
    );
    const d2 = d1 - impliedVolatility * Math.sqrt(timeToExpiration);

    const N_d1 = this.normalCDF(d1);
    const N_d2 = this.normalCDF(d2);
    const n_d1 = this.normalPDF(d1); // Standard normal PDF

    // Primary Greeks
    const delta = this.calculateDelta(optionType, N_d1, N_d2, riskFreeRate, timeToExpiration);
    const gamma = this.calculateGamma(n_d1, underlyingPrice, impliedVolatility, timeToExpiration);
    const theta = this.calculateTheta(
      optionType,
      underlyingPrice,
      strike,
      n_d1,
      N_d1,
      N_d2,
      impliedVolatility,
      timeToExpiration,
      riskFreeRate
    );
    const vega = this.calculateVega(underlyingPrice, n_d1, timeToExpiration) / 100; // Per 1% vol change
    const rho = this.calculateRho(optionType, strike, N_d2, timeToExpiration, riskFreeRate) / 100; // Per 1% rate change

    // Advanced Greeks
    const lambda =
      delta *
      (underlyingPrice /
        this.calculateOptionPrice(
          optionType,
          underlyingPrice,
          strike,
          timeToExpiration,
          impliedVolatility,
          riskFreeRate
        ));
    const epsilon = (vega * impliedVolatility) / 100; // Psi - elasticity to volatility
    const vomma = (vega * d1 * d2) / impliedVolatility; // Vega convexity
    const charm =
      (-n_d1 *
        (2 * riskFreeRate * timeToExpiration -
          d2 * impliedVolatility * Math.sqrt(timeToExpiration))) /
      (2 * timeToExpiration * impliedVolatility * Math.sqrt(timeToExpiration));
    const speed =
      (-gamma / underlyingPrice) * (d1 / (impliedVolatility * Math.sqrt(timeToExpiration)) + 1);
    const color =
      (-n_d1 /
        (2 *
          underlyingPrice *
          timeToExpiration *
          impliedVolatility *
          Math.sqrt(timeToExpiration))) *
      (2 * riskFreeRate * timeToExpiration +
        1 +
        (d1 *
          (2 * riskFreeRate * timeToExpiration -
            d2 * impliedVolatility * Math.sqrt(timeToExpiration))) /
          (impliedVolatility * Math.sqrt(timeToExpiration)));

    return {
      timestamp: new Date(),
      underlyingPrice,
      timeToExpiration,
      impliedVolatility,
      riskFreeRate,
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(6)),
      theta: Number(theta.toFixed(2)),
      vega: Number(vega.toFixed(2)),
      rho: Number(rho.toFixed(2)),
      lambda: Number(lambda.toFixed(2)),
      epsilon: Number(epsilon.toFixed(4)),
      vomma: Number(vomma.toFixed(4)),
      charm: Number(charm.toFixed(6)),
      speed: Number(speed.toFixed(8)),
      color: Number(color.toFixed(8)),
    };
  }

  /**
   * Calculate portfolio Greeks for multi-leg strategies
   */
  static calculatePortfolioGreeks(
    legs: { option: OptionsChain; quantity: number; side: 'LONG' | 'SHORT' }[],
    underlyingPrice: number,
    timeToExpiration: number
  ): GreeksSnapshot {
    let netDelta = 0;
    let netGamma = 0;
    let netTheta = 0;
    let netVega = 0;
    let netRho = 0;

    for (const leg of legs) {
      const greeks = this.calculateGreeks(leg.option, underlyingPrice, timeToExpiration);
      const multiplier = leg.quantity * (leg.side === 'LONG' ? 1 : -1);

      netDelta += greeks.delta * multiplier;
      netGamma += greeks.gamma * multiplier;
      netTheta += greeks.theta * multiplier;
      netVega += greeks.vega * multiplier;
      netRho += greeks.rho * multiplier;
    }

    // Return portfolio Greeks using the first leg as reference
    const firstLeg = this.calculateGreeks(legs[0].option, underlyingPrice, timeToExpiration);

    return {
      ...firstLeg,
      netDelta: Number(netDelta.toFixed(4)),
      netGamma: Number(netGamma.toFixed(6)),
      netTheta: Number(netTheta.toFixed(2)),
      netVega: Number(netVega.toFixed(2)),
      delta: Number(netDelta.toFixed(4)), // Override individual with portfolio
      gamma: Number(netGamma.toFixed(6)),
      theta: Number(netTheta.toFixed(2)),
      vega: Number(netVega.toFixed(2)),
    };
  }

  /**
   * Calculate Greeks sensitivity to various market moves
   */
  static calculateSensitivity(
    option: OptionsChain,
    underlyingPrice: number,
    timeToExpiration: number
  ): GreeksSensitivity {
    const iv = option.impliedVolatility || 0.2;

    return {
      priceMove1Dollar: this.calculateGreeks(option, underlyingPrice + 1, timeToExpiration, iv),
      priceMove5Dollar: this.calculateGreeks(option, underlyingPrice + 5, timeToExpiration, iv),
      volMove1Percent: this.calculateGreeks(option, underlyingPrice, timeToExpiration, iv + 0.01),
      timeDecay1Day: this.calculateGreeks(option, underlyingPrice, timeToExpiration - 1 / 365, iv),
    };
  }

  /**
   * Track Greeks changes over time for analysis
   */
  static trackGreeksEvolution(
    option: OptionsChain,
    marketData: MarketData[],
    entryDate: Date
  ): GreeksSnapshot[] {
    const evolution: GreeksSnapshot[] = [];
    const entryTime = entryDate.getTime();

    for (const bar of marketData) {
      if (bar.date.getTime() >= entryTime) {
        const daysToExpiration =
          (option.expiration.getTime() - bar.date.getTime()) / (1000 * 60 * 60 * 24);
        const timeToExpiration = Math.max(0.001, daysToExpiration / 365); // Minimum 0.001 years

        const snapshot = this.calculateGreeks(
          option,
          bar.close,
          timeToExpiration,
          option.impliedVolatility || 0.2
        );

        evolution.push(snapshot);
      }
    }

    return evolution;
  }

  // =================== PRIVATE HELPER METHODS ===================

  private static calculateD1(S: number, K: number, T: number, sigma: number, r: number): number {
    return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  }

  private static calculateDelta(
    type: 'call' | 'put',
    N_d1: number,
    N_d2: number,
    r: number,
    T: number
  ): number {
    if (type === 'call') {
      return N_d1;
    } else {
      return N_d1 - 1;
    }
  }

  private static calculateGamma(n_d1: number, S: number, sigma: number, T: number): number {
    return n_d1 / (S * sigma * Math.sqrt(T));
  }

  private static calculateTheta(
    type: 'call' | 'put',
    S: number,
    K: number,
    n_d1: number,
    N_d1: number,
    N_d2: number,
    sigma: number,
    T: number,
    r: number
  ): number {
    const common = -(S * n_d1 * sigma) / (2 * Math.sqrt(T));

    if (type === 'call') {
      return (common - r * K * Math.exp(-r * T) * N_d2) / 365; // Per day
    } else {
      return (common + r * K * Math.exp(-r * T) * (1 - N_d2)) / 365; // Per day
    }
  }

  private static calculateVega(S: number, n_d1: number, T: number): number {
    return S * n_d1 * Math.sqrt(T);
  }

  private static calculateRho(
    type: 'call' | 'put',
    K: number,
    N_d2: number,
    T: number,
    r: number
  ): number {
    if (type === 'call') {
      return K * T * Math.exp(-r * T) * N_d2;
    } else {
      return -K * T * Math.exp(-r * T) * (1 - N_d2);
    }
  }

  private static calculateOptionPrice(
    type: 'call' | 'put',
    S: number,
    K: number,
    T: number,
    sigma: number,
    r: number
  ): number {
    const d1 = this.calculateD1(S, K, T, sigma, r);
    const d2 = d1 - sigma * Math.sqrt(T);

    if (type === 'call') {
      return S * this.normalCDF(d1) - K * Math.exp(-r * T) * this.normalCDF(d2);
    } else {
      return K * Math.exp(-r * T) * this.normalCDF(-d2) - S * this.normalCDF(-d1);
    }
  }

  private static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private static normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Check if position has dangerous Greeks exposure
   */
  static checkGreeksRisk(
    greeks: GreeksSnapshot,
    positionSize: number
  ): {
    isRisky: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isRisky = false;

    // Check if this is 0-DTE (less than 1 day to expiration)
    const isZeroDTE = greeks.timeToExpiration < 1/365; // Less than 1 day

    if (isZeroDTE) {
      // 🔥 0-DTE OPTIMIZED RISK THRESHOLDS
      console.log(`🎯 0-DTE RISK CHECK: Using optimized thresholds for same-day expiry`);

      // Delta risk (0-DTE options naturally have high delta)
      const totalDelta = Math.abs(greeks.delta * positionSize);
      if (totalDelta > 100) { // Higher threshold for 0-DTE
        warnings.push(`Extreme delta exposure: ${totalDelta.toFixed(1)} (>100)`);
        isRisky = true;
      }

      // Gamma risk (expected to be high in 0-DTE)
      const totalGamma = Math.abs(greeks.gamma * positionSize);
      if (totalGamma > 2.0) { // Much higher threshold for 0-DTE
        warnings.push(`Extreme gamma exposure: ${totalGamma.toFixed(3)} (>2.0)`);
        isRisky = true;
      }

      // Theta decay (rapid decay is EXPECTED for 0-DTE - much higher thresholds)
      const totalTheta = Math.abs(greeks.theta * positionSize);
      if (totalTheta > 5000) { // Very high threshold for 0-DTE (theta decay is normal)
        warnings.push(`Extreme theta decay: $${totalTheta.toFixed(0)}/day (>$5000)`);
        isRisky = true;
      }

      // Vega risk (lower exposure in 0-DTE)
      const totalVega = Math.abs(greeks.vega * positionSize);
      if (totalVega > 500) { // Higher threshold for 0-DTE
        warnings.push(`High vega exposure: $${totalVega.toFixed(0)} per 1% vol (>$500)`);
        isRisky = true;
      }

      // 0-DTE specific timing check
      if (greeks.timeToExpiration < 0.0005) {
        // Less than 0.1825 days (~4.4 hours) - getting too close for 0-DTE
        warnings.push(`Too close to expiration: ${(greeks.timeToExpiration * 365 * 24).toFixed(1)} hours remaining (<4h)`);
        isRisky = true;
      }

    } else {
      // Traditional multi-day options risk thresholds
      console.log(`📊 TRADITIONAL RISK CHECK: Using standard thresholds for multi-day expiry`);

      // Delta risk (directional exposure)
      const totalDelta = Math.abs(greeks.delta * positionSize);
      if (totalDelta > 50) {
        warnings.push(`High delta exposure: ${totalDelta.toFixed(1)} (>50)`);
        isRisky = true;
      }

      // Gamma risk (acceleration risk)
      const totalGamma = Math.abs(greeks.gamma * positionSize);
      if (totalGamma > 0.1) {
        warnings.push(`High gamma exposure: ${totalGamma.toFixed(3)} (>0.1)`);
        isRisky = true;
      }

      // Theta decay (time risk)
      const totalTheta = Math.abs(greeks.theta * positionSize);
      if (totalTheta > 100) {
        warnings.push(`High theta decay: $${totalTheta.toFixed(0)}/day (>$100)`);
        isRisky = true;
      }

      // Vega risk (volatility exposure)
      const totalVega = Math.abs(greeks.vega * positionSize);
      if (totalVega > 200) {
        warnings.push(`High vega exposure: $${totalVega.toFixed(0)} per 1% vol (>$200)`);
        isRisky = true;
      }

      // Time to expiration risk for multi-day options
      if (greeks.timeToExpiration < 0.001) {
        warnings.push(`Too close to expiration: ${(greeks.timeToExpiration * 365).toFixed(2)} days remaining`);
        isRisky = true;
      }
      }

    return { isRisky, warnings };
  }
}
