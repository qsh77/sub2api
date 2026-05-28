package handler

import (
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
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
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	page, pageSize := response.ParsePagination(c)
	items, total, err := h.imageService.ListProjects(c.Request.Context(), service.ImageProjectListInput{
		UserID:   subject.UserID,
		Page:     page,
		PageSize: pageSize,
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
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	projectID, ok := parseImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	detail, err := h.imageService.GetProject(c.Request.Context(), subject.UserID, projectID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, detail)
}

func (h *ImageWorkspaceHandler) Upload(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	fileHeader, err := c.FormFile("image")
	if err != nil {
		response.BadRequest(c, "image is required")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		response.BadRequest(c, "failed to open image")
		return
	}
	defer file.Close()
	var maskFile multipart.File
	var maskMIMEType string
	if maskHeader, err := c.FormFile("mask"); err == nil {
		maskFile, err = maskHeader.Open()
		if err != nil {
			response.BadRequest(c, "failed to open mask")
			return
		}
		defer maskFile.Close()
		maskMIMEType = maskHeader.Header.Get("Content-Type")
	}

	var projectID int64
	if raw := c.PostForm("project_id"); raw != "" {
		projectID, err = strconv.ParseInt(raw, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid project_id")
			return
		}
	}
	parentVersionID, ok := parseOptionalImageWorkspaceFormID(c, "parent_version_id")
	if !ok {
		return
	}
	sourceVersionID, ok := parseOptionalImageWorkspaceFormID(c, "source_version_id")
	if !ok {
		return
	}
	detail, err := h.imageService.Upload(c.Request.Context(), service.ImageWorkspaceUploadInput{
		UserID:          subject.UserID,
		ProjectID:       projectID,
		ParentVersionID: parentVersionID,
		SourceVersionID: sourceVersionID,
		Mode:            c.PostForm("mode"),
		Title:           c.PostForm("title"),
		Prompt:          c.PostForm("prompt"),
		Model:           c.PostForm("model"),
		Size:            c.PostForm("size"),
		File:            file,
		MIMEType:        fileHeader.Header.Get("Content-Type"),
		Mask:            maskFile,
		MaskMIMEType:    maskMIMEType,
	})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Created(c, detail)
}

func (h *ImageWorkspaceHandler) GetVersionFile(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	versionID, ok := parseImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	file, err := h.imageService.GetVersionFile(c.Request.Context(), subject.UserID, versionID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	defer file.File.Close()
	c.DataFromReader(http.StatusOK, -1, file.MIMEType, file.File, nil)
}

func (h *ImageWorkspaceHandler) DeleteProject(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	projectID, ok := parseImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	if err := h.imageService.DeleteProject(c.Request.Context(), subject.UserID, projectID); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func (h *ImageWorkspaceHandler) DeleteVersion(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	versionID, ok := parseImageWorkspaceID(c, "id")
	if !ok {
		return
	}
	if err := h.imageService.DeleteVersion(c.Request.Context(), subject.UserID, versionID); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func parseImageWorkspaceID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		response.BadRequest(c, "invalid "+name)
		return 0, false
	}
	return id, true
}

func parseOptionalImageWorkspaceFormID(c *gin.Context, name string) (*int64, bool) {
	raw := c.PostForm(name)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		response.BadRequest(c, "invalid "+name)
		return nil, false
	}
	return &id, true
}
