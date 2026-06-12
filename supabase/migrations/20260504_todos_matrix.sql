ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'media'
    CHECK (urgency IN ('baja', 'media', 'alta', 'muy_urgente')),
  ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'normal'
    CHECK (importance IN ('muy_importante', 'importante', 'normal', 'poco_importante'));
