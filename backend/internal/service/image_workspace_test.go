package service

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestImageWorkspaceTitleFromPromptFitsProjectTitleLimit(t *testing.T) {
	title := imageWorkspaceTitleFromPrompt(strings.Repeat("蓝色圆点图标", 30))

	if len(title) > 160 {
		t.Fatalf("title byte length = %d, want <= 160", len(title))
	}
	if !utf8.ValidString(title) {
		t.Fatal("title must remain valid utf8")
	}
	if title == "" {
		t.Fatal("title must not be empty")
	}
}
