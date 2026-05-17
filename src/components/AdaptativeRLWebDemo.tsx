import React, { useEffect, useMemo, useState } from "react";
import {
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Bar,
  BarChart,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { actions, userTypes } from "@/rl/config";
import type { Decision, QTable, UserType, Action } from "@/rl/types";
import {
  chooseAction,
  createInitialQ,
  loadInitialQ,
  updateQValue,
} from "@/rl/model";
import { getPreferredContent, simulateUserResponse } from "@/rl/agents";
import {
  buildCombinedChartData,
  createInitialMultiUserChart,
} from "@/rl/charts";
import { contentLabel } from "@/utils/ui";
import { COLORS } from "./ui/palette";

export default function AdaptiveRLWebDemo() {
  const [selectedUser, setSelectedUser] = useState<UserType>("explorador");
  const [epsilon, setEpsilon] = useState(0.3);
  const [qTable, setQTable] = useState<QTable>(loadInitialQ);
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [chartData, setChartData] = useState<
    {
      step: number;
      reward: number;
    }[]
  >([]);
  const [multiUserChart, setMultiUserChart] = useState(
    createInitialMultiUserChart,
  );
  const [actionHistory, setActionHistory] = useState<
    {
      step: number;
      userType: UserType;
      action: Action;
      reward: number;
    }[]
  >([]);
  const [qValueHistory, setQValueHistory] = useState<
    ({ step: number; userType: UserType } & Partial<Record<Action, number>>)[]
  >([]);
  const [epsilonHistory, setEpsilonHistory] = useState<
    { step: number; userType: UserType; epsilon: number }[]
  >([]);
  const [strategyHistory, setStrategyHistory] = useState<
    {
      step: number;
      strategy: "exploration" | "exploitation" | "manual";
      count: number;
    }[]
  >([]);

  const [baselineByUser, setBaselineByUser] = useState<
    Record<UserType, { step: number; reward: number }[]>
  >({ explorador: [], eficient: [], novell: [] });

  useEffect(() => {
    localStorage.setItem("qTable", JSON.stringify(qTable));
  }, [qTable]);

  function getEpsilon(step: number) {
    const minEpsilon = 0.08;
    const decayRate = 0.995;

    return Math.max(minEpsilon, 0.3 * Math.pow(decayRate, step));
  }

  const recommendedAction = useMemo(() => {
    const qForState = qTable[selectedUser];
    return actions.reduce((best, current) =>
      qForState[current] > qForState[best] ? current : best,
    );
  }, [qTable, selectedUser]);

  const combinedChartData = useMemo(() => {
    return buildCombinedChartData(multiUserChart);
  }, [multiUserChart]);

  const averageReward =
    chartData.length > 0
      ? (
          chartData.reduce((acc, val) => acc + val.reward, 0) / chartData.length
        ).toFixed(2)
      : "0";

  const selectedRLData = useMemo(() => {
    return multiUserChart[selectedUser] ?? [];
  }, [multiUserChart, selectedUser]);

  const selectedRandomData = useMemo(() => {
    return baselineByUser[selectedUser] ?? [];
  }, [baselineByUser, selectedUser]);

  const evaluationMetrics = useMemo(() => {
    const rlTotal = selectedRLData.reduce((sum, item) => sum + item.reward, 0);
    const randomTotal = selectedRandomData.reduce(
      (sum, item) => sum + item.reward,
      0,
    );

    const rlAverage =
      selectedRLData.length > 0 ? rlTotal / selectedRLData.length : 0;

    const randomAverage =
      selectedRandomData.length > 0
        ? randomTotal / selectedRandomData.length
        : 0;

    const relativeImprovement =
      randomAverage !== 0
        ? ((rlAverage - randomAverage) / Math.abs(randomAverage)) * 100
        : 0;

    const rlVariance =
      selectedRLData.length > 0
        ? selectedRLData.reduce(
            (sum, item) => sum + Math.pow(item.reward - rlAverage, 2),
            0,
          ) / selectedRLData.length
        : 0;

    return {
      rlAverage,
      randomAverage,
      relativeImprovement,
      rlTotal,
      randomTotal,
      rlVariance,
    };
  }, [selectedRLData, selectedRandomData]);

  const selectedEpsilonHistory = useMemo(() => {
    return epsilonHistory
      .filter((item) => item.userType === selectedUser)
      .map((item, index) => ({
        ...item,
        step: index + 1,
      }));
  }, [epsilonHistory, selectedUser]);

  const selectedQValueHistory = useMemo(() => {
    return qValueHistory
      .filter((item) => item.userType === selectedUser)
      .map((item, index) => ({
        ...item,
        step: index + 1,
      }));
  }, [qValueHistory, selectedUser]);

  const strategyDistributionData = useMemo(() => {
    const totals = strategyHistory.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.strategy] = (acc[item.strategy] ?? 0) + item.count;
        return acc;
      },
      {},
    );

    return [
      {
        strategy: "exploration",
        count: totals.exploration ?? 0,
      },
      {
        strategy: "exploitation",
        count: totals.exploitation ?? 0,
      },
      {
        strategy: "manual",
        count: totals.manual ?? 0,
      },
    ];
  }, [strategyHistory]);

  const crossUserComparisonData = useMemo(() => {
    return userTypes.map((user) => {
      const rlData = multiUserChart[user] ?? [];
      const randomData = baselineByUser[user] ?? [];

      const rlAvg =
        rlData.length > 0
          ? rlData.reduce((sum, item) => sum + item.reward, 0) / rlData.length
          : 0;

      const randomAvg =
        randomData.length > 0
          ? randomData.reduce((sum, item) => sum + item.reward, 0) /
            randomData.length
          : 0;

      return {
        user,
        RL: Number(rlAvg.toFixed(2)),
        Random: Number(randomAvg.toFixed(2)),
      };
    });
  }, [multiUserChart, baselineByUser]);

  const runRandomBaseline = (steps = 50) => {
    const baselineResults: {
      step: number;
      reward: number;
    }[] = [];

    for (let i = 0; i < steps; i++) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      const result = simulateUserResponse(selectedUser, randomAction, {
        historyLength: baselineByUser[selectedUser].length + i,
        lastAction: null,
      });

      baselineResults.push({
        step: baselineByUser[selectedUser].length + i + 1,
        reward: result.reward,
      });
    }

    setBaselineByUser((prev) => ({
      ...prev,
      [selectedUser]: [...prev[selectedUser], ...baselineResults],
    }));
  };

  const runOneTrainingStep = () => {
    const currentUserStep = (multiUserChart[selectedUser]?.length ?? 0) + 1;

    const dynamicEpsilon = getEpsilon(currentUserStep);
    setEpsilon(dynamicEpsilon);

    const qForState = qTable[selectedUser];
    const { action, strategy } = chooseAction(qForState, dynamicEpsilon);

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

    setQValueHistory((prev) => [
      ...prev,
      {
        step: prev.filter((item) => item.userType === selectedUser).length + 1,
        userType: selectedUser,
        ...qTable[selectedUser],
        [action]: updateQValue(qTable[selectedUser][action], result.reward),
      },
    ]);

    setLastDecision(decision);
    setHistory((prev) => [decision, ...prev].slice(0, 8));

    setChartData((prev) => [
      ...prev,
      {
        step: prev.length + 1,
        reward: decision.reward,
      },
    ]);

    setEpsilonHistory((prev) => [
      ...prev,
      {
        step: prev.filter((item) => item.userType === selectedUser).length + 1,
        userType: selectedUser,
        epsilon: dynamicEpsilon,
      },
    ]);

    setActionHistory((prev) => [
      ...prev,
      {
        step: prev.length + 1,
        userType: selectedUser,
        action: decision.action,
        reward: decision.reward,
      },
    ]);

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [
        ...prev[selectedUser],
        {
          step: prev[selectedUser].length + 1,
          reward: decision.reward,
        },
      ],
    }));
  };

  const trainMany = (steps = 50) => {
    const nextQ = JSON.parse(JSON.stringify(qTable)) as QTable;
    const log: Decision[] = [];
    const nextMultiUserChart = JSON.parse(
      JSON.stringify(multiUserChart),
    ) as Record<UserType, { step: number; reward: number }[]>;

    for (let i = 0; i < steps; i++) {
      const currentUserStep =
        (nextMultiUserChart[selectedUser]?.length ?? 0) + 1;

      const dynamicEpsilon = getEpsilon(currentUserStep);

      const { action, strategy } = chooseAction(
        nextQ[selectedUser],
        dynamicEpsilon,
      );

      const result = simulateUserResponse(selectedUser, action, {
        historyLength:
          history.filter((item) => item.userType === selectedUser).length + i,
        lastAction:
          i === 0
            ? (history.find((item) => item.userType === selectedUser)?.action ??
              null)
            : (log[0]?.action ?? null),
      });

      nextQ[selectedUser][action] = updateQValue(
        nextQ[selectedUser][action],
        result.reward,
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

    setQValueHistory((prev) => {
      const currentUserSteps = prev.filter(
        (item) => item.userType === selectedUser,
      ).length;

      return [
        ...prev,
        ...log
          .slice()
          .reverse()
          .map((_, index) => ({
            step: currentUserSteps + index + 1,
            userType: selectedUser,
            ...nextQ[selectedUser],
          })),
      ];
    });

    const finalUserStep = nextMultiUserChart[selectedUser].length;

    setEpsilon(getEpsilon(finalUserStep));

    setEpsilonHistory((prev) => {
      const currentUserSteps = prev.filter(
        (item) => item.userType === selectedUser,
      ).length;

      return [
        ...prev,
        ...Array.from({ length: steps }, (_, index) => {
          const userStep = currentUserSteps + index + 1;

          return {
            step: userStep,
            userType: selectedUser,
            epsilon: getEpsilon(userStep),
          };
        }),
      ];
    });

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

    setActionHistory((prev) => [
      ...prev,
      ...log
        .slice()
        .reverse()
        .map((item, index) => ({
          step: prev.length + index + 1,
          userType: item.userType,
          action: item.action,
          reward: item.reward,
        })),
    ]);

    setStrategyHistory((prev) => [
      ...prev,
      ...log
        .slice()
        .reverse()
        .map((item, index) => ({
          step: prev.length + index + 1,
          strategy: item.strategy ?? "exploitation",
          count: 1,
        })),
    ]);
  };

  const trainAllUsers = (stepsPerUser = 20) => {
    const nextQ = JSON.parse(JSON.stringify(qTable)) as QTable;
    const nextMultiUserChart = JSON.parse(
      JSON.stringify(multiUserChart),
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
          result.reward,
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

    setActionHistory((prev) => [
      ...prev,
      ...allHistory
        .slice()
        .reverse()
        .map((item, index) => ({
          step: prev.length + index + 1,
          userType: item.userType,
          action: item.action,
          reward: item.reward,
        })),
    ]);

    setStrategyHistory((prev) => [
      ...prev,
      ...allHistory
        .slice()
        .reverse()
        .map((item, index) => ({
          step: prev.length + index + 1,
          strategy: item.strategy ?? "exploitation",
          count: 1,
        })),
    ]);
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
      {
        step: prev.length + 1,
        reward: decision.reward,
      },
    ]);

    setStrategyHistory((prev) => [
      ...prev,
      {
        step: prev.length + 1,
        strategy: "manual",
        count: 1,
      },
    ]);

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [
        ...prev[selectedUser],
        {
          step: prev[selectedUser].length + 1,
          reward: decision.reward,
        },
      ],
    }));
  };

  const resetSelectedUser = () => {
    setQTable((prev) => ({
      ...prev,
      [selectedUser]: createInitialQ()[selectedUser],
    }));

    setHistory((prev) => prev.filter((item) => item.userType !== selectedUser));

    setMultiUserChart((prev) => ({
      ...prev,
      [selectedUser]: [],
    }));

    setLastDecision(null);
    setActionHistory([]);
    setEpsilonHistory([]);
    setStrategyHistory([]);
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
    setMultiUserChart(createInitialMultiUserChart());
    setQValueHistory([]);
    setActionHistory([]);
    setEpsilonHistory([]);
    setStrategyHistory([]);
    setBaselineByUser({ explorador: [], eficient: [], novell: [] });
  };

  const cumulativeRewardData = useMemo(() => {
    const rlData = multiUserChart[selectedUser] ?? [];
    const randomData = baselineByUser[selectedUser] ?? [];

    const maxLength = Math.max(rlData.length, randomData.length);

    return Array.from({ length: maxLength }).reduce<
      {
        step: number;
        RL: number;
        Random: number;
      }[]
    >((acc, _, index) => {
      const previous = acc[index - 1] ?? {
        RL: 0,
        Random: 0,
      };

      acc.push({
        step: index + 1,
        RL: Number((previous.RL + (rlData[index]?.reward ?? 0)).toFixed(2)),
        Random: Number(
          (previous.Random + (randomData[index]?.reward ?? 0)).toFixed(2),
        ),
      });

      return acc;
    }, []);
  }, [multiUserChart, baselineByUser, selectedUser]);

  const actionDistributionData = useMemo(() => {
    const filtered = actionHistory.filter(
      (item) => item.userType === selectedUser,
    );

    return actions.map((action) => {
      const count = filtered.filter((item) => item.action === action).length;

      return { action, count };
    });
  }, [actionHistory, selectedUser]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Demo web adaptativa amb reinforcement learning
          </h1>
          <p className="mt-2 mx-auto max-w-3xl text-base text-slate-600">
            Aquesta demo mostra una versió simple del TFG: el sistema aprèn quin
            contingut mostrar segons el perfil d’usuari i actualitza una Q-table
            en funció de la recompensa obtinguda.
          </p>
        </div>

        {/* <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Formulació formal del model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              El prototip es pot descriure com un contextual bandit: per cada
              estat d'usuari, el sistema selecciona una adaptació de la
              interfície i rep una recompensa immediata.
            </p>
            <div className="rounded-2xl border bg-slate-50 p-4 font-mono text-xs leading-6">
              <p>s = userType</p>
              <p>a ∈ {actions.join(", ")}</p>
              <p>
                R = wc·clicks + wt·timeSpent + wp·preferenceScore + Bnovelty −
                Prepetition − Pfatigue + ε
              </p>
              <p>Q(s,a) ← Q(s,a) + α · (R − Q(s,a))</p>
            </div>
            <p className="text-slate-600">
              Aquesta formulació fa explícit que el sistema optimitza engagement
              immediat. Per convertir-lo en Q-learning complet caldria afegir
              estat següent, factor de descompte γ i recompensa futura esperada.
            </p>
          </CardContent>
        </Card> */}

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
                  <strong>Epsilon:</strong>
                  {epsilon.toFixed(2)}
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
                <Button
                  onClick={runOneTrainingStep}
                  className="w-full rounded-2xl"
                >
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
                <span className="text-sm text-slate-600">
                  Sistema recomana:
                </span>
                <Badge className="rounded-xl text-sm">
                  {recommendedAction}
                </Badge>
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
                        <h3 className="text-lg font-semibold">
                          {contentLabel(action)}
                        </h3>
                        {isRecommended && (
                          <Badge className="rounded-xl">Actiu</Badge>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-600">{action}</p>

                      <p className="mt-4 text-xs text-slate-500">
                        Q-value: {qTable[selectedUser][action].toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium">
                  Control manual de l’usuari
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Aquesta part representa la idea del TFG que l’usuari pot
                  influir en la personalització encara que el sistema aprengui
                  en background.
                </p>

                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => applyManualFeedback(true)}
                    className="rounded-2xl"
                  >
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
                  <p>
                    <strong>Perfil:</strong>
                    {lastDecision.userType}
                  </p>
                  <p>
                    <strong>Acció:</strong>
                    mostrar contingut {lastDecision.action}
                  </p>
                  <p>
                    <strong>Acció amb més afinitat:</strong>
                    {lastDecision.preferred}
                  </p>
                  <p>
                    <strong>Afinitat amb l’acció:</strong>
                    {lastDecision.preferenceScore}
                  </p>
                  <p>
                    <strong>Clics:</strong>
                    {lastDecision.clicks}
                  </p>
                  <p>
                    <strong>Temps:</strong>
                    {lastDecision.timeSpent}
                  </p>
                  <p>
                    <strong>Reward:</strong>
                    {lastDecision.reward.toFixed(2)}
                  </p>
                  <p>
                    <strong>Fase de sessió:</strong>
                    {lastDecision.sessionStage}
                  </p>
                  <p>
                    <strong>Acció repetida:</strong>
                    {lastDecision.wasRepeated ? "sí" : "no"}
                  </p>
                  <p>
                    <strong>Probabilitat de clic:</strong>
                    {lastDecision.clickProbability}
                  </p>
                  <p>
                    <strong>Marca temporal:</strong>
                    {lastDecision.timestamp}
                  </p>
                  <p>
                    <strong>Reward mitjà:</strong>
                    {averageReward}
                  </p>
                  <p>
                    <strong>Estratègia:</strong>
                    {lastDecision.strategy}
                  </p>
                  <p>
                    <strong>Epsilon actual:</strong>
                    {epsilon.toFixed(3)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha cap interacció. Executa una iteració o entrena
                  el model.
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
                        reward {item.reward.toFixed(2)}· preferit{" "}
                        {item.preferred}· {item.timestamp}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  No hi ha historial encara.
                </p>
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
                  qTable[user][current] > qTable[user][best] ? current : best,
                );

                return (
                  <p key={user}>
                    <strong>{user}</strong>→ {bestAction}
                  </p>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Mètriques d'avaluació</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Reward mitjà RL</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.rlAverage.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Reward mitjà random</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.randomAverage.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Millora relativa</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.relativeImprovement.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Reward acumulat RL</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.rlTotal.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Reward acumulat random</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.randomTotal.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-slate-500">Variància RL</p>
                <p className="text-2xl font-semibold">
                  {evaluationMetrics.rlVariance.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Evolució de l’aprenentatge del perfil actiu</CardTitle>
            </CardHeader>
            <CardContent>
              {multiUserChart[selectedUser].length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={multiUserChart[selectedUser]}>
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
              <CardTitle>Evolució dels Q-values</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedQValueHistory.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedQValueHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="step" />
                      <YAxis />
                      <Tooltip />
                      <Legend />{" "}
                      {actions.map((action, index) => (
                        <Line
                          key={action}
                          type="monotone"
                          dataKey={action}
                          name={contentLabel(action)}
                          stroke={COLORS.actions[index % COLORS.actions.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha Q-values per mostrar.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Reward acumulat: RL vs Random</CardTitle>
            </CardHeader>
            <CardContent>
              {cumulativeRewardData.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeRewardData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="step" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="RL"
                        name="RL"
                        stroke={COLORS.rl}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Random"
                        name="Random"
                        stroke={COLORS.random}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha dades acumulades.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Distribució d’accions seleccionades</CardTitle>
            </CardHeader>
            <CardContent>
              {actionHistory.some((item) => item.userType === selectedUser) ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="action" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Nombre de seleccions">
                        {actionDistributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS.actions[index % COLORS.actions.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha accions registrades.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Comparació entre perfils: RL vs Random</CardTitle>
            </CardHeader>

            <CardContent>
              {crossUserComparisonData.some(
                (item) => item.RL > 0 || item.Random > 0,
              ) ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={crossUserComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="user" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="RL"
                        name="Reward mitjà RL"
                        fill={COLORS.rl}
                      />
                      <Bar
                        dataKey="Random"
                        name="Reward mitjà random"
                        fill={COLORS.random}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha dades suficients per comparar perfils.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Disminució d'epsilon</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEpsilonHistory.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedEpsilonHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="step" />
                      <YAxis domain={[0, 0.35]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="epsilon"
                        name="Epsilon"
                        stroke={COLORS.epsilon}
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha dades d'epsilon.
                </p>
              )}{" "}
            </CardContent>
          </Card>{" "}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Exploració vs explotació</CardTitle>
            </CardHeader>
            <CardContent>
              {strategyHistory.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="strategy" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Nombre de decisions">
                        {strategyDistributionData.map((entry) => {
                          let color = "#64748b";
                          if (entry.strategy === "exploration")
                            color = "#f59e0b";
                          if (entry.strategy === "exploitation")
                            color = "#16a34a";
                          if (entry.strategy === "manual") color = "#3b82f6";

                          return <Cell key={entry.strategy} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Encara no hi ha decisions registrades.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            {" "}
            <CardHeader>
              <CardTitle>Comparació RL vs baseline random</CardTitle>
            </CardHeader>
            <CardContent>
              {" "}
              {selectedRLData.length > 0 || selectedRandomData.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="step"
                        type="number"
                        allowDuplicatedCategory={false}
                      />
                      <YAxis />
                      <Tooltip />

                      <Line
                        data={selectedRLData}
                        type="monotone"
                        dataKey="reward"
                        name="RL"
                        stroke={COLORS.rl}
                        strokeWidth={2}
                        dot={false}
                      />

                      <Line
                        data={selectedRandomData}
                        type="monotone"
                        dataKey="reward"
                        name="Random"
                        stroke={COLORS.random}
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
              )}{" "}
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
                        stroke={COLORS.explorador}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="eficient"
                        name="Eficient"
                        stroke={COLORS.eficient}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="novell"
                        name="Novell"
                        stroke={COLORS.novell}
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
