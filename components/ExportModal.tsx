import { Button } from "./ui/button";

export default function ExportModal({ exportData, onClose }: { exportData: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white p-4 rounded shadow max-w-2xl w-full">
        <h2 className="font-bold mb-2">Exported Simulation Data (JSON)</h2>
        <textarea className="w-full h-64 border p-2 font-mono text-xs" value={exportData} readOnly aria-label="Exported JSON" />
        <div className="flex justify-end mt-2">
          <Button onClick={onClose} aria-label="Close Export Modal">Close</Button>
        </div>
      </div>
    </div>
  );
}
