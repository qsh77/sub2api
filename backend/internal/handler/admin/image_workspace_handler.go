package admin

import (
	"net/http"
	"strconv"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

type ImageWorkspaceHandler struct {
	imageService *service.ImageWorkspaceService
}

func NewImageWorkspaceHandler(imageService *service.ImageWorkspaceService) *ImageWorkspaceHandler {
	return &ImageWorkspaceHandler{imageService: imageService}
}

func (h *ImageWorkspaceHandler) ListProjects(c *gin.Context) {
	page, pageSize := response.ParsePagination(c)
	var userID int64
	if raw := c.Query("user_id"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid user_id")
			return
		}
		userID = parsed
	}
	items, total, err := h.imageService.ListProjectsForAdmin(c.Request.Context(), service.AdminImageProjectListInput{
		Page:     page,
		PageSize: pageSize,
		UserID:   userID,
		Search:   c.Query("search"),
		Mode:     c.Query("mode"),
		Model:    c.Query("model"),
	})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Paginated(c, items, total, page, pageSize)
}

func (h *ImageWorkspaceHandler) GetProject(c *gin.Context) {
	projectID, ok := parseAdminImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	detail, err := h.imageService.GetProjectForAdmin(c.Request.Context(), projectID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, detail)
}

func (h *ImageWorkspaceHandler) GetVersionFile(c *gin.Context) {
	versionID, ok := parseAdminImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	file, err := h.imageService.GetVersionFileForAdmin(c.Request.Context(), versionID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	defer file.File.Close()
	c.DataFromReader(http.StatusOK, -1, file.MIMEType, file.File, nil)
}

func (h *ImageWorkspaceHandler) DeleteProject(c *gin.Context) {
	projectID, ok := parseAdminImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	if err := h.imageService.DeleteProjectForAdmin(c.Request.Context(), projectID); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func parseAdminImageWorkspaceID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		response.BadRequest(c, "invalid "+name)
		return 0, false
	}
	return id, true
}
