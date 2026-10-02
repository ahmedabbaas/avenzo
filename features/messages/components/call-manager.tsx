"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { createCallTaskQueue } from "../lib/call-task-queue";
import AvatarImage from "../../social/components/avatar-image";
import { avatarFor } from "../../social/lib/profile";

declare global {
  interface Window {
    AvenzoNative?: {
      notifyMessage?: (title: string, body: string, route: string) => void;
      registerSession?: (accessToken: string, userId: string) => void;
      setCallAudioMode?: (active: boolean, speaker: boolean) => void;
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

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
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

async function fetchIceServers() {
  try {
    const response = await fetch("/api/calls/ice", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return DEFAULT_ICE_SERVERS;

    const payload = (await response.json()) as {
      iceServers?: RTCIceServer[];
    };
    return payload.iceServers?.length
      ? payload.iceServers
      : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export default function CallManager() {
  const supabase = useMemo(() => createClient(), []);
  const [call, setCallState] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const startingRef = useRef(false);
  const callTasksRef = useRef(createCallTaskQueue());
  const peerPromiseRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const mediaGenerationRef = useRef(0);
  const remoteStreamRef = useRef<MediaStream | null>(null);
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
  const incomingPollRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const connectionTimerRef = useRef<number | null>(null);
  const callClockRef = useRef<number | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const iceLoadedRef = useRef(false);
  const iceRestartedRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
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

  function clearIncomingPoll() {
    if (incomingPollRef.current !== null) {
      window.clearInterval(incomingPollRef.current);
      incomingPollRef.current = null;
    }
  }

  function clearDisconnectTimer() {
    if (disconnectTimerRef.current !== null) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }

  function clearConnectionTimer() {
    if (connectionTimerRef.current !== null) {
      window.clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
  }

  function clearCallClock() {
    if (callClockRef.current !== null) {
      window.clearInterval(callClockRef.current);
      callClockRef.current = null;
    }
    setCallSeconds(0);
  }

  function startCallClock() {
    if (callClockRef.current !== null) return;
    setCallSeconds(0);
    callClockRef.current = window.setInterval(() => {
      setCallSeconds((seconds) => seconds + 1);
    }, 1000);
  }

  async function requestCallWakeLock() {
    try {
      const wakeLockApi = (
        navigator as Navigator & {
          wakeLock?: {
            request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
          };
        }
      ).wakeLock;
      if (!wakeLockApi || wakeLockRef.current) return;
      const lock = await wakeLockApi.request("screen");
      if (!callRef.current) {
        await lock.release();
        return;
      }
      wakeLockRef.current = lock;
      (lock as typeof lock & EventTarget).addEventListener?.("release", () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
      }, { once: true });
    } catch {
      // Wake lock is enhancement-only.
    }
  }

  function releaseCallWakeLock() {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) void lock.release().catch(() => undefined);
  }

  async function refreshIceServers() {
    if (iceLoadedRef.current) return iceServersRef.current;
    iceServersRef.current = await fetchIceServers();
    iceLoadedRef.current = true;
    return iceServersRef.current;
  }

  function setNativeCallAudio(
    active: boolean,
    callType: "audio" | "video" = "audio",
    speaker = callType === "video"
  ) {
    try {
      window.AvenzoNative?.setCallAudioMode?.(
        active,
        active && speaker
      );
    } catch {
      // Native audio routing is an Android enhancement; WebRTC still works on web.
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
    setNativeCallAudio(false);
    releaseCallWakeLock();
  }

  function destroyPeer() {
    mediaGenerationRef.current += 1;
    peerPromiseRef.current = null;
    remoteStreamRef.current = null;
    const peer = peerRef.current;
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
    }
    peer?.close();
    peerRef.current = null;
    stopMedia();
  }

  function resetCall() {
    clearRingTimer();
    clearAcceptancePoll();
    clearSignalSync();
    // Incoming polling belongs to the mounted runtime, not a single call.
    clearDisconnectTimer();
    clearConnectionTimer();
    clearCallClock();
    callTasksRef.current.reset();
    destroyPeer();
    offerStartedRef.current = false;
    iceRestartedRef.current = false;
    pendingIceRef.current = [];
    handledSignalIdsRef.current.clear();
    acceptingCallIdRef.current = null;
    setAccepting(false);
    setAudioBlocked(false);
    setMuted(false);
    setSpeakerOn(false);
    setCameraOff(false);
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
    if (!userId || callRef.current?.id !== callId) return;

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

    setNativeCallAudio(
      true,
      callType,
      callType === "video" ? true : speakerOn
    );
    void requestCallWakeLock();

    const generation = mediaGenerationRef.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
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
    } catch (error) {
      setNativeCallAudio(false);
      throw error;
    }

    if (generation !== mediaGenerationRef.current || !callRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Call ended while requesting media.");
    }
    stream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    stream.getVideoTracks().forEach((track) => { track.enabled = !cameraOff; });
    localStreamRef.current = stream;

    if (callType === "video" && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      void localVideoRef.current.play().catch(() => undefined);
    }

    return stream;
  }

  async function createPeer(
    otherUserId: string,
    callId: string
  ) {
    if (peerRef.current) return peerRef.current;

    const current = callRef.current;
    const generation = mediaGenerationRef.current;
    const stream = await getMedia(current?.callType || "audio");
    const iceServers = await refreshIceServers();
    if (callRef.current?.id !== callId || generation !== mediaGenerationRef.current) {
      throw new Error("Call ended.");
    }
    const peer = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

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
      if (callRef.current?.id !== callId || peerRef.current !== peer) return;
      const remoteStream = remoteStreamRef.current || new MediaStream();
      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      remoteStreamRef.current = remoteStream;
      // Audio always uses the persistent audio element. Video is muted to
      // avoid playing the same audio twice when the stream has both tracks.
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => setAudioBlocked(true));
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        void remoteVideoRef.current.play().catch(() => undefined);
      }
      // ontrack occurs during SDP negotiation, before transport is connected.
    };

    peer.oniceconnectionstatechange = () => {
      if (peerRef.current !== peer || callRef.current?.id !== callId) return;
      if (peer.iceConnectionState === "failed" && !iceRestartedRef.current) {
        iceRestartedRef.current = true;
        void restartConnectionRef.current();
      }
    };

    peer.onconnectionstatechange = () => {
      if (peerRef.current !== peer || callRef.current?.id !== callId) return;
      if (peer.connectionState === "connected") {
        clearDisconnectTimer();
        clearConnectionTimer();
        startCallClock();
        setError("");
        patchCall({ status: "connected" });
        return;
      }

      if (peer.connectionState === "disconnected") {
        patchCall({ status: "connecting" });
        clearDisconnectTimer();
        disconnectTimerRef.current = window.setTimeout(() => {
          if (
            peerRef.current === peer &&
            peer.connectionState === "disconnected"
          ) {
            setError("Connection interrupted. Tap Retry to reconnect.");
          }
        }, 4000);
        return;
      }

      if (peer.connectionState === "failed") {
        patchCall({ status: "connecting" });
        clearDisconnectTimer();
        setError("Call connection failed. Tap Retry to reconnect.");
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function ensurePeer(otherUserId: string, callId: string) {
    if (peerRef.current) return peerRef.current;
    if (peerPromiseRef.current) return peerPromiseRef.current;
    const pending = createPeer(otherUserId, callId);
    peerPromiseRef.current = pending;
    try {
      return await pending;
    } finally {
      if (peerPromiseRef.current === pending) peerPromiseRef.current = null;
    }
  }

  async function beginOffer(session: CallSession) {
    await callTasksRef.current.run(() => processBeginOffer(session));
  }

  async function processBeginOffer(session: CallSession) {
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
      if (callRef.current?.id !== current.id) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(
        current.otherUserId,
        current.id,
        "offer",
        offer
      );
      startSignalSync(current.id);
      clearConnectionTimer();
      connectionTimerRef.current = window.setTimeout(() => {
        const activePeer = peerRef.current;
        if (
          callRef.current?.id === current.id &&
          activePeer &&
          activePeer.connectionState !== "connected"
        ) {
          setError(
            "Call is taking too long to connect. Retry or check your network."
          );
        }
      }, 18000);
    } catch {
      if (callRef.current?.id !== current.id) return;
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
    await callTasksRef.current.run(() => processSignal(signal));
  }

  async function processSignal(signal: CallSignal) {
    const current = callRef.current;
    if (
      !current ||
      current.id !== signal.call_id ||
      current.status === "incoming" ||
      signal.sender_id !== current.otherUserId ||
      signal.recipient_id !== userIdRef.current ||
      handledSignalIdsRef.current.has(signal.id)
    ) {
      return;
    }

    try {
      const peer = await ensurePeer(current.otherUserId, current.id);
      if (callRef.current?.id !== current.id) return;

      if (signal.signal_type === "offer") {
        if (peer.signalingState !== "stable") {
          // The callee is polite during simultaneous recovery offers.
          if (current.direction === "outgoing") {
            handledSignalIdsRef.current.add(signal.id);
            return;
          }
          await peer.setLocalDescription({ type: "rollback" });
        }

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
        if (peer.connectionState !== "connected") patchCall({ status: "connecting" });
        startSignalSync(current.id);
        return;
      }

      if (signal.signal_type === "answer") {
        if (peer.signalingState !== "have-local-offer") {
          handledSignalIdsRef.current.add(signal.id);
          return;
        }

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
      if (callRef.current?.id === current.id) {
        setError("Call connection failed. Tap Retry to reconnect.");
      }
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
      if (!current || current.id !== callId) {
        clearSignalSync();
        return;
      }
      void syncSignals(callId);
    }, 2500);
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
    if (callRef.current) return;
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

  async function syncIncomingRinging() {
    const userId = userIdRef.current;
    if (!userId || callRef.current) return;

    const recentThreshold = new Date(Date.now() - 45_000).toISOString();
    const { data } = await supabase
      .from("call_sessions")
      .select(
        "id,conversation_id,caller_id,callee_id,status,call_type,created_at"
      )
      .eq("callee_id", userId)
      .eq("status", "ringing")
      .gte("created_at", recentThreshold)
      .order("created_at", { ascending: false })
      .limit(1);

    const session = data?.[0] as CallSession | undefined;
    if (session) {
      await receiveIncomingRef.current(session);
    }
  }

  async function acceptIncoming() {
    const current = callRef.current;
    if (!current || current.direction !== "incoming") return;
    if (acceptingCallIdRef.current === current.id) return;

    acceptingCallIdRef.current = current.id;
    setAccepting(true);
    setError("");

    // Acquire media first. Android WebView can take time to resolve its native
    // permission flow; publishing "accepted" before media exists makes the
    // caller start WebRTC too early and can tear the session down.
    try {
      await getMedia(current.callType);
    } catch {
      if (callRef.current?.id !== current.id) return;
      acceptingCallIdRef.current = null;
      setAccepting(false);
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
      setAccepting(false);
      stopMedia();
      return;
    }

    patchCall({ status: "connecting" });

    const { data: acceptedSession, error: updateError } = await supabase
      .from("call_sessions")
      .update({
        status: "accepted",
        answered_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("status", "ringing")
      .select("id")
      .maybeSingle();

    if (callRef.current?.id !== current.id) return;

    if (updateError || !acceptedSession) {
      acceptingCallIdRef.current = null;
      setAccepting(false);
      stopMedia();
      if (!updateError) {
        resetCallRef.current();
        setError("This call has already ended.");
        return;
      }
      setError("Could not accept the call. Tap Accept to try again.");
      patchCall({ status: "incoming" });
      return;
    }

    try {
      await ensurePeer(current.otherUserId, current.id);
      if (callRef.current?.id !== current.id) return;
      startSignalSync(current.id);
      clearConnectionTimer();
      connectionTimerRef.current = window.setTimeout(() => {
        const activePeer = peerRef.current;
        if (
          callRef.current?.id === current.id &&
          activePeer &&
          activePeer.connectionState !== "connected"
        ) {
          setError(
            "Call is taking too long to connect. Retry or check your network."
          );
        }
      }, 18000);
      acceptingCallIdRef.current = null;
      setAccepting(false);
    } catch {
      if (callRef.current?.id !== current.id) return;
      acceptingCallIdRef.current = null;
      setAccepting(false);
      setError("Call connection failed. Tap Retry to reconnect.");
      patchCall({ status: "connecting" });
    }
  }

  async function declineIncoming() {
    const current = callRef.current;
    if (!current) return;
    const { error: declineError } = await supabase
      .from("call_sessions")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", current.id);
    if (callRef.current?.id !== current.id) return;
    if (declineError) {
      setError("Could not decline the call. Check your connection and try again.");
      return;
    }
    resetCallRef.current();
  }

  async function endCall() {
    const current = callRef.current;
    if (!current) return;
    // Always release camera/microphone immediately, even when signalling is
    // offline. The backend notification cannot keep local capture running.
    resetCallRef.current();
    const { error: endError } = await supabase
      .from("call_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", current.id);
    if (endError && !callRef.current) {
      setError("Call ended on this device. Could not notify the other participant.");
    }
  }

  async function retryConnection() {
    const current = callRef.current;
    if (!current || current.status === "incoming" || current.status === "calling") return;
    await callTasksRef.current.run(async () => {
      if (callRef.current?.id !== current.id) return;
      setError("");
      clearDisconnectTimer();
      patchCall({ status: "connecting" });
      try {
        const peer = await ensurePeer(current.otherUserId, current.id);
        if (peer.signalingState !== "stable") {
          setError("Connection is still negotiating. Please retry in a moment.");
          return;
        }
        // Restart the existing transport and send the new SDP to the other
        // participant. Recreating only one peer leaves the other end stranded.
        const offer = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(offer);
        await sendSignal(current.otherUserId, current.id, "offer", offer);
        offerStartedRef.current = true;
        startSignalSync(current.id);
      } catch {
        if (callRef.current?.id !== current.id) return;
        setError("Could not reconnect. Check your network and try again.");
      }
    });
  }

  async function enableCallAudio() {
    try {
      await remoteAudioRef.current?.play();
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
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

  function toggleSpeaker() {
    const current = callRef.current;
    if (!current) return;
    const next = !speakerOn;
    setSpeakerOn(next);
    setNativeCallAudio(true, current.callType, next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    if (!tracks.length) return;

    const next = !cameraOff;
    tracks.forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  }

  function formatCallDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes + ":" + String(rest).padStart(2, "0");
  }

  const syncSignalsRef = useRef(syncSignals);
  const stopMediaRef = useRef(stopMedia);
  const restartConnectionRef = useRef(retryConnection);
  const resetCallRef = useRef(resetCall);
  const beginOfferRef = useRef(beginOffer);
  const handleSignalRef = useRef(handleSignal);
  const receiveIncomingRef = useRef(receiveIncoming);
  const syncIncomingRef = useRef(syncIncomingRinging);

  useEffect(() => {
    syncSignalsRef.current = syncSignals;
    stopMediaRef.current = stopMedia;
    restartConnectionRef.current = retryConnection;
    resetCallRef.current = resetCall;
    beginOfferRef.current = beginOffer;
    handleSignalRef.current = handleSignal;
    receiveIncomingRef.current = receiveIncoming;
    syncIncomingRef.current = syncIncomingRinging;
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

      if (cancelled) return;

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

      void syncIncomingRef.current();

      clearIncomingPoll();
      incomingPollRef.current = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        const active = callRef.current;
        if (!active) {
          void syncIncomingRef.current();
          return;
        }
        // Poll terminal state too, so a missed realtime end event cannot leave
        // the microphone running or an incoming overlay stuck indefinitely.
        void supabase.from("call_sessions")
          .select("id,conversation_id,caller_id,callee_id,status,call_type,created_at")
          .eq("id", active.id).maybeSingle()
          .then(({ data: latest, error: sessionError }) => {
            if (sessionError || callRef.current?.id !== active.id) return;
            if (!latest || ["ended", "declined", "missed"].includes(latest.status)) {
              resetCallRef.current();
            } else if (latest.status === "accepted" && active.direction === "outgoing") {
              void beginOfferRef.current(latest as CallSession);
            }
          });
      }, 2500);

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

    const recoverVisibleCall = () => {
      if (document.visibilityState !== "visible") return;
      if (!callRef.current) void syncIncomingRef.current();
      else {
        void syncSignalsRef.current(callRef.current.id);
        void requestCallWakeLock();
      }
    };
    document.addEventListener("visibilitychange", recoverVisibleCall);
    window.addEventListener("pageshow", recoverVisibleCall);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", recoverVisibleCall);
      window.removeEventListener("pageshow", recoverVisibleCall);
      if (sessionsChannel) void supabase.removeChannel(sessionsChannel);
      if (signalsChannel) void supabase.removeChannel(signalsChannel);
      clearIncomingPoll();
      resetCallRef.current();
    };
  }, [supabase]);

  useEffect(() => {
    let outgoingCancelled = false;
    async function startOutgoing(
      detail: WindowEventMap["avenzo:start-audio-call"]["detail"],
      callType: "audio" | "video"
    ) {
      if (callRef.current || startingRef.current) return;

      const userId = userIdRef.current;
      if (!userId) {
        setError("Your call session is loading. Try again in a moment.");
        return;
      }
      startingRef.current = true;
      setStarting(true);
      setError("");
      void refreshIceServers();

      // Do not block the call button on getUserMedia. Some Android WebViews
      // wait on the native permission bridge here, which made the button look
      // completely dead. Ring first; acquire caller media only after the
      // recipient accepts, inside beginOffer/ensurePeer.
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

      startingRef.current = false;
      if (outgoingCancelled) {
        if (data?.id) {
          void supabase.from("call_sessions")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", data.id);
        }
        return;
      }
      setStarting(false);
      if (insertError || !data) {
        stopMediaRef.current();
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
      if (callRef.current) {
        void supabase.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", data.id);
        return;
      }
      setSpeakerOn(callType === "video");
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
          .eq("status", "ringing")
          .select("id")
          .maybeSingle()
          .then(({ data: missed }) => {
            if (missed && callRef.current?.id === data.id) resetCallRef.current();
          });
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
      outgoingCancelled = true;
      window.removeEventListener("avenzo:start-audio-call", audioHandler);
      window.removeEventListener("avenzo:start-video-call", videoHandler);
    };
  }, [supabase]);

  const activeCallId = call?.id;
  useEffect(() => {
    if (!activeCallId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const root = document.documentElement;
    const hadCallClass = root.classList.contains("avenzo-call-open");
    const main = document.getElementById("main-content");
    const wasInert = main?.inert || false;
    if (main) main.inert = true;
    root.classList.add("avenzo-call-open");
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>(".avenzo-call-overlay");
    dialog?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (!hadCallClass) root.classList.remove("avenzo-call-open");
      if (main) main.inert = wasInert;
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [activeCallId]);

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
      {!call && (error || starting) && (
        <div className="avenzo-call-feedback" role={error ? "alert" : "status"}>
          <span>{error || "Starting call…"}</span>
          {error && <button type="button" onClick={() => setError("")} aria-label="Dismiss call error">Dismiss</button>}
        </div>
      )}

      {call && profile && (
        <div
          className={
            "avenzo-call-overlay " +
            (call.callType === "video" ? "avenzo-video-call" : "")
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="avenzo-call-name"
        >
          <div className="avenzo-call-card">
            {call.callType === "video" && (
              <div className="avenzo-video-stage">
                <video
                  ref={remoteVideoRef}
                  className="avenzo-remote-video"
                  muted
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
            <h2 id="avenzo-call-name">{call.displayName}</h2>
            <p role="status" aria-live="polite">
              {call.status === "incoming"
                ? "Incoming call…"
                : call.status === "calling"
                  ? "Calling…"
                  : call.status === "connecting"
                    ? "Connecting…"
                    : "Connected · " + formatCallDuration(callSeconds)}
            </p>

            {error && <div className="avenzo-call-error" role="alert">{error}</div>}
            {audioBlocked && (
              <button className="avenzo-enable-audio" type="button" onClick={() => void enableCallAudio()}>
                Tap to hear call audio
              </button>
            )}

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
                    disabled={accepting}
                    onClick={() => void acceptIncoming()}
                  >
                    {accepting ? "Accepting…" : "Accept"}
                  </button>
                </>
              ) : (
                <>
                  {(call.status === "connecting" ||
                    call.status === "connected") && (
                    <>
                      <button
                        type="button"
                        className={muted ? "active" : ""}
                        aria-pressed={muted}
                        onClick={toggleMute}
                      >
                        {muted ? "Unmute" : "Mute"}
                      </button>
                      {window.AvenzoNative?.setCallAudioMode && (
                      <button
                        type="button"
                        className={speakerOn ? "active" : ""}
                        aria-pressed={speakerOn}
                        onClick={toggleSpeaker}
                      >
                        {speakerOn ? "Speaker on" : "Speaker"}
                      </button>
                      )}
                      {call.callType === "video" && (
                        <button
                          type="button"
                          className={cameraOff ? "active" : ""}
                          aria-pressed={cameraOff}
                          onClick={toggleCamera}
                        >
                          {cameraOff ? "Camera off" : "Camera"}
                        </button>
                      )}
                    </>
                  )}
                  {error && (call.status === "connecting" || call.status === "connected") && (
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
