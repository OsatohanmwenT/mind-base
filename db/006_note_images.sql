CREATE TABLE IF NOT EXISTS note_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'note-images',
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT note_images_storage_key_key UNIQUE (storage_key),
  CONSTRAINT note_images_status_check CHECK (status IN ('pending', 'uploaded', 'failed')),
  CONSTRAINT note_images_size_bytes_check CHECK (size_bytes > 0),
  CONSTRAINT note_images_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS note_images_user_id_note_id_sort_order_idx
  ON note_images(user_id, note_id, sort_order);
CREATE INDEX IF NOT EXISTS note_images_note_id_status_idx
  ON note_images(note_id, status);
CREATE INDEX IF NOT EXISTS note_images_user_id_created_at_idx
  ON note_images(user_id, created_at DESC);

ALTER TABLE note_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_images_select_own" ON note_images;
CREATE POLICY "note_images_select_own" ON note_images
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_images.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_images_insert_own" ON note_images;
CREATE POLICY "note_images_insert_own" ON note_images
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_images.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_images_update_own" ON note_images;
CREATE POLICY "note_images_update_own" ON note_images
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_images.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_images.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_images_delete_own" ON note_images;
CREATE POLICY "note_images_delete_own" ON note_images
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_images.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP TRIGGER IF EXISTS note_images_updated_at ON note_images;
CREATE TRIGGER note_images_updated_at
  BEFORE UPDATE ON note_images
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP FUNCTION IF EXISTS list_note_images(UUID);
CREATE FUNCTION list_note_images(
  p_note_id UUID
)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  bucket TEXT,
  storage_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER,
  status TEXT,
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ni.id,
    ni.note_id,
    ni.user_id,
    ni.bucket,
    ni.storage_key,
    ni.original_filename,
    ni.mime_type,
    ni.size_bytes,
    ni.sort_order,
    ni.status,
    ni.uploaded_at,
    ni.last_error,
    ni.created_at,
    ni.updated_at
  FROM note_images ni
  WHERE ni.note_id = p_note_id
    AND ni.user_id = (SELECT auth.uid())
  ORDER BY ni.sort_order ASC, ni.created_at ASC;
$$;

DROP FUNCTION IF EXISTS reserve_note_image_upload(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT);
CREATE FUNCTION reserve_note_image_upload(
  p_image_id UUID,
  p_note_id UUID,
  p_bucket TEXT,
  p_storage_key TEXT,
  p_original_filename TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT
)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  bucket TEXT,
  storage_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER,
  status TEXT,
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  next_sort_order INTEGER;
  active_image_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM notes n
    WHERE n.id = p_note_id
      AND n.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  IF p_image_id IS NULL THEN
    RAISE EXCEPTION 'Image id is required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_storage_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Storage key is required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_original_filename, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Original filename is required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_mime_type, '')), '') IS NULL THEN
    RAISE EXCEPTION 'MIME type is required';
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RAISE EXCEPTION 'Image size must be greater than zero';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO active_image_count
  FROM note_images ni
  WHERE ni.note_id = p_note_id
    AND ni.user_id = current_user_id
    AND ni.status IN ('pending', 'uploaded');

  IF active_image_count >= 10 THEN
    RAISE EXCEPTION 'Add up to 10 images per note.';
  END IF;

  SELECT COALESCE(MAX(ni.sort_order) + 1, 0)
  INTO next_sort_order
  FROM note_images ni
  WHERE ni.note_id = p_note_id
    AND ni.user_id = current_user_id
    AND ni.status IN ('pending', 'uploaded');

  INSERT INTO note_images (
    id,
    note_id,
    user_id,
    bucket,
    storage_key,
    original_filename,
    mime_type,
    size_bytes,
    sort_order,
    status
  )
  VALUES (
    p_image_id,
    p_note_id,
    current_user_id,
    COALESCE(NULLIF(btrim(p_bucket), ''), 'note-images'),
    p_storage_key,
    p_original_filename,
    p_mime_type,
    p_size_bytes,
    next_sort_order,
    'pending'
  );

  RETURN QUERY
  SELECT *
  FROM list_note_images(p_note_id)
  WHERE list_note_images.id = p_image_id;
END;
$$;

DROP FUNCTION IF EXISTS complete_note_image_upload(UUID, UUID);
CREATE FUNCTION complete_note_image_upload(
  p_note_id UUID,
  p_image_id UUID
)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  bucket TEXT,
  storage_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER,
  status TEXT,
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM note_images ni
    WHERE ni.id = p_image_id
      AND ni.note_id = p_note_id
      AND ni.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Image not found';
  END IF;

  UPDATE note_images ni
  SET
    status = 'uploaded',
    uploaded_at = COALESCE(ni.uploaded_at, NOW()),
    last_error = NULL
  WHERE ni.id = p_image_id
    AND ni.note_id = p_note_id
    AND ni.user_id = current_user_id;

  RETURN QUERY
  SELECT *
  FROM list_note_images(p_note_id)
  WHERE list_note_images.id = p_image_id;
END;
$$;

DROP FUNCTION IF EXISTS mark_note_image_upload_failed(UUID, UUID, TEXT);
CREATE FUNCTION mark_note_image_upload_failed(
  p_note_id UUID,
  p_image_id UUID,
  p_last_error TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  bucket TEXT,
  storage_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER,
  status TEXT,
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM note_images ni
    WHERE ni.id = p_image_id
      AND ni.note_id = p_note_id
      AND ni.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Image not found';
  END IF;

  UPDATE note_images ni
  SET
    status = 'failed',
    last_error = NULLIF(btrim(COALESCE(p_last_error, '')), '')
  WHERE ni.id = p_image_id
    AND ni.note_id = p_note_id
    AND ni.user_id = current_user_id;

  RETURN QUERY
  SELECT *
  FROM list_note_images(p_note_id)
  WHERE list_note_images.id = p_image_id;
END;
$$;

DROP FUNCTION IF EXISTS delete_note_image(UUID, UUID);
CREATE FUNCTION delete_note_image(
  p_note_id UUID,
  p_image_id UUID
)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  bucket TEXT,
  storage_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER,
  status TEXT,
  uploaded_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  deleted_image note_images%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO deleted_image
  FROM note_images ni
  WHERE ni.id = p_image_id
    AND ni.note_id = p_note_id
    AND ni.user_id = current_user_id;

  IF deleted_image.id IS NULL THEN
    RAISE EXCEPTION 'Image not found';
  END IF;

  DELETE FROM note_images ni
  WHERE ni.id = p_image_id
    AND ni.note_id = p_note_id
    AND ni.user_id = current_user_id;

  UPDATE note_images ni
  SET sort_order = ni.sort_order - 1
  WHERE ni.note_id = p_note_id
    AND ni.user_id = current_user_id
    AND ni.status IN ('pending', 'uploaded')
    AND ni.sort_order > deleted_image.sort_order;

  RETURN QUERY
  SELECT
    deleted_image.id,
    deleted_image.note_id,
    deleted_image.user_id,
    deleted_image.bucket,
    deleted_image.storage_key,
    deleted_image.original_filename,
    deleted_image.mime_type,
    deleted_image.size_bytes,
    deleted_image.sort_order,
    deleted_image.status,
    deleted_image.uploaded_at,
    deleted_image.last_error,
    deleted_image.created_at,
    deleted_image.updated_at;
END;
$$;

DROP FUNCTION IF EXISTS list_notes_with_tags(TEXT, TEXT[], TEXT);
CREATE FUNCTION list_notes_with_tags(
  p_query TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_sort TEXT DEFAULT 'updated'
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
  image_count INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized_input AS (
    SELECT
      NULLIF(btrim(p_query), '') AS query,
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
      CASE p_sort
        WHEN 'updated' THEN 'updated'
        WHEN 'created' THEN 'created'
        WHEN 'alpha' THEN 'alpha'
        ELSE 'updated'
      END AS sort_mode
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
      n.updated_at,
      COALESCE(
        (
          SELECT COUNT(*)::INTEGER
          FROM note_images ni
          WHERE ni.note_id = n.id
            AND ni.user_id = n.user_id
            AND ni.status = 'uploaded'
        ),
        0
      ) AS image_count
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
    nwt.image_count
  FROM notes_with_tags nwt
  CROSS JOIN normalized_input input
  WHERE (
    input.query IS NULL
    OR nwt.title ILIKE '%' || input.query || '%'
    OR nwt.summary ILIKE '%' || input.query || '%'
    OR nwt.content ILIKE '%' || input.query || '%'
    OR EXISTS (
      SELECT 1
      FROM unnest(nwt.tags) AS tag_name
      WHERE tag_name ILIKE '%' || input.query || '%'
    )
  )
    AND (
      cardinality(input.active_tags) = 0
      OR input.active_tags <@ nwt.tags
    )
  ORDER BY
    CASE
      WHEN input.sort_mode = 'alpha' THEN
        CASE
          WHEN btrim(nwt.title) = '' THEN 'Untitled note'
          ELSE btrim(nwt.title)
        END
    END ASC,
    CASE
      WHEN input.sort_mode = 'updated' THEN nwt.updated_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'updated' THEN nwt.created_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'created' THEN nwt.created_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'created' THEN nwt.updated_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'alpha' THEN nwt.updated_at
    END DESC,
    nwt.id DESC;
$$;

DROP FUNCTION IF EXISTS get_note_with_tags(UUID);
CREATE FUNCTION get_note_with_tags(
  p_note_id UUID
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
  image_count INTEGER
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
    n.updated_at,
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM note_images ni
        WHERE ni.note_id = n.id
          AND ni.user_id = n.user_id
          AND ni.status = 'uploaded'
      ),
      0
    ) AS image_count
  FROM notes n
  LEFT JOIN note_tags nt
    ON nt.note_id = n.id
   AND nt.user_id = n.user_id
  LEFT JOIN tags t
    ON t.id = nt.tag_id
   AND t.user_id = n.user_id
  WHERE n.user_id = (SELECT auth.uid())
    AND n.id = p_note_id
  GROUP BY n.id;
$$;

DROP FUNCTION IF EXISTS update_note_with_tags(UUID, TEXT, TEXT, TEXT[]);
CREATE FUNCTION update_note_with_tags(
  p_note_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
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
  image_count INTEGER
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM notes n
    WHERE n.id = p_note_id
      AND n.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  UPDATE notes AS n
  SET
    title = COALESCE(p_title, ''),
    content = p_content
  WHERE n.id = p_note_id
    AND n.user_id = current_user_id;

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 10
  )
  INSERT INTO tags (user_id, name)
  SELECT current_user_id, normalized_tag
  FROM normalized_tags
  ON CONFLICT ON CONSTRAINT tags_user_id_name_key DO NOTHING;

  DELETE FROM note_tags nt
  WHERE nt.note_id = p_note_id
    AND nt.user_id = current_user_id;

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 10
  )
  INSERT INTO note_tags (note_id, tag_id, user_id)
  SELECT p_note_id, t.id, current_user_id
  FROM normalized_tags nt
  JOIN tags t
    ON t.user_id = current_user_id
   AND t.name = nt.normalized_tag
  ON CONFLICT ON CONSTRAINT note_tags_pkey DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM get_note_with_tags(p_note_id);
END;
$$;

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
  image_count INTEGER,
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
      n.updated_at,
      COALESCE(
        (
          SELECT COUNT(*)::INTEGER
          FROM note_images ni
          WHERE ni.note_id = n.id
            AND ni.user_id = n.user_id
            AND ni.status = 'uploaded'
        ),
        0
      ) AS image_count
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
    nwt.image_count,
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
