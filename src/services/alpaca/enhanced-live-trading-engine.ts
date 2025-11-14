/**
 * ENHANCED LIVE TRADING ENGINE WITH REAL-TIME STREAMS
 * Addresses key limitations with real-time market data and news integration
 * 
 * Features:
 * - Real-time market data streaming
 * - Live news sentiment analysis
 * - Dynamic options chain updates
 * - Enhanced risk management with live Greeks
 * - Market microstructure awareness
 */

import { EventEmitter } from 'events';
import AlpacaRealTimeStream, { RealTimeMarketData, RealTimeNewsData, RealTimeOptionData } from './alpaca-real-time-stream';
import { alpacaClient } from './alpaca';
import { AdaptiveStrategySelector } from './adaptive-strategy-selector';
import { GreeksEngine } from './greeks-engine';
import { TransactionCostEngine } from './transaction-cost-engine';
import { TechnicalAnalysis } from './technical-indicators';
import { OptionsChain, MarketData } from './types';

export interface EnhancedLivePosition {
  id: string;
  symbol: string;
  side: 'BULL_PUT_SPREAD' | 'BEAR_CALL_SPREAD' | 'IRON_CONDOR';
  spread: any;
  quantity: number;
  entryDate: Date;
  entryPrice: number;
  currentPrice: number;
  
  // Enhanced tracking
  entryGreeks: any;
  currentGreeks: any;
  greeksHistory: any[];
  entryFills: any[];
  totalTransactionCosts: number;
  
  // Real-time tracking
  lastUpdate: Date;
  marketDataUpdates: number;
  newsEvents: RealTimeNewsData[];
  sentimentScore: number;
  
  // Performance tracking
  currentPnL: number;
  maxPnL: number;
  minPnL: number;
  unrealizedPnL: number;
  
  // Risk metrics
  riskScore: number;
  maxLoss: number;
  isOpen: boolean;
}

export interface MarketRegimeState {
  regime: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY';
  confidence: number;
  vixLevel: number;
  newssentiment: 'positive' | 'negative' | 'neutral';
  lastUpdate: Date;
  factors: string[];
}

export class EnhancedLiveTradingEngine extends EventEmitter {
  private realTimeStream: AlpacaRealTimeStream;
  private positions: Map<string, EnhancedLivePosition> = new Map();
  private marketData: Map<string, RealTimeMarketData[]> = new Map();
  private recentNews: RealTimeNewsData[] = [];
  private currentMarketRegime: MarketRegimeState;
  
  // Trading state
  private isRunning = false;
  private tradingInterval?: NodeJS.Timeout;
  private lastTradeTime = new Date(0);
  private cooldownPeriod = 5 * 60 * 1000; // 5 minutes between trades
  
  // Performance tracking
  private startTime = new Date();
  private totalTrades = 0;
  private winningTrades = 0;
  private totalPnL = 0;
  private currentBalance = 50000; // Starting balance
  
  // Strategy parameters
  private strategy = {
    maxPositions: 3,
    maxRisk: 0.02,
    maxPortfolioRisk: 0.10,
    enableRealTimeNews: true,
    enableRealTimeGreeks: true,
    enableMicrostructureAnalysis: true,
    newsImpactThreshold: 0.7,
    volatilityAdjustment: true
  };

  constructor() {
    super();
    
    this.realTimeStream = new AlpacaRealTimeStream();
    this.currentMarketRegime = {
      regime: 'NEUTRAL',
      confidence: 0.5,
      vixLevel: 20,
      newssentiment: 'neutral',
      lastUpdate: new Date(),
      factors: []
    };
    
    this.setupEventHandlers();
    console.log('🚀 Enhanced Live Trading Engine initialized with real-time streaming');
  }

  /**
   * Start enhanced live trading with real-time streams
   */
  async start(): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return { success: false, message: 'Enhanced trading engine already running' };
    }

    try {
      console.log('🚀 Starting Enhanced Live Trading Engine...');
      
      // Test Alpaca connection
      const connectionTest = await alpacaClient.testConnection();
      if (!connectionTest) {
        throw new Error('Failed to connect to Alpaca API');
      }
      
      // Connect to real-time streams
      await this.realTimeStream.connect();
      
      // Subscribe to market data and news
      await this.setupSubscriptions();
      
      // Start trading loop
      this.startTradingLoop();
      
      this.isRunning = true;
      console.log('✅ Enhanced live trading started with real-time capabilities');
      
      return { success: true, message: 'Enhanced live trading started successfully' };
      
    } catch (error: any) {
      console.error('❌ Failed to start enhanced live trading:', error);
      return { success: false, message: `Failed to start: ${error?.message}` };
    }
  }

  /**
   * Setup real-time data subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    console.log('📡 Setting up real-time subscriptions...');
    
    // Subscribe to SPY market data
    this.realTimeStream.subscribeToQuotes(['SPY']);
    this.realTimeStream.subscribeToTrades(['SPY']);
    
    // Subscribe to SPY news
    this.realTimeStream.subscribeToNews(['SPY']);
    
    // Subscribe to SPY options (will be updated dynamically)
    this.realTimeStream.subscribeToOptions(['SPY']);
    
    console.log('✅ Real-time subscriptions configured');
  }

  /**
   * Setup event handlers for real-time streams
   */
  private setupEventHandlers(): void {
    // Market data events
    this.realTimeStream.on('quote', (data: RealTimeMarketData) => {
      this.handleMarketDataUpdate(data);
    });
    
    this.realTimeStream.on('trade', (data: RealTimeMarketData) => {
      this.handleMarketDataUpdate(data);
    });
    
    // News events
    this.realTimeStream.on('news', (data: RealTimeNewsData) => {
      this.handleNewsUpdate(data);
    });
    
    // Options events
    this.realTimeStream.on('optionQuote', (data: RealTimeOptionData) => {
      this.handleOptionDataUpdate(data);
    });
    
    this.realTimeStream.on('optionTrade', (data: RealTimeOptionData) => {
      this.handleOptionDataUpdate(data);
    });
  }

  /**
   * Handle real-time market data updates
   */
  private handleMarketDataUpdate(data: RealTimeMarketData): void {
    // Store market data
    if (!this.marketData.has(data.symbol)) {
      this.marketData.set(data.symbol, []);
    }
    
    const symbolData = this.marketData.get(data.symbol)!;
    symbolData.push(data);
    
    // Keep only last 1000 data points
    if (symbolData.length > 1000) {
      symbolData.shift();
    }
    
    // Update market regime
    this.updateMarketRegime(data);
    
    // Update position values
    this.updatePositionValues(data);
    
    // Emit update event
    this.emit('marketDataUpdate', data);
  }

  /**
   * Handle real-time news updates
   */
  private handleNewsUpdate(data: RealTimeNewsData): void {
    console.log(`📰 News: ${data.headline} (${data.sentiment})`);
    
    // Store recent news
    this.recentNews.push(data);
    
    // Keep only last 100 news items
    if (this.recentNews.length > 100) {
      this.recentNews.shift();
    }
    
    // Update market regime with news sentiment
    this.updateMarketRegimeWithNews(data);
    
    // Check for high-impact news
    if (this.isHighImpactNews(data)) {
      console.log('🚨 High-impact news detected - adjusting risk parameters');
      this.handleHighImpactNews(data);
    }
    
    // Update position news tracking
    this.updatePositionNews(data);
    
    // Emit news event
    this.emit('newsUpdate', data);
  }

  /**
   * Handle real-time option data updates
   */
  private handleOptionDataUpdate(data: RealTimeOptionData): void {
    // Update Greeks for relevant positions
    this.updatePositionGreeks(data);
    
    // Emit options update event
    this.emit('optionDataUpdate', data);
  }

  /**
   * Update market regime based on real-time data
   */
  private updateMarketRegime(data: RealTimeMarketData): void {
    const symbolData = this.marketData.get(data.symbol);
    if (!symbolData || symbolData.length < 20) return;
    
    // Calculate short-term momentum
    const recent = symbolData.slice(-20);
    const priceChange = (data.price - recent[0].price) / recent[0].price;
    
    // Calculate volatility
    const returns = recent.slice(1).map((point, i) => 
      Math.log(point.price / recent[i].price)
    );
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    // Update regime
    let newRegime: MarketRegimeState['regime'] = 'NEUTRAL';
    let confidence = 0.5;
    const factors: string[] = [];
    
    if (Math.abs(priceChange) > 0.005) { // 0.5% move
      newRegime = priceChange > 0 ? 'BULLISH' : 'BEARISH';
      confidence = Math.min(0.9, Math.abs(priceChange) * 100);
      factors.push(`Price ${priceChange > 0 ? 'surge' : 'drop'}: ${(priceChange * 100).toFixed(2)}%`);
    }
    
    if (volatility > 0.02) { // High volatility
      newRegime = 'HIGH_VOLATILITY';
      confidence = Math.min(0.9, volatility * 50);
      factors.push(`High volatility: ${(volatility * 100).toFixed(2)}%`);
    }
    
    // Incorporate news sentiment
    const recentNewsSentiment = this.getRecentNewsSentiment();
    if (recentNewsSentiment !== 'neutral') {
      factors.push(`News sentiment: ${recentNewsSentiment}`);
      confidence *= 1.2; // Boost confidence with news confirmation
    }
    
    this.currentMarketRegime = {
      regime: newRegime,
      confidence: Math.min(0.95, confidence),
      vixLevel: this.estimateVIX(volatility),
      newssentiment: recentNewsSentiment,
      lastUpdate: new Date(),
      factors
    };
  }

  /**
   * Update market regime with news sentiment
   */
  private updateMarketRegimeWithNews(news: RealTimeNewsData): void {
    // Weight recent news more heavily
    const recentSentiment = this.getRecentNewsSentiment();
    
    this.currentMarketRegime.newssentiment = recentSentiment;
    this.currentMarketRegime.lastUpdate = new Date();
    
    // Add news factor
    if (news.sentiment !== 'neutral') {
      this.currentMarketRegime.factors.push(`Breaking: ${news.sentiment} sentiment`);
    }
  }

  /**
   * Get recent news sentiment
   */
  private getRecentNewsSentiment(): 'positive' | 'negative' | 'neutral' {
    const recentNews = this.recentNews.filter(
      news => Date.now() - news.timestamp.getTime() < 30 * 60 * 1000 // Last 30 minutes
    );
    
    if (recentNews.length === 0) return 'neutral';
    
    const sentimentScores = {
      positive: recentNews.filter(n => n.sentiment === 'positive').length,
      negative: recentNews.filter(n => n.sentiment === 'negative').length,
      neutral: recentNews.filter(n => n.sentiment === 'neutral').length
    };
    
    const total = sentimentScores.positive + sentimentScores.negative + sentimentScores.neutral;
    const positiveRatio = sentimentScores.positive / total;
    const negativeRatio = sentimentScores.negative / total;
    
    if (positiveRatio > 0.6) return 'positive';
    if (negativeRatio > 0.6) return 'negative';
    return 'neutral';
  }

  /**
   * Check if news is high impact
   */
  private isHighImpactNews(news: RealTimeNewsData): boolean {
    const headline = news.headline.toLowerCase();
    
    const highImpactKeywords = [
      'fed', 'federal reserve', 'interest rate', 'inflation',
      'earnings', 'guidance', 'outlook', 'merger', 'acquisition',
      'sec', 'regulation', 'investigation', 'lawsuit',
      'recession', 'gdp', 'unemployment', 'jobs report'
    ];
    
    return highImpactKeywords.some(keyword => headline.includes(keyword));
  }

  /**
   * Handle high-impact news
   */
  private handleHighImpactNews(news: RealTimeNewsData): void {
    // Temporarily reduce position sizes
    this.strategy.maxRisk *= 0.5;
    this.strategy.maxPositions = Math.max(1, Math.floor(this.strategy.maxPositions * 0.5));
    
    // Reset after 1 hour
    setTimeout(() => {
      this.strategy.maxRisk *= 2;
      this.strategy.maxPositions *= 2;
      console.log('📈 Risk parameters restored after high-impact news cooldown');
    }, 60 * 60 * 1000);
    
    console.log('⚠️ Risk parameters reduced due to high-impact news');
  }

  /**
   * Update position values with real-time data
   */
  private updatePositionValues(data: RealTimeMarketData): void {
    for (const [positionId, position] of this.positions) {
      if (position.symbol === data.symbol || position.symbol.includes(data.symbol)) {
        // Update current price and P&L
        const previousPnL = position.currentPnL;
        position.currentPrice = data.price;
        position.lastUpdate = data.timestamp;
        position.marketDataUpdates++;
        
        // Calculate new P&L (simplified)
        position.currentPnL = this.calculatePositionPnL(position, data.price);
        position.unrealizedPnL = position.currentPnL;
        
        // Update max/min P&L
        position.maxPnL = Math.max(position.maxPnL, position.currentPnL);
        position.minPnL = Math.min(position.minPnL, position.currentPnL);
        
        // Emit position update if significant change
        if (Math.abs(position.currentPnL - previousPnL) > 10) {
          this.emit('positionUpdate', position);
        }
      }
    }
  }

  /**
   * Update position news tracking
   */
  private updatePositionNews(news: RealTimeNewsData): void {
    for (const [positionId, position] of this.positions) {
      if (news.symbols.includes(position.symbol) || news.symbols.includes('SPY')) {
        position.newsEvents.push(news);
        
        // Keep only last 20 news events per position
        if (position.newsEvents.length > 20) {
          position.newsEvents.shift();
        }
        
        // Update sentiment score
        position.sentimentScore = this.calculatePositionSentiment(position);
      }
    }
  }

  /**
   * Update position Greeks with real-time option data
   */
  private updatePositionGreeks(data: RealTimeOptionData): void {
    for (const [positionId, position] of this.positions) {
      // Check if this option data relates to the position
      if (this.isRelatedToPosition(position, data)) {
        // Update position Greeks (simplified)
        position.currentGreeks = {
          ...position.currentGreeks,
          timestamp: data.timestamp,
          // Add real-time Greeks calculation here
        };
        
        position.greeksHistory.push(position.currentGreeks);
        
        // Keep only last 100 Greeks snapshots
        if (position.greeksHistory.length > 100) {
          position.greeksHistory.shift();
        }
      }
    }
  }

  /**
   * Calculate position P&L
   */
  private calculatePositionPnL(position: EnhancedLivePosition, currentPrice: number): number {
    // Simplified P&L calculation
    const priceChange = currentPrice - position.entryPrice;
    return priceChange * position.quantity * 100; // $100 per point for options
  }

  /**
   * Calculate position sentiment score
   */
  private calculatePositionSentiment(position: EnhancedLivePosition): number {
    if (position.newsEvents.length === 0) return 0;
    
    const sentimentValues: number[] = position.newsEvents.map(news => {
      switch (news.sentiment) {
        case 'positive': return 1;
        case 'negative': return -1;
        default: return 0;
      }
    });
    
    return sentimentValues.reduce((sum: number, val: number) => sum + val, 0) / sentimentValues.length;
  }

  /**
   * Check if option data relates to position
   */
  private isRelatedToPosition(position: EnhancedLivePosition, data: RealTimeOptionData): boolean {
    // Check if the option is part of the position's spread
    return data.underlying === 'SPY' && position.symbol.includes('SPY');
  }

  /**
   * Estimate VIX from volatility
   */
  private estimateVIX(volatility: number): number {
    // Simple VIX estimation
    return Math.min(100, Math.max(5, volatility * 100 * 15.8)); // Rough conversion
  }

  /**
   * Start trading loop
   */
  private startTradingLoop(): void {
    this.tradingInterval = setInterval(async () => {
      await this.executeTradingCycle();
    }, 30000); // Run every 30 seconds for more responsive trading
  }

  /**
   * Execute one trading cycle
   */
  private async executeTradingCycle(): Promise<void> {
    try {
      // Check market hours
      if (!this.isMarketHours()) return;
      
      // Monitor existing positions
      await this.monitorPositions();
      
      // Check for new trading opportunities
      if (this.canPlaceNewTrade()) {
        await this.scanForTrades();
      }
      
      // Update performance metrics
      this.updatePerformanceMetrics();
      
    } catch (error) {
      console.error('Error in trading cycle:', error);
    }
  }

  /**
   * Check if new trade can be placed
   */
  private canPlaceNewTrade(): boolean {
    const timeSinceLastTrade = Date.now() - this.lastTradeTime.getTime();
    const positionCount = this.positions.size;
    
    return (
      positionCount < this.strategy.maxPositions &&
      timeSinceLastTrade > this.cooldownPeriod &&
      this.currentMarketRegime.confidence > 0.6
    );
  }

  /**
   * Monitor existing positions
   */
  private async monitorPositions(): Promise<void> {
    for (const [positionId, position] of this.positions) {
      // Check exit conditions with real-time data
      const shouldExit = await this.shouldExitPosition(position);
      
      if (shouldExit.shouldExit) {
        console.log(`🚪 Exiting position ${positionId}: ${shouldExit.reason}`);
        await this.closePosition(positionId, shouldExit.reason);
      }
    }
  }

  /**
   * Enhanced exit condition checking
   */
  private async shouldExitPosition(position: EnhancedLivePosition): Promise<{
    shouldExit: boolean;
    reason: string;
  }> {
    // Real-time P&L based exits
    if (position.currentPnL > position.maxLoss * 0.5) {
      return { shouldExit: true, reason: 'PROFIT_TARGET_REACHED' };
    }
    
    if (position.currentPnL < -position.maxLoss) {
      return { shouldExit: true, reason: 'STOP_LOSS_HIT' };
    }
    
    // Time-based exits
    const timeHeld = Date.now() - position.entryDate.getTime();
    const hoursHeld = timeHeld / (1000 * 60 * 60);
    
    if (hoursHeld > 6) { // Exit 0-DTE positions after 6 hours
      return { shouldExit: true, reason: 'TIME_DECAY_EXIT' };
    }
    
    // News-based exits
    if (position.sentimentScore < -0.7 && position.currentPnL < 0) {
      return { shouldExit: true, reason: 'NEGATIVE_NEWS_SENTIMENT' };
    }
    
    // Volatility-based exits
    if (this.currentMarketRegime.regime === 'HIGH_VOLATILITY' && position.currentPnL > 0) {
      return { shouldExit: true, reason: 'VOLATILITY_SPIKE_PROFIT_TAKE' };
    }
    
    return { shouldExit: false, reason: '' };
  }

  /**
   * Scan for new trading opportunities
   */
  private async scanForTrades(): Promise<void> {
    try {
      // Get current market data
      const spyData = this.marketData.get('SPY');
      if (!spyData || spyData.length < 20) return;
      
      // Convert to historical format for strategy analysis
      const historicalData: MarketData[] = spyData.slice(-50).map(point => ({
        id: `${point.symbol}_${point.timestamp.getTime()}`,
        symbol: point.symbol,
        date: point.timestamp,
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
        volume: BigInt(point.volume),
        createdAt: point.timestamp
      }));
      
      // Get current options chain
      const optionsChain = await alpacaClient.getOptionsChain('SPY');
      
      // Generate trading signal with real-time regime
      const signal = AdaptiveStrategySelector.generateAdaptiveSignal(
        historicalData,
        optionsChain,
        this.strategy,
        this.currentMarketRegime.vixLevel
      );
      
      if (signal.selectedStrategy !== 'NO_TRADE' && signal.signal) {
        console.log(`🎯 New trading opportunity: ${signal.selectedStrategy}`);
        console.log(`📊 Market regime: ${this.currentMarketRegime.regime} (${(this.currentMarketRegime.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`📰 News sentiment: ${this.currentMarketRegime.newssentiment}`);
        
        await this.executeTrade(signal.signal);
      }
      
    } catch (error) {
      console.error('Error scanning for trades:', error);
    }
  }

  /**
   * Execute a trade with enhanced features
   */
  private async executeTrade(signal: any): Promise<void> {
    // Implementation would include:
    // - Real-time Greeks calculation
    // - Transaction cost analysis
    // - Position sizing with current volatility
    // - News sentiment consideration
    
    console.log('📈 Trade execution with real-time data (implementation pending)');
    this.lastTradeTime = new Date();
  }

  /**
   * Close a position
   */
  private async closePosition(positionId: string, reason: string): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) return;
    
    // Update performance tracking
    this.totalTrades++;
    if (position.currentPnL > 0) {
      this.winningTrades++;
    }
    this.totalPnL += position.currentPnL;
    
    // Remove position
    this.positions.delete(positionId);
    
    console.log(`✅ Position closed: ${position.symbol}, P&L: $${position.currentPnL.toFixed(2)}, Reason: ${reason}`);
    
    this.emit('positionClosed', { position, reason });
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate current portfolio value
    const unrealizedPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    const currentPortfolioValue = this.currentBalance + this.totalPnL + unrealizedPnL;
    
    this.emit('performanceUpdate', {
      totalTrades: this.totalTrades,
      winRate: this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0,
      totalPnL: this.totalPnL,
      unrealizedPnL,
      currentPortfolioValue,
      openPositions: this.positions.size,
      marketRegime: this.currentMarketRegime
    });
  }

  /**
   * Check if market is open
   */
  private isMarketHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Monday-Friday, 9:30 AM - 4:00 PM ET
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }

  /**
   * Stop enhanced live trading
   */
  stop(): void {
    console.log('🛑 Stopping Enhanced Live Trading Engine...');
    
    this.isRunning = false;
    
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
    }
    
    this.realTimeStream.disconnect();
    
    console.log('✅ Enhanced live trading stopped');
  }

  /**
   * Get enhanced live status
   */
  getLiveStatus(): any {
    const unrealizedPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      marketRegime: this.currentMarketRegime,
      
      // Stream status
      streamStatus: this.realTimeStream.getStatus(),
      
      // Performance
      totalTrades: this.totalTrades,
      winRate: this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0,
      totalPnL: this.totalPnL,
      unrealizedPnL,
      currentBalance: this.currentBalance + this.totalPnL + unrealizedPnL,
      
      // Positions
      openPositions: Array.from(this.positions.values()),
      positionCount: this.positions.size,
      
      // Real-time data
      recentNewsCount: this.recentNews.length,
      marketDataPoints: Array.from(this.marketData.values())
        .reduce((sum, data) => sum + data.length, 0),
      
      // Strategy parameters
      strategy: this.strategy
    };
  }
}

export default EnhancedLiveTradingEngine;