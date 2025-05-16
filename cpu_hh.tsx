import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const pipelineStages = ["IF", "ID", "EX", "MEM", "WB"];

const defaultRegisters = Array(32).fill(0);
const defaultMemory = Array(64).fill(0);

const instructionsExample = [
  { id: 1, text: "ADD R1, R2, R3", type: "R", rd: 1, rs: 2, rt: 3 },
  { id: 2, text: "SUB R4, R1, R5", type: "R", rd: 4, rs: 1, rt: 5 },
  { id: 3, text: "BEQ R4, R6, LABEL", type: "B", rs: 4, rt: 6 },
  { id: 4, text: "LW R7, 0(R1)", type: "I", rt: 7, base: 1, offset: 0 },
  { id: 5, text: "SW R7, 4(R1)", type: "I", rt: 7, base: 1, offset: 4 },
];

const getPipelineState = (cycle, instructions, forwarding) => {
  const state = pipelineStages.map(() => []);
  instructions.forEach((inst, idx) => {
    const stageIndex = cycle - idx;
    if (stageIndex >= 0 && stageIndex < pipelineStages.length) {
      state[stageIndex].push(inst.text);
    }
  });
  return state;
};

const detectRawHazard = (instA, instB) => {
  if (!instA || !instB) return false;
  const writes = instA.type === "R" ? [instA.rd] : instA.type === "I" && instA.text.startsWith("LW") ? [instA.rt] : [];
  const reads = instB.type === "R" ? [instB.rs, instB.rt] : instB.type === "I" ? [instB.rt, instB.base] : [];
  return writes.some(w => reads.includes(w));
};

const detectControlHazard = (inst) => {
  return inst.type === "B";
};

const isBranchTaken = (inst, registers) => {
  if (inst.type === "B" && inst.text.startsWith("BEQ")) {
    return registers[inst.rs] === registers[inst.rt];
  }
  return false;
};

export default function PipelinedCPUSimulator() {
  const [cycle, setCycle] = useState(0);
  const [registers, setRegisters] = useState([...defaultRegisters]);
  const [memory, setMemory] = useState([...defaultMemory]);
  const [instructions, setInstructions] = useState([...instructionsExample]);
  const [forwarding, setForwarding] = useState(true);
  const [explanations, setExplanations] = useState([]);
  const [stalls, setStalls] = useState(0);
  const [branchHistory, setBranchHistory] = useState({});
  const [predictionEnabled, setPredictionEnabled] = useState(true);
  const [flushing, setFlushing] = useState(0);

  const handleNextCycle = () => {
    if (flushing > 0) {
      setCycle(c => c + 1);
      setExplanations(e => [...e, `Flushing pipeline at cycle ${cycle}`]);
      setFlushing(flushing - 1);
      return;
    }

    let explanation = "";
    let currentIdx = cycle;

    if (currentIdx > 0 && currentIdx < instructions.length) {
      const current = instructions[currentIdx];
      const previous = instructions[currentIdx - 1];

      if (!forwarding && detectRawHazard(previous, current)) {
        explanation = `Stalling at cycle ${cycle} due to RAW hazard between "${previous.text}" and "${current.text}".`;
        setExplanations(e => [...e, explanation]);
        setStalls(s => s + 1);
        return;
      }

      if (detectControlHazard(current)) {
        const taken = isBranchTaken(current, registers);
        const predictedTaken = branchHistory[current.id] ?? false;

        if (predictionEnabled && taken !== predictedTaken) {
          explanation = `Misprediction at cycle ${cycle}: predicted ${predictedTaken ? "taken" : "not taken"}, actual was ${taken ? "taken" : "not taken"}. Flushing pipeline.`;
          setExplanations(e => [...e, explanation]);
          setStalls(s => s + 2);
          setBranchHistory(h => ({ ...h, [current.id]: taken }));
          setFlushing(2);
          return;
        } else if (predictionEnabled) {
          explanation = `Branch prediction correct at cycle ${cycle}.`;
        } else {
          explanation = `Control hazard resolved by stalling at cycle ${cycle}. Flushing pipeline.`;
          setStalls(s => s + 2);
          setFlushing(2);
          setExplanations(e => [...e, explanation]);
          return;
        }
      }
    }

    setCycle((c) => c + 1);
    setExplanations(e => [...e, explanation || `Cycle ${cycle} executed without stall.`]);
  };

  const pipelineState = getPipelineState(cycle, instructions, forwarding);
  const cpi = (cycle + stalls) / instructions.length;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">5-Stage Pipelined CPU Simulator</h1>
      <div className="space-y-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Pipeline Stages (Cycle {cycle})</h2>
            <div className="grid grid-cols-5 gap-4 mt-2">
              {pipelineStages.map((stage, i) => (
                <div key={stage} className={`p-2 rounded-xl ${pipelineState[i].length === 0 ? "bg-gray-100" : "bg-green-100"}`}>
                  <div className="font-bold">{stage}</div>
                  <div className="text-xs space-y-1">
                    {pipelineState[i].length > 0 ? pipelineState[i].map((instText, idx) => (
                      <div key={idx}>{instText}</div>
                    )) : "-"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Registers</h2>
            <div className="grid grid-cols-8 gap-2 text-sm">
              {registers.map((reg, idx) => (
                <div key={idx}>R{idx}: {reg}</div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Memory</h2>
            <div className="grid grid-cols-8 gap-2 text-sm">
              {memory.map((mem, idx) => (
                <div key={idx}>M{idx}: {mem}</div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Hazard Explanations</h2>
            <ul className="list-disc ml-5 text-sm">
              {explanations.map((exp, idx) => (
                <li key={idx}>{exp}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Performance Metrics</h2>
            <div className="text-sm">
              <p>Total Cycles: {cycle}</p>
              <p>Stalls: {stalls}</p>
              <p>CPI: {cpi.toFixed(2)}</p>
              <p>Forwarding: {forwarding ? "Enabled" : "Disabled"}</p>
              <p>Branch Prediction: {predictionEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex space-x-4">
        <Button onClick={handleNextCycle}>Next Cycle</Button>
        <Button onClick={() => setForwarding(!forwarding)}>
          Toggle Forwarding: {forwarding ? "ON" : "OFF"}
        </Button>
        <Button onClick={() => setPredictionEnabled(!predictionEnabled)}>
          Toggle Prediction: {predictionEnabled ? "ON" : "OFF"}
        </Button>
      </div>
    </div>
  );
}
