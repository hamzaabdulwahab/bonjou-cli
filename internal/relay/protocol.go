// Package relay implements the Bonjou web relay: a stateless rendezvous
// server that pairs two browsers so they can exchange end-to-end encrypted
// messages and file payloads.
//
// The relay is deliberately a dumb pipe. Control frames carry an opaque
// Payload field holding a protocol v2 sealedEnvelope that only the two
// browsers can open, and file bytes are forwarded without ever being
// buffered to disk. Nothing in this package imports internal/network: the
// relay has no key material and no way to read what it carries.
package relay

// Control-plane message kinds. The relay reads only the outer routing
// fields of each frame; anything in Payload is ciphertext it cannot open.
const (
	// Client to server.
	msgCreate        = "create"
	msgJoin          = "join"
	msgRelay         = "relay"
	msgTransferBegin = "transfer_begin"
	msgTransferEnd   = "transfer_end"

	// Server to client.
	msgCreated       = "created"
	msgJoined        = "joined"
	msgRoster        = "roster"
	msgTransferReady = "transfer_ready"
	msgPeerLeft      = "peer_left"
	msgError         = "error"
)

// Transfer roles announced in a transfer_ready frame so each side knows
// which half of the rendezvous to open.
const (
	roleSender   = "sender"
	roleReceiver = "receiver"
)

// Error codes sent to clients. These are stable identifiers the frontend
// switches on; the accompanying message is for humans only.
const (
	errCodeBadRequest    = "bad_request"
	errCodeNoRoom        = "no_room"
	errCodeRoomFull      = "room_full"
	errCodeNoPeer        = "no_peer"
	errCodeRateLimited   = "rate_limited"
	errCodeCapacity      = "capacity"
	errCodeAlreadyInRoom = "already_in_room"
	errCodeNotInRoom     = "not_in_room"
)

// clientMessage is an inbound control frame. Fields are optional per kind;
// unpopulated fields are ignored rather than rejected so the protocol can
// gain fields without breaking older clients.
type clientMessage struct {
	Type string `json:"type"`

	// create, join
	Name   string `json:"name,omitempty"`
	PubKey string `json:"pubkey,omitempty"`
	Code   string `json:"code,omitempty"`

	// relay, transfer_begin
	To string `json:"to,omitempty"`

	// relay — a base64 protocol v2 sealedEnvelope, opaque to the relay.
	Payload string `json:"payload,omitempty"`

	// transfer_begin — total ciphertext bytes the sender will upload. The
	// relay uses it to set Content-Length on the download, so the browser
	// detects a truncated transfer natively. It reveals nothing the relay
	// would not learn anyway by counting bytes.
	Size int64 `json:"size,omitempty"`

	// transfer_end
	TransferID string `json:"transfer_id,omitempty"`
	Status     string `json:"status,omitempty"`
}

// serverMessage is an outbound control frame.
type serverMessage struct {
	Type string `json:"type"`

	Code   string     `json:"code,omitempty"`
	PeerID string     `json:"peer_id,omitempty"`
	Peers  []peerInfo `json:"peers,omitempty"`

	From    string `json:"from,omitempty"`
	Payload string `json:"payload,omitempty"`

	TransferID string `json:"transfer_id,omitempty"`
	Token      string `json:"token,omitempty"`
	Role       string `json:"role,omitempty"`
	Peer       string `json:"peer,omitempty"`
	Size       int64  `json:"size,omitempty"`

	Status  string `json:"status,omitempty"`
	ErrCode string `json:"code_error,omitempty"`
	Message string `json:"message,omitempty"`
}

// peerInfo is one entry in a room roster. PubKey is the peer's ephemeral
// X25519 public key, hex-encoded; the relay forwards it verbatim and never
// uses it.
type peerInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	PubKey string `json:"pubkey"`
}

func errorMessage(code, message string) *serverMessage {
	return &serverMessage{Type: msgError, ErrCode: code, Message: message}
}
