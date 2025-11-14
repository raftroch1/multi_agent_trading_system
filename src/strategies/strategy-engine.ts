import { Strategy, TechnicalIndicators } from './types';

export interface ExitCondition {
  shouldExit: boolean;
  reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EXPIRATION' | 'SIGNAL_EXIT';
}

export class StrategyEngine {
  
  /**
   * Determine if position should be exited based on strategy rules
   */
  static shouldExit(
    currentPrice: number,
    entryPrice: number,
    strategy: Strategy,
    indicators: TechnicalIndicators,
    side: 'CALL' | 'PUT'
  ): ExitCondition {
    
    // Calculate P&L percentage
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Take profit condition
    if (pnlPercent >= strategy.takeProfitPercent) {
      return { shouldExit: true, reason: 'TAKE_PROFIT' };
    }
    
    // Stop loss condition
    if (pnlPercent <= -strategy.stopLossPercent) {
      return { shouldExit: true, reason: 'STOP_LOSS' };
    }
    
    // Signal-based exit conditions
    if (side === 'CALL') {
      // Exit long calls if RSI becomes extremely overbought
      if (indicators.rsi > 85) {
        return { shouldExit: true, reason: 'SIGNAL_EXIT' };
      }
    } else if (side === 'PUT') {
      // Exit long puts if RSI becomes extremely oversold
      if (indicators.rsi < 15) {
        return { shouldExit: true, reason: 'SIGNAL_EXIT' };
      }
    }
    
    return { shouldExit: false, reason: 'STOP_LOSS' };
  }
  
  /**
   * Calculate position size based on strategy parameters
   */
  static calculatePositionSize(
    accountBalance: number,
    strategy: Strategy,
    currentPrice: number,
    volatility: number = 0.25
  ): number {
    
    const riskAmount = accountBalance * (strategy.positionSizePercent / 100);
    const maxLoss = currentPrice * (strategy.stopLossPercent / 100);
    
    // Position size based on risk management
    const positionSize = Math.floor(riskAmount / (maxLoss * 100)); // 100 shares per contract
    
    // Apply volatility adjustment
    const volatilityAdjustment = Math.max(0.5, Math.min(1.5, 1 / volatility));
    const adjustedSize = Math.floor(positionSize * volatilityAdjustment);
    
    // Ensure reasonable bounds
    return Math.max(1, Math.min(adjustedSize, 10));
  }
}

export default StrategyEngine;
