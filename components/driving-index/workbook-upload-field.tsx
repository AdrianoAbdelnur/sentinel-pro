"use client";

import type { ChangeEvent } from "react";

type WorkbookUploadFieldProps = {
  onFileSelected(bytes: ArrayBuffer): void;
};

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function WorkbookUploadField({ onFileSelected }: WorkbookUploadFieldProps) {
  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onFileSelected(await readFileAsArrayBuffer(file));
  }

  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-300">
      Planilla de viajes
      <input
        type="file"
        accept=".xlsx"
        onChange={(event) => void handleChange(event)}
        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-zinc-950"
      />
    </label>
  );
}
