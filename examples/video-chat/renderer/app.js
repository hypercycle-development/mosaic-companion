// One-to-one WebRTC call. The caller shares one short code; everything else
// travels as direct messages on the MosAIc chat server, between two throwaway
// identities that exist only for this call.
//
//   caller: connect to chat → show code "<memberId>.<secret>"
//   joiner: paste code → connect → send "hello"
//   caller: offer → joiner: answer → peer to peer from here on
//
// Messages without the secret are ignored. Public STUN only, no TURN, so some
// networks (symmetric NAT, strict firewalls) will not connect.

const RELAY_URL = "wss://agents-chat.hyperpg.site";
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const GATHER_TIMEOUT_MS = 5000;
const CHUNK = 3800; // the chat server refuses messages over 4096 characters

const $ = (id) => document.getElementById(id);
let pc = null;
let localStream = null;
let relay = null; // { ws, myId }
let peerId = null;
let secret = null;
let dmRoomId = null;
const parts = [];

const randomId = () => crypto.randomUUID().slice(0, 8);

function setStatus(text) {
  $("status").textContent = text;
}

function showError(e) {
  setStatus(e.name === "NotAllowedError" ? "Camera or microphone not allowed." : `Failed: ${e.message}`);
}

/** Runs a button action, showing any failure in the status line. */
const run = (action) => () => action().catch(showError);

async function newConnection(video) {
  localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  $("local").srcObject = localStream;
  document.body.classList.toggle("voice", !video);
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
  pc.ontrack = (e) => ($("remote").srcObject = e.streams[0]);
  pc.onconnectionstatechange = () => {
    document.body.classList.toggle("connected", pc.connectionState === "connected");
    setStatus(`Call ${pc.connectionState}.`);
    if (pc.connectionState === "connected") closeRelay();
  };
}

/** Waits for ICE gathering (or a timeout), so one message carries every candidate. */
function gathered() {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && resolve());
    setTimeout(resolve, GATHER_TIMEOUT_MS);
  });
}

// ── Relay over the chat server ────────────────────────────────────────────

function connectRelay() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL);
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", username: `video-chat-${randomId()}` }));
    ws.onerror = () => reject(new Error("could not reach the chat server"));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "auth-ok") resolve((relay = { ws, myId: m.memberId }));
      else if (m.type === "message") onRelayMessage(m.message);
    };
  });
}

function sendSignal(data) {
  const text = JSON.stringify(data);
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) {
    const part = { s: secret, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) };
    relay.ws.send(JSON.stringify({ type: "direct-message", targetMemberId: peerId, text: JSON.stringify(part) }));
  }
}

function onRelayMessage({ memberId, roomId, text }) {
  if (!relay || memberId === relay.myId) return; // the server echoes our own sends
  let part;
  try {
    part = JSON.parse(text);
  } catch {
    return;
  }
  if (part.s !== secret || (peerId && memberId !== peerId)) return;
  peerId = memberId;
  dmRoomId = roomId;
  parts.push(part.d);
  if (part.i === part.n - 1) handleSignal(JSON.parse(parts.splice(0).join(""))).catch(showError);
}

/** Once connected the relay is done. Deleting the DM room drops the stored
 * signaling (which holds IP addresses); only its creator may, so both try. */
function closeRelay() {
  if (!relay) return;
  if (dmRoomId) relay.ws.send(JSON.stringify({ type: "delete-room", roomId: dmRoomId }));
  relay.ws.close();
  relay = null;
}

async function handleSignal(data) {
  if (data.hello) {
    await pc.setLocalDescription(await pc.createOffer());
    await gathered();
    sendSignal(pc.localDescription);
    setStatus("Connecting…");
  } else if (data.type === "offer") {
    await newConnection(data.sdp.includes("m=video"));
    await pc.setRemoteDescription(data);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered();
    sendSignal(pc.localDescription);
    setStatus("Connecting…");
  } else if (data.type === "answer") {
    await pc.setRemoteDescription(data);
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────

async function startCall(video) {
  document.body.classList.add("in-call");
  await newConnection(video);
  secret = randomId();
  const { myId } = await connectRelay();
  $("mine").value = `${myId}.${secret}`;
  $("invite").hidden = false;
  setStatus("Send this code to the other person.");
}

$("video-call").onclick = run(() => startCall(true));
$("voice-call").onclick = run(() => startCall(false));

$("join").onclick = run(async () => {
  [peerId, secret] = $("theirs").value.trim().split(".");
  if (!peerId || !secret) throw new Error("that is not a call code");
  document.body.classList.add("in-call");
  await connectRelay();
  sendSignal({ hello: true });
  setStatus("Waiting for them…");
});

$("copy").onclick = run(() => navigator.clipboard.writeText($("mine").value));

function toggle(kind, button, onLabel, offLabel) {
  const track = localStream?.getTracks().find((t) => t.kind === kind);
  if (!track) return;
  track.enabled = !track.enabled;
  button.textContent = track.enabled ? onLabel : offLabel;
}

$("mute").onclick = () => toggle("audio", $("mute"), "Mute", "Unmute");
$("camera").onclick = () => toggle("video", $("camera"), "Camera off", "Camera on");

// Reloading ends all capture for certain, and the host clears its camera
// indicator when this page navigates. A fresh page also starts idle.
$("hangup").onclick = () => location.reload();
