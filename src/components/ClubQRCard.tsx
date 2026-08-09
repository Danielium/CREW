"use client";

import { useMemo } from "react";
import { create as createQrMatrix } from "qrcode";
import ClubBadge from "@/components/ClubBadge";

const QR_SIZE = 224;
const BADGE_SIZE = 52;
const QUIET_ZONE_MODULES = 2;
const FINDER_SIZE = 7;
const DOT_FILL_RATIO = 0.92; // just under the full cell so adjacent dots read as separate, not fused
// Rounded square, not a full circle (0.5): verified against jsQR decoding — full circles
// combined with rounded finder eyes fail to scan (corner radius >=0.35 breaks the round-trip
// in a from-scratch decode test; 0.28 leaves real margin and matches the finder eyes' own
// innermost-layer radius below).
const DOT_RADIUS_RATIO = 0.28;

interface ClubQRCardProps {
  value: string;
  clubName: string;
  logo?: Record<string, any> | null;
}

interface FinderSpec {
  row: number;
  col: number;
}

/** True while (row, col) sits inside any of the QR's 7x7 finder squares — those get their
 *  own layered rendering below and must be skipped by the generic dot pass. */
function isInsideFinder(row: number, col: number, moduleCount: number): boolean {
  const finders: FinderSpec[] = [
    { row: 0, col: 0 },
    { row: 0, col: moduleCount - FINDER_SIZE },
    { row: moduleCount - FINDER_SIZE, col: 0 },
  ];
  return finders.some(
    (f) => row >= f.row && row < f.row + FINDER_SIZE && col >= f.col && col < f.col + FINDER_SIZE
  );
}

/** One finder "eye": dark 7x7 ring, white 5x5 punch, dark 3x3 core — the classic QR eye,
 *  rendered with rounded corners so it reads as a single soft square, not the ring's seam. */
function FinderEye({ row, col, cellSize, fill }: { row: number; col: number; cellSize: number; fill: string }) {
  const x = col * cellSize;
  const y = row * cellSize;
  const layers = [
    { span: 7, offset: 0, fill, radius: 0.32 },
    { span: 5, offset: 1, fill: "#FFFFFF", radius: 0.3 },
    { span: 3, offset: 2, fill, radius: 0.28 },
  ];
  return (
    <>
      {layers.map((l, i) => {
        const size = l.span * cellSize;
        return (
          <rect
            key={i}
            x={x + l.offset * cellSize}
            y={y + l.offset * cellSize}
            width={size}
            height={size}
            rx={size * l.radius}
            ry={size * l.radius}
            fill={l.fill}
          />
        );
      })}
    </>
  );
}

/**
 * The club's shareable code — hand-rendered as rounded dots with soft finder "eyes"
 * (Telegram's own QR style) rather than qrcode.react's raw squares, which is all that
 * library can draw. The modules run a dark olive-to-black gradient rather than CREW
 * lime: lime on white lands at ~1.3:1, which scanners cannot resolve. The brand lives
 * in the card's glow and the emblem instead, so the code itself stays readable.
 */
export default function ClubQRCard({ value, clubName, logo }: ClubQRCardProps) {
  const matrix = useMemo(() => createQrMatrix(value, { errorCorrectionLevel: "H" }), [value]);
  const moduleCount = matrix.modules.size;
  const totalCells = moduleCount + QUIET_ZONE_MODULES * 2;
  const cellSize = QR_SIZE / totalCells;

  const dots: { row: number; col: number }[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix.modules.get(row, col) && !isInsideFinder(row, col, moduleCount)) {
        dots.push({ row, col });
      }
    }
  }

  return (
    <div className="relative mx-auto w-fit">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="crewQrGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3D4D00" />
            <stop offset="55%" stopColor="#1F2600" />
            <stop offset="100%" stopColor="#0A0A0A" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative rounded-[32px] bg-white p-5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] ring-1 ring-primary/40">
        <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
          <svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}>
            <g transform={`translate(${QUIET_ZONE_MODULES * cellSize}, ${QUIET_ZONE_MODULES * cellSize})`}>
              {dots.map(({ row, col }) => {
                const size = cellSize * DOT_FILL_RATIO;
                const inset = (cellSize - size) / 2;
                return (
                  <rect
                    key={`${row}-${col}`}
                    x={col * cellSize + inset}
                    y={row * cellSize + inset}
                    width={size}
                    height={size}
                    rx={size * DOT_RADIUS_RATIO}
                    ry={size * DOT_RADIUS_RATIO}
                    fill="url(#crewQrGradient)"
                  />
                );
              })}
              <FinderEye row={0} col={0} cellSize={cellSize} fill="url(#crewQrGradient)" />
              <FinderEye row={0} col={moduleCount - FINDER_SIZE} cellSize={cellSize} fill="url(#crewQrGradient)" />
              <FinderEye row={moduleCount - FINDER_SIZE} col={0} cellSize={cellSize} fill="url(#crewQrGradient)" />
            </g>
          </svg>
          {logo && (
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1.5"
              aria-hidden="true"
            >
              <ClubBadge {...logo} size={BADGE_SIZE} />
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-black font-black uppercase tracking-tight text-lg leading-none break-words">
          {clubName}
        </p>
      </div>
    </div>
  );
}
