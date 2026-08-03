package relay

import (
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestHubCreateAndLookupRoom(t *testing.T) {
	h := NewHub(DefaultLimits(), nil)
	room, err := h.CreateRoom("192.0.2.1")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	// A user retyping the code casually must still land in the room.
	found, err := h.Room(strings.ToLower(room.Code))
	if err != nil {
		t.Fatalf("Room: %v", err)
	}
	if found != room {
		t.Fatal("lookup returned a different room")
	}
	if _, err := h.Room("BBB-CCC"); !errors.Is(err, errRoomNotFound) {
		t.Fatalf("unknown code error = %v, want errRoomNotFound", err)
	}
}

func TestHubDropRemovesRoom(t *testing.T) {
	h := NewHub(DefaultLimits(), nil)
	room, err := h.CreateRoom("192.0.2.1")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	h.Drop(room.Code)
	if _, err := h.Room(room.Code); !errors.Is(err, errRoomNotFound) {
		t.Fatalf("after Drop, lookup error = %v, want errRoomNotFound", err)
	}
	if h.Rooms() != 0 {
		t.Fatalf("Rooms() = %d, want 0", h.Rooms())
	}
}

func TestRoomRejectsPeersBeyondLimit(t *testing.T) {
	limits := DefaultLimits()
	limits.MaxPeersPerRoom = 2
	h := NewHub(limits, nil)
	room, err := h.CreateRoom("192.0.2.1")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := room.Add(newPeer(strconv.Itoa(i), "peer", "")); err != nil {
			t.Fatalf("Add %d: %v", i, err)
		}
	}
	if err := room.Add(newPeer("overflow", "peer", "")); !errors.Is(err, errRoomFull) {
		t.Fatalf("third Add error = %v, want errRoomFull", err)
	}
}

func TestRoomRemoveReportsEmpty(t *testing.T) {
	room := newRoom("7K2-9QX", 8)
	a, b := newPeer("a", "A", ""), newPeer("b", "B", "")
	if err := room.Add(a); err != nil {
		t.Fatalf("Add a: %v", err)
	}
	if err := room.Add(b); err != nil {
		t.Fatalf("Add b: %v", err)
	}
	if empty := room.Remove("a"); empty {
		t.Fatal("room reported empty while one peer remains")
	}
	if empty := room.Remove("b"); !empty {
		t.Fatal("room did not report empty after last peer left")
	}
}

func TestRoomRosterReflectsMembers(t *testing.T) {
	room := newRoom("7K2-9QX", 8)
	if err := room.Add(newPeer("a", "Ada", "aa")); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := room.Add(newPeer("b", "Bo", "bb")); err != nil {
		t.Fatalf("Add: %v", err)
	}
	roster := room.Roster()
	if len(roster) != 2 {
		t.Fatalf("roster size = %d, want 2", len(roster))
	}
	names := map[string]string{}
	for _, p := range roster {
		names[p.ID] = p.Name
	}
	if names["a"] != "Ada" || names["b"] != "Bo" {
		t.Fatalf("roster = %+v, want Ada and Bo", roster)
	}
}

func TestHubSweepExpiresIdleRooms(t *testing.T) {
	limits := DefaultLimits()
	limits.RoomIdleTTL = time.Minute
	h := NewHub(limits, nil)
	room, err := h.CreateRoom("192.0.2.1")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	peer := newPeer("a", "Ada", "")
	if err := room.Add(peer); err != nil {
		t.Fatalf("Add: %v", err)
	}

	// Not yet idle enough.
	h.sweep(time.Now())
	if h.Rooms() != 1 {
		t.Fatalf("room expired early; Rooms() = %d, want 1", h.Rooms())
	}

	h.sweep(time.Now().Add(2 * time.Minute))
	if h.Rooms() != 0 {
		t.Fatalf("idle room survived sweep; Rooms() = %d, want 0", h.Rooms())
	}
	select {
	case msg := <-peer.send:
		if msg.Type != msgError || msg.ErrCode != errCodeNoRoom {
			t.Fatalf("expiry notice = %+v, want error/no_room", msg)
		}
	default:
		t.Fatal("peer was not told the room expired")
	}
}

func TestRoomTouchDefersExpiry(t *testing.T) {
	limits := DefaultLimits()
	limits.RoomIdleTTL = time.Minute
	h := NewHub(limits, nil)
	room, err := h.CreateRoom("192.0.2.1")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	later := time.Now().Add(2 * time.Minute)
	room.mu.Lock()
	room.lastActive = later
	room.mu.Unlock()

	h.sweep(later)
	if h.Rooms() != 1 {
		t.Fatalf("recently active room was swept; Rooms() = %d, want 1", h.Rooms())
	}
}

// A client that stops reading its socket must not be able to make the
// relay buffer for it indefinitely.
func TestPeerSendClosesSlowClient(t *testing.T) {
	p := newPeer("a", "Ada", "")
	for i := 0; i < peerSendBuffer; i++ {
		p.Send(&serverMessage{Type: msgRoster})
	}
	select {
	case <-p.closed:
		t.Fatal("peer closed before its buffer was full")
	default:
	}
	p.Send(&serverMessage{Type: msgRoster})
	select {
	case <-p.closed:
	default:
		t.Fatal("peer was not closed after overflowing its send buffer")
	}
}

func TestPeerCloseIsIdempotent(t *testing.T) {
	p := newPeer("a", "Ada", "")
	p.Close()
	p.Close()
	select {
	case <-p.closed:
	default:
		t.Fatal("peer not closed")
	}
}

func TestRateLimiterWindow(t *testing.T) {
	rl := newRateLimiter(3)
	now := time.Now()
	for i := 0; i < 3; i++ {
		if !rl.allow("192.0.2.1", now) {
			t.Fatalf("request %d denied inside the limit", i)
		}
	}
	if rl.allow("192.0.2.1", now) {
		t.Fatal("fourth request allowed past the limit")
	}
	// A different source has its own budget.
	if !rl.allow("192.0.2.2", now) {
		t.Fatal("unrelated address was rate limited")
	}
	// The window rolls over.
	if !rl.allow("192.0.2.1", now.Add(time.Minute)) {
		t.Fatal("request denied after the window rolled over")
	}
}

func TestRateLimiterSweepDropsStaleWindows(t *testing.T) {
	rl := newRateLimiter(3)
	now := time.Now()
	rl.allow("192.0.2.1", now)
	rl.sweep(now.Add(3 * time.Minute))
	rl.mu.Lock()
	remaining := len(rl.windows)
	rl.mu.Unlock()
	if remaining != 0 {
		t.Fatalf("stale windows remaining = %d, want 0", remaining)
	}
}

func TestHubCreateRoomRateLimited(t *testing.T) {
	limits := DefaultLimits()
	limits.CreatePerIPPerMin = 2
	h := NewHub(limits, nil)
	for i := 0; i < 2; i++ {
		if _, err := h.CreateRoom("192.0.2.1"); err != nil {
			t.Fatalf("CreateRoom %d: %v", i, err)
		}
	}
	if _, err := h.CreateRoom("192.0.2.1"); !errors.Is(err, errRateLimited) {
		t.Fatalf("third CreateRoom error = %v, want errRateLimited", err)
	}
}

func TestHubCapacity(t *testing.T) {
	limits := DefaultLimits()
	limits.MaxRooms = 1
	h := NewHub(limits, nil)
	if _, err := h.CreateRoom("192.0.2.1"); err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	if _, err := h.CreateRoom("192.0.2.2"); !errors.Is(err, errAtCapacity) {
		t.Fatalf("second CreateRoom error = %v, want errAtCapacity", err)
	}
}

func TestSanitizeName(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"plain", "Ada", "Ada"},
		{"trims", "  Ada  ", "Ada"},
		{"strips control characters", "Ada\x1b[31m", "Ada[31m"},
		{"strips newlines", "Ada\nLovelace", "AdaLovelace"},
		{"empty", "   ", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := sanitizeName(tc.in); got != tc.want {
				t.Errorf("sanitizeName(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
	long := make([]rune, maxNameLen+50)
	for i := range long {
		long[i] = 'x'
	}
	if got := sanitizeName(string(long)); len([]rune(got)) != maxNameLen {
		t.Errorf("long name length = %d, want %d", len([]rune(got)), maxNameLen)
	}
}

func TestCodeForError(t *testing.T) {
	tests := []struct {
		err  error
		want string
	}{
		{errRoomNotFound, errCodeNoRoom},
		{errRoomFull, errCodeRoomFull},
		{errPeerNotFound, errCodeNoPeer},
		{errRateLimited, errCodeRateLimited},
		{errAtCapacity, errCodeCapacity},
		{errAlreadyInRoom, errCodeAlreadyInRoom},
		{errNotInRoom, errCodeNotInRoom},
		{errors.New("something else"), errCodeBadRequest},
	}
	for _, tc := range tests {
		if got := codeForError(tc.err); got != tc.want {
			t.Errorf("codeForError(%v) = %q, want %q", tc.err, got, tc.want)
		}
	}
}
