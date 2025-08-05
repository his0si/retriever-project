export interface CrawlSite {
  name: string
  url: string
  description: string
  enabled: boolean
}

export interface CrawlSites {
  sites: CrawlSite[]
  settings: {
    max_depth: number
    update_frequency: string
    last_updated: string
    total_sites: number
  }
  schedule: string
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

export interface ToggleSiteResponse {
  site_name: string
  enabled: boolean
  message: string
}

export type AlertType = 'success' | 'error' | 'info'
export type ButtonVariant = 'primary' | 'secondary'