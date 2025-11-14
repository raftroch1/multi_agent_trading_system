/**
 * POSITION MANAGEMENT ORCHESTRATOR
 *
 * Coordinates all 4 specialized position managers with weighted voting and conflict resolution
 * Implements priority rules and consensus-driven decision making for 0-DTE trading
 */

import {
  Position,
  OptionsChain,
  DynamicExitSignal,
  MarketData
} from './types';

import {
  GreeksBasedPositionManager,
  GreeksPositionAnalysis,
  GreeksPortfolioSummary
} from './greeks-position-manager';

import {
  TimeDecayPositionManager,
  TimeDecayAnalysis,
  TimeDecayPortfolioSummary
} from './time-decay-position-manager';

import {
  ProfitProtectionManager,
  ProfitProtectionAnalysis,
  ProfitProtectionPortfolioSummary
} from './profit-protection-manager';

import {
  MarketRegimePositionManager,
  MarketRegimeAnalysis,
  MarketRegimePortfolioSummary
} from './market-regime-position-manager';

export interface OrchestratorConfig {
  // Manager weights (must sum to 100)
  managerWeights: {
    greeks: number;               // 25% weight for Greeks analysis
    timeDecay: number;           // 25% weight for time decay
    profitProtection: number;    // 25% weight for profit protection
    marketRegime: number;        // 25% weight for market regime
  };

  // Priority rules for conflict resolution
  priorityRules: {
    criticalUrgency: boolean;     // Critical urgency always wins
    consensusThreshold: number;   // Minimum consensus for action (0-100)
    vetoPower: boolean;           // High-risk managers can veto
    tieBreaker: 'greeks' | 'timeDecay' | 'profitProtection' | 'marketRegime';
  };

  // Execution settings
  executionSettings: {
    autoExecute: boolean;         // Auto-execute consensus decisions
    requireConfirmation: boolean; // Require confirmation for high-value exits
    maxSimultaneousExits: number; // Limit simultaneous position exits
    executionDelay: number;       // Delay between actions (seconds)
  };

  // Safety constraints
  safetyConstraints: {
    maxPortfolioRisk: number;     // Maximum portfolio risk percentage
    emergencyConditions: string[]; // Conditions triggering immediate action
    circuitBreakers: string[];    // Conditions pausing execution
    requireHumanOverride: boolean; // Require human for certain conditions
  };
}

export interface ManagerVote {
  manager: 'greeks' | 'timeDecay' | 'profitProtection' | 'marketRegime';
  action: 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT' | 'ADJUST_HEDGE';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  weight: number;
  confidence: number;
  reason: string;
  exitQuantity?: number;
  priority: number;              // Numerical priority (higher = more important)
}

export interface OrchestratedDecision {
  positionId: string;
  symbol: string;
  finalAction: 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT' | 'ADJUST_HEDGE';
  confidence: number;             // Overall confidence score (0-100)
  consensus: number;              // Consensus percentage (0-100)
  weightedVoteScore: number;      // Weighted vote score
  recommendation: {
    action: string;
    reason: string;
    executeImmediately: boolean;
    supportingManagers: string[];
    opposingManagers: string[];
    conflictingSignals: string[];
    riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  executionPlan: {
    suggestedQuantity?: number;
    suggestedTiming: 'IMMEDIATE' | 'WITHIN_5_MIN' | 'WITHIN_15_MIN' | 'WITHIN_HOUR';
    priority: number;             // Execution priority (1-10)
    dependencies: string[];        // Dependencies on other actions
  };
  individualAnalyses: {
    greeks?: GreeksPositionAnalysis;
    timeDecay?: TimeDecayAnalysis;
    profitProtection?: ProfitProtectionAnalysis;
    marketRegime?: MarketRegimeAnalysis;
  };
  timestamp: Date;
}

export interface OrchestratorPortfolioReport {
  totalPositions: number;
  orchestratorConfig: OrchestratorConfig;

  // Portfolio analysis summary
  portfolioAnalysis: {
    greeksSummary: GreeksPortfolioSummary;
    timeDecaySummary: TimeDecayPortfolioSummary;
    profitProtectionSummary: ProfitProtectionPortfolioSummary;
    marketRegimeSummary: MarketRegimePortfolioSummary;
  };

  // Decision distribution
  decisionDistribution: {
    holdPositions: number;
    scaleOutPositions: number;
    fullExitPositions: number;
    emergencyExitPositions: number;
    hedgeAdjustments: number;
  };

  // Consensus metrics
  consensusMetrics: {
    averageConsensus: number;
    highConsensusPositions: number;    // >80% consensus
    lowConsensusPositions: number;     // <50% consensus
    conflictingSignals: number;
    unanimousDecisions: number;
  };

  // Risk assessment
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    criticalPositions: string[];     // Positions requiring immediate attention
    riskFactors: string[];
    recommendedActions: string[];
  };

  // Execution queue
  executionQueue: {
    immediateActions: OrchestratedDecision[];
    priorityActions: OrchestratedDecision[];
    normalActions: OrchestratedDecision[];
  };

  timestamp: Date;
}

/**
 * Position Management Orchestrator
 *
 * Coordinates all 4 specialized position managers with weighted voting
 * Implements sophisticated conflict resolution and consensus-driven decision making
 */
export class PositionManagementOrchestrator {
  private static readonly DEFAULT_CONFIG: OrchestratorConfig = {
    managerWeights: {
      greeks: 25,                   // 25% weight
      timeDecay: 25,               // 25% weight
      profitProtection: 25,        // 25% weight
      marketRegime: 25             // 25% weight
    },

    priorityRules: {
      criticalUrgency: true,       // Critical urgency always wins
      consensusThreshold: 60,       // 60% consensus required
      vetoPower: true,             // High-risk managers can veto
      tieBreaker: 'profitProtection' // Profit protection breaks ties
    },

    executionSettings: {
      autoExecute: false,           // Require manual confirmation initially
      requireConfirmation: true,   // Confirm high-value actions
      maxSimultaneousExits: 2,     // Max 2 exits at once
      executionDelay: 30           // 30 second delay between actions
    },

    safetyConstraints: {
      maxPortfolioRisk: 0.15,      // 15% max portfolio risk
      emergencyConditions: [
        'CRITICAL_GREEKS_RISK',
        'EMERGENCY_TIME_EXIT',
        'CRISIS_REGIME_DETECTED',
        'PROFIT_PROTECTION_BREACH'
      ],
      circuitBreakers: [
        'MARKET_CIRCUIT_BREAKER',
        'EXTREME_VOLATILITY_SPIKE',
        'SYSTEM_ERROR_DETECTED'
      ],
      requireHumanOverride: true   // Require human for emergency conditions
    }
  };

  private static config: OrchestratorConfig = { ...this.DEFAULT_CONFIG };
  private static executionQueue: OrchestratedDecision[] = [];
  private static lastExecutionTime: Date | null = null;

  /**
   * Orchestrate position analysis across all managers
   */
  static async orchestratePositionManagement(
    positions: Position[],
    optionsChain: OptionsChain[],
    marketData: MarketData[],
    customConfig?: Partial<OrchestratorConfig>
  ): Promise<OrchestratorPortfolioReport> {
    // Update configuration
    if (customConfig) {
      this.config = this.mergeConfig(this.DEFAULT_CONFIG, customConfig);
    }

    console.log(`🎯 POSITION ORCHESTRATOR: Analyzing ${positions.length} positions across 4 managers`);

    // Run all 4 managers in parallel for efficiency
    const [
      greeksAnalyses,
      timeDecayAnalyses,
      profitProtectionAnalyses,
      marketRegimeAnalyses
    ] = await Promise.all([
      GreeksBasedPositionManager.analyzePositions(positions, optionsChain, marketData),
      TimeDecayPositionManager.analyzePositions(positions, optionsChain, marketData),
      ProfitProtectionManager.analyzePositions(positions, optionsChain, marketData),
      MarketRegimePositionManager.analyzePositions(positions, optionsChain, marketData)
    ]);

    // Generate portfolio summaries from each manager
    const portfolioAnalysis = {
      greeksSummary: GreeksBasedPositionManager.generatePortfolioSummary(greeksAnalyses),
      timeDecaySummary: TimeDecayPositionManager.generatePortfolioSummary(timeDecayAnalyses),
      profitProtectionSummary: ProfitProtectionManager.generatePortfolioSummary(profitProtectionAnalyses),
      marketRegimeSummary: MarketRegimePositionManager.generatePortfolioSummary(marketRegimeAnalyses)
    };

    // Create orchestrated decisions for each position
    const orchestratedDecisions: OrchestratedDecision[] = [];

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const greeksAnalysis = greeksAnalyses[i];
      const timeDecayAnalysis = timeDecayAnalyses[i];
      const profitProtectionAnalysis = profitProtectionAnalyses[i];
      const marketRegimeAnalysis = marketRegimeAnalyses[i];

      try {
        const decision = await this.createOrchestratedDecision(
          position,
          greeksAnalysis,
          timeDecayAnalysis,
          profitProtectionAnalysis,
          marketRegimeAnalysis
        );
        orchestratedDecisions.push(decision);
      } catch (error) {
        console.error(`❌ Orchestration failed for ${position.symbol}: ${error}`);
      }
    }

    // Analyze decision distribution and consensus
    const decisionDistribution = this.analyzeDecisionDistribution(orchestratedDecisions);
    const consensusMetrics = this.calculateConsensusMetrics(orchestratedDecisions);
    const riskAssessment = this.assessPortfolioRisk(orchestratedDecisions, portfolioAnalysis);

    // Build execution queue
    const executionQueue = this.buildExecutionQueue(orchestratedDecisions);

    return {
      totalPositions: positions.length,
      orchestratorConfig: this.config,
      portfolioAnalysis,
      decisionDistribution,
      consensusMetrics,
      riskAssessment,
      executionQueue,
      timestamp: new Date()
    };
  }

  /**
   * Create orchestrated decision for a single position
   */
  private static async createOrchestratedDecision(
    position: Position,
    greeksAnalysis: GreeksPositionAnalysis,
    timeDecayAnalysis: TimeDecayAnalysis,
    profitProtectionAnalysis: ProfitProtectionAnalysis,
    marketRegimeAnalysis: MarketRegimeAnalysis
  ): Promise<OrchestratedDecision> {
    // Collect votes from all managers
    const votes: ManagerVote[] = [
      {
        manager: 'greeks',
        action: this.mapRecommendationToAction(greeksAnalysis.recommendation.action),
        urgency: greeksAnalysis.recommendation.urgency,
        weight: this.config.managerWeights.greeks,
        confidence: 75,
        reason: greeksAnalysis.recommendation.reason,
        exitQuantity: this.getExitQuantity(greeksAnalysis.recommendation.action, position),
        priority: this.getManagerPriority('greeks', greeksAnalysis.recommendation.urgency)
      },
      {
        manager: 'timeDecay',
        action: this.mapRecommendationToAction(timeDecayAnalysis.recommendation.action),
        urgency: timeDecayAnalysis.recommendation.urgency,
        weight: this.config.managerWeights.timeDecay,
        confidence: 75,
        reason: timeDecayAnalysis.recommendation.reason,
        exitQuantity: this.getExitQuantity(timeDecayAnalysis.recommendation.action, position),
        priority: this.getManagerPriority('timeDecay', timeDecayAnalysis.recommendation.urgency)
      },
      {
        manager: 'profitProtection',
        action: this.mapRecommendationToAction(profitProtectionAnalysis.recommendation.action),
        urgency: profitProtectionAnalysis.recommendation.urgency,
        weight: this.config.managerWeights.profitProtection,
        confidence: profitProtectionAnalysis.recommendation.confidence || 75,
        reason: profitProtectionAnalysis.recommendation.reason,
        exitQuantity: this.getExitQuantity(profitProtectionAnalysis.recommendation.action, position),
        priority: this.getManagerPriority('profitProtection', profitProtectionAnalysis.recommendation.urgency)
      },
      {
        manager: 'marketRegime',
        action: this.mapRecommendationToAction(marketRegimeAnalysis.regimeRecommendations.action),
        urgency: marketRegimeAnalysis.regimeRecommendations.urgency,
        weight: this.config.managerWeights.marketRegime,
        confidence: marketRegimeAnalysis.regimeRecommendations.confidence || 75,
        reason: marketRegimeAnalysis.regimeRecommendations.reason,
        exitQuantity: this.getExitQuantity(marketRegimeAnalysis.regimeRecommendations.action, position),
        priority: this.getManagerPriority('marketRegime', marketRegimeAnalysis.regimeRecommendations.urgency)
      }
    ];

    // Apply priority rules
    const priorityVotes = this.applyPriorityRules(votes);

    // Calculate weighted consensus
    const consensus = this.calculateConsensus(priorityVotes);
    const weightedVoteScore = this.calculateWeightedVoteScore(priorityVotes);

    // Determine final action
    const finalAction = this.determineFinalAction(priorityVotes, consensus, weightedVoteScore);

    // Check for emergency conditions
    const emergencyConditions = this.checkEmergencyConditions(greeksAnalysis, timeDecayAnalysis, profitProtectionAnalysis, marketRegimeAnalysis);

    // Build recommendation
    const supportingManagers = votes.filter(v => v.action === finalAction).map(v => v.manager);
    const opposingManagers = votes.filter(v => v.action !== finalAction && v.action !== 'HOLD').map(v => v.manager);
    const conflictingSignals = this.identifyConflictingSignals(votes);

    // Calculate execution timing and priority
    const executionTiming = this.determineExecutionTiming(priorityVotes, finalAction, emergencyConditions);
    const executionPriority = this.calculateExecutionPriority(priorityVotes, emergencyConditions);

    return {
      positionId: position.id || '',
      symbol: position.symbol,
      finalAction: emergencyConditions.length > 0 ? 'EMERGENCY_EXIT' : finalAction,
      confidence: this.calculateOverallConfidence(votes),
      consensus,
      weightedVoteScore,
      recommendation: {
        action: emergencyConditions.length > 0 ?
          `EMERGENCY: ${emergencyConditions.join(', ')}` :
          `${finalAction} - ${supportingManagers.join(', ')} support`,
        reason: emergencyConditions.length > 0 ?
          `Emergency conditions triggered: ${emergencyConditions.join(', ')}` :
          `Weighted consensus: ${consensus.toFixed(0)}% - ${supportingManagers.join(', ')}`,
        executeImmediately: emergencyConditions.length > 0 ||
                               finalAction === 'EMERGENCY_EXIT' ||
                               this.config.priorityRules.criticalUrgency && supportingManagers.some(m => priorityVotes.find(v => v.manager === m)?.urgency === 'CRITICAL'),
        supportingManagers,
        opposingManagers,
        conflictingSignals,
        riskAssessment: this.assessPositionRisk(greeksAnalysis, timeDecayAnalysis, profitProtectionAnalysis, marketRegimeAnalysis)
      },
      executionPlan: {
        suggestedQuantity: this.calculateSuggestedQuantity(votes, position),
        suggestedTiming: executionTiming,
        priority: executionPriority,
        dependencies: this.identifyDependencies(votes, position)
      },
      individualAnalyses: {
        greeks: greeksAnalysis,
        timeDecay: timeDecayAnalysis,
        profitProtection: profitProtectionAnalysis,
        marketRegime: marketRegimeAnalysis
      },
      timestamp: new Date()
    };
  }

  /**
   * Apply priority rules to votes
   */
  private static applyPriorityRules(votes: ManagerVote[]): ManagerVote[] {
    // Emergency conditions override everything
    const criticalVotes = votes.filter(v => v.urgency === 'CRITICAL');
    if (this.config.priorityRules.criticalUrgency && criticalVotes.length > 0) {
      // Give critical votes higher weight
      return votes.map(vote => ({
        ...vote,
        weight: vote.urgency === 'CRITICAL' ? vote.weight * 2 : vote.weight * 0.5
      }));
    }

    return votes;
  }

  /**
   * Calculate consensus percentage
   */
  private static calculateConsensus(votes: ManagerVote[]): number {
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return 0;

    // Group by action
    const actionGroups = new Map<string, number>();
    votes.forEach(vote => {
      const currentWeight = actionGroups.get(vote.action) || 0;
      actionGroups.set(vote.action, currentWeight + vote.weight);
    });

    // Find highest weight action
    const maxWeight = Math.max(...actionGroups.values());
    return (maxWeight / totalWeight) * 100;
  }

  /**
   * Calculate weighted vote score
   */
  private static calculateWeightedVoteScore(votes: ManagerVote[]): number {
    return votes.reduce((score, vote) => {
      const actionValue = this.getActionValue(vote.action);
      const urgencyMultiplier = this.getUrgencyMultiplier(vote.urgency);
      return score + (actionValue * vote.weight * urgencyMultiplier * (vote.confidence / 100));
    }, 0);
  }

  /**
   * Determine final action based on votes and consensus
   */
  private static determineFinalAction(
    votes: ManagerVote[],
    consensus: number,
    weightedScore: number
  ): 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT' | 'ADJUST_HEDGE' {
    // Check for critical urgency
    const criticalVotes = votes.filter(v => v.urgency === 'CRITICAL');
    if (criticalVotes.length > 0 && this.config.priorityRules.criticalUrgency) {
      return 'EMERGENCY_EXIT';
    }

    // Check consensus threshold
    if (consensus < this.config.priorityRules.consensusThreshold) {
      return 'HOLD'; // Insufficient consensus
    }

    // Determine action by weighted score
    if (weightedScore > 150) {
      return 'EMERGENCY_EXIT';
    } else if (weightedScore > 100) {
      return 'EXIT_FULL';
    } else if (weightedScore > 50) {
      return 'SCALE_OUT';
    } else if (weightedScore > 25) {
      return 'ADJUST_HEDGE';
    } else {
      return 'HOLD';
    }
  }

  /**
   * Check for emergency conditions
   */
  private static checkEmergencyConditions(
    greeks: GreeksPositionAnalysis,
    timeDecay: TimeDecayAnalysis,
    profitProtection: ProfitProtectionAnalysis,
    marketRegime: MarketRegimeAnalysis
  ): string[] {
    const conditions: string[] = [];

    // Greeks emergency conditions
    if (greeks.riskProfile.riskLevel === 'CRITICAL') {
      conditions.push('CRITICAL_GREEKS_RISK');
    }

    // Time decay emergency conditions
    if (timeDecay.recommendation.action === 'EMERGENCY_EXIT') {
      conditions.push('EMERGENCY_TIME_EXIT');
    }

    // Profit protection emergency conditions
    if (profitProtection.recommendation.action === 'EMERGENCY_EXIT') {
      conditions.push('PROFIT_PROTECTION_BREACH');
    }

    // Market regime emergency conditions
    if (marketRegime.currentRegime.primary === 'CRISIS' ||
        marketRegime.currentRegime.riskLevel === 'CRITICAL') {
      conditions.push('CRISIS_REGIME_DETECTED');
    }

    return conditions;
  }

  /**
   * Analyze decision distribution
   */
  private static analyzeDecisionDistribution(decisions: OrchestratedDecision[]): {
    holdPositions: number;
    scaleOutPositions: number;
    fullExitPositions: number;
    emergencyExitPositions: number;
    hedgeAdjustments: number;
  } {
    return {
      holdPositions: decisions.filter(d => d.finalAction === 'HOLD').length,
      scaleOutPositions: decisions.filter(d => d.finalAction === 'SCALE_OUT').length,
      fullExitPositions: decisions.filter(d => d.finalAction === 'EXIT_FULL').length,
      emergencyExitPositions: decisions.filter(d => d.finalAction === 'EMERGENCY_EXIT').length,
      hedgeAdjustments: decisions.filter(d => d.finalAction === 'ADJUST_HEDGE').length
    };
  }

  /**
   * Calculate consensus metrics
   */
  private static calculateConsensusMetrics(decisions: OrchestratedDecision[]): {
    averageConsensus: number;
    highConsensusPositions: number;
    lowConsensusPositions: number;
    conflictingSignals: number;
    unanimousDecisions: number;
  } {
    const consensusScores = decisions.map(d => d.consensus);
    const averageConsensus = consensusScores.reduce((sum, score) => sum + score, 0) / consensusScores.length;

    return {
      averageConsensus,
      highConsensusPositions: consensusScores.filter(s => s > 80).length,
      lowConsensusPositions: consensusScores.filter(s => s < 50).length,
      conflictingSignals: decisions.filter(d => d.recommendation.conflictingSignals.length > 0).length,
      unanimousDecisions: consensusScores.filter(s => s >= 95).length
    };
  }

  /**
   * Assess overall portfolio risk
   */
  private static assessPortfolioRisk(
    decisions: OrchestratedDecision[],
    portfolioAnalysis: {
      greeksSummary: GreeksPortfolioSummary;
      timeDecaySummary: TimeDecayPortfolioSummary;
      profitProtectionSummary: ProfitProtectionPortfolioSummary;
      marketRegimeSummary: MarketRegimePortfolioSummary;
    }
  ): {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    criticalPositions: string[];
    riskFactors: string[];
    recommendedActions: string[];
  } {
    const criticalPositions = decisions
      .filter(d => d.recommendation.riskAssessment === 'CRITICAL' || d.finalAction === 'EMERGENCY_EXIT')
      .map(d => d.symbol);

    const riskFactors: string[] = [];

    // Add risk factors from each manager
    if (portfolioAnalysis.greeksSummary.riskLevel === 'HIGH' || portfolioAnalysis.greeksSummary.riskLevel === 'CRITICAL') {
      riskFactors.push('High Greeks risk detected');
    }

    if (portfolioAnalysis.timeDecaySummary.portfolioTimeMetrics.portfolioUrgencyScore > 75) {
      riskFactors.push('High time decay urgency');
    }

    if (portfolioAnalysis.profitProtectionSummary.portfolioMetrics.maxDrawdown > 0.1) {
      riskFactors.push('Significant drawdown risk');
    }

    if (portfolioAnalysis.marketRegimeSummary.currentRegime.riskLevel === 'HIGH' ||
        portfolioAnalysis.marketRegimeSummary.currentRegime.riskLevel === 'CRITICAL') {
      riskFactors.push('Adverse market regime');
    }

    const recommendedActions = [
      criticalPositions.length > 0 ? 'Immediate review of critical positions' : null,
      riskFactors.length > 2 ? 'Reduce overall portfolio risk' : null,
      portfolioAnalysis.timeDecaySummary.immediateActions.emergencyExits > 0 ? 'Execute emergency exits' : null
    ].filter(Boolean) as string[];

    // Determine overall risk level
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (criticalPositions.length > 0 || riskFactors.length > 3) {
      overallRisk = 'CRITICAL';
    } else if (riskFactors.length > 2 || criticalPositions.length > 1) {
      overallRisk = 'HIGH';
    } else if (riskFactors.length > 0) {
      overallRisk = 'MEDIUM';
    }

    return {
      overallRisk,
      criticalPositions,
      riskFactors,
      recommendedActions
    };
  }

  /**
   * Build execution queue
   */
  private static buildExecutionQueue(decisions: OrchestratedDecision[]): {
    immediateActions: OrchestratedDecision[];
    priorityActions: OrchestratedDecision[];
    normalActions: OrchestratedDecision[];
  } {
    const immediateActions = decisions.filter(d =>
      d.finalAction === 'EMERGENCY_EXIT' || d.recommendation.executeImmediately
    );

    const priorityActions = decisions.filter(d =>
      d.finalAction === 'EXIT_FULL' && d.executionPlan.priority >= 7
    );

    const normalActions = decisions.filter(d =>
      d.finalAction !== 'EMERGENCY_EXIT' && !d.recommendation.executeImmediately && d.finalAction !== 'HOLD'
    );

    // Sort by priority
    priorityActions.sort((a, b) => b.executionPlan.priority - a.executionPlan.priority);
    normalActions.sort((a, b) => b.executionPlan.priority - a.executionPlan.priority);

    return {
      immediateActions: immediateActions.slice(0, this.config.executionSettings.maxSimultaneousExits),
      priorityActions: priorityActions.slice(0, this.config.executionSettings.maxSimultaneousExits),
      normalActions
    };
  }

  // =================== UTILITY METHODS ===================

  private static mergeConfig(
    defaultConfig: OrchestratorConfig,
    customConfig: Partial<OrchestratorConfig>
  ): OrchestratorConfig {
    return {
      managerWeights: { ...defaultConfig.managerWeights, ...customConfig.managerWeights },
      priorityRules: { ...defaultConfig.priorityRules, ...customConfig.priorityRules },
      executionSettings: { ...defaultConfig.executionSettings, ...customConfig.executionSettings },
      safetyConstraints: { ...defaultConfig.safetyConstraints, ...customConfig.safetyConstraints }
    };
  }

  private static mapRecommendationToAction(recommendationAction: string): 'HOLD' | 'SCALE_OUT' | 'EXIT_FULL' | 'EMERGENCY_EXIT' | 'ADJUST_HEDGE' {
    switch (recommendationAction.toLowerCase()) {
      case 'hold':
        return 'HOLD';
      case 'scale_out':
      case 'scale_out':
      case 'exit_partial':
        return 'SCALE_OUT';
      case 'exit_full':
        return 'EXIT_FULL';
      case 'emergency_exit':
        return 'EMERGENCY_EXIT';
      case 'adjust_hedge':
      case 'move_stop':
        return 'ADJUST_HEDGE';
      default:
        return 'HOLD';
    }
  }

  private static getExitQuantity(recommendationAction: string, position: Position): number {
    if (recommendationAction.toLowerCase().includes('full') || recommendationAction.toLowerCase().includes('emergency')) {
      return position.quantity;
    } else if (recommendationAction.toLowerCase().includes('partial') || recommendationAction.toLowerCase().includes('scale')) {
      return position.quantity * 0.3; // Default 30% for partial exits
    }
    return 0;
  }

  private static getManagerPriority(manager: string, urgency: string): number {
    let basePriority = 5; // Base priority

    // Adjust by manager type
    switch (manager) {
      case 'greeks':
        basePriority = 6; // Higher priority for Greeks
        break;
      case 'profitProtection':
        basePriority = 7; // Highest priority for profit protection
        break;
      case 'timeDecay':
        basePriority = 5;
        break;
      case 'marketRegime':
        basePriority = 4;
        break;
    }

    // Adjust by urgency
    switch (urgency) {
      case 'CRITICAL':
        basePriority += 4;
        break;
      case 'HIGH':
        basePriority += 2;
        break;
      case 'MEDIUM':
        basePriority += 1;
        break;
    }

    return Math.min(10, basePriority);
  }

  private static getActionValue(action: string): number {
    switch (action) {
      case 'EMERGENCY_EXIT': return 100;
      case 'EXIT_FULL': return 75;
      case 'SCALE_OUT': return 50;
      case 'ADJUST_HEDGE': return 25;
      case 'HOLD': return 0;
      default: return 0;
    }
  }

  private static getUrgencyMultiplier(urgency: string): number {
    switch (urgency) {
      case 'CRITICAL': return 2.0;
      case 'HIGH': return 1.5;
      case 'MEDIUM': return 1.0;
      case 'LOW': return 0.5;
      default: return 1.0;
    }
  }

  private static calculateOverallConfidence(votes: ManagerVote[]): number {
    return votes.reduce((sum, vote) => sum + vote.confidence, 0) / votes.length;
  }

  private static assessPositionRisk(
    greeks: GreeksPositionAnalysis,
    timeDecay: TimeDecayAnalysis,
    profitProtection: ProfitProtectionAnalysis,
    marketRegime: MarketRegimeAnalysis
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const riskLevels = [
      greeks.riskProfile.riskLevel,
      timeDecay.thetaAnalysis.thetaRiskLevel,
      profitProtection.riskManagement.positionRisk,
      marketRegime.currentRegime.riskLevel
    ];

    if (riskLevels.includes('CRITICAL')) return 'CRITICAL';
    if (riskLevels.includes('HIGH')) return 'HIGH';
    if (riskLevels.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private static determineExecutionTiming(
    votes: ManagerVote[],
    finalAction: string,
    emergencyConditions: string[]
  ): 'IMMEDIATE' | 'WITHIN_5_MIN' | 'WITHIN_15_MIN' | 'WITHIN_HOUR' {
    if (emergencyConditions.length > 0) return 'IMMEDIATE';
    if (finalAction === 'EMERGENCY_EXIT') return 'IMMEDIATE';
    if (votes.some(v => v.urgency === 'HIGH')) return 'WITHIN_5_MIN';
    if (votes.some(v => v.urgency === 'MEDIUM')) return 'WITHIN_15_MIN';
    return 'WITHIN_HOUR';
  }

  private static calculateExecutionPriority(votes: ManagerVote[], emergencyConditions: string[]): number {
    if (emergencyConditions.length > 0) return 10;
    return Math.max(...votes.map(v => v.priority));
  }

  private static calculateSuggestedQuantity(votes: ManagerVote[], position: Position): number {
    const exitVotes = votes.filter(v => v.exitQuantity && v.exitQuantity > 0);
    if (exitVotes.length === 0) return 0;

    const avgQuantity = exitVotes.reduce((sum, v) => sum + (v.exitQuantity || 0), 0) / exitVotes.length;
    return Math.min(position.quantity, avgQuantity);
  }

  private static identifyDependencies(votes: ManagerVote[], position: Position): string[] {
    const dependencies: string[] = [];

    // Check for hedge dependencies
    const hedgeVotes = votes.filter(v => v.action === 'ADJUST_HEDGE');
    if (hedgeVotes.length > 0) {
      dependencies.push('HEDGE_EXECUTION');
    }

    // Check for related positions (simplified)
    dependencies.push('MARKET_CONDITIONS');

    return dependencies;
  }

  private static identifyConflictingSignals(votes: ManagerVote[]): string[] {
    const conflicts: string[] = [];
    const actions = votes.map(v => v.action);
    const uniqueActions = [...new Set(actions)];

    if (uniqueActions.length > 2) {
      conflicts.push('MULTIPLE_CONFLICTING_ACTIONS');
    }

    const urgencies = votes.map(v => v.urgency);
    if (urgencies.includes('CRITICAL') && urgencies.includes('LOW')) {
      conflicts.push('URGENCY_CONFLICT');
    }

    return conflicts;
  }

  /**
   * Get current configuration
   */
  static getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);
  }

  /**
   * Reset to default configuration
   */
  static resetConfig(): void {
    this.config = { ...this.DEFAULT_CONFIG };
  }

  /**
   * Get execution queue
   */
  static getExecutionQueue(): OrchestratedDecision[] {
    return [...this.executionQueue];
  }

  /**
   * Clear execution queue
   */
  static clearExecutionQueue(): void {
    this.executionQueue = [];
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: Partial<OrchestratorConfig>): string[] {
    const errors: string[] = [];

    if (config.managerWeights) {
      const totalWeight = Object.values(config.managerWeights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(totalWeight - 100) > 1) {
        errors.push('Manager weights must sum to 100');
      }
    }

    if (config.priorityRules?.consensusThreshold !== undefined &&
        (config.priorityRules.consensusThreshold < 0 || config.priorityRules.consensusThreshold > 100)) {
      errors.push('Consensus threshold must be between 0 and 100');
    }

    if (config.safetyConstraints?.maxPortfolioRisk !== undefined &&
        (config.safetyConstraints.maxPortfolioRisk < 0 || config.safetyConstraints.maxPortfolioRisk > 1)) {
      errors.push('Max portfolio risk must be between 0 and 1');
    }

    return errors;
  }
}