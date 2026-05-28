//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestImageWorkspaceRepo_ProjectVersionLifecycle(t *testing.T) {
	ctx := context.Background()
	tx := testEntTx(t)
	client := tx.Client()
	repo := NewImageWorkspaceRepository(client)
	user := createImageWorkspaceTestUser(t, ctx, client, "owner")
	other := createImageWorkspaceTestUser(t, ctx, client, "other")

	project, err := repo.CreateProject(ctx, service.CreateImageProjectInput{
		UserID: user.ID,
		Title:  "Launch ideas",
	})
	require.NoError(t, err)
	require.NotZero(t, project.ID)

	first, err := repo.CreateVersion(ctx, service.CreateImageVersionInput{
		ProjectID:     project.ID,
		UserID:        user.ID,
		Mode:          service.ImageWorkspaceModeGeneration,
		Prompt:        "draw a cat",
		Model:         "gpt-image-2",
		Size:          "1024x1024",
		MIMEType:      "image/png",
		FilePath:      "image-workspace/1/2/3.png",
		FileSizeBytes: 12,
		Width:         1,
		Height:        1,
	})
	require.NoError(t, err)

	second, err := repo.CreateVersion(ctx, service.CreateImageVersionInput{
		ProjectID:       project.ID,
		UserID:          user.ID,
		ParentVersionID: &first.ID,
		SourceVersionID: &first.ID,
		Mode:            service.ImageWorkspaceModeEdit,
		Prompt:          "make it blue",
		Model:           "gpt-image-2",
		Size:            "1024x1024",
		MIMEType:        "image/png",
		FilePath:        "image-workspace/1/2/4.png",
		FileSizeBytes:   14,
		Width:           1,
		Height:          1,
	})
	require.NoError(t, err)

	detail, err := repo.GetProjectForUser(ctx, user.ID, project.ID)
	require.NoError(t, err)
	require.Equal(t, project.ID, detail.Project.ID)
	require.Equal(t, second.ID, *detail.Project.CoverVersionID)
	require.Len(t, detail.Versions, 2)

	_, err = repo.GetProjectForUser(ctx, other.ID, project.ID)
	require.Error(t, err)

	items, total, err := repo.ListProjectsForUser(ctx, service.ImageProjectListInput{UserID: user.ID, Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, int64(2), items[0].VersionCount)

	require.NoError(t, repo.SoftDeleteVersionForUser(ctx, user.ID, second.ID))
	detail, err = repo.GetProjectForUser(ctx, user.ID, project.ID)
	require.NoError(t, err)
	require.Equal(t, first.ID, *detail.Project.CoverVersionID)
	require.Len(t, detail.Versions, 1)

	require.NoError(t, repo.SoftDeleteProjectForUser(ctx, user.ID, project.ID))
	_, err = repo.GetProjectForUser(ctx, user.ID, project.ID)
	require.Error(t, err)
}

func createImageWorkspaceTestUser(t *testing.T, ctx context.Context, client *dbent.Client, tag string) *dbent.User {
	t.Helper()
	user, err := client.User.Create().
		SetEmail(fmt.Sprintf("image-%s-%d@test.com", tag, time.Now().UnixNano())).
		SetPasswordHash("hash").
		Save(ctx)
	require.NoError(t, err)
	return user
}
