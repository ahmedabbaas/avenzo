import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const PUBLIC_FALLBACK: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

function managedIceServers(): IceServer[] | null {
  const urls = String(process.env.AVENZO_TURN_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const username = String(process.env.AVENZO_TURN_USERNAME || "").trim();
  const credential = String(process.env.AVENZO_TURN_CREDENTIAL || "").trim();

  if (!urls.length || !username || !credential) return null;

  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls,
      username,
      credential,
    },
  ];
}

export async function GET() {
  const managed = managedIceServers();

  return NextResponse.json(
    {
      iceServers: managed || PUBLIC_FALLBACK,
      managed: Boolean(managed),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
