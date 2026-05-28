package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/imageproject"
	"github.com/Wei-Shaw/sub2api/ent/imageversion"
	"github.com/Wei-Shaw/sub2api/ent/predicate"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"entgo.io/ent/dialect/sql"
)

type imageWorkspaceRepository struct {
	client *dbent.Client
}

func NewImageWorkspaceRepository(client *dbent.Client) service.ImageWorkspaceRepository {
	return &imageWorkspaceRepository{client: client}
}

func (r *imageWorkspaceRepository) CreateProject(ctx context.Context, input service.CreateImageProjectInput) (*service.ImageProject, error) {
	created, err := r.client.ImageProject.Create().
		SetUserID(input.UserID).
		SetTitle(strings.TrimSpace(input.Title)).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return imageProjectEntityToService(created), nil
}

func (r *imageWorkspaceRepository) CreateVersion(ctx context.Context, input service.CreateImageVersionInput) (*service.ImageVersion, error) {
	builder := r.client.ImageVersion.Create().
		SetProjectID(input.ProjectID).
		SetUserID(input.UserID).
		SetMode(input.Mode).
		SetPrompt(input.Prompt).
		SetModel(input.Model).
		SetSize(input.Size).
		SetMimeType(input.MIMEType).
		SetFilePath(input.FilePath).
		SetFileSizeBytes(input.FileSizeBytes).
		SetSha256(input.SHA256).
		SetWidth(input.Width).
		SetHeight(input.Height)

	if input.ParentVersionID != nil {
		builder.SetParentVersionID(*input.ParentVersionID)
	}
	if input.SourceVersionID != nil {
		builder.SetSourceVersionID(*input.SourceVersionID)
	}
	if input.RevisedPrompt != nil {
		builder.SetRevisedPrompt(*input.RevisedPrompt)
	}
	if input.MaskFilePath != nil {
		builder.SetMaskFilePath(*input.MaskFilePath)
	}
	if input.MaskMIMEType != nil {
		builder.SetMaskMimeType(*input.MaskMIMEType)
	}
	if input.APIKeyID != nil {
		builder.SetAPIKeyID(*input.APIKeyID)
	}
	if input.UsageLogID != nil {
		builder.SetUsageLogID(*input.UsageLogID)
	}

	created, err := builder.Save(ctx)
	if err != nil {
		return nil, err
	}
	_, err = r.client.ImageProject.Update().
		Where(imageproject.IDEQ(input.ProjectID), imageproject.UserIDEQ(input.UserID), imageproject.DeletedAtIsNil()).
		SetCoverVersionID(created.ID).
		SetUpdatedAt(time.Now()).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return imageVersionEntityToService(created), nil
}

func (r *imageWorkspaceRepository) UpdateVersionFile(ctx context.Context, versionID int64, stored *service.StoredImageFile) (*service.ImageVersion, error) {
	updated, err := r.client.ImageVersion.UpdateOneID(versionID).
		SetMimeType(stored.MIMEType).
		SetFilePath(stored.RelativePath).
		SetFileSizeBytes(stored.SizeBytes).
		SetSha256(stored.SHA256).
		SetWidth(stored.Width).
		SetHeight(stored.Height).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return imageVersionEntityToService(updated), nil
}

func (r *imageWorkspaceRepository) UpdateVersionMask(ctx context.Context, versionID int64, stored *service.StoredImageFile) (*service.ImageVersion, error) {
	updated, err := r.client.ImageVersion.UpdateOneID(versionID).
		SetMaskFilePath(stored.RelativePath).
		SetMaskMimeType(stored.MIMEType).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return imageVersionEntityToService(updated), nil
}

func (r *imageWorkspaceRepository) GetProjectForUser(ctx context.Context, userID, projectID int64) (*service.ImageProjectDetail, error) {
	project, err := r.client.ImageProject.Query().
		Where(imageproject.IDEQ(projectID), imageproject.UserIDEQ(userID), imageproject.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.projectDetail(ctx, project)
}

func (r *imageWorkspaceRepository) GetProjectForAdmin(ctx context.Context, projectID int64) (*service.ImageProjectDetail, error) {
	project, err := r.client.ImageProject.Query().
		Where(imageproject.IDEQ(projectID), imageproject.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.projectDetail(ctx, project)
}

func (r *imageWorkspaceRepository) ListProjectsForUser(ctx context.Context, input service.ImageProjectListInput) ([]*service.ImageProjectSummary, int64, error) {
	q := r.client.ImageProject.Query().
		Where(imageproject.UserIDEQ(input.UserID), imageproject.DeletedAtIsNil())
	return r.listProjects(ctx, q, input.Page, input.PageSize)
}

func (r *imageWorkspaceRepository) ListProjectsForAdmin(ctx context.Context, input service.AdminImageProjectListInput) ([]*service.ImageProjectSummary, int64, error) {
	q := r.client.ImageProject.Query().
		Where(imageproject.DeletedAtIsNil())
	if input.UserID > 0 {
		q = q.Where(imageproject.UserIDEQ(input.UserID))
	}
	return r.listProjects(ctx, q, input.Page, input.PageSize)
}

func (r *imageWorkspaceRepository) GetVersionForUser(ctx context.Context, userID, versionID int64) (*service.ImageVersion, error) {
	version, err := r.client.ImageVersion.Query().
		Where(imageversion.IDEQ(versionID), imageversion.UserIDEQ(userID), imageversion.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return imageVersionEntityToService(version), nil
}

func (r *imageWorkspaceRepository) GetVersionForAdmin(ctx context.Context, versionID int64) (*service.ImageVersion, error) {
	version, err := r.client.ImageVersion.Query().
		Where(imageversion.IDEQ(versionID), imageversion.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return imageVersionEntityToService(version), nil
}

func (r *imageWorkspaceRepository) SoftDeleteProjectForUser(ctx context.Context, userID, projectID int64) error {
	return r.softDeleteProject(ctx, projectID, imageproject.UserIDEQ(userID))
}

func (r *imageWorkspaceRepository) SoftDeleteProjectForAdmin(ctx context.Context, projectID int64) error {
	return r.softDeleteProject(ctx, projectID)
}

func (r *imageWorkspaceRepository) SoftDeleteVersionForUser(ctx context.Context, userID, versionID int64) error {
	now := time.Now()
	version, err := r.client.ImageVersion.Query().
		Where(imageversion.IDEQ(versionID), imageversion.UserIDEQ(userID), imageversion.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return err
	}
	if _, err := r.client.ImageVersion.Update().
		Where(imageversion.IDEQ(versionID), imageversion.UserIDEQ(userID), imageversion.DeletedAtIsNil()).
		SetDeletedAt(now).
		Save(ctx); err != nil {
		return err
	}
	return r.refreshProjectCover(ctx, version.ProjectID)
}

func (r *imageWorkspaceRepository) softDeleteProject(ctx context.Context, projectID int64, predicates ...predicate.ImageProject) error {
	now := time.Now()
	projectPredicates := []predicate.ImageProject{imageproject.IDEQ(projectID), imageproject.DeletedAtIsNil()}
	projectPredicates = append(projectPredicates, predicates...)
	affected, err := r.client.ImageProject.Update().
		Where(projectPredicates...).
		SetDeletedAt(now).
		Save(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("image project not found")
	}
	_, err = r.client.ImageVersion.Update().
		Where(imageversion.ProjectIDEQ(projectID), imageversion.DeletedAtIsNil()).
		SetDeletedAt(now).
		Save(ctx)
	return err
}

func (r *imageWorkspaceRepository) refreshProjectCover(ctx context.Context, projectID int64) error {
	next, err := r.client.ImageVersion.Query().
		Where(imageversion.ProjectIDEQ(projectID), imageversion.DeletedAtIsNil()).
		Order(imageversion.ByCreatedAt(sql.OrderDesc()), imageversion.ByID(sql.OrderDesc())).
		First(ctx)
	if err != nil {
		_, updateErr := r.client.ImageProject.Update().
			Where(imageproject.IDEQ(projectID)).
			ClearCoverVersionID().
			SetUpdatedAt(time.Now()).
			Save(ctx)
		return updateErr
	}
	_, err = r.client.ImageProject.Update().
		Where(imageproject.IDEQ(projectID)).
		SetCoverVersionID(next.ID).
		SetUpdatedAt(time.Now()).
		Save(ctx)
	return err
}

func (r *imageWorkspaceRepository) projectDetail(ctx context.Context, project *dbent.ImageProject) (*service.ImageProjectDetail, error) {
	versions, err := r.client.ImageVersion.Query().
		Where(imageversion.ProjectIDEQ(project.ID), imageversion.DeletedAtIsNil()).
		Order(imageversion.ByCreatedAt(sql.OrderAsc()), imageversion.ByID(sql.OrderAsc())).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*service.ImageVersion, 0, len(versions))
	for _, version := range versions {
		out = append(out, imageVersionEntityToService(version))
	}
	return &service.ImageProjectDetail{
		Project:  imageProjectEntityToService(project),
		Versions: out,
	}, nil
}

func (r *imageWorkspaceRepository) listProjects(ctx context.Context, q *dbent.ImageProjectQuery, page, pageSize int) ([]*service.ImageProjectSummary, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	projects, err := q.
		Order(imageproject.ByUpdatedAt(sql.OrderDesc()), imageproject.ByID(sql.OrderDesc())).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}
	out := make([]*service.ImageProjectSummary, 0, len(projects))
	for _, project := range projects {
		count, err := r.client.ImageVersion.Query().
			Where(imageversion.ProjectIDEQ(project.ID), imageversion.DeletedAtIsNil()).
			Count(ctx)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, &service.ImageProjectSummary{
			ImageProject: *imageProjectEntityToService(project),
			VersionCount: int64(count),
		})
	}
	return out, int64(total), nil
}

func imageProjectEntityToService(entity *dbent.ImageProject) *service.ImageProject {
	return &service.ImageProject{
		ID:             entity.ID,
		UserID:         entity.UserID,
		Title:          entity.Title,
		CoverVersionID: entity.CoverVersionID,
		Status:         entity.Status,
		CreatedAt:      entity.CreatedAt,
		UpdatedAt:      entity.UpdatedAt,
		DeletedAt:      entity.DeletedAt,
	}
}

func imageVersionEntityToService(entity *dbent.ImageVersion) *service.ImageVersion {
	return &service.ImageVersion{
		ID:              entity.ID,
		ProjectID:       entity.ProjectID,
		UserID:          entity.UserID,
		ParentVersionID: entity.ParentVersionID,
		SourceVersionID: entity.SourceVersionID,
		Mode:            entity.Mode,
		Prompt:          entity.Prompt,
		RevisedPrompt:   entity.RevisedPrompt,
		Model:           entity.Model,
		Size:            entity.Size,
		MIMEType:        entity.MimeType,
		FilePath:        entity.FilePath,
		FileSizeBytes:   entity.FileSizeBytes,
		SHA256:          entity.Sha256,
		Width:           entity.Width,
		Height:          entity.Height,
		MaskFilePath:    entity.MaskFilePath,
		MaskMIMEType:    entity.MaskMimeType,
		APIKeyID:        entity.APIKeyID,
		UsageLogID:      entity.UsageLogID,
		CreatedAt:       entity.CreatedAt,
		DeletedAt:       entity.DeletedAt,
	}
}
