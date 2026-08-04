package commands

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// Dragging a file into a terminal, or tab-completing one, escapes every
// space and quote. Those backslashes are not part of the filename, and
// leaving them in sent os.Stat looking for a file that does not exist.
func TestNormalizePathArgUnescapesShellEscapes(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("backslash is a path separator on Windows, not an escape")
	}
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			// The path from the original report.
			name: "spaces and an apostrophe",
			in:   `/Users/x/Downloads/Aayat\ al-Kursi\ Hifazat\ Ka\ Zari\'ah.pdf`,
			want: "/Users/x/Downloads/Aayat al-Kursi Hifazat Ka Zari'ah.pdf",
		},
		{name: "escaped spaces", in: `/tmp/my\ file.txt`, want: "/tmp/my file.txt"},
		{name: "double quote", in: `/tmp/say\"hi\".txt`, want: `/tmp/say"hi".txt`},
		{name: "parentheses", in: `/tmp/track\ \(1\).mp3`, want: "/tmp/track (1).mp3"},
		{name: "square brackets", in: `/tmp/log\[2026\].txt`, want: "/tmp/log[2026].txt"},
		{name: "braces", in: `/tmp/set\{a,b\}.txt`, want: "/tmp/set{a,b}.txt"},
		{name: "ampersand", in: `/tmp/rock\ \&\ roll.mp3`, want: "/tmp/rock & roll.mp3"},
		{name: "dollar and backtick", in: `/tmp/\$var\ \` + "`" + `cmd\` + "`" + `.txt`, want: "/tmp/$var `cmd`.txt"},
		{name: "semicolon and pipe", in: `/tmp/a\;b\|c.txt`, want: "/tmp/a;b|c.txt"},
		{name: "glob characters", in: `/tmp/all\*\?.txt`, want: "/tmp/all*?.txt"},
		{
			// A doubled backslash is one literal backslash in the name.
			name: "escaped backslash",
			in:   `/tmp/back\\slash.txt`,
			want: `/tmp/back\slash.txt`,
		},
		{
			// Nothing to unescape; must survive untouched.
			name: "plain path",
			in:   "/tmp/ordinary.txt",
			want: "/tmp/ordinary.txt",
		},
		{
			name: "relative path resolves against cwd",
			in:   `docs/my\ notes.md`,
			want: filepath.Join(cwd, "docs/my notes.md"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizePathArg(tc.in)
			if err != nil {
				t.Fatalf("normalizePathArg(%q) errored: %v", tc.in, err)
			}
			if got != tc.want {
				t.Errorf("normalizePathArg(%q)\n got %q\nwant %q", tc.in, got, tc.want)
			}
		})
	}
}

// A quoted path is already literal: the shell does not apply backslash
// escaping inside quotes, so neither should we.
func TestNormalizePathArgLeavesQuotedContentAlone(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("quoting behaves differently on Windows shells")
	}
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "double quoted with spaces", in: `"/tmp/my file.txt"`, want: "/tmp/my file.txt"},
		{name: "single quoted with spaces", in: `'/tmp/my file.txt'`, want: "/tmp/my file.txt"},
		{
			// Backslashes inside quotes belong to the filename.
			name: "quoted backslash is literal",
			in:   `"/tmp/back\slash.txt"`,
			want: `/tmp/back\slash.txt`,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizePathArg(tc.in)
			if err != nil {
				t.Fatalf("normalizePathArg(%q) errored: %v", tc.in, err)
			}
			if got != tc.want {
				t.Errorf("normalizePathArg(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestNormalizePathArgHomeExpansion(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory available: %v", err)
	}

	got, err := normalizePathArg("~")
	if err != nil {
		t.Fatalf("normalizePathArg(~): %v", err)
	}
	if got != filepath.Clean(home) {
		t.Errorf("~ expanded to %q, want %q", got, home)
	}

	if runtime.GOOS == "windows" {
		return
	}

	// Home expansion and unescaping have to cooperate.
	got, err = normalizePathArg(`~/My\ Documents/a\ b.txt`)
	if err != nil {
		t.Fatalf("normalizePathArg: %v", err)
	}
	want := filepath.Join(home, "My Documents/a b.txt")
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}

	// An escaped tilde is a filename, not the home directory.
	got, err = normalizePathArg(`\~notes.txt`)
	if err != nil {
		t.Fatalf("normalizePathArg: %v", err)
	}
	if strings.HasPrefix(got, home+string(filepath.Separator)+"notes.txt") {
		t.Errorf("escaped tilde was expanded to %q", got)
	}
	if filepath.Base(got) != "~notes.txt" {
		t.Errorf("base = %q, want ~notes.txt", filepath.Base(got))
	}
}

func TestNormalizePathArgRejectsEmpty(t *testing.T) {
	for _, in := range []string{"", "   ", `""`, `''`} {
		if _, err := normalizePathArg(in); err == nil {
			t.Errorf("normalizePathArg(%q) accepted an empty path", in)
		}
	}
}

func TestNormalizePathArgRejectsOtherUserHome(t *testing.T) {
	if _, err := normalizePathArg("~someoneelse/file.txt"); err == nil {
		t.Error("expected ~user expansion to be rejected")
	}
}

// The escaped path must resolve to a file that genuinely exists, which is
// the whole point: os.Stat was failing on the literal backslashes.
func TestNormalizePathArgResolvesRealFileWithSpaces(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("backslash escaping is POSIX shell behaviour")
	}
	dir := t.TempDir()
	name := "Aayat al-Kursi Hifazat Ka Zari'ah.pdf"
	full := filepath.Join(dir, name)
	if err := os.WriteFile(full, []byte("test"), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	escaped := filepath.Join(dir, `Aayat\ al-Kursi\ Hifazat\ Ka\ Zari\'ah.pdf`)
	got, err := normalizePathArg(escaped)
	if err != nil {
		t.Fatalf("normalizePathArg: %v", err)
	}
	if _, err := os.Stat(got); err != nil {
		t.Fatalf("resolved path does not exist: %v (got %q)", err, got)
	}
}

// Windows uses backslash as its separator, so unescaping there would
// destroy every absolute path.
func TestUnescapeShellPathLeavesWindowsSeparatorsAlone(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("only meaningful on Windows")
	}
	const in = `C:\Users\bob\Documents\file.txt`
	if got := unescapeShellPath(in); got != in {
		t.Errorf("unescapeShellPath(%q) = %q, want it unchanged", in, got)
	}
}
