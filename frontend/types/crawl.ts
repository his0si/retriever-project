export interface CrawlSite {
  name: string
  enabled: boolean
}

export interface CrawlSites {
  total_enabled: number
  sites: CrawlSite[]
}

export interface DbStatusUpdate {
  url: string
  updated_at: string
  chunk_index: number
  total_chunks: number
}

export interface DbStatus {
  total_documents: number
  last_checked: string
  recent_updates: DbStatusUpdate[]
}

export interface CrawlResponse {
  task_id: string
}

export interface AutoCrawlResponse extends CrawlResponse {
  sites: string[]
}

export type AlertType = 'success' | 'error' | 'info'
export type ButtonVariant = 'primary' | 'secondary'