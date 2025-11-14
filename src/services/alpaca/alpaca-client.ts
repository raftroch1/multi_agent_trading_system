/**
 * WORKING ALPACA CLIENT FOR NAKED OPTIONS
 *
 * Adapted from Alpaca_Dashboard_TS for naked calls/puts strategy
 * Focus on single-leg options trading
 */

import { AlpacaCredentials, MarketData, OptionsChain } from '../../types';
import axios from 'axios';

class AlpacaClient {
  private credentials: AlpacaCredentials;

  constructor() {
    this.credentials = {
      apiKey: process.env.ALPACA_API_KEY || '',
      apiSecret: process.env.ALPACA_API_SECRET || '',
      baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    };

    if (!this.credentials.apiKey || !this.credentials.apiSecret) {
      throw new Error(
        'Alpaca API credentials not found. Please set ALPACA_API_KEY and ALPACA_API_SECRET in .env file.'
      );
    }
  }

  // Get proper headers for Alpaca API as per documentation
  private getHeaders() {
    return {
      'APCA-API-KEY-ID': this.credentials.apiKey,
      'APCA-API-SECRET-KEY': this.credentials.apiSecret,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.credentials.baseUrl}/v2/account`, {
        headers: this.getHeaders(),
      });
      console.log('✅ Alpaca connection successful');
      return response.status === 200;
    } catch (error) {
      console.error('❌ Alpaca connection failed:', error);
      return false;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Get latest market data for current price
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const marketData = await this.getMarketData(symbol, startDate, endDate, '1Day');

      if (marketData.length === 0) {
        throw new Error(`No market data available for ${symbol}`);
      }

      const currentPrice = marketData[marketData.length - 1].close;
      console.log(`✅ Current price for ${symbol}: $${currentPrice.toFixed(2)}`);
      return currentPrice;
    } catch (error) {
      console.error(`❌ Error fetching current price for ${symbol}:`, error);
      throw new Error(`Failed to get current price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMarketData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' = '1Day'
  ): Promise<MarketData[]> {
    try {
      console.log(
        `📊 Fetching ${timeframe} market data for ${symbol} from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      const response = await axios.get(`https://data.alpaca.markets/v2/stocks/${symbol}/bars`, {
        headers: this.getHeaders(),
        params: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          timeframe: timeframe,
          limit: 10000,
          feed: 'iex', // Use IEX feed instead of SIP (free with paper trading)
        },
      });

      const marketData: MarketData[] = [];

      if (response.data.bars) {
        response.data.bars.forEach((bar: any, index: number) => {
          marketData.push({
            id: `${symbol}_${bar.t}_${index}`,
            symbol: symbol,
            date: new Date(bar.t),
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: BigInt(Math.floor(bar.v)),
            createdAt: new Date(),
          });
        });
      }

      console.log(`✅ Retrieved ${marketData.length} ${timeframe} bars for ${symbol}`);
      return marketData;
    } catch (error: any) {
      console.error(`❌ Error fetching market data for ${symbol}:`, error);

      // Check if it's a 403 subscription error
      if (error.response?.status === 403) {
        console.error('🚫 403 Forbidden: Market data subscription required');
        console.error('💡 Solution: Using IEX feed instead of SIP (should be free with paper trading)');
      }

      throw new Error(`Failed to fetch market data for ${symbol}: ${error.message}`);
    }
  }

  /**
   * 🔥 NAKED OPTIONS: Get 0-DTE options chain for naked calls/puts
   */
  async getOptionsChain(symbol: string, expiration?: Date): Promise<OptionsChain[]> {
    try {
      console.log(`🔥 Fetching 0-DTE options chain for ${symbol} (naked options)...`);

      const currentPrice = await this.getCurrentPrice(symbol);
      const today = new Date();
      const targetExp = expiration || this.getTodayExpiration();

      console.log(`🎯 Current SPY price: $${currentPrice.toFixed(2)}, Target expiration: ${targetExp.toDateString()}`);

      // Try to get real options chain from Alpaca
      const realChain = await this.getRealOptionsChain(symbol, targetExp, currentPrice);

      if (realChain.length > 0) {
        console.log(`✅ Retrieved ${realChain.length} real options contracts`);
        return realChain;
      }

      // Fallback to synthetic data
      console.log(`⚠️ Using synthetic options data as fallback`);
      return this.generateSyntheticOptionsChain(symbol, currentPrice, targetExp);

    } catch (error) {
      console.error('Error fetching options chain:', error);
      const currentPrice = await this.getCurrentPrice(symbol);
      const targetExp = expiration || this.getTodayExpiration();
      return this.generateSyntheticOptionsChain(symbol, currentPrice, targetExp);
    }
  }

  private getTodayExpiration(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();

    if (dayOfWeek === 6) { // Saturday
      today.setDate(today.getDate() + 2); // Next Monday
    } else if (dayOfWeek === 0) { // Sunday
      today.setDate(today.getDate() + 1); // Tomorrow Monday
    }

    today.setHours(16, 0, 0, 0); // 4 PM market close
    return today;
  }

  private async getRealOptionsChain(symbol: string, expiration: Date, currentPrice: number): Promise<OptionsChain[]> {
    try {
      const snapshotsResponse = await fetch(
        `https://data.alpaca.markets/v1beta1/options/snapshots/${symbol}`,
        {
          headers: {
            'APCA-API-KEY-ID': this.credentials.apiKey,
            'APCA-API-SECRET-KEY': this.credentials.apiSecret,
          },
        }
      );

      if (!snapshotsResponse.ok) {
        console.log(`⚠️ Real options data unavailable`);
        return [];
      }

      const data: any = await snapshotsResponse.json();
      if (!data.snapshots || Object.keys(data.snapshots).length === 0) {
        return [];
      }

      const optionsChain: OptionsChain[] = [];
      for (const [optionSymbol, snapshot] of Object.entries(data.snapshots)) {
        const option = this.parseOptionSnapshot(optionSymbol, snapshot);
        if (option) {
          // Filter for today's expiration and reasonable strikes
          if (option.expiration.toDateString() === expiration.toDateString()) {
            const otmPercent = Math.abs(option.strike - currentPrice) / currentPrice;
            if (otmPercent >= 0.003 && otmPercent <= 0.05) { // 0.3% - 5% OTM for naked options
              optionsChain.push(option);
            }
          }
        }
      }

      return optionsChain;
    } catch (error) {
      console.error('Error getting real options chain:', error);
      return [];
    }
  }

  private parseOptionSnapshot(optionSymbol: string, snapshot: any): OptionsChain | null {
    try {
      // Parse option symbol format: SPYYMMDDCPPPPPPP (e.g., SPY241220C00450000)
      const symbolMatch = /^([A-Z]+)(\d{6})([CP])(\d{8})$/.exec(optionSymbol);
      if (!symbolMatch) return null;

      const [, underlying, dateStr, callPut, strikeStr] = symbolMatch;

      // Parse expiration date YYMMDD
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4)) - 1;
      const day = parseInt(dateStr.substring(4, 6));
      const expiration = new Date(year, month, day);

      // Parse strike price (divide by 1000)
      const strike = parseInt(strikeStr) / 1000;

      // Extract real market data from Alpaca snapshot
      const latestTrade = snapshot.latestTrade;
      const latestQuote = snapshot.latestQuote;
      const greeks = snapshot.greeks || {};

      const bid = latestQuote?.bp || 0.01;
      const ask = latestQuote?.ap || bid + 0.05;
      const last = latestTrade?.p || (bid + ask) / 2;

      return {
        symbol: optionSymbol,
        expiration,
        strike,
        side: callPut === 'C' ? 'CALL' : 'PUT',
        bid,
        ask,
        last,
        impliedVolatility: greeks.impliedVolatility || 0.2,
        delta: greeks.delta || 0.5,
        volume: latestTrade?.s || 100,
        openInterest: snapshot.openInterest || 500,
      };
    } catch (error) {
      console.error('Error parsing option snapshot:', error);
      return null;
    }
  }

  private generateSyntheticOptionsChain(symbol: string, currentPrice: number, expiration: Date): OptionsChain[] {
    console.log(`🔧 Generating synthetic options chain for ${symbol} at $${currentPrice.toFixed(2)}`);

    const optionsChain: OptionsChain[] = [];
    const timeToExpiry = Math.max(0.01, (expiration.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));

    // Generate strikes for naked options (0.3% - 5% OTM)
    for (let otmPercent = 0.003; otmPercent <= 0.05; otmPercent += 0.002) {
      const callStrike = currentPrice * (1 + otmPercent);
      const putStrike = currentPrice * (1 - otmPercent);

      // Simple Black-Scholes pricing
      const volatility = 0.25; // Higher IV for 0-DTE
      const riskFreeRate = 0.05;

      // Call option
      const { callPrice, callDelta } = this.calculateOptionPrice(currentPrice, callStrike, timeToExpiry, volatility, riskFreeRate, true);
      const callSpread = Math.max(0.05, callPrice * 0.05);

      optionsChain.push({
        symbol: `${symbol}${this.formatExpiration(expiration)}C${this.formatStrike(callStrike)}`,
        expiration,
        strike: Math.round(callStrike * 100) / 100,
        side: 'CALL',
        bid: Math.max(0.01, callPrice - callSpread),
        ask: callPrice + callSpread,
        last: callPrice,
        impliedVolatility: volatility,
        delta: callDelta,
        volume: Math.floor(Math.random() * 1000) + 100,
        openInterest: Math.floor(Math.random() * 5000) + 500,
      });

      // Put option
      const { putPrice, putDelta } = this.calculateOptionPrice(currentPrice, putStrike, timeToExpiry, volatility, riskFreeRate, false);
      const putSpread = Math.max(0.05, putPrice * 0.05);

      optionsChain.push({
        symbol: `${symbol}${this.formatExpiration(expiration)}P${this.formatStrike(putStrike)}`,
        expiration,
        strike: Math.round(putStrike * 100) / 100,
        side: 'PUT',
        bid: Math.max(0.01, putPrice - putSpread),
        ask: putPrice + putSpread,
        last: putPrice,
        impliedVolatility: volatility,
        delta: putDelta,
        volume: Math.floor(Math.random() * 1000) + 100,
        openInterest: Math.floor(Math.random() * 5000) + 500,
      });
    }

    console.log(`✅ Generated ${optionsChain.length} synthetic options contracts`);
    return optionsChain;
  }

  private calculateOptionPrice(S: number, K: number, T: number, vol: number, r: number, isCall: boolean) {
    const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
    const d2 = d1 - vol * Math.sqrt(T);

    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);
    const NmD2 = this.normalCDF(-d2);

    if (isCall) {
      const callPrice = S * Nd1 - K * Math.exp(-r * T) * Nd2;
      return { callPrice: Math.max(0.01, callPrice), callDelta: Nd1 };
    } else {
      const putPrice = K * Math.exp(-r * T) * NmD2 - S * (1 - Nd1);
      return { putPrice: Math.max(0.01, putPrice), putDelta: Nd1 - 1 };
    }
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private formatExpiration(date: Date): string {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return year + month + day;
  }

  private formatStrike(strike: number): string {
    return (strike * 1000).toString().padStart(8, '0');
  }

  /**
   * 🔥 NAKED OPTIONS: Submit naked call/put order
   */
  async submitNakedOptionOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    orderType: 'market' | 'limit';
    timeInForce: 'day' | 'gtc';
    limitPrice?: number;
  }): Promise<{ id: string; status: string; symbol: string }> {
    try {
      console.log(`🔥 NAKED OPTION ORDER: ${params.side} ${params.quantity} ${params.symbol}`);

      const response = await fetch(`${this.credentials.baseUrl}/v2/orders`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          side: params.side,
          type: params.orderType,
          time_in_force: params.timeInForce,
          symbol: params.symbol,
          qty: Math.floor(params.quantity),
          order_class: 'simple',
          extended_hours: false,
          ...(params.limitPrice && { limit_price: params.limitPrice.toString() }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const order = await response.json() as any;
      console.log(`✅ Naked option order submitted: ${order.id}`);
      return {
        id: order.id,
        status: order.status || 'NEW',
        symbol: order.symbol || params.symbol
      };

    } catch (error) {
      console.error('❌ Error submitting naked option order:', error);
      throw error;
    }
  }

  /**
   * 🔥 NAKED OPTIONS: Close naked option position
   */
  async closeNakedOptionPosition(params: {
    symbol: string;
    quantity: number;
    orderType: 'market' | 'limit';
    timeInForce: 'day' | 'gtc';
    limitPrice?: number;
  }): Promise<{ id: string; status: string; symbol: string }> {
    try {
      console.log(`🔥 CLOSE NAKED POSITION: ${params.quantity} ${params.symbol}`);

      const response = await fetch(`${this.credentials.baseUrl}/v2/orders`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          side: params.quantity > 0 ? 'sell' : 'buy', // Determine side based on quantity
          type: params.orderType,
          time_in_force: params.timeInForce,
          symbol: params.symbol,
          qty: Math.abs(Math.floor(params.quantity)),
          order_class: 'simple',
          extended_hours: false,
          ...(params.limitPrice && { limit_price: params.limitPrice.toString() }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const order = await response.json() as any;
      console.log(`✅ Naked option position closed: ${order.id}`);
      return {
        id: order.id,
        status: order.status || 'NEW',
        symbol: order.symbol || params.symbol
      };

    } catch (error) {
      console.error('❌ Error closing naked option position:', error);
      throw error;
    }
  }

  // Get account information
  async getAccount() {
    try {
      const response = await axios.get(`${this.credentials.baseUrl}/v2/account`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching account:', error);
      throw error;
    }
  }

  // Get current positions
  async getPositions() {
    try {
      const response = await axios.get(`${this.credentials.baseUrl}/v2/positions`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching positions:', error);
      return [];
    }
  }

  // Get order status
  async getOrderStatus(orderId: string) {
    try {
      const response = await axios.get(`${this.credentials.baseUrl}/v2/orders/${orderId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching order status:', error);
      return null;
    }
  }
}

export { AlpacaClient };
export const alpacaClient = new AlpacaClient();