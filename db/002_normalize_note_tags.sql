CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tags_user_id_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT note_tags_pkey PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX IF NOT EXISTS tags_user_id_name_idx ON tags(user_id, name);
CREATE INDEX IF NOT EXISTS tags_user_id_created_at_idx ON tags(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS note_tags_user_id_tag_id_idx ON note_tags(user_id, tag_id);
CREATE INDEX IF NOT EXISTS note_tags_user_id_note_id_idx ON note_tags(user_id, note_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_own" ON tags;
CREATE POLICY "tags_select_own" ON tags
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "tags_insert_own" ON tags;
CREATE POLICY "tags_insert_own" ON tags
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "tags_update_own" ON tags;
CREATE POLICY "tags_update_own" ON tags
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "tags_delete_own" ON tags;
CREATE POLICY "tags_delete_own" ON tags
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "note_tags_select_own" ON note_tags;
CREATE POLICY "note_tags_select_own" ON note_tags
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "note_tags_insert_own" ON note_tags;
CREATE POLICY "note_tags_insert_own" ON note_tags
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "note_tags_update_own" ON note_tags;
CREATE POLICY "note_tags_update_own" ON note_tags
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "note_tags_delete_own" ON note_tags;
CREATE POLICY "note_tags_delete_own" ON note_tags
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

INSERT INTO tags (user_id, name)
SELECT DISTINCT n.user_id, tag_name
FROM notes n
CROSS JOIN LATERAL unnest(COALESCE(n.tags, ARRAY[]::TEXT[])) AS raw_tag(tag_value)
CROSS JOIN LATERAL (
  SELECT NULLIF(lower(regexp_replace(btrim(raw_tag.tag_value), '\s+', ' ', 'g')), '') AS tag_name
) normalized
WHERE normalized.tag_name IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO note_tags (note_id, tag_id, user_id)
SELECT DISTINCT n.id, t.id, n.user_id
FROM notes n
CROSS JOIN LATERAL unnest(COALESCE(n.tags, ARRAY[]::TEXT[])) AS raw_tag(tag_value)
CROSS JOIN LATERAL (
  SELECT NULLIF(lower(regexp_replace(btrim(raw_tag.tag_value), '\s+', ' ', 'g')), '') AS tag_name
) normalized
JOIN tags t
  ON t.user_id = n.user_id
 AND t.name = normalized.tag_name
WHERE normalized.tag_name IS NOT NULL
ON CONFLICT (note_id, tag_id) DO NOTHING;

DROP FUNCTION IF EXISTS create_note_with_tags(TEXT, TEXT, TEXT[]);
CREATE FUNCTION create_note_with_tags(
  p_title TEXT,
  p_content TEXT,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  new_note_id UUID;
  normalized_tag TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO notes (user_id, title, content, summary, status)
  VALUES (current_user_id, COALESCE(p_title, ''), p_content, '', 'draft')
  RETURNING id INTO new_note_id;

  FOR normalized_tag IN
    SELECT DISTINCT NULLIF(
      lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
      ''
    )
    FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    WHERE NULLIF(lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')), '') IS NOT NULL
  LOOP
    INSERT INTO tags (user_id, name)
    VALUES (current_user_id, normalized_tag)
    ON CONFLICT (user_id, name) DO NOTHING;

    INSERT INTO note_tags (note_id, tag_id, user_id)
    SELECT new_note_id, t.id, current_user_id
    FROM tags t
    WHERE t.user_id = current_user_id
      AND t.name = normalized_tag
    ON CONFLICT (note_id, tag_id) DO NOTHING;
  END LOOP;

  RETURN new_note_id;
END;
$$;

DROP FUNCTION IF EXISTS list_notes_with_tags();
CREATE FUNCTION list_notes_with_tags()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.content,
    n.summary,
    COALESCE(
      ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS tags,
    n.status,
    n.created_at,
    n.updated_at
  FROM notes n
  LEFT JOIN note_tags nt
    ON nt.note_id = n.id
   AND nt.user_id = n.user_id
  LEFT JOIN tags t
    ON t.id = nt.tag_id
   AND t.user_id = n.user_id
  WHERE n.user_id = (SELECT auth.uid())
  GROUP BY n.id
  ORDER BY n.updated_at DESC;
$$;

DROP FUNCTION IF EXISTS list_used_tags();
CREATE FUNCTION list_used_tags()
RETURNS TABLE (
  name TEXT,
  usage_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.name,
    COUNT(*)::BIGINT AS usage_count
  FROM note_tags nt
  JOIN tags t
    ON t.id = nt.tag_id
   AND t.user_id = nt.user_id
  WHERE nt.user_id = (SELECT auth.uid())
  GROUP BY t.name
  ORDER BY usage_count DESC, t.name ASC;
$$;

DROP INDEX IF EXISTS notes_tags_gin_idx;
ALTER TABLE notes DROP COLUMN IF EXISTS tags;
