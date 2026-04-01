/**
 * aiWeights.ts — Behavioral weights and magic numbers for the AI system.
 * This file centralizes all thresholds, probabilities, and Bayesian likelihood ratios
 * for the various AI personality profiles.
 */

import { AIPersonality } from '../src/types.ts';

export const AI_WEIGHTS = {
  // Difficulty-based scaling applied to suspicion thresholds
  difficulty: {
    Elite: 1.5,
    Normal: 1.0,
    Casual: 0.5,
  },

  // Personality-specific voting risk thresholds (lower = more risk-averse / "Nay"-prone)
  riskThresholds: {
    Strategic: 0.3,
    Chaotic: 0.7,
    Default: 0.5,
  } as Record<string, number>,

  // Lying probabilities for declarations and claims
  lying: {
    // Probability of lying about what they saw/passed (higher is more likely)
    Deceptive: 1.0, 
    Aggressive: 0.85, // 1 - 0.15
    Chaotic: 0.7,    // 1 - 0.3
    Strategic: 1.0,  // (conditional in gameEngine, handled by threshold)
    Honest: 0.05,    // (mistake chance)
  } as Record<AIPersonality, number>,

  // Legislative strategy thresholds
  legislative: {
    // Number of state directives needed before a Strategic player prioritizes state
    STRATEGIC_PASS_THRESHOLD: 1, 
    STRATEGIC_PLAY_THRESHOLD: 2,
    // Chance of a Civil player "accidentally" discarding a Civil card
    CIVIL_MISTAKE_CHANCE: 0.05,
  },

  // State Team Voting Behavior (desperation and blending)
  stateVoting: {
    AYE_THRESHOLD_BASE: 0.15, // Chance of voting Nay even if government is good for State (blending)
    NAY_THRESHOLD_BASE: 0.45, // Chance of voting Aye on Civil gov (desperation/blending)
  },

  // Noise factors for voting and reactivity
  noise: {
    BASE_VOTING: 0.2,
    AGENDA_CONTRIBUTION: 0.25,
  },

  // Suspicion Likelihood Ratios (Bayesian compounds)
  // These are already in suspicion.ts but gathered here for reference or future refactoring
  suspicionModel: {
    INITIAL_BELIEF: {
      STATE_TEAM: 0.97,
      CIVIL_TEAM: 0.03,
    },
    VOTING_LR: {
      STATE_POLICY: { AYE: 1.78, NAY: 0.56 },
      CIVIL_POLICY: { AYE: 0.71, NAY: 1.4 },
    },
    BLAME_LR: {
      PRESIDENT: { STATE: 1.4, CIVIL: 0.75 },
      CHANCELLOR: { STATE: 2.8, CIVIL: 0.45 },
    },
    DECLARATION_LR: {
      INCONSISTENT: 2.0,
      CONSISTENT: 0.88,
      TRIPLE_STATE_DEFLECTION: 1.2,
      CHANCELLOR_EXCULPATORY: 1.3,
      POLICY_EXPECTATION: 3.5,
    },
    INVESTIGATION_LR: {
      TARGET_STATE: 10.0,
      TARGET_CIVIL: 0.08,
      INVESTIGATOR_STATE_CLAIM: 0.85,
      INVESTIGATOR_CIVIL_CLAIM: 0.88,
    },
    NOMINATION: {
      SUSPICION_THRESHOLD: 0.6,
      BASE_INCREASE: 1.2,
      BASE_DECREASE: 0.95,
      SUSPICIOUS_NOMINATION_LR_BASE: 1.0,
    },
  },
  // General AI interaction probabilities
  general: {
    CHAT_CHANCE: 0.4, // Math.random() > 0.6
    REACTION_CHANCE: 0.6, // Math.random() > 0.4
    VETO_AGREE_CHANCE: 0.25, // Math.random() > 0.75
    NOMINATION_RANDOM_TEAMMATE_CHANCE: 0.7, // Math.random() > 0.3
  },
} as const;
