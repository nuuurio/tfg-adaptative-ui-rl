import {actions, userProfiles} from "./config";
import type {Action, UserType}
from "./types";

export function getPreferredContent(userType : UserType) : Action {
    const preferences = userProfiles[userType].preferences;

    return actions.reduce((bestAction, currentAction) => preferences[currentAction] > preferences[bestAction]
        ? currentAction
        : bestAction);
}

function clamp(value : number, min : number, max : number) {
    return Math.max(min, Math.min(max, value));
}

function randomBetween(min : number, max : number) {
    return min + Math.random() * (max - min);
}

function getSessionStage(historyLength : number) {
    if (historyLength < 5) 
        return "early";
    if (historyLength < 12) 
        return "mid";
    return "late";
}

export function simulateUserResponse(
  userType: UserType,
  action: Action,
  context: {
    historyLength: number;
    lastAction: Action | null;
  } = {
    historyLength: 0,
    lastAction: null,
  }
) {
  const profile = userProfiles[userType];
  const preferences = profile.preferences;

  const preferenceScore = preferences[action];
  const preferred = getPreferredContent(userType);

  const historyLength = context.historyLength ?? 0;
  const sessionStage = getSessionStage(historyLength);
  const wasRepeated = context.lastAction === action;

  const stagePenalty =
    sessionStage === "late"
      ? profile.fatigueSensitivity * 0.6
      : sessionStage === "mid"
      ? profile.fatigueSensitivity * 0.3
      : 0;

  const noveltyBonus =
    userType === "explorador"
      ? wasRepeated
        ? -0.6
        : 0.8
      : wasRepeated
      ? -0.25
      : 0.15;

  const repeatedPenalty =
    userType === "explorador" && wasRepeated
      ? 0.7
      : wasRepeated
      ? 0.35
      : 0;

  const preferenceWeight =
    userType === "explorador"
      ? 1.2
      : userType === "eficient"
      ? 3.2
      : 2.2;

  const clickWeight =
    userType === "eficient" ? 2.8 : 2.3;

  const timeWeight =
    userType === "eficient" ? 0.08 : 0.12;

  let clickProbability =
    0.1 +
    preferenceScore * (userType === "explorador" ? 0.45 : 0.75) +
    profile.curiosity * 0.12 +
    profile.consistency * 0.08 +
    noveltyBonus * 0.15 -
    stagePenalty;

  let baseTime =
    2 +
    preferenceScore * (userType === "explorador" ? 5 : 7) +
    profile.patience * 4 +
    profile.curiosity * 1.5 -
    stagePenalty * 4;

  if (wasRepeated) {
    clickProbability -= 0.12 + profile.fatigueSensitivity * 0.2;
    baseTime -= userType === "explorador" ? 3 : 2;
  }

  clickProbability = clamp(clickProbability, 0.05, 0.95);
  baseTime = clamp(baseTime, 1.5, 16);

  const clicks = Math.random() < clickProbability ? 1 : 0;

  const timeSpent = Math.round(
    clamp(baseTime + randomBetween(-1.5, 2.5), 1, 18)
  );

  const noise =
    userType === "explorador"
      ? randomBetween(-0.8, 0.8)
      : randomBetween(-0.4, 0.4);

  let reward =
    clickWeight * clicks +
    timeWeight * timeSpent +
    preferenceWeight * preferenceScore +
    noveltyBonus -
    repeatedPenalty -
    stagePenalty +
    noise;

  if (userType === "eficient" && preferenceScore < 0.5) {
    reward -= 1.2;
  }

  if (userType === "explorador" && wasRepeated) {
    reward -= 0.5;
  }

  reward = Number(reward.toFixed(2));

  return {
    clicks,
    timeSpent,
    reward,
    preferred,
    preferenceScore: Number(preferenceScore.toFixed(2)),
    sessionStage,
    wasRepeated,
    clickProbability: Number(clickProbability.toFixed(2)),
  };
}