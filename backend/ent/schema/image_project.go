package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ImageProject struct {
	ent.Schema
}

func (ImageProject) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "image_projects"},
	}
}

func (ImageProject) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixins.TimeMixin{},
		mixins.SoftDeleteMixin{},
	}
}

func (ImageProject) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("user_id"),
		field.String("title").MaxLen(160).Default(""),
		field.Int64("cover_version_id").Optional().Nillable(),
		field.String("status").MaxLen(20).Default("active"),
	}
}

func (ImageProject) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("image_projects").
			Field("user_id").
			Unique().
			Required(),
		edge.To("versions", ImageVersion.Type),
	}
}

func (ImageProject) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "created_at"),
		index.Fields("status", "created_at"),
		index.Fields("deleted_at"),
	}
}
