package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	_ "golang.org/x/image/webp"
)

const imageWorkspaceDirName = "image-workspace"

type ImageWorkspaceStorage struct {
	baseDir string
}

type StoredImageFile struct {
	RelativePath string
	MIMEType     string
	SizeBytes    int64
	SHA256       string
	Width        int
	Height       int
}

func NewImageWorkspaceStorage(dataDir string) *ImageWorkspaceStorage {
	return &ImageWorkspaceStorage{baseDir: filepath.Join(dataDir, imageWorkspaceDirName)}
}

func (s *ImageWorkspaceStorage) SaveDataURL(userID, projectID, versionID int64, raw string, suffix string) (*StoredImageFile, error) {
	mimeType, data, err := decodeImageWorkspaceDataURL(raw)
	if err != nil {
		return nil, err
	}
	return s.SaveBytes(userID, projectID, versionID, data, mimeType, suffix)
}

func (s *ImageWorkspaceStorage) SaveBytes(userID, projectID, versionID int64, data []byte, mimeType, suffix string) (*StoredImageFile, error) {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	ext, ok := imageWorkspaceExtByMIME(mimeType)
	if !ok {
		return nil, fmt.Errorf("unsupported image mime type: %s", mimeType)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("image data is empty")
	}
	width, height, err := decodeImageWorkspaceDimensions(data)
	if err != nil {
		return nil, err
	}

	dir := filepath.Join(s.baseDir, fmt.Sprint(userID), fmt.Sprint(projectID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	name := fmt.Sprintf("%d%s%s", versionID, suffix, ext)
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0644); err != nil {
		return nil, err
	}

	sum := sha256.Sum256(data)
	rel := filepath.ToSlash(filepath.Join(imageWorkspaceDirName, fmt.Sprint(userID), fmt.Sprint(projectID), name))
	return &StoredImageFile{
		RelativePath: rel,
		MIMEType:     mimeType,
		SizeBytes:    int64(len(data)),
		SHA256:       hex.EncodeToString(sum[:]),
		Width:        width,
		Height:       height,
	}, nil
}

func (s *ImageWorkspaceStorage) Open(relativePath string) (*os.File, string, error) {
	path, err := s.resolve(relativePath)
	if err != nil {
		return nil, "", err
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, "", err
	}
	header := make([]byte, 512)
	n, readErr := file.Read(header)
	if readErr != nil && readErr != io.EOF {
		_ = file.Close()
		return nil, "", readErr
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		_ = file.Close()
		return nil, "", err
	}
	mimeType := http.DetectContentType(header[:n])
	if _, ok := imageWorkspaceExtByMIME(mimeType); !ok {
		_ = file.Close()
		return nil, "", fmt.Errorf("unsupported stored image mime type: %s", mimeType)
	}
	return file, mimeType, nil
}

func (s *ImageWorkspaceStorage) Remove(relativePath string) error {
	path, err := s.resolve(relativePath)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *ImageWorkspaceStorage) resolve(relativePath string) (string, error) {
	if relativePath == "" || filepath.IsAbs(relativePath) || strings.Contains(relativePath, "\\") || strings.ContainsRune(relativePath, 0) {
		return "", fmt.Errorf("invalid image path")
	}
	cleanRel := filepath.Clean(filepath.FromSlash(relativePath))
	if cleanRel == "." || strings.HasPrefix(cleanRel, ".."+string(filepath.Separator)) || cleanRel == ".." {
		return "", fmt.Errorf("invalid image path")
	}
	prefix := imageWorkspaceDirName + string(filepath.Separator)
	if !strings.HasPrefix(cleanRel, prefix) {
		return "", fmt.Errorf("invalid image path")
	}
	insideRel := strings.TrimPrefix(cleanRel, prefix)
	base := filepath.Clean(s.baseDir)
	target := filepath.Clean(filepath.Join(base, insideRel))
	if target != base && !strings.HasPrefix(target, base+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid image path")
	}
	return target, nil
}

func decodeImageWorkspaceDataURL(raw string) (string, []byte, error) {
	prefix, encoded, ok := strings.Cut(strings.TrimSpace(raw), ",")
	if !ok || !strings.HasPrefix(prefix, "data:") || !strings.Contains(prefix, ";base64") {
		return "", nil, fmt.Errorf("invalid image data url")
	}
	mimeType := strings.TrimPrefix(strings.TrimSuffix(prefix, ";base64"), "data:")
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", nil, err
	}
	return strings.ToLower(strings.TrimSpace(mimeType)), data, nil
}

func imageWorkspaceExtByMIME(mimeType string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/png":
		return ".png", true
	case "image/jpeg":
		return ".jpg", true
	case "image/webp":
		return ".webp", true
	default:
		return "", false
	}
}

func decodeImageWorkspaceDimensions(data []byte) (int, int, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, err
	}
	return cfg.Width, cfg.Height, nil
}
