package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ImageVersion struct {
	ent.Schema
}

func (ImageVersion) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "image_versions"},
	}
}

func (ImageVersion) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("project_id"),
		field.Int64("user_id"),
		field.Int64("parent_version_id").Optional().Nillable(),
		field.Int64("source_version_id").Optional().Nillable(),
		field.String("mode").MaxLen(20).NotEmpty(),
		field.String("prompt").SchemaType(map[string]string{dialect.Postgres: "text"}).Default(""),
		field.String("revised_prompt").SchemaType(map[string]string{dialect.Postgres: "text"}).Optional().Nillable(),
		field.String("model").MaxLen(100).Default(""),
		field.String("size").MaxLen(32).Default(""),
		field.String("mime_type").MaxLen(64).NotEmpty(),
		field.String("file_path").SchemaType(map[string]string{dialect.Postgres: "text"}).NotEmpty(),
		field.Int64("file_size_bytes").Default(0),
		field.String("sha256").MaxLen(64).Default(""),
		field.Int("width").Default(0),
		field.Int("height").Default(0),
		field.String("mask_file_path").SchemaType(map[string]string{dialect.Postgres: "text"}).Optional().Nillable(),
		field.String("mask_mime_type").MaxLen(64).Optional().Nillable(),
		field.Int64("api_key_id").Optional().Nillable(),
		field.Int64("usage_log_id").Optional().Nillable(),
		field.Time("created_at").Immutable().Default(time.Now).SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
		field.Time("deleted_at").Optional().Nillable().SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
	}
}

func (ImageVersion) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("project", ImageProject.Type).
			Ref("versions").
			Field("project_id").
			Unique().
			Required(),
		edge.From("user", User.Type).
			Ref("image_versions").
			Field("user_id").
			Unique().
			Required(),
	}
}

func (ImageVersion) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("project_id", "created_at"),
		index.Fields("user_id", "created_at"),
		index.Fields("parent_version_id"),
		index.Fields("deleted_at"),
	}
}
