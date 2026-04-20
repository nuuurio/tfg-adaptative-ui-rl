import React, {useMemo, useState} from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer
} from "recharts";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";

const actions = ["A", "B", "C"];
const userTypes = ["explorador", "eficient", "indecis"];

function createInitialQ() {
    const q = {};
    userTypes.forEach((type) => {
        q[type] = {
            A: 0,
            B: 0,
            C: 0
        };
    });
    return q;
}

function getPreferredContent(userType: string) {
    if (userType === "explorador") 
        return "A";
    if (userType === "eficient") 
        return "B";
    return "C";
}

function simulateUserResponse(userType: string, action: string) {
    const preferred = getPreferredContent(userType);

    let clicks = 0;
    let timeSpent = 0;

    if (action === preferred) {
        clicks = Math.random() < 0.85
            ? 1
            : 0;
        timeSpent = 8 + Math.floor(Math.random() * 8);
    } else if (userType === "explorador") {
        clicks = Math.random() < 0.5
            ? 1
            : 0;
        timeSpent = 4 + Math.floor(Math.random() * 7);
    } else if (userType === "eficient") {
        clicks = Math.random() < 0.3
            ? 1
            : 0;
        timeSpent = 2 + Math.floor(Math.random() * 4);
    } else {
        clicks = Math.random() < 0.4
            ? 1
            : 0;
        timeSpent = 3 + Math.floor(Math.random() * 5);
    }

    const reward = clicks * 2 + timeSpent * 0.1;

    return {clicks, timeSpent, reward, preferred};
}

function chooseAction(qForState: object, epsilon = 0.2) {
    if (Math.random() < epsilon) {
        return actions[Math.floor(Math.random() * actions.length)];
    }

    return actions.reduce((best, current) => qForState[current] > qForState[best]
        ? current
        : best);
}

function updateQValue(oldQ: number, reward: number, alpha = 0.1) {
    return oldQ + alpha * (reward - oldQ);
}

function contentLabel(action: string) {
    if (action === "A") 
        return "Contingut A · tutorials i exploració";
    if (action === "B") 
        return "Contingut B · accés ràpid i tasques";
    return "Contingut C · suggeriments i ajuda guiada";
}

export default function AdaptiveRLWebDemo() {
    const [selectedUser,
        setSelectedUser] = useState("explorador");
    const [qTable,
        setQTable] = useState(createInitialQ);
    const [lastDecision,
        setLastDecision] = useState(null);
    const [history,
        setHistory] = useState([]);
    const [chartData,
        setChartData] = useState([]);

    const recommendedAction = useMemo(() => {
        const qForState = qTable[selectedUser];
        return actions.reduce((best, current) => qForState[current] > qForState[best]
            ? current
            : best);
    }, [qTable, selectedUser]);

    const runOneTrainingStep = () => {
        const qForState = qTable[selectedUser];
        const action = chooseAction(qForState, 0.2);
        const result = simulateUserResponse(selectedUser, action);

        setQTable((prev) => ({
            ...prev,
            [selectedUser]: {
                ...prev[selectedUser],
                [action]: updateQValue(prev[selectedUser][action], result.reward)
            }
        }));

        const decision = {
            userType: selectedUser,
            action,
            ...result,
            timestamp: new Date().toLocaleTimeString()
        };

        setLastDecision(decision);
        setHistory((prev) => [
            decision, ...prev
        ].slice(0, 8));

        setChartData((prev) => [
            ...prev, {
                step: prev.length + 1,
                reward: decision.reward
            }
        ]);
    };

    const trainMany = (steps = 50) => {
        const nextQ = JSON.parse(JSON.stringify(qTable));
        const log = [];

        for (let i = 0; i < steps; i++) {
            const action = chooseAction(nextQ[selectedUser], 0.2);
            const result = simulateUserResponse(selectedUser, action);

            nextQ[selectedUser][action] = updateQValue(nextQ[selectedUser][action], result.reward);

            log.unshift({
                userType: selectedUser,
                action,
                ...result,
                timestamp: `step ${i + 1}`
            });
        }

        setQTable(nextQ);

        if (log.length > 0) {
            setLastDecision(log[0]);
        }

        setHistory((prev) => [
            ...log.slice(0, 5),
            ...prev
        ].slice(0, 8));

        setChartData((prev) => [
            ...prev,
            ...log
                .slice()
                .reverse()
                .map((item, index) => ({
                    step: prev.length + index + 1,
                    reward: item.reward
                }))
        ]);
    };

    const applyManualFeedback = (liked: boolean) => {
        const action = recommendedAction;
        const manualReward = liked
            ? 3
            : -1;

        setQTable((prev) => ({
            ...prev,
            [selectedUser]: {
                ...prev[selectedUser],
                [action]: updateQValue(prev[selectedUser][action], manualReward)
            }
        }));

        const decision = {
            userType: selectedUser,
            action,
            clicks: liked
                ? 1
                : 0,
            timeSpent: 0,
            reward: manualReward,
            preferred: getPreferredContent(selectedUser),
            timestamp: liked
                ? "feedback positiu"
                : "feedback negatiu"
        };

        setLastDecision(decision);
        setHistory((prev) => [
            decision, ...prev
        ].slice(0, 8));

        setChartData((prev) => [
            ...prev, {
                step: prev.length + 1,
                reward: decision.reward
            }
        ]);
    };

    const resetDemo = () => {
        setQTable(createInitialQ());
        setLastDecision(null);
        setHistory([]);
        setChartData([]);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Demo web adaptativa amb reinforcement learning
                    </h1>
                    <p className="mt-2 max-w-3xl text-base text-slate-600">
                        Aquesta demo mostra una versió simple del TFG: el sistema aprèn quin contingut
                        mostrar segons el perfil d’usuari i actualitza una Q-table en funció de la
                        recompensa obtinguda.
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
                                            variant={selectedUser === type
                                            ? "default"
                                            : "outline"}
                                            onClick={() => setSelectedUser(type)}
                                            className="rounded-2xl">
                                            {type}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Button onClick={runOneTrainingStep} className="w-full rounded-2xl">
                                    Executar 1 interacció
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => trainMany(50)}
                                    className="w-full rounded-2xl">
                                    Entrenar 50 iteracions
                                </Button>

                                <Button variant="outline" onClick={resetDemo} className="w-full rounded-2xl">
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
                                            className={`rounded-2xl border p-4 transition-all ${isRecommended
                                            ? "border-slate-900 bg-white shadow-md"
                                            : "border-slate-200 bg-slate-100"}`}>
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
                                        className="rounded-2xl">
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
                            {lastDecision
                                ? (
                                    <div className="space-y-2 text-sm">
                                        <p>
                                            <strong>Perfil:</strong>
                                            {lastDecision.userType}</p>
                                        <p>
                                            <strong>Acció:</strong>
                                            mostrar contingut {lastDecision.action}</p>
                                        <p>
                                            <strong>Preferència real simulada:</strong>
                                            {lastDecision.preferred}</p>
                                        <p>
                                            <strong>Clics:</strong>
                                            {lastDecision.clicks}</p>
                                        <p>
                                            <strong>Temps:</strong>
                                            {lastDecision.timeSpent}</p>
                                        <p>
                                            <strong>Reward:</strong>
                                            {lastDecision
                                                .reward
                                                .toFixed(2)}</p>
                                        <p>
                                            <strong>Marca temporal:</strong>
                                            {lastDecision.timestamp}</p>
                                    </div>
                                )
                                : (
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
                            {history.length > 0
                                ? (
                                    <div className="space-y-3">
                                        {history.map((item, index) => (
                                            <div
                                                key={`${item.timestamp}-${index}`}
                                                className="rounded-2xl border border-slate-200 p-3 text-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium">{item.userType}</span>
                                                    <Badge variant="outline" className="rounded-xl">
                                                        {item.action}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-slate-600">
                                                    reward {item
                                                        .reward
                                                        .toFixed(2)}
                                                    · preferit {item.preferred}
                                                    · {item.timestamp}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )
                                : (
                                    <p className="text-sm text-slate-600">No hi ha historial encara.</p>
                                )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-1">
                    <Card className="rounded-2xl shadow-sm">
                        <CardHeader>
                            <CardTitle>Evolució de l’aprenentatge del perfil actiu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.length > 0
                                ? (
                                    <div className="h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="step"/>
                                                <YAxis/>
                                                <Tooltip/>
                                                <Line
                                                    type="monotone"
                                                    dataKey="reward"
                                                    name="Reward"
                                                    stroke="#2563eb"
                                                    strokeWidth={2}
                                                    dot={false}/>
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )
                                : (
                                    <p className="text-sm text-slate-600">
                                        Encara no hi ha dades per mostrar.
                                    </p>
                                )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}