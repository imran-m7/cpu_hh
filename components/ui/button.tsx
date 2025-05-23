import React from "react";

export function Button({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
