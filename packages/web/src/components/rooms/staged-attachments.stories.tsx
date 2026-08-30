import type { Meta, StoryObj } from "@storybook/react-vite";
import { StagedAttachments, type StagedAttachment } from "./staged-attachments";

const noop = () => {};

/** A tiny solid-colour PNG, so image chips render a real preview in Storybook. */
function swatchPng(hex: string, name: string, bytes: number): File {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 64, 64);
  }
  const url = canvas.toDataURL("image/png");
  const binary = atob(url.slice(url.indexOf(",") + 1));
  const bin = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  // Pad past the PNG's IEND so the chip shows a plausible size; decoders stop
  // at IEND and ignore the trailing bytes, so the preview still renders.
  const padded = new Uint8Array(Math.max(bytes, bin.length));
  padded.set(bin);
  return new File([padded], name, { type: "image/png" });
}

function doc(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function stage(files: File[]): StagedAttachment[] {
  return files.map((file, i) => ({ id: `s${i}`, file }));
}

const meta = {
  title: "Rooms/StagedAttachments",
  component: StagedAttachments,
  parameters: { layout: "padded" },
  args: { onRemove: noop, uploadingId: null },
} satisfies Meta<typeof StagedAttachments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleImage: Story = {
  args: { attachments: stage([swatchPng("#4f46e5", "pasted-20260830-090503.png", 42_000)]) },
};

export const MixedImagesAndFiles: Story = {
  args: {
    attachments: stage([
      swatchPng("#4f46e5", "pasted-20260830-090503.png", 42_000),
      doc("incident-report.pdf", "application/pdf", 310_000),
      swatchPng("#059669", "architecture-diagram.png", 128_000),
      doc("daemon.log", "text/plain", 900),
    ]),
  },
};

export const Uploading: Story = {
  args: {
    attachments: stage([
      swatchPng("#4f46e5", "screenshot.png", 42_000),
      doc("incident-report.pdf", "application/pdf", 310_000),
    ]),
    uploadingId: "s0",
    progress: 0.6,
  },
};

/** The cap: eight chips scroll horizontally rather than wrapping the composer. */
export const AtCapacity: Story = {
  args: {
    attachments: stage(
      Array.from({ length: 8 }, (_, i) =>
        swatchPng(`hsl(${i * 40} 70% 55%)`, `screenshot-${i + 1}.png`, 20_000 + i * 5_000),
      ),
    ),
  },
};

export const LongFilename: Story = {
  args: {
    attachments: stage([
      doc("a-very-long-filename-that-should-truncate-in-the-chip.tar.gz", "application/gzip", 480_000),
    ]),
  },
};
