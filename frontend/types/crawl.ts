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

export interface TaskDetail {
  worker: string
  task_id: string
  name: string
  args: any[]
  kwargs?: Record<string, any>
  time_start?: number
  worker_pid?: number
}

export interface ProcessingStats {
  total_processed: number
  uptime_seconds: number
  tasks_per_minute: number
  tasks_per_hour: number
}

export interface QueueStatus {
  queue_status: {
    active_tasks: number
    scheduled_tasks: number
    reserved_tasks: number
    total_pending: number
  }
  workers: {
    online: number
    details: Record<string, any>
  }
  task_details: {
    active: TaskDetail[]
    reserved: TaskDetail[]
  }
  processing_stats: Record<string, ProcessingStats>
  total_stats: Record<string, Record<string, number>>
  current_activity: {
    is_crawling: boolean
    is_processing_embeddings: boolean
    has_pending_work: boolean
  }
  timestamp: string
}

export interface PurgeResponse {
  status: string
  message: string
  purged_tasks: number
  revoked_tasks: number
  total_cleared: number
}

export type AlertType = 'success' | 'error' | 'info'
export type ButtonVariant = 'primary' | 'secondary'