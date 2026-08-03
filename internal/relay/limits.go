package relay

import (
	"sync"
	"time"
)

// Limits bounds what a single client, or the internet at large, can make
// the relay do. Every field has a defensive default; zero values are
// replaced by DefaultLimits at construction.
type Limits struct {
	// MaxRooms caps concurrent rooms process-wide.
	MaxRooms int
	// MaxPeersPerRoom caps roster size. Small on purpose: a share room is
	// two or three devices, not a chat channel.
	MaxPeersPerRoom int
	// RoomIdleTTL is how long a room survives with no traffic.
	RoomIdleTTL time.Duration
	// CreatePerIPPerMin throttles room creation per source address.
	CreatePerIPPerMin int
	// MaxTransferBytes caps one transfer. Mirrors the CLI's
	// max_incoming_bytes default so both halves of the product agree on
	// what "too big" means.
	MaxTransferBytes int64
	// MaxChunkBytes caps one uploaded chunk, bounding the memory a
	// malicious sender can make a single request occupy.
	MaxChunkBytes int64
	// RendezvousWait is how long one half of a transfer waits for its
	// counterpart to attach before giving up.
	RendezvousWait time.Duration
	// TransferIdleTTL fails a transfer that stops making progress.
	TransferIdleTTL time.Duration
	// MaxConcurrentTransfers caps in-flight transfers process-wide.
	MaxConcurrentTransfers int
}

// DefaultLimits returns production defaults sized for a 4-core, 24 GB box.
func DefaultLimits() Limits {
	return Limits{
		MaxRooms:               5000,
		MaxPeersPerRoom:        8,
		RoomIdleTTL:            30 * time.Minute,
		CreatePerIPPerMin:      20,
		MaxTransferBytes:       16 << 30, // 16 GiB, matching config.MaxIncomingBytes
		MaxChunkBytes:          32 << 20, // 32 MiB, 4x the client's 8 MiB target
		RendezvousWait:         30 * time.Second,
		TransferIdleTTL:        60 * time.Second,
		MaxConcurrentTransfers: 256,
	}
}

func (l Limits) withDefaults() Limits {
	d := DefaultLimits()
	if l.MaxRooms <= 0 {
		l.MaxRooms = d.MaxRooms
	}
	if l.MaxPeersPerRoom <= 0 {
		l.MaxPeersPerRoom = d.MaxPeersPerRoom
	}
	if l.RoomIdleTTL <= 0 {
		l.RoomIdleTTL = d.RoomIdleTTL
	}
	if l.CreatePerIPPerMin <= 0 {
		l.CreatePerIPPerMin = d.CreatePerIPPerMin
	}
	if l.MaxTransferBytes <= 0 {
		l.MaxTransferBytes = d.MaxTransferBytes
	}
	if l.MaxChunkBytes <= 0 {
		l.MaxChunkBytes = d.MaxChunkBytes
	}
	if l.RendezvousWait <= 0 {
		l.RendezvousWait = d.RendezvousWait
	}
	if l.TransferIdleTTL <= 0 {
		l.TransferIdleTTL = d.TransferIdleTTL
	}
	if l.MaxConcurrentTransfers <= 0 {
		l.MaxConcurrentTransfers = d.MaxConcurrentTransfers
	}
	return l
}

// rateLimiter is a fixed-window counter keyed by source address. A fixed
// window is coarser than a token bucket at the boundary, but the thing it
// guards — room creation — is cheap enough that burst precision does not
// matter, and the simpler structure has less to get wrong.
type rateLimiter struct {
	mu      sync.Mutex
	perMin  int
	windows map[string]*rateWindow
}

type rateWindow struct {
	count int
	start time.Time
}

func newRateLimiter(perMin int) *rateLimiter {
	return &rateLimiter{perMin: perMin, windows: make(map[string]*rateWindow)}
}

// allow reports whether key may perform another action now.
func (rl *rateLimiter) allow(key string, now time.Time) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	w, ok := rl.windows[key]
	if !ok || now.Sub(w.start) >= time.Minute {
		rl.windows[key] = &rateWindow{count: 1, start: now}
		return true
	}
	if w.count >= rl.perMin {
		return false
	}
	w.count++
	return true
}

// sweep drops windows that have aged out, so the map cannot grow without
// bound as source addresses churn.
func (rl *rateLimiter) sweep(now time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for key, w := range rl.windows {
		if now.Sub(w.start) >= 2*time.Minute {
			delete(rl.windows, key)
		}
	}
}
