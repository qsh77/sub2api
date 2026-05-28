//go:build unit

package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"io"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImageWorkspaceStorage_SaveBytesStoresImageMetadata(t *testing.T) {
	storage := NewImageWorkspaceStorage(t.TempDir())
	data := imageWorkspaceTestPNG(t, 2, 3)

	stored, err := storage.SaveBytes(7, 11, 13, data, "image/png", "")

	require.NoError(t, err)
	require.Equal(t, "image/png", stored.MIMEType)
	require.Equal(t, int64(len(data)), stored.SizeBytes)
	require.Len(t, stored.SHA256, 64)
	require.Equal(t, 2, stored.Width)
	require.Equal(t, 3, stored.Height)
	require.Equal(t, filepath.ToSlash("image-workspace/7/11/13.png"), stored.RelativePath)

	file, mimeType, err := storage.Open(stored.RelativePath)
	require.NoError(t, err)
	defer file.Close()
	require.Equal(t, "image/png", mimeType)
	got, err := io.ReadAll(file)
	require.NoError(t, err)
	require.Equal(t, data, got)
}

func TestImageWorkspaceStorage_SaveDataURLAndMask(t *testing.T) {
	storage := NewImageWorkspaceStorage(t.TempDir())
	data := imageWorkspaceTestPNG(t, 1, 1)
	raw := "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)

	stored, err := storage.SaveDataURL(1, 2, 3, raw, "-mask")

	require.NoError(t, err)
	require.Equal(t, filepath.ToSlash("image-workspace/1/2/3-mask.png"), stored.RelativePath)
	require.Equal(t, "image/png", stored.MIMEType)
}

func TestImageWorkspaceStorage_RejectsInvalidInput(t *testing.T) {
	storage := NewImageWorkspaceStorage(t.TempDir())
	data := imageWorkspaceTestPNG(t, 1, 1)

	_, err := storage.SaveBytes(1, 2, 3, data, "image/gif", "")
	require.Error(t, err)

	_, err = storage.SaveDataURL(1, 2, 3, "data:image/png;base64,***", "")
	require.Error(t, err)
}

func TestImageWorkspaceStorage_OpenRejectsTraversal(t *testing.T) {
	storage := NewImageWorkspaceStorage(t.TempDir())

	_, _, err := storage.Open("../secret.png")
	require.Error(t, err)

	_, _, err = storage.Open(`image-workspace\1\2\3.png`)
	require.Error(t, err)
}

func imageWorkspaceTestPNG(t *testing.T, width, height int) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 80, G: 120, B: 180, A: 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}
