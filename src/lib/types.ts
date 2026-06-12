export interface Chunk {
  source: string;
  page: string | number;
  text: string;
  score: number;
  search_type: string;
  figure_id?: string;
}

export interface CalcEntry {
  code: string;
  result: { result?: string | number; error?: string };
}

export interface QueryMeta {
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  time_seconds: number;
  calc_log: CalcEntry[];
  blocked: boolean;
  reason?: string;
  retrieval_query_used?: string;
  cached: boolean;
  execution_trace: string[];
}

export interface QueryResult {
  session_id: string;
  answer: string;
  chunks: Chunk[];
  context: string;
  meta: QueryMeta;
}

export interface ChatTurn {
  id: string;
  query: string;
  result: QueryResult;
  timestamp: Date;
}

export interface Document {
  filename: string;
  status: "active" | "processing" | "failed" | string;
  total_chunks?: number;
  ocr_executed?: boolean;
  has_images?: boolean;
  images_extracted_count?: number;
  ingested_at?: string;
}

export interface HealthStatus {
  postgres: boolean;
  elasticsearch: boolean;
  stats: {
    total_docs?: number;
    total_chunks?: number;
    total_assets?: number;
    total_timeseries?: number;
  };
}

export interface RecentQuery {
  hash: string;
  text: string;
  cached_at?: string;
}

export interface Citation {
  source: string;
  page: string;
  quote: string;
}

export interface EsChunk {
  source: string;
  page?: number;
  text: string;
  chunk_subtype?: string;
  structured_data?: unknown;
}
