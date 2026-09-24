"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import { avatarFor } from "../../social/lib/profile";

declare global {
  interface Window {
    AvenzoNative?: {
      notifyMessage?: (title: string, body: string, route: string) => void;
      registerSession?: (accessToken: string, userId: string) => void;
    };
  }

  interface WindowEventMap {
    "avenzo:start-audio-call": CustomEvent<{
      conversationId: string;
      otherUserId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    }>;
  }
}

type CallStatus =
  | "calling"
  | "incoming"
  | "connecting"
  | "connected";

type ActiveCall = {
  id: string;
  conversationId: string;
  otherUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  direction: "incoming" | "outgoing";
  status: CallStatus;
};

type CallSession = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted" | "declined" | "ended" | "missed";
  created_at: string;
};

type CallSignal = {
  id: number;
  call_id: string;
  sender_id: string;
  recipient_id: string;
  signal_type: "offer" | "answer" | "ice";
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CallManager() {
  const supabase = useMemo(() => createClient(), []);
  const [call, setCallState] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const userIdRef = useRef("");
  const profileRef = useRef<{
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<number | null>(null);

  function setCall(next: ActiveCall | null) {
    callRef.current = next;
    setCallState(next);
  }

  function patchCall(patch: Partial<ActiveCall>) {
    const current = callRef.current;
    if (!current) return;
    setCall({ ...current, ...patch });
  }

  function clearRingTimer() {
    if (ringTimerRef.current !== null) {
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }

  function stopMedia() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }

  function destroyPeer() {
    peerRef.current?.close();
    peerRef.current = null;
    stopMedia();
  }

  function resetCall() {
    clearRingTimer();
    destroyPeer();
    setMuted(false);
    setError("");
    setCall(null);
  }

  async function sendSignal(
    recipientId: string,
    callId: string,
    signalType: CallSignal["signal_type"],
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ) {
    const userId = userIdRef.current;
    if (!userId) return;

    const { error: signalError } = await supabase
      .from("call_signals")
      .insert({
        call_id: callId,
        sender_id: userId,
        recipient_id: recipientId,
        signal_type: signalType,
        payload,
      });

    if (signalError) throw signalError;
  }

  async function getMicrophone() {
    if (localStreamRef.current) return localStreamRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not available on this device.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }

  async function ensurePeer(
    otherUserId: string,
    callId: string
  ) {
    if (peerRef.current) return peerRef.current;

    const stream = await getMicrophone();
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    for (const track of stream.getTracks()) {
      peer.addTrack(track, stream);
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal(
        otherUserId,
        callId,
        "ice",
        event.candidate.toJSON()
      ).catch(() => undefined);
    };

    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream || !remoteAudioRef.current) return;
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => undefined);
      patchCall({ status: "connected" });
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        patchCall({ status: "connected" });
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        setError("Call connection ended.");
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function beginOffer(session: CallSession) {
    const current = callRef.current;
    if (!current || current.id !== session.id) return;

    try {
      patchCall({ status: "connecting" });
      const peer = await ensurePeer(current.otherUserId, current.id);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(
        current.otherUserId,
        current.id,
        "offer",
        offer
      );
    } catch {
      setError("Could not connect the call.");
      await endCall();
    }
  }

  async function handleSignal(signal: CallSignal) {
    const current = callRef.current;
    if (!current || current.id !== signal.call_id) return;

    try {
      const peer = await ensurePeer(current.otherUserId, current.id);

      if (signal.signal_type === "offer") {
        await peer.setRemoteDescription(
          new RTCSessionDescription(
            signal.payload as RTCSessionDescriptionInit
          )
        );
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal(
          current.otherUserId,
          current.id,
          "answer",
          answer
        );
        patchCall({ status: "connecting" });
        return;
      }

      if (signal.signal_type === "answer") {
        await peer.setRemoteDescription(
          new RTCSessionDescription(
            signal.payload as RTCSessionDescriptionInit
          )
        );
        return;
      }

      if (signal.signal_type === "ice") {
        await peer.addIceCandidate(
          new RTCIceCandidate(signal.payload as RTCIceCandidateInit)
        );
      }
    } catch {
      setError("Call connection failed.");
    }
  }

  async function profileFor(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username,display_name,avatar_url")
      .eq("id", userId)
      .maybeSingle();

    return {
      username: data?.username || "user",
      displayName: data?.display_name || "AVENZO user",
      avatarUrl: data?.avatar_url || null,
    };
  }

  async function receiveIncoming(session: CallSession) {
    if (
      callRef.current ||
      session.status !== "ringing" ||
      session.callee_id !== userIdRef.current
    ) {
      return;
    }

    const caller = await profileFor(session.caller_id);
    const next: ActiveCall = {
      id: session.id,
      conversationId: session.conversation_id,
      otherUserId: session.caller_id,
      username: caller.username,
      displayName: caller.displayName,
      avatarUrl: caller.avatarUrl,
      direction: "incoming",
      status: "incoming",
    };

    setCall(next);

    if (document.visibilityState !== "visible") {
      window.AvenzoNative?.notifyMessage?.(
        "Incoming AVENZO call",
        caller.displayName + " is calling you",
        "/messages?user=" + encodeURIComponent(caller.username)
      );
    }
  }

  async function acceptIncoming() {
    const current = callRef.current;
    if (!current || current.direction !== "incoming") return;

    try {
      patchCall({ status: "connecting" });
      await ensurePeer(current.otherUserId, current.id);
      const { error: updateError } = await supabase
        .from("call_sessions")
        .update({
          status: "accepted",
          answered_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      if (updateError) throw updateError;
    } catch {
      setError("Microphone permission is required for calls.");
      patchCall({ status: "incoming" });
    }
  }

  async function declineIncoming() {
    const current = callRef.current;
    if (!current) return;

    await supabase
      .from("call_sessions")
      .update({
        status: "declined",
        ended_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    resetCall();
  }

  async function endCall() {
    const current = callRef.current;
    if (!current) return;

    await supabase
      .from("call_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    resetCall();
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  useEffect(() => {
    let cancelled = false;
    let sessionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let signalsChannel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      userIdRef.current = userId;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username,display_name,avatar_url")
        .eq("id", userId)
        .maybeSingle();

      profileRef.current = profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null;

      sessionsChannel = supabase
        .channel("avenzo-call-sessions-" + userId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_sessions",
          },
          async (payload) => {
            const session = (payload.new || payload.old) as CallSession;

            if (
              session.callee_id === userId &&
              session.status === "ringing"
            ) {
              await receiveIncoming(session);
              return;
            }

            const current = callRef.current;
            if (!current || current.id !== session.id) return;

            if (
              session.status === "accepted" &&
              current.direction === "outgoing"
            ) {
              clearRingTimer();
              await beginOffer(session);
              return;
            }

            if (
              session.status === "declined" ||
              session.status === "ended" ||
              session.status === "missed"
            ) {
              resetCall();
            }
          }
        )
        .subscribe();

      signalsChannel = supabase
        .channel("avenzo-call-signals-" + userId)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: "recipient_id=eq." + userId,
          },
          ({ new: inserted }) => {
            void handleSignal(inserted as CallSignal);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (sessionsChannel) void supabase.removeChannel(sessionsChannel);
      if (signalsChannel) void supabase.removeChannel(signalsChannel);
      resetCall();
    };
  }, [supabase]);

  useEffect(() => {
    const handler = async (
      event: WindowEventMap["avenzo:start-audio-call"]
    ) => {
      if (callRef.current) return;
      const detail = event.detail;
      const userId = userIdRef.current;
      if (!userId) return;

      setError("");

      const { data, error: insertError } = await supabase
        .from("call_sessions")
        .insert({
          conversation_id: detail.conversationId,
          caller_id: userId,
          callee_id: detail.otherUserId,
          status: "ringing",
        })
        .select("id,conversation_id,caller_id,callee_id,status,created_at")
        .single();

      if (insertError || !data) {
        setError("Could not start the call.");
        return;
      }

      const next: ActiveCall = {
        id: data.id,
        conversationId: detail.conversationId,
        otherUserId: detail.otherUserId,
        username: detail.username,
        displayName: detail.displayName,
        avatarUrl: detail.avatarUrl,
        direction: "outgoing",
        status: "calling",
      };
      setCall(next);

      ringTimerRef.current = window.setTimeout(() => {
        const current = callRef.current;
        if (!current || current.id !== data.id || current.status !== "calling") {
          return;
        }

        void supabase
          .from("call_sessions")
          .update({
            status: "missed",
            ended_at: new Date().toISOString(),
          })
          .eq("id", data.id)
          .then(() => resetCall());
      }, 30000);
    };

    window.addEventListener("avenzo:start-audio-call", handler);
    return () => {
      window.removeEventListener("avenzo:start-audio-call", handler);
    };
  }, [supabase]);

  const profile = call
    ? {
        id: call.otherUserId,
        username: call.username,
        display_name: call.displayName,
        bio: "",
        avatar_url: call.avatarUrl,
      }
    : null;

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {call && profile && (
        <div className="avenzo-call-overlay" role="dialog" aria-modal="true">
          <div className="avenzo-call-card">
            <div className="avenzo-call-avatar">
              <AvatarImage
                src={avatarFor(profile)}
                alt={call.displayName}
                size={180}
              />
            </div>

            <small>AVENZO AUDIO CALL</small>
            <h2>{call.displayName}</h2>
            <p>
              {call.status === "incoming"
                ? "Incoming call…"
                : call.status === "calling"
                  ? "Calling…"
                  : call.status === "connecting"
                    ? "Connecting…"
                    : "Connected"}
            </p>

            {error && <div className="avenzo-call-error">{error}</div>}

            <div className="avenzo-call-actions">
              {call.status === "incoming" ? (
                <>
                  <button
                    type="button"
                    className="avenzo-call-decline"
                    onClick={() => void declineIncoming()}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="avenzo-call-accept"
                    onClick={() => void acceptIncoming()}
                  >
                    Accept
                  </button>
                </>
              ) : (
                <>
                  {(call.status === "connecting" ||
                    call.status === "connected") && (
                    <button
                      type="button"
                      className={muted ? "active" : ""}
                      onClick={toggleMute}
                    >
                      {muted ? "Unmute" : "Mute"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="avenzo-call-decline"
                    onClick={() => void endCall()}
                  >
                    End
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
