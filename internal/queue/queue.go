package queue

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	ErrQueueItemNotFound = errors.New("queue item not found")
)

type PendingFile struct {
	ID        int
	Sender    string
	SenderIP  string
	Name      string
	Size      int64
	TempPath  string
	Timestamp time.Time
}

type PendingFolder struct {
	ID        int
	Sender    string
	SenderIP  string
	Name      string
	Size      int64
	TempPath  string
	Timestamp time.Time
}

type Manager struct {
	mu           sync.RWMutex
	files        map[int]*PendingFile
	folders      map[int]*PendingFolder
	nextFileID   int
	nextFolderID int
}

func NewManager() *Manager {
	return &Manager{
		files:        make(map[int]*PendingFile),
		folders:      make(map[int]*PendingFolder),
		nextFileID:   1,
		nextFolderID: 1,
	}
}

// AddFile adds a file to the pending queue and returns its ID.
func (m *Manager) AddFile(sender, senderIP, name string, size int64, tempPath string) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := m.nextFileID
	m.nextFileID++

	m.files[id] = &PendingFile{
		ID:        id,
		Sender:    sender,
		SenderIP:  senderIP,
		Name:      name,
		Size:      size,
		TempPath:  tempPath,
		Timestamp: time.Now(),
	}

	return id
}

// GetFile retrieves a pending file by ID.
func (m *Manager) GetFile(id int) (*PendingFile, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	file, exists := m.files[id]
	if !exists {
		return nil, ErrQueueItemNotFound
	}
	return file, nil
}

// RemoveFile removes a file from the queue. It optionally deletes the temporary file.
func (m *Manager) RemoveFile(id int, cleanupTemp bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	file, exists := m.files[id]
	if !exists {
		return ErrQueueItemNotFound
	}

	if cleanupTemp {
		_ = os.Remove(file.TempPath)
	}

	delete(m.files, id)
	return nil
}

// ListFiles returns all pending files.
func (m *Manager) ListFiles() []*PendingFile {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var files []*PendingFile
	for _, f := range m.files {
		files = append(files, f)
	}
	return files
}

// AddFolder adds a folder to the pending queue and returns its ID.
func (m *Manager) AddFolder(sender, senderIP, name string, size int64, tempPath string) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := m.nextFolderID
	m.nextFolderID++

	m.folders[id] = &PendingFolder{
		ID:        id,
		Sender:    sender,
		SenderIP:  senderIP,
		Name:      name,
		Size:      size,
		TempPath:  tempPath,
		Timestamp: time.Now(),
	}

	return id
}

// GetFolder retrieves a pending folder by ID.
func (m *Manager) GetFolder(id int) (*PendingFolder, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	folder, exists := m.folders[id]
	if !exists {
		return nil, ErrQueueItemNotFound
	}
	return folder, nil
}

// RemoveFolder removes a folder from the queue. It optionally deletes the temporary folder.
func (m *Manager) RemoveFolder(id int, cleanupTemp bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	folder, exists := m.folders[id]
	if !exists {
		return ErrQueueItemNotFound
	}

	if cleanupTemp {
		_ = os.RemoveAll(folder.TempPath)
	}

	delete(m.folders, id)
	return nil
}

// ListFolders returns all pending folders.
func (m *Manager) ListFolders() []*PendingFolder {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var folders []*PendingFolder
	for _, f := range m.folders {
		folders = append(folders, f)
	}
	return folders
}

// Flush clears all queues and removes all temporary files and folders.
func (m *Manager) Flush() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, f := range m.files {
		_ = os.Remove(f.TempPath)
		delete(m.files, id)
	}

	for id, f := range m.folders {
		_ = os.RemoveAll(f.TempPath)
		delete(m.folders, id)
	}
}

// MoveFile moves a temporary file to a target destination.
func MoveFile(src, dst string) error {
	// Ensure the destination directory exists
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	// Try renaming first
	err := os.Rename(src, dst)
	if err == nil {
		return nil
	}
	// If rename fails across volumes, read and write
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	err = os.WriteFile(dst, input, 0o644)
	if err != nil {
		return err
	}
	return os.Remove(src)
}

// UniquePath generates a distinct file path by appending a number if the file already exists.
func UniquePath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)

	for i := 1; ; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}
