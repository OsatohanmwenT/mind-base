CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS note_embeddings (
  note_id UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  last_embedded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT note_embeddings_status_check
    CHECK (status IN ('pending', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS note_embeddings_user_id_updated_at_idx
  ON note_embeddings(user_id, updated_at DESC);

ALTER TABLE note_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_embeddings_select_own" ON note_embeddings;
CREATE POLICY "note_embeddings_select_own" ON note_embeddings
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "note_embeddings_insert_own" ON note_embeddings;
CREATE POLICY "note_embeddings_insert_own" ON note_embeddings
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_embeddings.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_embeddings_update_own" ON note_embeddings;
CREATE POLICY "note_embeddings_update_own" ON note_embeddings
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_embeddings.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_embeddings_delete_own" ON note_embeddings;
CREATE POLICY "note_embeddings_delete_own" ON note_embeddings
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS note_embeddings_updated_at ON note_embeddings;
CREATE TRIGGER note_embeddings_updated_at
  BEFORE UPDATE ON note_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP FUNCTION IF EXISTS search_notes_semantic(DOUBLE PRECISION[], TEXT[], INTEGER);
CREATE FUNCTION search_notes_semantic(
  p_embedding DOUBLE PRECISION[],
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized_input AS (
    SELECT
      COALESCE(
        ARRAY(
          SELECT DISTINCT normalized_tag
          FROM (
            SELECT NULLIF(
              lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
              ''
            ) AS normalized_tag
            FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
          ) normalized_tags
          WHERE normalized_tag IS NOT NULL
          ORDER BY normalized_tag
        ),
        ARRAY[]::TEXT[]
      ) AS active_tags,
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS result_limit,
      ('[' || array_to_string(p_embedding, ',') || ']')::vector(1536) AS query_embedding
  ),
  notes_with_tags AS (
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
  )
  SELECT
    nwt.id,
    nwt.user_id,
    nwt.title,
    nwt.content,
    nwt.summary,
    nwt.tags,
    nwt.status,
    nwt.created_at,
    nwt.updated_at,
    1 - (ne.embedding <=> input.query_embedding) AS similarity
  FROM notes_with_tags nwt
  JOIN note_embeddings ne
    ON ne.note_id = nwt.id
   AND ne.user_id = nwt.user_id
  CROSS JOIN normalized_input input
  WHERE ne.user_id = (SELECT auth.uid())
    AND ne.status = 'ready'
    AND (
      cardinality(input.active_tags) = 0
      OR input.active_tags <@ nwt.tags
    )
  ORDER BY ne.embedding <=> input.query_embedding ASC, nwt.updated_at DESC
  LIMIT (SELECT result_limit FROM normalized_input);
$$;
