package service

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

const (
	ImageWorkspaceModeGeneration = "generation"
	ImageWorkspaceModeEdit       = "edit"
	ImageWorkspaceModeMaskEdit   = "mask_edit"
	ImageWorkspaceModeUpload     = "upload"

	imageWorkspaceProjectTitleMaxBytes = 160
)

type ImageProject struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"user_id"`
	Title          string     `json:"title"`
	CoverVersionID *int64     `json:"cover_version_id,omitempty"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type ImageVersion struct {
	ID              int64      `json:"id"`
	ProjectID       int64      `json:"project_id"`
	UserID          int64      `json:"user_id"`
	ParentVersionID *int64     `json:"parent_version_id,omitempty"`
	SourceVersionID *int64     `json:"source_version_id,omitempty"`
	Mode            string     `json:"mode"`
	Prompt          string     `json:"prompt"`
	RevisedPrompt   *string    `json:"revised_prompt,omitempty"`
	Model           string     `json:"model"`
	Size            string     `json:"size"`
	MIMEType        string     `json:"mime_type"`
	FilePath        string     `json:"-"`
	FileSizeBytes   int64      `json:"file_size_bytes"`
	SHA256          string     `json:"sha256"`
	Width           int        `json:"width"`
	Height          int        `json:"height"`
	MaskFilePath    *string    `json:"-"`
	MaskMIMEType    *string    `json:"mask_mime_type,omitempty"`
	APIKeyID        *int64     `json:"api_key_id,omitempty"`
	UsageLogID      *int64     `json:"usage_log_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

type ImageProjectSummary struct {
	ImageProject
	VersionCount int64         `json:"version_count"`
	CoverVersion *ImageVersion `json:"cover_version,omitempty"`
}

type ImageProjectDetail struct {
	Project  *ImageProject   `json:"project"`
	Versions []*ImageVersion `json:"versions"`
}

type ImageWorkspaceRepository interface {
	CreateProject(ctx context.Context, input CreateImageProjectInput) (*ImageProject, error)
	CreateVersion(ctx context.Context, input CreateImageVersionInput) (*ImageVersion, error)
	UpdateVersionFile(ctx context.Context, versionID int64, stored *StoredImageFile) (*ImageVersion, error)
	UpdateVersionMask(ctx context.Context, versionID int64, stored *StoredImageFile) (*ImageVersion, error)
	GetProjectForUser(ctx context.Context, userID, projectID int64) (*ImageProjectDetail, error)
	GetProjectForAdmin(ctx context.Context, projectID int64) (*ImageProjectDetail, error)
	ListProjectsForUser(ctx context.Context, input ImageProjectListInput) ([]*ImageProjectSummary, int64, error)
	ListProjectsForAdmin(ctx context.Context, input AdminImageProjectListInput) ([]*ImageProjectSummary, int64, error)
	GetVersionForUser(ctx context.Context, userID, versionID int64) (*ImageVersion, error)
	GetVersionForAdmin(ctx context.Context, versionID int64) (*ImageVersion, error)
	SoftDeleteProjectForUser(ctx context.Context, userID, projectID int64) error
	SoftDeleteProjectForAdmin(ctx context.Context, projectID int64) error
	SoftDeleteVersionForUser(ctx context.Context, userID, versionID int64) error
}

type CreateImageProjectInput struct {
	UserID int64
	Title  string
}

type CreateImageVersionInput struct {
	ProjectID       int64
	UserID          int64
	ParentVersionID *int64
	SourceVersionID *int64
	Mode            string
	Prompt          string
	RevisedPrompt   *string
	Model           string
	Size            string
	MIMEType        string
	FilePath        string
	FileSizeBytes   int64
	SHA256          string
	Width           int
	Height          int
	MaskFilePath    *string
	MaskMIMEType    *string
	APIKeyID        *int64
	UsageLogID      *int64
}

type ImageProjectListInput struct {
	UserID   int64
	Page     int
	PageSize int
	Search   string
	Mode     string
	Model    string
}

type AdminImageProjectListInput struct {
	Page     int
	PageSize int
	UserID   int64
	Search   string
	Mode     string
	Model    string
}

type ImageWorkspaceService struct {
	repo    ImageWorkspaceRepository
	storage *ImageWorkspaceStorage
}

type ImageWorkspaceUploadInput struct {
	UserID          int64
	ProjectID       int64
	ParentVersionID *int64
	SourceVersionID *int64
	Mode            string
	Title           string
	Prompt          string
	Model           string
	Size            string
	File            io.Reader
	MIMEType        string
	Mask            io.Reader
	MaskMIMEType    string
}

type ImageWorkspaceFile struct {
	File     io.ReadCloser
	MIMEType string
}

func ProvideImageWorkspaceStorage(cfg *config.Config) *ImageWorkspaceStorage {
	return NewImageWorkspaceStorage(cfg.Pricing.DataDir)
}

func NewImageWorkspaceService(repo ImageWorkspaceRepository, storage *ImageWorkspaceStorage) *ImageWorkspaceService {
	return &ImageWorkspaceService{repo: repo, storage: storage}
}

func (s *ImageWorkspaceService) ListProjects(ctx context.Context, input ImageProjectListInput) ([]*ImageProjectSummary, int64, error) {
	return s.repo.ListProjectsForUser(ctx, input)
}

func (s *ImageWorkspaceService) ListProjectsForAdmin(ctx context.Context, input AdminImageProjectListInput) ([]*ImageProjectSummary, int64, error) {
	return s.repo.ListProjectsForAdmin(ctx, input)
}

func (s *ImageWorkspaceService) GetProject(ctx context.Context, userID, projectID int64) (*ImageProjectDetail, error) {
	return s.repo.GetProjectForUser(ctx, userID, projectID)
}

func (s *ImageWorkspaceService) GetProjectForAdmin(ctx context.Context, projectID int64) (*ImageProjectDetail, error) {
	return s.repo.GetProjectForAdmin(ctx, projectID)
}

func (s *ImageWorkspaceService) GetVersionFile(ctx context.Context, userID, versionID int64) (*ImageWorkspaceFile, error) {
	version, err := s.repo.GetVersionForUser(ctx, userID, versionID)
	if err != nil {
		return nil, err
	}
	return s.openVersionFile(version)
}

func (s *ImageWorkspaceService) GetVersionFileForAdmin(ctx context.Context, versionID int64) (*ImageWorkspaceFile, error) {
	version, err := s.repo.GetVersionForAdmin(ctx, versionID)
	if err != nil {
		return nil, err
	}
	return s.openVersionFile(version)
}

func (s *ImageWorkspaceService) Upload(ctx context.Context, input ImageWorkspaceUploadInput) (*ImageProjectDetail, error) {
	if input.UserID <= 0 {
		return nil, fmt.Errorf("user is required")
	}
	data, err := io.ReadAll(io.LimitReader(input.File, 10*1024*1024+1))
	if err != nil {
		return nil, err
	}
	if len(data) > 10*1024*1024 {
		return nil, fmt.Errorf("image exceeds 10MB")
	}

	projectID := input.ProjectID
	if projectID == 0 {
		title := strings.TrimSpace(input.Title)
		if title == "" {
			title = imageWorkspaceTitleFromPrompt(input.Prompt)
		}
		project, err := s.repo.CreateProject(ctx, CreateImageProjectInput{UserID: input.UserID, Title: title})
		if err != nil {
			return nil, err
		}
		projectID = project.ID
	}

	mode := strings.TrimSpace(input.Mode)
	if mode == "" {
		mode = ImageWorkspaceModeUpload
	}
	version, err := s.repo.CreateVersion(ctx, CreateImageVersionInput{
		ProjectID:       projectID,
		UserID:          input.UserID,
		ParentVersionID: input.ParentVersionID,
		SourceVersionID: input.SourceVersionID,
		Mode:            mode,
		Prompt:          strings.TrimSpace(input.Prompt),
		Model:           strings.TrimSpace(input.Model),
		Size:            strings.TrimSpace(input.Size),
		MIMEType:        "image/png",
		FilePath:        "pending",
	})
	if err != nil {
		return nil, err
	}
	stored, err := s.storage.SaveBytes(input.UserID, projectID, version.ID, data, input.MIMEType, "")
	if err != nil {
		_ = s.repo.SoftDeleteVersionForUser(ctx, input.UserID, version.ID)
		return nil, err
	}
	if _, err := s.repo.UpdateVersionFile(ctx, version.ID, stored); err != nil {
		_ = s.storage.Remove(stored.RelativePath)
		return nil, err
	}
	if input.Mask != nil {
		maskData, err := io.ReadAll(io.LimitReader(input.Mask, 5*1024*1024+1))
		if err != nil {
			return nil, err
		}
		if len(maskData) > 5*1024*1024 {
			return nil, fmt.Errorf("mask exceeds 5MB")
		}
		maskStored, err := s.storage.SaveBytes(input.UserID, projectID, version.ID, maskData, input.MaskMIMEType, "-mask")
		if err != nil {
			return nil, err
		}
		if _, err := s.repo.UpdateVersionMask(ctx, version.ID, maskStored); err != nil {
			_ = s.storage.Remove(maskStored.RelativePath)
			return nil, err
		}
	}
	return s.repo.GetProjectForUser(ctx, input.UserID, projectID)
}

func (s *ImageWorkspaceService) DeleteProject(ctx context.Context, userID, projectID int64) error {
	return s.repo.SoftDeleteProjectForUser(ctx, userID, projectID)
}

func (s *ImageWorkspaceService) DeleteProjectForAdmin(ctx context.Context, projectID int64) error {
	return s.repo.SoftDeleteProjectForAdmin(ctx, projectID)
}

func (s *ImageWorkspaceService) DeleteVersion(ctx context.Context, userID, versionID int64) error {
	return s.repo.SoftDeleteVersionForUser(ctx, userID, versionID)
}

func (s *ImageWorkspaceService) openVersionFile(version *ImageVersion) (*ImageWorkspaceFile, error) {
	file, mimeType, err := s.storage.Open(version.FilePath)
	if err != nil {
		return nil, err
	}
	return &ImageWorkspaceFile{File: file, MIMEType: mimeType}, nil
}

func imageWorkspaceTitleFromPrompt(prompt string) string {
	title := strings.TrimSpace(prompt)
	if title == "" {
		return "Untitled image"
	}
	if len(title) <= imageWorkspaceProjectTitleMaxBytes {
		return title
	}
	end := 0
	for end < len(title) {
		_, size := utf8.DecodeRuneInString(title[end:])
		if end+size > imageWorkspaceProjectTitleMaxBytes {
			break
		}
		end += size
	}
	title = strings.TrimSpace(title[:end])
	if title == "" {
		return "Untitled image"
	}
	return title
}
