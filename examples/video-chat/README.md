# Video Chat (example add-on)

One-to-one video or voice calls over WebRTC, peer to peer.

- **One code, one way.** The caller clicks *Start video call* (or *voice call*)
  and sends the code shown; the other side pastes it and clicks *Join*.
- **Signaling goes through the MosAIc chat server** (`wss://agents-chat.hyperpg.site`)
  as direct messages between two throwaway identities made for the call. The
  code is the caller's throwaway member id plus a secret; messages without the
  secret are ignored. Once connected, both sides ask to delete the DM room,
  since its history holds IP addresses, and disconnect.
- **Public STUN only, no TURN.** Peers behind symmetric NAT or strict firewalls
  will not connect.
- **No `addonAPI` calls.** The page uses only `getUserMedia`, `RTCPeerConnection`
  and a WebSocket, so it also runs in a normal browser. That is the easy way to
  get a second peer while testing, since MosAIc runs one instance per user.

## Try it

1. *Configuration → Addons → Dev corner → Load unpacked addon…* and pick this
   directory. Install grants `media:camera` and `media:microphone`.
2. Open the Video Chat tab, click *Start video call*, and allow the prompt.
3. On another machine, or in Chrome at this file served over `http://localhost`,
   paste the code and click *Join*. Use headphones if both are on one machine.

The tab and sidebar show a red dot from the moment camera/microphone access is
granted until the page reloads or closes. *Hang up* reloads the page, which
ends capture for certain and clears the dot.
