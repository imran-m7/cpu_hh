import { useState, useRef } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Tooltip } from 'react-tooltip';
import InstructionEditor from "./components/InstructionEditor";
import ExportModal from "./components/ExportModal";

const pipelineStages = ["IF", "ID", "EX", "MEM", "WB"];

const defaultRegisters = Array(32).fill(0);
const defaultMemory = Array(64).fill(0);

// Types for instructions
interface RTypeInst { id: number; text: string; type: "R"; rd: number; rs: number; rt: number; }
interface ITypeInst { id: number; text: string; type: "I"; rt: number; base: number; offset: number; }
interface BTypeInst { id: number; text: string; type: "B"; rs: number; rt: number; }
type Inst = RTypeInst | ITypeInst | BTypeInst;

// Convert instructionsExample to typed Inst[]
const instructionsExampleTyped: Inst[] = [
  { id: 1, text: "ADD R1, R2, R3", type: "R", rd: 1, rs: 2, rt: 3 },
  { id: 2, text: "SUB R4, R1, R5", type: "R", rd: 4, rs: 1, rt: 5 },
  { id: 3, text: "BEQ R4, R6, LABEL", type: "B", rs: 4, rt: 6 },
  { id: 4, text: "LW R7, 0(R1)", type: "I", rt: 7, base: 1, offset: 0 },
  { id: 5, text: "SW R7, 4(R1)", type: "I", rt: 7, base: 1, offset: 4 },
];

const getPipelineState = (cycle: number, instructions: any[], forwarding: boolean): string[][] => {
  const state: string[][] = pipelineStages.map(() => []);
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

// Utility for hazard color
const hazardColors = {
  RAW: "bg-yellow-200 border-yellow-500",
  CONTROL: "bg-red-200 border-red-500",
  STRUCTURAL: "bg-blue-200 border-blue-500",
  NONE: "bg-green-100 border-green-300"
};

// --- Branch prediction strategies ---
const branchStrategies = [
  { label: "Always Not Taken", value: "always-not-taken" },
  { label: "Always Taken", value: "always-taken" },
  { label: "1-bit Predictor", value: "1bit" },
  { label: "2-bit Saturating Counter", value: "2bit" },
];

export default function PipelinedCPUSimulator() {
  const [cycle, setCycle] = useState(0);
  const [registers, setRegisters] = useState([...defaultRegisters]);
  const [memory, setMemory] = useState([...defaultMemory]);
  const [instructions, setInstructions] = useState([...instructionsExampleTyped]);
  const [forwarding, setForwarding] = useState(true);
  const [explanations, setExplanations] = useState<string[]>([]);
  const [stalls, setStalls] = useState(0);
  const [branchHistory, setBranchHistory] = useState({});
  const [predictionEnabled, setPredictionEnabled] = useState(true);
  const [flushing, setFlushing] = useState(0);
  const [history, setHistory] = useState<any[]>([]); // for step-back
  const [pipelineRegs, setPipelineRegs] = useState<any>({}); // for pipeline register visualization
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState<Inst[]>([...instructionsExampleTyped]);
  const [selectedInst, setSelectedInst] = useState<number|null>(null);
  const [instInput, setInstInput] = useState<Inst>({id: 0, text: "", type: "R", rd: 0, rs: 0, rt: 0});
  const inputRef = useRef<HTMLInputElement>(null);
  const [showForwarding, setShowForwarding] = useState(true);
  const [showHazardDetails, setShowHazardDetails] = useState(true);
  const [execLog, setExecLog] = useState<string[]>([]);
  const [branchStrategy, setBranchStrategy] = useState<string>(branchStrategies[0].value);
  const [wbResults, setWbResults] = useState<any[]>([]);
  const [saturatingTable, setSaturatingTable] = useState<{[id:number]:number}>({});
  const [exportData, setExportData] = useState<string>("");

  // --- Step-back logic ---
  const saveHistory = () => {
    setHistory(h => [...h, {
      cycle, registers: [...registers], memory: [...memory], instructions: [...instructions], forwarding, explanations: [...explanations], stalls, branchHistory: {...branchHistory}, predictionEnabled, flushing
    }]);
  };
  const handleStepBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setCycle(prev.cycle);
    setRegisters(prev.registers);
    setMemory(prev.memory);
    setInstructions(prev.instructions);
    setForwarding(prev.forwarding);
    setExplanations(prev.explanations);
    setStalls(prev.stalls);
    setBranchHistory(prev.branchHistory);
    setPredictionEnabled(prev.predictionEnabled);
    setFlushing(prev.flushing);
    setHistory(h => h.slice(0, h.length - 1));
  };

  // --- Instruction editing ---
  const handleAddInstruction = () => {
    let newInst: Inst;
    if (instInput.type === "R") {
      newInst = { id: Date.now(), text: instInput.text, type: "R", rd: instInput.rd, rs: instInput.rs, rt: instInput.rt };
    } else if (instInput.type === "I") {
      newInst = { id: Date.now(), text: instInput.text, type: "I", rt: (instInput as ITypeInst).rt, base: (instInput as ITypeInst).base, offset: (instInput as ITypeInst).offset };
    } else {
      newInst = { id: Date.now(), text: instInput.text, type: "B", rs: (instInput as BTypeInst).rs, rt: (instInput as BTypeInst).rt };
    }
    setEditInstructions(insts => [...insts, newInst]);
    setInstInput({id: 0, text: "", type: "R", rd: 0, rs: 0, rt: 0});
    inputRef.current?.focus();
  };
  const handleDeleteInstruction = (id: number) => {
    setEditInstructions(insts => insts.filter(i => i.id !== id));
  };
  const handleEditInstruction = (id: number) => {
    const inst = editInstructions.find(i => i.id === id);
    if (inst) {
      if (inst.type === "R") setInstInput({...inst});
      else if (inst.type === "I") setInstInput({...inst});
      else setInstInput({...inst});
      setSelectedInst(id);
    }
  };
  const handleUpdateInstruction = () => {
    setEditInstructions(insts => insts.map(i => i.id === selectedInst ? {...instInput, id: selectedInst} as Inst : i));
    setInstInput({id: 0, text: "", type: "R", rd: 0, rs: 0, rt: 0});
    setSelectedInst(null);
  };
  const handleApplyInstructions = () => {
    setInstructions([...editInstructions]);
    setEditMode(false);
    setCycle(0);
    setRegisters([...defaultRegisters]);
    setMemory([...defaultMemory]);
    setExplanations([]);
    setStalls(0);
    setBranchHistory({});
    setPredictionEnabled(true);
    setFlushing(0);
    setHistory([]);
  };

  // --- Branch prediction logic ---
  function predictBranch(inst, registers, history, strategy, saturatingTable) {
    switch (strategy) {
      case "always-taken": return true;
      case "always-not-taken": return false;
      case "1bit": return history[inst.id] ?? false;
      case "2bit": return (saturatingTable[inst.id] ?? 1) > 1;
      default: return false;
    }
  }

  // --- Enhanced handleNextCycle ---
  const handleNextCycle = () => {
    const timestamp = new Date().toLocaleTimeString();
    if (flushing > 0) {
      // Find the instruction that caused the flush (last control hazard)
      const lastControlHazardIdx = explanations
        .map((exp, idx) => exp.includes('Misprediction') || exp.includes('Control hazard resolved') ? idx : -1)
        .filter(idx => idx !== -1)
        .pop();
      let causingInst: string | null = null;
      if (lastControlHazardIdx !== undefined && lastControlHazardIdx !== -1) {
        // Try to extract the instruction from the explanation string
        const exp = explanations[lastControlHazardIdx];
        const match = exp.match(/between \"(.+?)\" and \"(.+?)\"|at cycle (\d+): (.+?)(?:\.|$)/);
        if (match) {
          causingInst = (match[4] ? String(match[4]) : (match[1] || match[2] || null));
        }
      }
      // Show which instructions are being flushed (all in pipeline except WB)
      const flushedInsts = pipelineStages.slice(0, -1).flatMap((stage, idx) => getPipelineState(cycle, instructions, forwarding)[idx]);
      setCycle(c => c + 1);
      setExplanations(e => [
        ...e,
        `Flushing pipeline at cycle ${cycle}` +
        (causingInst ? ` (caused by: ${causingInst})` : "") +
        (flushedInsts.length ? ` | Flushed instructions: ${flushedInsts.join(", ")}` : "")
      ]);
      setFlushing(flushing - 1);
      return;
    }

    let explanation = "";
    let currentIdx = cycle;
    let logEntry = `Cycle ${cycle} @ ${timestamp}: `;

    if (currentIdx > 0 && currentIdx < instructions.length) {
      const current = instructions[currentIdx];
      const previous = instructions[currentIdx - 1];

      if (!forwarding && detectRawHazard(previous, current)) {
        explanation = `Stalling at cycle ${cycle} due to RAW hazard between "${previous.text}" and "${current.text}".`;
        logEntry += explanation;
        setExplanations(e => [...e, explanation]);
        setExecLog(l => [...l, logEntry]);
        setStalls(s => s + 1);
        return;
      }
      if (detectControlHazard(current)) {
        let taken = isBranchTaken(current, registers);
        let predictedTaken = predictBranch(current, registers, branchHistory, branchStrategy, saturatingTable);
        if (branchStrategy === "2bit") {
          // Update 2-bit counter
          let counter = saturatingTable[current.id] ?? 1;
          if (taken) counter = Math.min(3, counter + 1); else counter = Math.max(0, counter - 1);
          setSaturatingTable(t => ({...t, [current.id]: counter}));
        }
        if (branchStrategy === "1bit") {
          setBranchHistory(h => ({...h, [current.id]: taken}));
        }
        if (predictionEnabled && taken !== predictedTaken) {
          explanation = `Misprediction at cycle ${cycle}: predicted ${predictedTaken ? "taken" : "not taken"}, actual was ${taken ? "taken" : "not taken"}. Flushing pipeline.`;
          logEntry += explanation;
          setExplanations(e => [...e, explanation]);
          setExecLog(l => [...l, logEntry]);
          setStalls(s => s + 2);
          setFlushing(2);
          return;
        } else if (predictionEnabled) {
          explanation = `Branch prediction correct at cycle ${cycle}.`;
        } else {
          explanation = `Control hazard resolved by stalling at cycle ${cycle}. Flushing pipeline.`;
          setStalls(s => s + 2);
          setFlushing(2);
          setExplanations(e => [...e, explanation]);
          setExecLog(l => [...l, logEntry + explanation]);
          return;
        }
      }
    }

    // WB stage: show result
    const wbStage = pipelineStages.length - 1;
    const wbInsts = getPipelineState(cycle, instructions, forwarding)[wbStage];
    if (wbInsts.length > 0) {
      wbInsts.forEach(instText => {
        const instObj = instructions.find(i => i.text === instText);
        if (instObj) {
          // Show result after WB
          let result = "";
          if (instObj.type === "R") {
            result = `R${(instObj as RTypeInst).rd} = ${registers[(instObj as RTypeInst).rs]} op ${registers[(instObj as RTypeInst).rt]}`;
          } else if (instObj.type === "I" && instObj.text.startsWith("LW")) {
            result = `R${(instObj as ITypeInst).rt} loaded from M${registers[(instObj as ITypeInst).base] + (instObj as ITypeInst).offset}`;
          } else if (instObj.type === "I" && instObj.text.startsWith("SW")) {
            result = `M${registers[(instObj as ITypeInst).base] + (instObj as ITypeInst).offset} = R${(instObj as ITypeInst).rt}`;
          } else if (instObj.type === "B") {
            result = `Branch evaluated: ${isBranchTaken(instObj, registers)}`;
          }
          setWbResults(r => [...r, {cycle, inst: instObj.text, result, registers: [...registers], memory: [...memory]}]);
        }
      });
    }
    setExecLog(l => [...l, logEntry + (explanation || `Cycle ${cycle} executed without stall.`)]);
    setCycle((c) => c + 1);
    setExplanations(e => [...e, explanation || `Cycle ${cycle} executed without stall.`]);
  };

  // --- Export simulation data ---
  const handleExport = () => {
    const data = {
      registers,
      memory,
      instructions,
      pipelineState: getPipelineState(cycle, instructions, forwarding),
      stalls,
      cpi: (cycle + stalls) / instructions.length,
      execLog,
      wbResults
    };
    setExportData(JSON.stringify(data, null, 2));
  };

  const pipelineState = getPipelineState(cycle, instructions, forwarding);
  const cpi = (cycle + stalls) / instructions.length;

  // --- Pipeline register visualization ---
  const getPipelineRegisters = () => {
    const regs: any = {};
    pipelineStages.forEach((stage, idx) => {
      if (idx < pipelineStages.length - 1) {
        const regName = `${pipelineStages[idx]}/${pipelineStages[idx+1]}`;
        const insts = getPipelineState(cycle, instructions, forwarding)[idx];
        regs[regName] = insts.length > 0 ? insts.join(", ") : "-";
      }
    });
    return regs;
  };

  // --- Hazard visualization ---
  const getHazardType = (stageIdx: number, instIdx: number) => {
    const insts = getPipelineState(cycle, instructions, forwarding)[stageIdx];
    const instText = insts[instIdx];
    if (!instText) return "NONE";
    // RAW hazard: check previous instruction
    if (stageIdx > 0) {
      const prevInsts = getPipelineState(cycle, instructions, forwarding)[stageIdx-1];
      for (const prevText of prevInsts) {
        const prevObj = instructions.find(i => i.text === prevText);
        const currObj = instructions.find(i => i.text === instText);
        if (detectRawHazard(prevObj, currObj)) return "RAW";
      }
    }
    // Control hazard
    const currObj = instructions.find(i => i.text === instText);
    if (currObj && detectControlHazard(currObj)) return "CONTROL";
    // (Simple) Structural hazard: if more than one instruction in a stage
    if (insts.length > 1) return "STRUCTURAL";
    return "NONE";
  };

  // Helper to reset instInput to correct type
  function getDefaultInstInput(type: Inst["type"]): Inst {
    if (type === "R") return {id: 0, text: "", type: "R", rd: 0, rs: 0, rt: 0};
    if (type === "I") return {id: 0, text: "", type: "I", rt: 0, base: 0, offset: 0};
    return {id: 0, text: "", type: "B", rs: 0, rt: 0};
  }

  return (
    <div className="p-4 space-y-4 w-full max-w-6xl mx-auto min-h-screen flex flex-col">
      <h1 className="text-xl font-bold">5-Stage Pipelined CPU Simulator</h1>
      <div className="space-y-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Pipeline Stages (Cycle {cycle})</h2>
            <div className="grid grid-cols-5 gap-4 mt-2">
              {pipelineStages.map((stage, i) => (
                <div key={stage} className="p-2 rounded-xl border-2 mb-2" style={{minHeight: 80, borderColor: '#e5e7eb'}}>
                  <div className="font-bold mb-1">{stage}</div>
                  <div className="text-xs space-y-1">
                    {pipelineState[i].length > 0 ? pipelineState[i].map((instText, idx2) => {
                      const hazard = getHazardType(i, idx2);
                      return (
                        <div key={idx2} className={`${hazardColors[hazard]} p-1 rounded flex items-center`}>
                          {instText}
                          {hazard === 'RAW' && <span title="RAW Hazard" className="ml-2">⚠️</span>}
                          {hazard === 'CONTROL' && <span title="Control Hazard" className="ml-2">⏸️</span>}
                          {hazard === 'STRUCTURAL' && <span title="Structural Hazard" className="ml-2">🏗️</span>}
                        </div>
                      );
                    }) : "-"}
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
      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={handleNextCycle}>Next Cycle</Button>
        <Button onClick={handleStepBack}>Step Back</Button>
        <Button onClick={() => setShowForwarding(f => !f)}>
          {showForwarding ? "Hide Forwarding" : "Show Forwarding"}
        </Button>
        <Button onClick={() => setShowHazardDetails(h => !h)}>
          {showHazardDetails ? "Hide Hazard Details" : "Show Hazard Details"}
        </Button>
        <Button onClick={() => setForwarding(!forwarding)}>
          Toggle Forwarding: {forwarding ? "ON" : "OFF"}
        </Button>
        <Button onClick={() => setPredictionEnabled(!predictionEnabled)}>
          Toggle Prediction: {predictionEnabled ? "ON" : "OFF"}
        </Button>
        <select className="border p-1" value={branchStrategy} onChange={e => setBranchStrategy(e.target.value)}>
          {branchStrategies.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button onClick={() => {
          setCycle(0);
          setRegisters([...defaultRegisters]);
          setMemory([...defaultMemory]);
          setInstructions([...instructionsExampleTyped]);
          setForwarding(true);
          setExplanations([]);
          setStalls(0);
          setBranchHistory({});
          setPredictionEnabled(true);
          setFlushing(0);
          setHistory([]);
          setExecLog([]);
          setWbResults([]);
          setSaturatingTable({});
        }}>
          Reset Simulation
        </Button>
        <Button onClick={handleExport}>Export JSON</Button>
        <Button onClick={() => setEditMode(m => !m)}>
          {editMode ? "Close Editor" : "Edit Instructions"}
        </Button>
      </div>
      {/* Instruction Editor Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <InstructionEditor
            editInstructions={editInstructions}
            setEditInstructions={setEditInstructions}
            instInput={instInput}
            setInstInput={setInstInput}
            selectedInst={selectedInst}
            setSelectedInst={setSelectedInst}
            handleAddInstruction={handleAddInstruction}
            handleEditInstruction={handleEditInstruction}
            handleDeleteInstruction={handleDeleteInstruction}
            handleUpdateInstruction={handleUpdateInstruction}
            handleApplyInstructions={handleApplyInstructions}
            getDefaultInstInput={getDefaultInstInput}
          />
        </div>
      )}
      {/* Export JSON Modal */}
      {exportData && (
        <ExportModal exportData={exportData} onClose={() => setExportData("")} />
      )}
      {showHazardDetails && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Hazard Explanations <span data-tooltip-id="hazard-tip">❓</span></h2>
            <Tooltip id="hazard-tip" place="top">
              <div><b>RAW:</b> Read After Write hazard (data hazard)</div>
              <div><b>Control:</b> Branch or jump hazard</div>
              <div><b>Structural:</b> Resource conflict (e.g., two instructions need same hardware)</div>
            </Tooltip>
            <ul className="list-disc ml-5 text-sm">
              {explanations.map((exp, idx) => (
                <li key={idx}>{exp}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold">Pipeline Registers</h2>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {Object.entries(getPipelineRegisters()).map(([reg, val]) => (
              <div key={reg} className="border p-2 rounded bg-gray-50"><b>{reg}:</b> {String(val)}</div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold">Instruction Memory</h2>
          <div className="grid grid-cols-1 gap-1 text-sm">
            {instructions.map((inst, idx) => (
              <div key={inst.id} className="border p-1 rounded bg-gray-50">{inst.text}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
