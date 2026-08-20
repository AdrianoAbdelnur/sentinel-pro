import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbookUploadField } from "./workbook-upload-field";

describe("WorkbookUploadField", () => {
  it("invokes the provided callback with the selected file's bytes when a file is chosen", async () => {
    const onFileSelected = vi.fn();
    render(<WorkbookUploadField onFileSelected={onFileSelected} />);

    const file = new File(["contenido de prueba"], "viajes.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(screen.getByLabelText("Planilla de viajes"), {
      target: { files: [file] },
    });

    await vi.waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1));
    const [bytes] = onFileSelected.mock.calls[0] as [ArrayBuffer];
    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(bytes)).toBe("contenido de prueba");
  });

  it("does not invoke the callback when the selection is cleared", () => {
    const onFileSelected = vi.fn();
    render(<WorkbookUploadField onFileSelected={onFileSelected} />);

    fireEvent.change(screen.getByLabelText("Planilla de viajes"), {
      target: { files: [] },
    });

    expect(onFileSelected).not.toHaveBeenCalled();
  });
});
