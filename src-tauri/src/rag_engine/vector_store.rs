use lancedb::{connect, Connection, Table};
use lancedb::query::{QueryBase, ExecutableQuery};
use lancedb::arrow::arrow_schema::{DataType, Field, Schema};
use arrow_array::{RecordBatch, RecordBatchIterator, RecordBatchReader, StringArray, FixedSizeListArray, Float32Array};
use std::sync::Arc;
use tokio::runtime::Runtime;

const EMBEDDING_DIM: i32 = 384;

fn runtime() -> Runtime {
    Runtime::new().expect("Failed to create Tokio runtime")
}

fn schema() -> Arc<Schema> {
    Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("document_id", DataType::Utf8, false),
        Field::new("project_id", DataType::Utf8, false),
        Field::new("content", DataType::Utf8, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                EMBEDDING_DIM,
            ),
            false,
        ),
    ]))
}

async fn open_db(db_path: &str) -> Result<Connection, String> {
    connect(db_path).execute().await.map_err(|e| e.to_string())
}

async fn open_or_create_table(conn: &Connection) -> Result<Table, String> {
    let table_names = conn.table_names().execute().await.map_err(|e| e.to_string())?;

    if table_names.iter().any(|n| n == "chunks") {
        conn.open_table("chunks").execute().await.map_err(|e| e.to_string())
    } else {
        let empty_batch = RecordBatch::new_empty(schema());
        let batches: Box<dyn RecordBatchReader + Send> =
            Box::new(RecordBatchIterator::new(vec![Ok(empty_batch)], schema()));
        conn.create_table("chunks", batches)
            .execute()
            .await
            .map_err(|e| e.to_string())
    }
}

pub struct VectorRecord {
    pub id: String,
    pub document_id: String,
    pub project_id: String,
    pub content: String,
    pub embedding: Vec<f32>,
}

#[derive(Debug, serde::Serialize)]
pub struct SearchResult {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub distance: f32,
}

/// Stores a batch of chunk embeddings into the LanceDB "chunks" table.
pub fn store_embeddings(db_path: &str, records: &[VectorRecord]) -> Result<(), String> {
    if records.is_empty() {
        return Ok(());
    }

    runtime().block_on(async {
        let conn = open_db(db_path).await?;
        let table = open_or_create_table(&conn).await?;

        let ids: Vec<&str> = records.iter().map(|r| r.id.as_str()).collect();
        let doc_ids: Vec<&str> = records.iter().map(|r| r.document_id.as_str()).collect();
        let project_ids: Vec<&str> = records.iter().map(|r| r.project_id.as_str()).collect();
        let contents: Vec<&str> = records.iter().map(|r| r.content.as_str()).collect();

        let flat_values: Vec<f32> = records.iter().flat_map(|r| r.embedding.clone()).collect();
        let value_array = Float32Array::from(flat_values);
        let vector_array = FixedSizeListArray::try_new(
            Arc::new(Field::new("item", DataType::Float32, true)),
            EMBEDDING_DIM,
            Arc::new(value_array),
            None,
        )
        .map_err(|e| e.to_string())?;

        let batch = RecordBatch::try_new(
            schema(),
            vec![
                Arc::new(StringArray::from(ids)),
                Arc::new(StringArray::from(doc_ids)),
                Arc::new(StringArray::from(project_ids)),
                Arc::new(StringArray::from(contents)),
                Arc::new(vector_array),
            ],
        )
        .map_err(|e| e.to_string())?;

        let batches: Box<dyn RecordBatchReader + Send> =
            Box::new(RecordBatchIterator::new(vec![Ok(batch)], schema()));
        table.add(batches).execute().await.map_err(|e| e.to_string())?;

        Ok(())
    })
}

/// Searches for the top-K chunks most similar to the given embedding vector,
/// optionally restricted to a single project.
pub fn search(
    db_path: &str,
    query_embedding: &[f32],
    project_id: Option<&str>,
    top_k: usize,
) -> Result<Vec<SearchResult>, String> {
    runtime().block_on(async {
        let conn = open_db(db_path).await?;

        let table_names = conn.table_names().execute().await.map_err(|e| e.to_string())?;
        if !table_names.iter().any(|n| n == "chunks") {
            return Ok(vec![]);
        }

        let table = conn.open_table("chunks").execute().await.map_err(|e| e.to_string())?;

        let mut query = table
            .query()
            .nearest_to(query_embedding)
            .map_err(|e| e.to_string())?
            .limit(top_k);

        if let Some(pid) = project_id {
            query = query.only_if(format!("project_id = '{}'", pid));
        }

        let mut stream = query.execute().await.map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        use futures::TryStreamExt;
        while let Some(batch) = stream.try_next().await.map_err(|e| e.to_string())? {
            let ids = batch
                .column_by_name("id")
                .ok_or("missing id column")?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or("id column wrong type")?;
            let doc_ids = batch
                .column_by_name("document_id")
                .ok_or("missing document_id column")?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or("document_id column wrong type")?;
            let contents = batch
                .column_by_name("content")
                .ok_or("missing content column")?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or("content column wrong type")?;
            let distances = batch
                .column_by_name("_distance")
                .and_then(|c| c.as_any().downcast_ref::<Float32Array>().cloned());

            for i in 0..batch.num_rows() {
                results.push(SearchResult {
                    id: ids.value(i).to_string(),
                    document_id: doc_ids.value(i).to_string(),
                    content: contents.value(i).to_string(),
                    distance: distances.as_ref().map(|d| d.value(i)).unwrap_or(0.0),
                });
            }
        }

        Ok(results)
    })
}