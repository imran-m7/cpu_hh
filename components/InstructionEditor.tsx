import { useRef } from "react";
import { Button } from "./ui/button";

export default function InstructionEditor({
  editInstructions,
  setEditInstructions,
  instInput,
  setInstInput,
  selectedInst,
  setSelectedInst,
  handleAddInstruction,
  handleEditInstruction,
  handleDeleteInstruction,
  handleUpdateInstruction,
  handleApplyInstructions,
  getDefaultInstInput
}: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="bg-white p-4 rounded shadow max-w-2xl w-full mx-auto mt-4 border">
      <h2 className="font-bold mb-2">Edit Instructions</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        <select
          className="border p-1"
          value={instInput.type}
          onChange={e => setInstInput(getDefaultInstInput(e.target.value))}
          aria-label="Instruction Type"
        >
          <option value="R">R-Type</option>
          <option value="I">I-Type</option>
          <option value="B">B-Type</option>
        </select>
        <input
          ref={inputRef}
          className="border p-1 w-40"
          placeholder="Instruction Text"
          value={instInput.text}
          onChange={e => setInstInput((i: any) => ({ ...i, text: e.target.value }))}
          aria-label="Instruction Text"
        />
        {instInput.type === "R" && (
          <>
            <input className="border p-1 w-16" type="number" placeholder="rd" value={instInput.rd} onChange={e => setInstInput((i: any) => ({ ...i, rd: +e.target.value }))} aria-label="rd" />
            <input className="border p-1 w-16" type="number" placeholder="rs" value={instInput.rs} onChange={e => setInstInput((i: any) => ({ ...i, rs: +e.target.value }))} aria-label="rs" />
            <input className="border p-1 w-16" type="number" placeholder="rt" value={instInput.rt} onChange={e => setInstInput((i: any) => ({ ...i, rt: +e.target.value }))} aria-label="rt" />
          </>
        )}
        {instInput.type === "I" && (
          <>
            <input className="border p-1 w-16" type="number" placeholder="rt" value={instInput.rt} onChange={e => setInstInput((i: any) => ({ ...i, rt: +e.target.value }))} aria-label="rt" />
            <input className="border p-1 w-16" type="number" placeholder="base" value={instInput.base} onChange={e => setInstInput((i: any) => ({ ...i, base: +e.target.value }))} aria-label="base" />
            <input className="border p-1 w-16" type="number" placeholder="offset" value={instInput.offset} onChange={e => setInstInput((i: any) => ({ ...i, offset: +e.target.value }))} aria-label="offset" />
          </>
        )}
        {instInput.type === "B" && (
          <>
            <input className="border p-1 w-16" type="number" placeholder="rs" value={instInput.rs} onChange={e => setInstInput((i: any) => ({ ...i, rs: +e.target.value }))} aria-label="rs" />
            <input className="border p-1 w-16" type="number" placeholder="rt" value={instInput.rt} onChange={e => setInstInput((i: any) => ({ ...i, rt: +e.target.value }))} aria-label="rt" />
          </>
        )}
        {selectedInst === null ? (
          <Button onClick={handleAddInstruction} aria-label="Add Instruction">Add</Button>
        ) : (
          <Button onClick={handleUpdateInstruction} aria-label="Update Instruction">Update</Button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto text-xs bg-gray-50 border rounded p-2">
        {editInstructions.map((inst: any) => (
          <div key={inst.id} className="flex items-center gap-2 mb-1">
            <span>{inst.text}</span>
            <Button onClick={() => handleEditInstruction(inst.id)} aria-label="Edit">✏️</Button>
            <Button onClick={() => handleDeleteInstruction(inst.id)} aria-label="Delete">🗑️</Button>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-2 gap-2">
        <Button onClick={handleApplyInstructions} aria-label="Apply Changes">Apply</Button>
      </div>
    </div>
  );
}
