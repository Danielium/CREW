"use client";

import { QRCodeSVG } from "qrcode.react";
import ClubBadge from "@/components/ClubBadge";

const QR_SIZE = 224;
const BADGE_SIZE = 52;

interface ClubQRCardProps {
  value: string;
  clubName: string;
  logo?: Record<string, any> | null;
}

/**
 * The club's shareable code.
 *
 * The modules run a dark olive-to-black gradient rather than CREW lime: lime on
 * white lands at ~1.3:1, which scanners cannot resolve. The brand lives in the
 * card's glow and the emblem instead, so the code itself stays readable.
 */
export default function ClubQRCard({ value, clubName, logo }: ClubQRCardProps) {
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
          <QRCodeSVG
            value={value}
            size={QR_SIZE}
            level="H"
            bgColor="transparent"
            fgColor="url(#crewQrGradient)"
          />
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
