package commands

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
)

func TestWizardNotifyStripsColourAndKeepsTheLatest(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	for i := 1; i <= wizardNoticeCap+2; i++ {
		WizardNotify(fmt.Sprintf("\x1b[36m[15:04:0%d] Message from ada:\x1b[0m line %d", i, i))
	}

	notices := recentWizardNotices()
	if len(notices) != wizardNoticeCap {
		t.Fatalf("kept %d notices, want %d", len(notices), wizardNoticeCap)
	}

	// The oldest are the ones dropped: somebody glancing at the wizard
	// wants what just arrived, not what arrived first.
	if !strings.HasSuffix(notices[len(notices)-1].text, fmt.Sprintf("line %d", wizardNoticeCap+2)) {
		t.Fatalf("newest notice = %q, want it to end with the last line sent", notices[len(notices)-1].text)
	}
	for _, notice := range notices {
		if strings.Contains(notice.text, "\x1b[") {
			t.Fatalf("notice kept an escape sequence: %q", notice.text)
		}
	}
}

func TestWizardNotifyIgnoresBlankLines(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	// writeResult emits a trailing blank line after every result, and a
	// blank entry would render as a gap in the notice block.
	WizardNotify("")
	WizardNotify("   ")
	WizardNotify("\x1b[0m\x1b[36m\x1b[0m")

	if got := recentWizardNotices(); len(got) != 0 {
		t.Fatalf("blank lines produced %d notices, want 0: %#v", len(got), got)
	}
}

func TestWizardNotifyIsSafeWithoutARunningProgram(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	// The event goroutine calls this between forms, when no bubbletea
	// program is registered. It has to store the line rather than panic.
	wizardProgMu.Lock()
	wizardProg = nil
	wizardProgMu.Unlock()

	WizardNotify("[15:04:05] Message from ada: still here?")

	if got := recentWizardNotices(); len(got) != 1 {
		t.Fatalf("stored %d notices, want 1", len(got))
	}
}

func TestWizardNotifyIsConcurrencySafe(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			WizardNotify(fmt.Sprintf("[15:04:05] Message from peer%d: hello", n))
			_ = recentWizardNotices()
		}(i)
	}
	wg.Wait()

	if got := len(recentWizardNotices()); got != wizardNoticeCap {
		t.Fatalf("kept %d notices, want %d", got, wizardNoticeCap)
	}
}

func TestWizardNoticeBlockRendersEveryNotice(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	WizardNotify("[15:04:05] Message from ada: first")
	WizardNotify("[15:04:06] Message from lin: second")

	block := wizardNoticeBlock(recentWizardNotices(), wizardMenuMinWidth)

	for _, want := range []string{"While you were here", "ada: first", "lin: second"} {
		if !strings.Contains(block, want) {
			t.Fatalf("notice block missing %q:\n%s", want, block)
		}
	}
}

func TestWizardNoticeBlockStampsOnlyUnstampedLines(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	// The UI's own event lines already start with a time. A second stamp
	// in front of the first would read as two different timestamps for one
	// event.
	WizardNotify("[15:04:05] Message from ada: already stamped")
	stamped := wizardNoticeBlock(recentWizardNotices(), wizardMenuMinWidth)
	if strings.Count(stamped, "[15:04:05]") != 1 {
		t.Fatalf("stamped line was stamped again:\n%s", stamped)
	}

	clearWizardNotices()
	WizardNotify("a bare line from somewhere else")
	bare := wizardNoticeBlock(recentWizardNotices(), wizardMenuMinWidth)
	if !strings.Contains(bare, "bare line") {
		t.Fatalf("bare line missing from block:\n%s", bare)
	}
	if strings.Count(bare, ":") < 2 {
		t.Fatalf("bare line was not given a timestamp:\n%s", bare)
	}
}

func TestWizardMultiSentNoticeSeparatesDeliveryFromOffer(t *testing.T) {
	cases := []struct {
		name       string
		kind       string
		path       string
		recipients int
		want       string
	}{
		{
			name:       "a message is delivered",
			kind:       "message",
			recipients: 3,
			want:       "✓ Message sent to 3 recipients.",
		},
		{
			name:       "one recipient reads as singular",
			kind:       "message",
			recipients: 1,
			want:       "✓ Message sent to 1 recipient.",
		},
		{
			name:       "a file is only offered",
			kind:       "file",
			path:       "/tmp/report.pdf",
			recipients: 2,
			want:       "✓ File report.pdf offered to 2 recipients. Waiting for them to accept.",
		},
		{
			name:       "a folder is only offered",
			kind:       "folder",
			path:       "/tmp/photos",
			recipients: 1,
			want:       "✓ Folder photos offered to 1 recipient. Waiting for them to accept.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := wizardMultiSentNotice(tc.kind, tc.path, tc.recipients); got != tc.want {
				t.Fatalf("notice = %q, want %q", got, tc.want)
			}
		})
	}
}

// TestWizardNoticeReachesARunningProgram drives the real path: a line
// arrives on the event goroutine while a bubbletea program is drawing a
// form, and has to appear in what that program renders. This is the part
// worth testing for real rather than in pieces, because it crosses a
// goroutine boundary into a running program's message loop.
func TestWizardNoticeReachesARunningProgram(t *testing.T) {
	clearWizardNotices()
	t.Cleanup(clearWizardNotices)

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("Bonjou Wizard").
				Options(huh.NewOption("Send message", "message")).
				Value(new(string)),
		),
	)
	form.SubmitCmd = tea.Quit

	var out bytes.Buffer
	prog := tea.NewProgram(
		&altScreenClearModel{inner: form, width: wizardMenuMinWidth},
		tea.WithInput(bytes.NewReader(nil)),
		tea.WithOutput(&out),
	)

	wizardProgMu.Lock()
	wizardProg = prog
	wizardProgMu.Unlock()
	t.Cleanup(func() {
		wizardProgMu.Lock()
		wizardProg = nil
		wizardProgMu.Unlock()
	})

	done := make(chan error, 1)
	go func() { _, err := prog.Run(); done <- err }()

	// From another goroutine, exactly as the UI's event loop does it.
	go func() {
		time.Sleep(120 * time.Millisecond)
		WizardNotify("\x1b[36m[15:04:05] Message from ada:\x1b[0m are you there?")
		time.Sleep(220 * time.Millisecond)
		prog.Quit()
	}()

	select {
	case err := <-done:
		if err != nil && !errors.Is(err, tea.ErrProgramKilled) {
			t.Fatalf("program: %v", err)
		}
	case <-time.After(5 * time.Second):
		prog.Kill()
		t.Fatal("program did not finish")
	}

	// The notice is wrapped to the render width, so collapse the frame's
	// line breaks and padding before looking for the text in it.
	rendered := out.String()
	flat := strings.Join(strings.Fields(rendered), " ")

	if !strings.Contains(flat, "While you were here") {
		t.Fatalf("notice heading never rendered:\n%q", rendered)
	}
	if !strings.Contains(flat, "Message from ada: are you there?") {
		t.Fatalf("notice text never rendered:\n%q", rendered)
	}
	if !strings.Contains(flat, "Bonjou Wizard") {
		t.Fatalf("the form stopped rendering once a notice arrived:\n%q", rendered)
	}
}
