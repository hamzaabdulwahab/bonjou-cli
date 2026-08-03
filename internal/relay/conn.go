package relay

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

const (
	// wsReadLimit bounds one control frame. Frames carry sealed envelopes
	// — offers, approvals, chat — never file payloads, so 1 MiB is
	// generous. File bytes travel over the data plane instead.
	wsReadLimit = 1 << 20

	wsWriteTimeout = 10 * time.Second
	wsPingInterval = 30 * time.Second

	maxNameLen   = 64
	pubKeyHexLen = 64 // X25519 public key: 32 bytes
)

// Conn is one browser's control-plane connection: a WebSocket carrying
// room membership and opaque end-to-end encrypted frames.
type Conn struct {
	ws   *websocket.Conn
	hub  *Hub
	rv   *Rendezvous
	ip   string
	peer *Peer
	room *Room
}

func newConn(ws *websocket.Conn, hub *Hub, rv *Rendezvous, ip string) (*Conn, error) {
	id, err := newID()
	if err != nil {
		return nil, err
	}
	return &Conn{ws: ws, hub: hub, rv: rv, ip: ip, peer: newPeer(id, "", "")}, nil
}

// run drives the read loop until the client disconnects or misbehaves.
func (c *Conn) run(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer c.cleanup()

	c.ws.SetReadLimit(wsReadLimit)
	go c.writePump(ctx)

	for {
		var msg clientMessage
		if err := wsjson.Read(ctx, c.ws, &msg); err != nil {
			return
		}
		if err := c.handle(&msg); err != nil {
			c.peer.Send(errorMessage(codeForError(err), err.Error()))
			// Protocol misuse is not fatal on its own: a client that asks
			// for a room that expired should be told so and allowed to
			// create a new one rather than dropped.
			continue
		}
	}
}

// writePump owns all writes to the socket. Concentrating them here means
// no two goroutines can interleave frames, and keepalive pings share the
// same serialisation.
func (c *Conn) writePump(ctx context.Context) {
	ping := time.NewTicker(wsPingInterval)
	defer ping.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.peer.closed:
			_ = c.ws.Close(websocket.StatusPolicyViolation, "client not reading")
			return
		case msg := <-c.peer.send:
			wctx, cancel := context.WithTimeout(ctx, wsWriteTimeout)
			err := wsjson.Write(wctx, c.ws, msg)
			cancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, wsWriteTimeout)
			err := c.ws.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (c *Conn) handle(msg *clientMessage) error {
	switch msg.Type {
	case msgCreate:
		return c.handleCreate(msg)
	case msgJoin:
		return c.handleJoin(msg)
	case msgRelay:
		return c.handleRelay(msg)
	case msgTransferBegin:
		return c.handleTransferBegin(msg)
	case msgTransferEnd:
		return c.handleTransferEnd(msg)
	default:
		return fmt.Errorf("unknown message type %q", msg.Type)
	}
}

func (c *Conn) handleCreate(msg *clientMessage) error {
	if c.room != nil {
		return errAlreadyInRoom
	}
	if err := c.adoptIdentity(msg); err != nil {
		return err
	}
	room, err := c.hub.CreateRoom(c.ip)
	if err != nil {
		return err
	}
	if err := room.Add(c.peer); err != nil {
		c.hub.Drop(room.Code)
		return err
	}
	c.room = room
	c.peer.Send(&serverMessage{Type: msgCreated, Code: room.Code, PeerID: c.peer.ID})
	room.BroadcastRoster()
	c.hub.logf("relay: room %s created by %s", room.Code, c.peer.ID)
	return nil
}

func (c *Conn) handleJoin(msg *clientMessage) error {
	if c.room != nil {
		return errAlreadyInRoom
	}
	if err := c.adoptIdentity(msg); err != nil {
		return err
	}
	room, err := c.hub.Room(msg.Code)
	if err != nil {
		return err
	}
	if err := room.Add(c.peer); err != nil {
		return err
	}
	c.room = room
	c.peer.Send(&serverMessage{Type: msgJoined, Code: room.Code, PeerID: c.peer.ID})
	room.BroadcastRoster()
	return nil
}

// handleRelay forwards an end-to-end encrypted frame. The relay reads the
// destination and nothing else: Payload is ciphertext it has no key for.
func (c *Conn) handleRelay(msg *clientMessage) error {
	if c.room == nil {
		return errNotInRoom
	}
	if msg.Payload == "" {
		return errors.New("relay frame has empty payload")
	}
	target, ok := c.room.Peer(msg.To)
	if !ok {
		return errPeerNotFound
	}
	target.Send(&serverMessage{Type: msgRelay, From: c.peer.ID, Payload: msg.Payload})
	c.room.Touch()
	return nil
}

// handleTransferBegin sets up a data-plane rendezvous. A well-behaved
// client only sends this after the receiver has approved the offer, but
// the relay does not — and cannot — verify that: the approval is
// encrypted. The guarantee that nothing is written without consent is
// enforced on the receiving browser, which will not open the download
// until its own user has approved.
func (c *Conn) handleTransferBegin(msg *clientMessage) error {
	if c.room == nil {
		return errNotInRoom
	}
	target, ok := c.room.Peer(msg.To)
	if !ok {
		return errPeerNotFound
	}
	x, err := c.rv.Begin(c.peer.ID, target.ID, msg.Size)
	if err != nil {
		return err
	}
	c.peer.Send(&serverMessage{
		Type:       msgTransferReady,
		TransferID: x.id,
		Token:      x.sendToken,
		Role:       roleSender,
		Peer:       target.ID,
		Size:       x.size,
	})
	target.Send(&serverMessage{
		Type:       msgTransferReady,
		TransferID: x.id,
		Token:      x.recvToken,
		Role:       roleReceiver,
		Peer:       c.peer.ID,
		Size:       x.size,
	})
	c.room.Touch()
	return nil
}

// handleTransferEnd propagates a client-initiated cancel. Normal
// completion is observed by the data plane; this path exists so a user
// who changes their mind mid-transfer stops it immediately rather than
// after the idle timeout.
func (c *Conn) handleTransferEnd(msg *clientMessage) error {
	if c.room == nil {
		return errNotInRoom
	}
	if msg.TransferID == "" {
		return errors.New("transfer_end requires transfer_id")
	}
	c.rv.Abort(msg.TransferID, fmt.Errorf("cancelled by peer: %s", msg.Status))
	if target, ok := c.room.Peer(msg.To); ok {
		target.Send(&serverMessage{
			Type:       msgTransferEnd,
			TransferID: msg.TransferID,
			Status:     msg.Status,
			From:       c.peer.ID,
		})
	}
	c.room.Touch()
	return nil
}

// adoptIdentity validates and records the display name and ephemeral
// public key a client presents when entering a room.
func (c *Conn) adoptIdentity(msg *clientMessage) error {
	name := sanitizeName(msg.Name)
	if name == "" {
		return errors.New("a display name is required")
	}
	if len(msg.PubKey) != pubKeyHexLen {
		return fmt.Errorf("public key must be %d hex characters", pubKeyHexLen)
	}
	if _, err := hex.DecodeString(msg.PubKey); err != nil {
		return errors.New("public key is not valid hex")
	}
	c.peer.Name = name
	c.peer.PubKey = strings.ToLower(msg.PubKey)
	return nil
}

func (c *Conn) cleanup() {
	c.peer.Close()
	for _, id := range c.rv.AbortForPeer(c.peer.ID, errors.New("peer disconnected")) {
		c.hub.logf("relay: aborted transfer %s (peer %s left)", id, c.peer.ID)
	}
	if c.room == nil {
		return
	}
	empty := c.room.Remove(c.peer.ID)
	if empty {
		c.hub.Drop(c.room.Code)
		c.hub.logf("relay: room %s closed (last peer left)", c.room.Code)
		return
	}
	c.room.Broadcast(&serverMessage{Type: msgPeerLeft, PeerID: c.peer.ID})
	c.room.BroadcastRoster()
}

// sanitizeName strips control characters and clamps length so one client
// cannot inject terminal escapes or layout-breaking strings into another
// client's roster.
func sanitizeName(raw string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, strings.TrimSpace(raw))
	runes := []rune(cleaned)
	if len(runes) > maxNameLen {
		runes = runes[:maxNameLen]
	}
	return strings.TrimSpace(string(runes))
}

func codeForError(err error) string {
	switch {
	case errors.Is(err, errRoomNotFound):
		return errCodeNoRoom
	case errors.Is(err, errRoomFull):
		return errCodeRoomFull
	case errors.Is(err, errPeerNotFound):
		return errCodeNoPeer
	case errors.Is(err, errRateLimited):
		return errCodeRateLimited
	case errors.Is(err, errAtCapacity):
		return errCodeCapacity
	case errors.Is(err, errAlreadyInRoom):
		return errCodeAlreadyInRoom
	case errors.Is(err, errNotInRoom):
		return errCodeNotInRoom
	default:
		return errCodeBadRequest
	}
}
