package commands

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unicode"
)

// ansiPrefixPattern matches leading CSI sequences that may sneak into
// command input (e.g. the trailing cursor-position report after a paste).
var ansiPrefixPattern = regexp.MustCompile(`^(?:\x1b\[[0-9;?]*[A-Za-z])+`)

// sanitizeCommandInput strips leading ANSI escapes and control characters
// before the @command parser sees the line. Without this, a stray cursor
// report after a paste would cause "Commands must start with @" errors on
// otherwise valid input.
func sanitizeCommandInput(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}
	trimmed = ansiPrefixPattern.ReplaceAllString(trimmed, "")
	trimmed = strings.TrimLeftFunc(trimmed, func(r rune) bool {
		if unicode.IsSpace(r) {
			return true
		}
		return unicode.IsControl(r)
	})
	return trimmed
}

// splitMultiArgs splits the @multi argument into a target list and the
// trailing payload. Targets are comma-separated; the payload starts at the
// first whitespace that isn't part of the comma-separated target list.
func splitMultiArgs(input string) (string, string, bool) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return "", "", false
	}
	lastNonSpace := rune(0)
	for idx, r := range trimmed {
		if unicode.IsSpace(r) {
			if lastNonSpace != ',' {
				targets := strings.TrimSpace(trimmed[:idx])
				payload := strings.TrimSpace(trimmed[idx:])
				if targets == "" || payload == "" {
					return "", "", false
				}
				return targets, payload, true
			}
			continue
		}
		lastNonSpace = r
	}
	return "", "", false
}

// shellEscaped lists the characters a POSIX shell backslash-escapes when
// it completes a filename or when a file manager pastes a path. Only these
// are unescaped, so a backslash that is genuinely part of a filename
// survives unless the shell doubled it.
const shellEscaped = " \t'\"`$\\|&;()<>[]{}*?!~#^="

// unescapeShellPath removes the backslashes a shell adds around special
// characters, turning `Zari\'ah\ Ka.pdf` back into `Zari'ah Ka.pdf`.
//
// Skipped entirely on Windows, where a backslash is the path separator
// rather than an escape: unescaping there would turn C:\Users\bob into
// C:Usersbob. Windows shells quote paths instead, which the caller has
// already handled.
func unescapeShellPath(path string) string {
	if runtime.GOOS == "windows" || !strings.ContainsRune(path, '\\') {
		return path
	}
	var out strings.Builder
	out.Grow(len(path))
	for i := 0; i < len(path); i++ {
		if path[i] == '\\' && i+1 < len(path) && strings.IndexByte(shellEscaped, path[i+1]) >= 0 {
			i++
			out.WriteByte(path[i])
			continue
		}
		out.WriteByte(path[i])
	}
	return out.String()
}

// normalizePathArg turns a user-supplied path into an absolute, cleaned
// path. Supports ~ home expansion, ' or " quote stripping, shell escape
// removal, and resolves relative paths against the working directory.
//
// Dragging a file into a terminal, or tab-completing one, produces a path
// with every space and quote backslash-escaped. Those backslashes are not
// part of the filename, and leaving them in made os.Stat look for a file
// that does not exist and report the path as missing.
func normalizePathArg(input string) (string, error) {
	path := strings.TrimSpace(input)
	if path == "" {
		return "", errors.New("empty path")
	}

	// Quoted paths are already literal. A shell does not apply backslash
	// escaping inside them, so neither do we.
	quoted := false
	if len(path) >= 2 {
		if (path[0] == '"' && path[len(path)-1] == '"') || (path[0] == '\'' && path[len(path)-1] == '\'') {
			path = strings.TrimSpace(path[1 : len(path)-1])
			quoted = true
		}
	}
	if path == "" {
		return "", errors.New("empty path")
	}

	// Decided before unescaping so that an escaped \~ stays a literal
	// tilde rather than becoming the home directory.
	expandHome := path[0] == '~'

	if !quoted {
		path = unescapeShellPath(path)
	}
	if path == "" {
		return "", errors.New("empty path")
	}

	if expandHome {
		if len(path) > 1 && path[1] != '/' && path[1] != '\\' {
			return "", fmt.Errorf("unsupported home expansion for %s", path)
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		if path == "~" {
			path = home
		} else {
			cleaned := strings.TrimPrefix(path, "~")
			cleaned = strings.TrimPrefix(cleaned, "/")
			cleaned = strings.TrimPrefix(cleaned, "\\")
			path = filepath.Join(home, cleaned)
		}
	}
	if !filepath.IsAbs(path) {
		cwd, _ := os.Getwd()
		path = filepath.Join(cwd, path)
	}
	return filepath.Clean(path), nil
}
