CREATE INDEX "tasks_search_document_idx" ON "tasks" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", ''))
);
