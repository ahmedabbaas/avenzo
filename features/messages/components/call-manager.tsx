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
    "avenzo:start-video-call": CustomEvent<{
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
  callType: "audio" | "video";
  status: CallStatus;
};

type CallSession = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted" | "declined" | "ended" | "missed";
  call_type: "audio" | "video";
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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const acceptancePollRef = useRef<number | null>(null);
  const signalSyncTimerRef = useRef<number | null>(null);
  const offerStartedRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const handledSignalIdsRef = useRef<Set<number>>(new Set());
  const acceptingCallIdRef = useRef<string | null>(null);

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

  function clearAcceptancePoll() {
    if (acceptancePollRef.current !== null) {
      window.clearInterval(acceptancePollRef.current);
      acceptancePollRef.current = null;
    }
  }

  function clearSignalSync() {
    if (signalSyncTimerRef.current !== null) {
      window.clearInterval(signalSyncTimerRef.current);
      signalSyncTimerRef.current = null;
    }
  }

  function stopMedia() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  function destroyPeer() {
    peerRef.current?.close();
    peerRef.current = null;
    stopMedia();
  }

  function resetCall() {
    clearRingTimer();
    clearAcceptancePoll();
    clearSignalSync();
    destroyPeer();
    offerStartedRef.current = false;
    pendingIceRef.current = [];
    handledSignalIdsRef.current.clear();
    acceptingCallIdRef.current = null;
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

  async function getMedia(callType: "audio" | "video") {
    if (localStreamRef.current) return localStreamRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Media access is not available on this device.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callType === "video"
          ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    });

    localStreamRef.current = stream;

    if (callType === "video" && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      void localVideoRef.current.play().catch(() => undefined);
    }

    return stream;
  }

  async function ensurePeer(
    otherUserId: string,
    callId: string
  ) {
    if (peerRef.current) return peerRef.current;

    const current = callRef.current;
    const stream = await getMedia(current?.callType || "audio");
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
      if (!remoteStream) return;

      const currentCall = callRef.current;
      if (currentCall?.callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        void remoteVideoRef.current.play().catch(() => undefined);
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }

      patchCall({ status: "connected" });
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        clearSignalSync();
        setError("");
        patchCall({ status: "connected" });
      }

      if (peer.connectionState === "failed") {
        setError("Call connection failed. Tap Retry to reconnect.");
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function beginOffer(session: CallSession) {
    const current = callRef.current;
    if (
      !current ||
      current.id !== session.id ||
      current.direction !== "outgoing" ||
      offerStartedRef.current
    ) {
      return;
    }

    offerStartedRef.current = true;

    try {
      clearRingTimer();
      clearAcceptancePoll();
      setError("");
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
      startSignalSync(current.id);
    } catch {
      offerStartedRef.current = false;
      setError("Could not connect the call. Tap Retry to reconnect.");
      patchCall({ status: "connecting" });
    }
  }

  async function flushPendingIce(peer: RTCPeerConnection) {
    if (!peer.remoteDescription || pendingIceRef.current.length === 0) return;

    const pending = pendingIceRef.current;
    pendingIceRef.current = [];

    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        pendingIceRef.current.push(candidate);
      }
    }
  }

  async function handleSignal(signal: CallSignal) {
    const current = callRef.current;
    if (
      !current ||
      current.id !== signal.call_id ||
      handledSignalIdsRef.current.has(signal.id)
    ) {
      return;
    }

    try {
      const peer = await ensurePeer(current.otherUserId, current.id);

      if (signal.signal_type === "offer") {
        if (peer.signalingState !== "stable") return;

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            signal.payload as RTCSessionDescriptionInit
          )
        );
        await flushPendingIce(peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal(
          current.otherUserId,
          current.id,
          "answer",
          answer
        );
        handledSignalIdsRef.current.add(signal.id);
        patchCall({ status: "connecting" });
        startSignalSync(current.id);
        return;
      }

      if (signal.signal_type === "answer") {
        if (peer.signalingState !== "have-local-offer") return;

        await peer.setRemoteDescription(
          new RTCSessionDescription(
            signal.payload as RTCSessionDescriptionInit
          )
        );
        await flushPendingIce(peer);
        handledSignalIdsRef.current.add(signal.id);
        return;
      }

      if (signal.signal_type === "ice") {
        const candidate = signal.payload as RTCIceCandidateInit;
        if (!peer.remoteDescription) {
          pendingIceRef.current.push(candidate);
        } else {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        handledSignalIdsRef.current.add(signal.id);
      }
    } catch {
      setError("Call connection failed. Tap Retry to reconnect.");
    }
  }

  async function syncSignals(callId: string) {
    const userId = userIdRef.current;
    const current = callRef.current;
    if (!userId || !current || current.id !== callId) return;

    const { data, error: syncError } = await supabase
      .from("call_signals")
      .select("id,call_id,sender_id,recipient_id,signal_type,payload")
      .eq("call_id", callId)
      .eq("recipient_id", userId)
      .order("id", { ascending: true });

    if (syncError || !data) return;

    for (const signal of data as CallSignal[]) {
      await handleSignalRef.current(signal);
    }
  }

  function startSignalSync(callId: string) {
    clearSignalSync();
    void syncSignals(callId);
    signalSyncTimerRef.current = window.setInterval(() => {
      const current = callRef.current;
      if (!current || current.id !== callId || current.status === "connected") {
        clearSignalSync();
        return;
      }
      void syncSignals(callId);
    }, 1200);
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
      callType: session.call_type === "video" ? "video" : "audio",
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
    if (acceptingCallIdRef.current === current.id) return;

    acceptingCallIdRef.current = current.id;
    setError("");

    // Acquire media first. Android WebView can take time to resolve its native
    // permission flow; publishing "accepted" before media exists makes the
    // caller start WebRTC too early and can tear the session down.
    try {
      await getMedia(current.callType);
    } catch {
      acceptingCallIdRef.current = null;
      setError(
        current.callType === "video"
          ? "Camera and microphone permission are required for video calls."
          : "Microphone permission is required for calls."
      );
      patchCall({ status: "incoming" });
      return;
    }

    if (callRef.current?.id !== current.id) {
      acceptingCallIdRef.current = null;
      stopMedia();
      return;
    }

    patchCall({ status: "connecting" });

    const { error: updateError } = await supabase
      .from("call_sessions")
      .update({
        status: "accepted",
        answered_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("status", "ringing");

    if (updateError) {
      acceptingCallIdRef.current = null;
      stopMedia();
      setError("Could not accept the call. Tap Accept to try again.");
      patchCall({ status: "incoming" });
      return;
    }

    try {
      await ensurePeer(current.otherUserId, current.id);
      startSignalSync(current.id);
      acceptingCallIdRef.current = null;
    } catch {
      acceptingCallIdRef.current = null;
      setError("Call connection failed. Tap Retry to reconnect.");
      patchCall({ status: "connecting" });
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

    resetCallRef.current();
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

    resetCallRef.current();
  }

  async function retryConnection() {
    const current = callRef.current;
    if (!current) return;

    setError("");

    if (current.direction === "outgoing") {
      offerStartedRef.current = false;
      await beginOffer({
        id: current.id,
        conversation_id: current.conversationId,
        caller_id: userIdRef.current,
        callee_id: current.otherUserId,
        status: "accepted",
        call_type: current.callType,
        created_at: new Date().toISOString(),
      });
      return;
    }

    try {
      await ensurePeer(current.otherUserId, current.id);
      startSignalSync(current.id);
    } catch {
      setError("Microphone access is required to reconnect the call.");
    }
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

  const resetCallRef = useRef(resetCall);
  const beginOfferRef = useRef(beginOffer);
  const handleSignalRef = useRef(handleSignal);
  const receiveIncomingRef = useRef(receiveIncoming);

  useEffect(() => {
    resetCallRef.current = resetCall;
    beginOfferRef.current = beginOffer;
    handleSignalRef.current = handleSignal;
    receiveIncomingRef.current = receiveIncoming;
  });

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
              await receiveIncomingRef.current(session);
              return;
            }

            const current = callRef.current;
            if (!current || current.id !== session.id) return;

            if (
              session.status === "accepted" &&
              current.direction === "outgoing"
            ) {
              clearRingTimer();
              clearAcceptancePoll();
              await beginOfferRef.current(session);
              return;
            }

            if (
              session.status === "declined" ||
              session.status === "ended" ||
              session.status === "missed"
            ) {
              resetCallRef.current();
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
            void handleSignalRef.current(inserted as CallSignal);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (sessionsChannel) void supabase.removeChannel(sessionsChannel);
      if (signalsChannel) void supabase.removeChannel(signalsChannel);
      resetCallRef.current();
    };
  }, [supabase]);

  useEffect(() => {
    async function startOutgoing(
      detail: WindowEventMap["avenzo:start-audio-call"]["detail"],
      callType: "audio" | "video"
    ) {
      if (callRef.current) return;

      const userId = userIdRef.current;
      if (!userId) return;

      setError("");

      try {
        await getMedia(callType);
      } catch {
        setError(
          callType === "video"
            ? "Camera and microphone permission are required for video calls."
            : "Microphone permission is required for calls."
        );
        stopMedia();
        return;
      }

      const { data, error: insertError } = await supabase
        .from("call_sessions")
        .insert({
          conversation_id: detail.conversationId,
          caller_id: userId,
          callee_id: detail.otherUserId,
          status: "ringing",
          call_type: callType,
        })
        .select(
          "id,conversation_id,caller_id,callee_id,status,call_type,created_at"
        )
        .single();

      if (insertError || !data) {
        stopMedia();
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
        callType,
        status: "calling",
      };
      setCall(next);

      clearAcceptancePoll();
      acceptancePollRef.current = window.setInterval(() => {
        const current = callRef.current;
        if (!current || current.id !== data.id || current.direction !== "outgoing") {
          clearAcceptancePoll();
          return;
        }

        void supabase
          .from("call_sessions")
          .select("id,conversation_id,caller_id,callee_id,status,call_type,created_at")
          .eq("id", data.id)
          .maybeSingle()
          .then(({ data: latest }) => {
            if (!latest || callRef.current?.id !== data.id) return;

            if (latest.status === "accepted") {
              clearRingTimer();
              clearAcceptancePoll();
              void beginOfferRef.current(latest as CallSession);
              return;
            }

            if (
              latest.status === "declined" ||
              latest.status === "ended" ||
              latest.status === "missed"
            ) {
              clearAcceptancePoll();
              resetCallRef.current();
            }
          });
      }, 900);

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
          .then(() => resetCallRef.current());
      }, 30000);
    }

    const audioHandler = (
      event: WindowEventMap["avenzo:start-audio-call"]
    ) => {
      void startOutgoing(event.detail, "audio");
    };
    const videoHandler = (
      event: WindowEventMap["avenzo:start-video-call"]
    ) => {
      void startOutgoing(event.detail, "video");
    };

    window.addEventListener("avenzo:start-audio-call", audioHandler);
    window.addEventListener("avenzo:start-video-call", videoHandler);

    return () => {
      window.removeEventListener("avenzo:start-audio-call", audioHandler);
      window.removeEventListener("avenzo:start-video-call", videoHandler);
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
        <div
          className={
            "avenzo-call-overlay " +
            (call.callType === "video" ? "avenzo-video-call" : "")
          }
          role="dialog"
          aria-modal="true"
        >
          <div className="avenzo-call-card">
            {call.callType === "video" && (
              <div className="avenzo-video-stage">
                <video
                  ref={remoteVideoRef}
                  className="avenzo-remote-video"
                  autoPlay
                  playsInline
                />
                <video
                  ref={localVideoRef}
                  className="avenzo-local-video"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            )}
            <div className="avenzo-call-avatar">
              <AvatarImage
                src={avatarFor(profile)}
                alt={call.displayName}
                size={180}
              />
            </div>

            <small>
              {call.callType === "video"
                ? "AVENZO VIDEO CALL"
                : "AVENZO AUDIO CALL"}
            </small>
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
                  {error && call.status === "connecting" && (
                    <button
                      type="button"
                      onClick={() => void retryConnection()}
                    >
                      Retry
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
