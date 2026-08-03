package relay

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/hamzawahab/bonjou-cli/internal/logger"
)

var (
	errRoomNotFound  = errors.New("no room with that code — it may have expired")
	errRoomFull      = errors.New("room is full")
	errAtCapacity    = errors.New("relay is at capacity, try again shortly")
	errPeerNotFound  = errors.New("that peer is no longer in the room")
	errRateLimited   = errors.New("too many rooms created from this address")
	errAlreadyInRoom = errors.New("this connection is already in a room")
	errNotInRoom     = errors.New("join a room first")
)

// peerSendBuffer is how many control frames may queue for one client
// before the relay gives up on it. Control frames are small and rare —
// roster updates and E2E envelopes — so a client that falls this far
// behind is not reading its socket, and disconnecting it is kinder than
// growing a queue forever.
const peerSendBuffer = 64

// Peer is one connected browser inside a room.
type Peer struct {
	ID     string
	Name   string
	PubKey string

	send     chan *serverMessage
	closed   chan struct{}
	closeOne sync.Once
}

func newPeer(id, name, pubKey string) *Peer {
	return &Peer{
		ID:     id,
		Name:   name,
		PubKey: pubKey,
		send:   make(chan *serverMessage, peerSendBuffer),
		closed: make(chan struct{}),
	}
}

// Send queues a frame for delivery. It never blocks: if the peer's queue
// is full the peer is closed, because a client that cannot keep up with
// control traffic is already gone in every way that matters.
func (p *Peer) Send(msg *serverMessage) {
	select {
	case <-p.closed:
		return
	default:
	}
	select {
	case p.send <- msg:
	default:
		p.Close()
	}
}

// Close marks the peer disconnected. Safe to call repeatedly.
func (p *Peer) Close() {
	p.closeOne.Do(func() { close(p.closed) })
}

func (p *Peer) info() peerInfo {
	return peerInfo{ID: p.ID, Name: p.Name, PubKey: p.PubKey}
}

// Room is a rendezvous group addressed by a short human-readable code.
type Room struct {
	Code string

	mu         sync.RWMutex
	peers      map[string]*Peer
	lastActive time.Time
	maxPeers   int
}

func newRoom(code string, maxPeers int) *Room {
	return &Room{
		Code:       code,
		peers:      make(map[string]*Peer),
		lastActive: time.Now(),
		maxPeers:   maxPeers,
	}
}

// Add places a peer in the room and returns the resulting roster.
func (r *Room) Add(p *Peer) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.peers) >= r.maxPeers {
		return errRoomFull
	}
	r.peers[p.ID] = p
	r.lastActive = time.Now()
	return nil
}

// Remove drops a peer and reports whether the room is now empty.
func (r *Room) Remove(id string) (empty bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.peers, id)
	r.lastActive = time.Now()
	return len(r.peers) == 0
}

// Peer looks up one member.
func (r *Room) Peer(id string) (*Peer, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.peers[id]
	return p, ok
}

// Roster snapshots the current membership.
func (r *Room) Roster() []peerInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]peerInfo, 0, len(r.peers))
	for _, p := range r.peers {
		out = append(out, p.info())
	}
	return out
}

// Broadcast delivers a frame to every member.
func (r *Room) Broadcast(msg *serverMessage) {
	r.mu.RLock()
	targets := make([]*Peer, 0, len(r.peers))
	for _, p := range r.peers {
		targets = append(targets, p)
	}
	r.mu.RUnlock()
	for _, p := range targets {
		p.Send(msg)
	}
}

// BroadcastRoster pushes the current membership to everyone. Called after
// any join or leave so each client can render who is present without
// polling.
func (r *Room) BroadcastRoster() {
	r.Broadcast(&serverMessage{Type: msgRoster, Code: r.Code, Peers: r.Roster()})
}

// Touch marks the room as active, deferring its idle expiry.
func (r *Room) Touch() {
	r.mu.Lock()
	r.lastActive = time.Now()
	r.mu.Unlock()
}

func (r *Room) idleSince() time.Time {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.lastActive
}

func (r *Room) size() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.peers)
}

// Hub owns every room. State lives entirely in memory: a single relay
// instance has nothing worth persisting, and a restart losing all rooms is
// an acceptable, recoverable event that clients already handle.
type Hub struct {
	mu     sync.RWMutex
	rooms  map[string]*Room
	limits Limits
	logger *logger.Logger
	rl     *rateLimiter
}

// NewHub constructs a hub. A nil logger is allowed; log calls become no-ops.
func NewHub(limits Limits, lg *logger.Logger) *Hub {
	limits = limits.withDefaults()
	return &Hub{
		rooms:  make(map[string]*Room),
		limits: limits,
		logger: lg,
		rl:     newRateLimiter(limits.CreatePerIPPerMin),
	}
}

// CreateRoom allocates a room with a fresh code. Codes are retried on the
// astronomically unlikely event of a collision rather than trusting
// randomness blindly.
func (h *Hub) CreateRoom(ip string) (*Room, error) {
	if !h.rl.allow(ip, time.Now()) {
		return nil, errRateLimited
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.rooms) >= h.limits.MaxRooms {
		return nil, errAtCapacity
	}
	for attempt := 0; attempt < 8; attempt++ {
		code, err := newRoomCode()
		if err != nil {
			return nil, err
		}
		if _, taken := h.rooms[code]; taken {
			continue
		}
		room := newRoom(code, h.limits.MaxPeersPerRoom)
		h.rooms[code] = room
		return room, nil
	}
	return nil, errAtCapacity
}

// Room resolves a code, tolerating user formatting.
func (h *Hub) Room(code string) (*Room, error) {
	normalized := normalizeCode(code)
	if normalized == "" {
		return nil, errRoomNotFound
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.rooms[normalized]
	if !ok {
		return nil, errRoomNotFound
	}
	return room, nil
}

// Drop removes a room, used when its last peer leaves.
func (h *Hub) Drop(code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, code)
}

// Rooms reports the current room count, for the health endpoint.
func (h *Hub) Rooms() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms)
}

// Run sweeps idle rooms until ctx is cancelled.
func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			h.sweep(now)
			h.rl.sweep(now)
		}
	}
}

func (h *Hub) sweep(now time.Time) {
	h.mu.Lock()
	stale := make([]*Room, 0)
	for code, room := range h.rooms {
		if now.Sub(room.idleSince()) < h.limits.RoomIdleTTL {
			continue
		}
		stale = append(stale, room)
		delete(h.rooms, code)
	}
	h.mu.Unlock()

	for _, room := range stale {
		room.Broadcast(errorMessage(errCodeNoRoom, "room expired after inactivity"))
		h.logf("relay: expired idle room %s (%d peers)", room.Code, room.size())
	}
}

func (h *Hub) logf(format string, args ...any) {
	if h.logger == nil {
		return
	}
	h.logger.Info(format, args...)
}
