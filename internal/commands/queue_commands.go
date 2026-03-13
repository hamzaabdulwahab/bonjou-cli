package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/hamzawahab/bonjou-cli/internal/queue"
)

func (h *Handler) cmdFileQueue() (Result, error) {
	files := h.session.Queue.ListFiles()
	if len(files) == 0 {
		return Result{Output: "File queue is empty."}, nil
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].ID < files[j].ID
	})

	var sb strings.Builder
	sb.WriteString("\033[36mPending Single Files:\033[0m\n")
	for _, f := range files {
		sb.WriteString(fmt.Sprintf("  [%d] %s (from: %s, size: %s)\n", f.ID, f.Name, f.Sender, formatSize(f.Size)))
	}
	sb.WriteString("\nUse @approveFile <ID> or @rejectFile <ID>")
	return Result{Output: sb.String()}, nil
}

func (h *Handler) cmdApproveFile(args string) (Result, error) {
	indices, err := parseCommaIndices(args)
	if err != nil || len(indices) == 0 {
		return Result{Output: "Usage: @approveFile <Queue_ID> [nested]"}, nil
	}

	queueID := indices[0]
	// If it's a nested approval, route to nested folder approve logic
	if len(indices) > 1 {
		return h.approveNestedFile(queueID, indices[1:])
	}

	f, err := h.session.Queue.GetFile(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	destPath := queue.UniquePath(filepath.Join(h.session.Config.ReceivedFilesDir, f.Name))
	if err := queue.MoveFile(f.TempPath, destPath); err != nil {
		return Result{}, err
	}

	_ = h.session.Queue.RemoveFile(queueID, false)
	return Result{Output: fmt.Sprintf("Approved file '%s'. Saved to %s", f.Name, destPath)}, nil
}

func (h *Handler) cmdRejectFile(args string) (Result, error) {
	indices, err := parseCommaIndices(args)
	if err != nil || len(indices) == 0 {
		return Result{Output: "Usage: @rejectFile <Queue_ID> [nested]"}, nil
	}

	queueID := indices[0]
	// If it's a nested rejection, route to nested folder reject logic
	if len(indices) > 1 {
		return h.rejectNestedFile(queueID, indices[1:])
	}

	f, err := h.session.Queue.GetFile(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	_ = h.session.Queue.RemoveFile(queueID, true)
	return Result{Output: fmt.Sprintf("Rejected file '%s'.", f.Name)}, nil
}

func (h *Handler) cmdApproveFileQueue() (Result, error) {
	files := h.session.Queue.ListFiles()
	if len(files) == 0 {
		return Result{Output: "File queue is empty."}, nil
	}

	count := 0
	for _, f := range files {
		destPath := queue.UniquePath(filepath.Join(h.session.Config.ReceivedFilesDir, f.Name))
		if err := queue.MoveFile(f.TempPath, destPath); err == nil {
			_ = h.session.Queue.RemoveFile(f.ID, false)
			count++
		}
	}
	return Result{Output: fmt.Sprintf("Approved %d files.", count)}, nil
}

func (h *Handler) cmdRejectFileQueue() (Result, error) {
	files := h.session.Queue.ListFiles()
	if len(files) == 0 {
		return Result{Output: "File queue is empty."}, nil
	}

	count := len(files)
	for _, f := range files {
		_ = h.session.Queue.RemoveFile(f.ID, true)
	}
	return Result{Output: fmt.Sprintf("Rejected %d files.", count)}, nil
}

func (h *Handler) cmdFolderQueue() (Result, error) {
	folders := h.session.Queue.ListFolders()
	if len(folders) == 0 {
		return Result{Output: "Folder queue is empty."}, nil
	}

	sort.Slice(folders, func(i, j int) bool {
		return folders[i].ID < folders[j].ID
	})

	var sb strings.Builder
	sb.WriteString("\033[36mPending Folders:\033[0m\n")
	for _, f := range folders {
		sb.WriteString(fmt.Sprintf("  [%d] %s/ (from: %s, total size: %s)\n", f.ID, f.Name, f.Sender, formatSize(f.Size)))
	}
	sb.WriteString("\nUse @viewFolder <ID> or @approveFolder <ID> or @rejectFolder <ID>")
	return Result{Output: sb.String()}, nil
}

func (h *Handler) cmdApproveFolder(args string) (Result, error) {
	idStr := strings.TrimSpace(args)
	queueID, err := strconv.Atoi(idStr)
	if err != nil {
		return Result{Output: "Usage: @approveFolder <Folder_Queue_ID>"}, nil
	}

	f, err := h.session.Queue.GetFolder(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	destPath := queue.UniquePath(filepath.Join(h.session.Config.ReceivedFoldersDir, f.Name))
	if err := queue.MoveFile(f.TempPath, destPath); err != nil {
		return Result{}, err
	}

	_ = h.session.Queue.RemoveFolder(queueID, false)
	return Result{Output: fmt.Sprintf("Approved folder '%s'. Saved to %s", f.Name, destPath)}, nil
}

func (h *Handler) cmdRejectFolder(args string) (Result, error) {
	idStr := strings.TrimSpace(args)
	queueID, err := strconv.Atoi(idStr)
	if err != nil {
		return Result{Output: "Usage: @rejectFolder <Folder_Queue_ID>"}, nil
	}

	f, err := h.session.Queue.GetFolder(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	_ = h.session.Queue.RemoveFolder(queueID, true)
	return Result{Output: fmt.Sprintf("Rejected folder '%s'.", f.Name)}, nil
}

func (h *Handler) cmdApproveFolderQueue() (Result, error) {
	folders := h.session.Queue.ListFolders()
	if len(folders) == 0 {
		return Result{Output: "Folder queue is empty."}, nil
	}

	count := 0
	for _, f := range folders {
		destPath := queue.UniquePath(filepath.Join(h.session.Config.ReceivedFoldersDir, f.Name))
		if err := queue.MoveFile(f.TempPath, destPath); err == nil {
			_ = h.session.Queue.RemoveFolder(f.ID, false)
			count++
		}
	}
	return Result{Output: fmt.Sprintf("Approved %d folders.", count)}, nil
}

func (h *Handler) cmdRejectFolderQueue() (Result, error) {
	folders := h.session.Queue.ListFolders()
	if len(folders) == 0 {
		return Result{Output: "Folder queue is empty."}, nil
	}

	count := len(folders)
	for _, f := range folders {
		_ = h.session.Queue.RemoveFolder(f.ID, true)
	}
	return Result{Output: fmt.Sprintf("Rejected %d folders.", count)}, nil
}

func (h *Handler) cmdViewFolder(args string) (Result, error) {
	indices, err := parseCommaIndices(args)
	if err != nil || len(indices) == 0 {
		return Result{Output: "Usage: @viewFolder <Folder_Queue_ID> [, <Nested_ID>...]"}, nil
	}

	queueID := indices[0]
	f, err := h.session.Queue.GetFolder(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	targetDir := f.TempPath
	if len(indices) > 1 {
		resolved, isDir, err := resolveNestedPath(targetDir, indices[1:])
		if err != nil {
			return Result{Output: fmt.Sprintf("Error resolving path: %v", err)}, nil
		}
		if !isDir {
			return Result{Output: "Target is a file, not a folder."}, nil
		}
		targetDir = resolved
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return Result{}, err
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() != entries[j].IsDir() {
			return entries[i].IsDir()
		}
		return strings.ToLower(entries[i].Name()) < strings.ToLower(entries[j].Name())
	})

	var sb strings.Builder
	rel, _ := filepath.Rel(f.TempPath, targetDir)
	if rel == "." {
		sb.WriteString(fmt.Sprintf("\033[36mContents of Folder Queue [%d] '%s/':\033[0m\n", queueID, f.Name))
	} else {
		sb.WriteString(fmt.Sprintf("\033[36mContents of Folder Queue [%d] '%s/%s/':\033[0m\n", queueID, f.Name, filepath.ToSlash(rel)))
	}

	if len(entries) == 0 {
		sb.WriteString("  (empty)")
		return Result{Output: sb.String()}, nil
	}

	for i, entry := range entries {
		if entry.IsDir() {
			sb.WriteString(fmt.Sprintf("  %d. %s/ (nested folder)\n", i+1, entry.Name()))
		} else {
			info, _ := entry.Info()
			sizeStr := "unknown"
			if info != nil {
				sizeStr = formatSize(info.Size())
			}
			sb.WriteString(fmt.Sprintf("  %d. %s (%s)\n", i+1, entry.Name(), sizeStr))
		}
	}
	return Result{Output: strings.TrimRight(sb.String(), "\n")}, nil
}

func (h *Handler) approveNestedFile(queueID int, nestedIndices []int) (Result, error) {
	f, err := h.session.Queue.GetFolder(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	resolved, isDir, err := resolveNestedPath(f.TempPath, nestedIndices)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error resolving path: %v", err)}, nil
	}
	if isDir {
		return Result{Output: "Target is a folder. Use @approveFolder to approve a whole folder queue item."}, nil
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return Result{}, err
	}

	// Figure out relative path to reconstruct inside ReceivedFoldersDir/FolderName/
	rel, err := filepath.Rel(f.TempPath, resolved)
	if err != nil {
		return Result{}, err
	}

	destPath := filepath.Join(h.session.Config.ReceivedFoldersDir, f.Name, rel)
	// Don't use UniquePath here blindly, but we should make sure the directory structure exists
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return Result{}, err
	}
	destPath = queue.UniquePath(destPath)

	// Since we are approving just ONE file from a pending folder, we should COPY or MOVE it.
	// We'll move it out of the pending folder entirely so it isn't approved again.
	if err := queue.MoveFile(resolved, destPath); err != nil {
		return Result{}, err
	}

	return Result{Output: fmt.Sprintf("Approved nested file '%s'. Saved to %s", info.Name(), destPath)}, nil
}

func (h *Handler) rejectNestedFile(queueID int, nestedIndices []int) (Result, error) {
	f, err := h.session.Queue.GetFolder(queueID)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error: %v", err)}, nil
	}

	resolved, isDir, err := resolveNestedPath(f.TempPath, nestedIndices)
	if err != nil {
		return Result{Output: fmt.Sprintf("Error resolving path: %v", err)}, nil
	}
	if isDir {
		return Result{Output: "Target is a folder. Rejecting nested folders is not supported yet. Reject the main folder or individual files."}, nil
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return Result{}, err
	}

	if err := os.Remove(resolved); err != nil {
		return Result{}, err
	}

	return Result{Output: fmt.Sprintf("Rejected nested file '%s'.", info.Name())}, nil
}

func resolveNestedPath(baseDir string, indices []int) (string, bool, error) {
	currentDir := baseDir
	isDir := true

	for i, targetIdx := range indices {
		if !isDir {
			return "", false, fmt.Errorf("index path transversed through a file")
		}

		entries, err := os.ReadDir(currentDir)
		if err != nil {
			return "", false, err
		}

		sort.Slice(entries, func(i, j int) bool {
			if entries[i].IsDir() != entries[j].IsDir() {
				return entries[i].IsDir()
			}
			return strings.ToLower(entries[i].Name()) < strings.ToLower(entries[j].Name())
		})

		idx := targetIdx - 1
		if idx < 0 || idx >= len(entries) {
			return "", false, fmt.Errorf("invalid index %d at depth %d", targetIdx, i+1)
		}

		entry := entries[idx]
		currentDir = filepath.Join(currentDir, entry.Name())
		isDir = entry.IsDir()
	}

	return currentDir, isDir, nil
}

func parseCommaIndices(args string) ([]int, error) {
	parts := strings.Split(args, ",")
	var indices []int
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed == "" {
			continue
		}
		val, err := strconv.Atoi(trimmed)
		if err != nil {
			return nil, err
		}
		indices = append(indices, val)
	}
	return indices, nil
}

func formatSize(size int64) string {
	const unit = 1000
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}
