import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type UserType = "explorador" | "eficient" | "indecis";
type Action = "A" | "B" | "C";

type QTable = Record<UserType, Record<Action, number>>;

type Decision = {
  userType: UserType;
  action: Action;
  strategy?: "exploration" | "exploitation" | "manual";
  clicks: number;
  timeSpent: number;
  reward: number;
  preferred: Action;
  sessionStage?: string;
  wasRepeated?: boolean;
  clickProbability?: number;
  timestamp: string;
};

const actions: Action[] = ["A", "B", "C"];
const userTypes: UserType[] = ["explorador", "eficient", "indecis"];

const userProfiles = {
  explorador: {
    preferred: "A",
    curiosity: 0.75,
    patience: 0.8,
    consistency: 0.65,
    fatigueSensitivity: 0.15,
  },
  eficient: {
    preferred: "B",
    curiosity: 0.2,
    patience: 0.35,
    consistency: 0.9,
    fatigueSensitivity: 0.35,
  },
  indecis: {
    preferred: "C",
    curiosity: 0.5,
    patience: 0.55,
    consistency: 0.4,
    fatigueSensitivity: 0.25,
  },
} as const;

function createInitialQ(): QTable {
  return {
    explorador: { A: 0, B: 0, C: 0 },
    eficient: { A: 0, B: 0, C: 0 },
    indecis: { A: 0, B: 0, C: 0 },
  };
}

function loadInitialQ(): QTable {
  const saved = localStorage.getItem("qTable");
  return saved ? JSON.parse(saved) : createInitialQ();
}

function createInitialMultiUserChart() {
  return {
    explorador: [],
    eficient: [],
    indecis: [],
  } as Record<UserType, { step: number; reward: number }[]>;
}

function getPreferredContent(userType: UserType): Action {
  return userProfiles[userType].preferred as Action;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getSessionStage(historyLength: number) {
  if (historyLength < 5) return "early";
  if (historyLength < 12) return "mid";
  return "late";
}

function simulateUserResponse(
  userType: UserType,
  action: Action,
  context: { historyLength: number; lastAction: Action | null } = {
    historyLength: 0,
    lastAction: null,
  }
) {
  const profile = userProfiles[userType];
  const preferred = profile.preferred as Action;

  const historyLength = context.historyLength ?? 0;
  const sessionStage = getSessionStage(historyLength);
  const wasRepeated = context.lastAction === action;

  const isPreferred = action === preferred;
  const noveltyBonus = wasRepeated ? -0.15 : 0.2;

  const stagePenalty =
    sessionStage === "late"
      ? profile.fatigueSensitivity * 0.6
      : sessionStage === "mid"
      ? profile.fatigueSensitivity * 0.3
      : 0;

  let clickProbability: number;
  let baseTime: number;

  if (isPreferred) {
    clickProbability = 0.45 + profile.consistency * 0.4;
    baseTime = 5 + profile.patience * 8;
  } else {
    clickProbability =
      0.12 + profile.curiosity * 0.45 + noveltyBonus - stagePenalty;
    baseTime =
      2 + profile.curiosity * 5 + profile.patience * 2 - stagePenalty * 4;
  }

  if (wasRepeated) {
    clickProbability -= 0.1 + profile.fatigueSensitivity * 0.15;
    baseTime -= 1.5;
  }

  clickProbability = clamp(clickProbability, 0.05, 0.95);
  baseTime = clamp(baseTime, 1.5, 15);

  const clicks = Math.random() < clickProbability ? 1 : 0;
  const timeSpent = Math.round(
    clamp(baseTime + randomBetween(-1.5, 2.5), 1, 18)
  );

  const satisfaction = isPreferred ? 1 : 0;

  const reward = Number(
    (
      clicks * 2 +
      timeSpent * 0.12 +
      satisfaction * 0.8 +
      noveltyBonus -
      stagePenalty
    ).toFixed(2)
  );

  return {
    clicks,
    timeSpent,
    reward,
    preferred,
    sessionStage,
    wasRepeated,
    clickProbability: Number(clickProbability.toFixed(2)),
  };
}

function chooseAction(qForState: Record<Action, number>, epsilon = 0.2) {
  if (Math.random() < epsilon) {
    return {
      action: actions[Math.floor(Math.random() * actions.length)],
      strategy: "exploration" as const,
    };
  }

  const best = actions.reduce((best, current) =>
    qForState[current] > qForState[best] ? current : best
  );

  return {
    action: best,
    strategy: "exploitation" as const,
  };
}

function updateQValue(oldQ: number, reward: number, alpha = 0.1) {
  return oldQ + alpha * (reward - oldQ);
}

function contentLabel(action: Action) {
  if (action === "A") return "Contingut A · tutorials i exploració";
  if (action === "B") return "Contingut B · accés ràpid i tasques";
  return "Contingut C · suggeriments i ajuda guiada";
}

function buildCombinedChartData(
  multiUserChart: Record<UserType, { step: number; reward: number }[]>
) {
  const maxLength = Math.max(
    multiUserChart.explorador.length,
    multiUserChart.eficient.length,
    multiUserChart.indecis.length
  );

  return Array.from({ length: maxLength }, (_, index) => ({
    step: index + 1,
    explorador: multiUserChart.explorador[index]?.reward ?? null,
    eficient: multiUserChart.eficient[index]?.reward ?? null,
    indecis: multiUserChart.indecis[index]?.reward ?? null,
  }));
}

export default function AdaptiveRLWebDemo() {
  const [selectedUser, setSelectedUser] = useState<UserType>("explorador");
  const [epsilon, setEpsilon] = useState(0.2);
  const [qTable, setQTable] = useState<QTable>(loadInitialQ);
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [chartData, setChartData] = useState<{ step: number; reward: number }[]>(
    []
  );
  const [multiUserChart, setMultiUserChart] = useState(
    createInitialMultiUserChart
  );
  const [baselineChartData, setBaselineChartData] = useState<
    { step: number; reward: number }[]
  >([]);

  useEffect(() => {
    localStorage.setItem("qTable", JSON.stringify(qTable));
  }, [qTable]);

  const recommendedAction = useMemo(() => {
    const qForState = qTable[selectedUser];
    return actions.reduce((best, current) =>
      qForState[current] > qForState[best] ? current : best
    );
  }, [qTable, selectedUser]);

  const combinedChartData = useMemo(() => {
    return buildCombinedChartData(multiUserChart);
  }, [multiUserChart]);

  const averageReward =
    chartData.length > 0
      ? (
          chartData.reduce((acc, val) => acc + val.reward, 0) /
          chartData.length
        ).toFixed(2)
      : "0";

  const runOneTrainingStep = () => {
    const qForState = qTable[selectedUser];
    const { action, strategy } = chooseAction(qForState, epsilon);

    const result = simulateUserResponse(selectedUser, action, {
      historyLength: history.filter((item) => item.userType === selectedUser)
        .length,
      lastAction:
        history.find((item) => item.userType === selectedUser)?.action ?? null,
    });

    setQTable((prev) => ({
      ...prev,
      [selectedUser]: {
        ...prev[selectedUser],
        [action]: updateQValue(prev[selectedUser][action], result.reward),
      },
    }));

    const decision: Decision = {
      userType: selectedUser,
      action,
      strategy,
      ...result,
      timestamp: new Date().toLocaleTimeString(),
    };

    setLastDecision(decision);
    setHistory((prev) => [decision, ...prev].slice(0, 8));

    setChartData((prev) => [
      ...prev,
      { step: prev.length + 1, reward: decision.reward },
    ]);

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [
        ...prev[selectedUser],
        { step: prev[selectedUser].length + 1, reward: decision.reward },
      ],
    }));
  };

  const trainMany = (steps = 50) => {
    const nextQ = JSON.parse(JSON.stringify(qTable)) as QTable;
    const log: Decision[] = [];
    const nextMultiUserChart = JSON.parse(
      JSON.stringify(multiUserChart)
    ) as Record<UserType, { step: number; reward: number }[]>;

    for (let i = 0; i < steps; i++) {
      const { action, strategy } = chooseAction(nextQ[selectedUser], epsilon);

      const result = simulateUserResponse(selectedUser, action, {
        historyLength:
          history.filter((item) => item.userType === selectedUser).length + i,
        lastAction:
          i === 0
            ? history.find((item) => item.userType === selectedUser)?.action ??
              null
            : log[0]?.action ?? null,
      });

      nextQ[selectedUser][action] = updateQValue(
        nextQ[selectedUser][action],
        result.reward
      );

      const entry: Decision = {
        userType: selectedUser,
        action,
        strategy,
        ...result,
        timestamp: `step ${i + 1}`,
      };

      log.unshift(entry);

      nextMultiUserChart[selectedUser].push({
        step: nextMultiUserChart[selectedUser].length + 1,
        reward: result.reward,
      });
    }

    setQTable(nextQ);
    setMultiUserChart(nextMultiUserChart);

    if (log.length > 0) setLastDecision(log[0]);

    setHistory((prev) => [...log.slice(0, 5), ...prev].slice(0, 8));

    setChartData((prev) => [
      ...prev,
      ...log
        .slice()
        .reverse()
        .map((item, index) => ({
          step: prev.length + index + 1,
          reward: item.reward,
        })),
    ]);
  };

  const trainAllUsers = (stepsPerUser = 20) => {
    const nextQ = JSON.parse(JSON.stringify(qTable)) as QTable;
    const nextMultiUserChart = JSON.parse(
      JSON.stringify(multiUserChart)
    ) as Record<UserType, { step: number; reward: number }[]>;
    const allHistory: Decision[] = [];

    userTypes.forEach((userType) => {
      for (let i = 0; i < stepsPerUser; i++) {
        const { action, strategy } = chooseAction(nextQ[userType], epsilon);

        const result = simulateUserResponse(userType, action, {
          historyLength: nextMultiUserChart[userType].length,
          lastAction:
            allHistory.find((item) => item.userType === userType)?.action ??
            null,
        });

        nextQ[userType][action] = updateQValue(
          nextQ[userType][action],
          result.reward
        );

        nextMultiUserChart[userType].push({
          step: nextMultiUserChart[userType].length + 1,
          reward: result.reward,
        });

        allHistory.unshift({
          userType,
          action,
          strategy,
          ...result,
          timestamp: `${userType} · step ${i + 1}`,
        });
      }
    });

    setQTable(nextQ);
    setMultiUserChart(nextMultiUserChart);
    setHistory((prev) => [...allHistory.slice(0, 8), ...prev].slice(0, 8));

    if (allHistory.length > 0) setLastDecision(allHistory[0]);
  };

  const applyManualFeedback = (liked: boolean) => {
    const action = recommendedAction;
    const manualReward = liked ? 3 : -1;

    setQTable((prev) => ({
      ...prev,
      [selectedUser]: {
        ...prev[selectedUser],
        [action]: updateQValue(prev[selectedUser][action], manualReward),
      },
    }));

    const decision: Decision = {
      userType: selectedUser,
      action,
      strategy: "manual",
      clicks: liked ? 1 : 0,
      timeSpent: 0,
      reward: manualReward,
      preferred: getPreferredContent(selectedUser),
      timestamp: liked ? "feedback positiu" : "feedback negatiu",
    };

    setLastDecision(decision);
    setHistory((prev) => [decision, ...prev].slice(0, 8));

    setChartData((prev) => [
      ...prev,
      { step: prev.length + 1, reward: decision.reward },
    ]);

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [
        ...prev[selectedUser],
        { step: prev[selectedUser].length + 1, reward: decision.reward },
      ],
    }));
  };

  const resetSelectedUser = () => {
    setQTable((prev) => ({
      ...prev,
      [selectedUser]: { A: 0, B: 0, C: 0 },
    }));

    setHistory((prev) =>
      prev.filter((item) => item.userType !== selectedUser)
    );

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [],
    }));

    setLastDecision(null);
  };

  const clearSavedQTable = () => {
    localStorage.removeItem("qTable");
    setQTable(createInitialQ());
  };

  const resetDemo = () => {
    setQTable(createInitialQ());
    setLastDecision(null);
    setHistory([]);
    setChartData([]);
    setBaselineChartData([]);
    setMultiUserChart(createInitialMultiUserChart());
  };

  const runRandomBaseline = (steps = 50) => {
    const baselineResults = [];

    for (let i = 0; i < steps; i++) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const result = simulateUserResponse(selectedUser, randomAction);

      baselineResults.push({
        step: baselineChartData.length + i + 1,
        reward: result.reward,
      });
    }

    setBaselineChartData((prev) => [...prev, ...baselineResults]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Demo web adaptativa amb reinforcement learning
          </h1>
          <p className="mt-2 max-w-3xl text-base text-slate-600">
            Aquesta demo mostra una versió simple del TFG: el sistema aprèn quin
            contingut mostrar segons el perfil d’usuari i actualitza una Q-table en
            funció de la recompensa obtinguda.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle>Configuració</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Perfil d’usuari</p>
                <div className="flex flex-wrap gap-2">
                  {userTypes.map((type) => (
                    <Button
                      key={type}
                      variant={selectedUser === type ? "default" : "outline"}
                      onClick={() => setSelectedUser(type)}
                      className="rounded-2xl"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border p-3 text-sm">
                <p>
                  <strong>Epsilon:</strong> {epsilon.toFixed(2)}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEpsilon((prev) => Math.max(0, prev - 0.05))
                    }
                  >
                    Baixar epsilon
                  </Button>
                  <Button variant="outline" onClick={() => setEpsilon(0.2)}>
                    Reset epsilon
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Button onClick={runOneTrainingStep} className="w-full rounded-2xl">
                  Executar 1 interacció
                </Button>

                <Button
                  variant="outline"
                  onClick={() => trainMany(50)}
                  className="w-full rounded-2xl"
                >
                  Entrenar 50 iteracions
                </Button>

                <Button
                  variant="outline"
                  onClick={() => trainAllUsers(20)}
                  className="w-full rounded-2xl"
                >
                  Entrenar tots els usuaris
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runRandomBaseline(50)}
                  className="w-full rounded-2xl"
                >
                  Executar baseline random
                </Button>

                <Button
                  variant="outline"
                  onClick={resetSelectedUser}
                  className="w-full rounded-2xl"
                >
                  Reiniciar perfil actual
                </Button>

                <Button
                  variant="outline"
                  onClick={clearSavedQTable}
                  className="w-full rounded-2xl"
                >
                  Esborrar Q-table guardada
                </Button>

                <Button
                  variant="outline"
                  onClick={resetDemo}
                  className="w-full rounded-2xl"
                >
                  Reiniciar demo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Web personalitzada</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-600">Sistema recomana:</span>
                          <Badge className="rounded-xl text-sm">{recommendedAction}</Badge>
                          <span className="text-sm text-slate-700">
                            {contentLabel(recommendedAction)}
                          </span>
                        </div>
          
                        <div className="grid gap-4 md:grid-cols-3">
                          {actions.map((action) => {
                            const isRecommended = action === recommendedAction;
          
                            return (
                              <div
                                key={action}
                                className={`rounded-2xl border p-4 transition-all ${
                                  isRecommended
                                    ? "border-slate-900 bg-white shadow-md"
                                    : "border-slate-200 bg-slate-100"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-semibold">Bloc {action}</h3>
                                  {isRecommended && <Badge className="rounded-xl">Actiu</Badge>}
                                </div>
          
                                <p className="mt-2 text-sm text-slate-600">{contentLabel(action)}</p>
          
                                <p className="mt-4 text-xs text-slate-500">
                                  Q-value: {qTable[selectedUser][action].toFixed(2)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
          
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-medium">Control manual de l’usuari</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Aquesta part representa la idea del TFG que l’usuari pot influir en la
                            personalització encara que el sistema aprengui en background.
                          </p>
          
                          <div className="mt-3 flex gap-2">
                            <Button onClick={() => applyManualFeedback(true)} className="rounded-2xl">
                              M’agrada la recomanació
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => applyManualFeedback(false)}
                              className="rounded-2xl"
                            >
                              No m’agrada
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
          
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Última decisió del sistema</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {lastDecision ? (
                          <div className="space-y-2 text-sm">
                            <p><strong>Perfil:</strong> {lastDecision.userType}</p>
                            <p><strong>Acció:</strong> mostrar contingut {lastDecision.action}</p>
                            <p><strong>Preferència real simulada:</strong> {lastDecision.preferred}</p>
                            <p><strong>Clics:</strong> {lastDecision.clicks}</p>
                            <p><strong>Temps:</strong> {lastDecision.timeSpent}</p>
                            <p><strong>Reward:</strong> {lastDecision.reward.toFixed(2)}</p>
                            <p><strong>Fase de sessió:</strong> {lastDecision.sessionStage}</p>
                            <p><strong>Acció repetida:</strong> {lastDecision.wasRepeated ? "sí" : "no"}</p>
                            <p><strong>Probabilitat de clic:</strong> {lastDecision.clickProbability}</p>
                            <p><strong>Marca temporal:</strong> {lastDecision.timestamp}</p>
                            <p><strong>Reward mitjà:</strong> {averageReward}</p>
                            <p><strong>Estratègia:</strong> {lastDecision.strategy}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
                            Encara no hi ha cap interacció. Executa una iteració o entrena el model.
                          </p>
                        )}
                      </CardContent>
                    </Card>
          
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Historial recent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {history.length > 0 ? (
                          <div className="space-y-3">
                            {history.map((item, index) => (
                              <div
                                key={`${item.timestamp}-${index}`}
                                className="rounded-2xl border border-slate-200 p-3 text-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{item.userType}</span>
                                  <Badge variant="outline" className="rounded-xl">
                                    {item.action}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-slate-600">
                                  reward {item.reward.toFixed(2)} · preferit {item.preferred} · {item.timestamp}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">No hi ha historial encara.</p>
                        )}
                      </CardContent>
                    </Card>
          
                    <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Política apresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {userTypes.map((user) => {
                const bestAction = actions.reduce((best, current) =>
                  qTable[user][current] > qTable[user][best] ? current : best
                );
          
                return (
                  <p key={user}>
                    <strong>{user}</strong> → {bestAction}
                  </p>
                );
              })}
            </CardContent>
          </Card>
                  </div>
          
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Evolució de l’aprenentatge del perfil actiu</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartData.length > 0 ? (
                          <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="step" />
                                <YAxis />
                                <Tooltip />
                                <Line
                                  type="monotone"
                                  dataKey="reward"
                                  name="Reward"
                                  stroke="#2563eb"
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
                            Encara no hi ha dades per mostrar.
                          </p>
                        )}
                      </CardContent>
                    </Card>
          
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                          <CardTitle>Comparació RL vs baseline random</CardTitle>
                      </CardHeader>
                      <CardContent>
                          {chartData.length > 0 || baselineChartData.length > 0 ? (
                          <div className="h-[280px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                              <LineChart>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="step" type="number" allowDuplicatedCategory={false} />
                                  <YAxis />
                                  <Tooltip />
          
                                  <Line
                                  data={chartData}
                                  type="monotone"
                                  dataKey="reward"
                                  name="RL"
                                  stroke="#2563eb"
                                  strokeWidth={2}
                                  dot={false}
                                  />
          
                                  <Line
                                  data={baselineChartData}
                                  type="monotone"
                                  dataKey="reward"
                                  name="Random"
                                  stroke="#dc2626"
                                  strokeWidth={2}
                                  dot={false}
                                  />
                              </LineChart>
                              </ResponsiveContainer>
                          </div>
                          ) : (
                          <p className="text-sm text-slate-600">
                              Encara no hi ha dades per mostrar.
                          </p>
                          )}
                      </CardContent>
                  </Card>
          
                    <Card className="rounded-2xl shadow-sm">
                      <CardHeader>
                        <CardTitle>Evolució multiusuari</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {combinedChartData.length > 0 ? (
                          <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={combinedChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="step" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="explorador"
                                  name="Explorador"
                                  stroke="#7c3aed"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="eficient"
                                  name="Eficient"
                                  stroke="#16a34a"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="indecis"
                                  name="Indecís"
                                  stroke="#ea580c"
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
                            Encara no hi ha dades multiusuari per mostrar.
                          </p>
                        )}
                      </CardContent>
                    </Card>
        </div>
      </div>
    </div>
  );
}