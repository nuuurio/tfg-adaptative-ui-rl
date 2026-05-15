export type UserType = "explorador" | "eficient" | "indecis";
export type Action = "A" | "B" | "C";
export type Strategy = "exploration" | "exploitation" | "manual";

export type QTable = Record<UserType, Record<Action, number>>;

export type Decision = {
  userType: UserType;
  action: Action;
  strategy?: Strategy;
  clicks: number;
  timeSpent: number;
  reward: number;
  preferred: Action;
  sessionStage?: string;
  wasRepeated?: boolean;
  clickProbability?: number;
  timestamp: string;
};