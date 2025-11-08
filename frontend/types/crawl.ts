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
  worker_name?: string
}

export interface QueueStatus {
  queue_status: {
    active_tasks: number
    scheduled_tasks: number
    reserved_tasks: number
    total_pending: number
    rabbitmq_messages: number
    crawler_queue_messages: number
    embedding_queue_messages: number
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
  crawler_stats: ProcessingStats
  embedding_stats: ProcessingStats
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

// ============================================================================
// Scheduled Crawling Types (Supabase-based)
// ============================================================================

export type ScheduleType = 'daily' | 'weekly' | 'monthly'

export interface CrawlFolder {
  id: string
  name: string
  schedule_type: ScheduleType
  schedule_time: string  // "HH:MM:SS" format
  schedule_day: number | null  // 0=Sunday, 6=Saturday (null for daily/monthly)
  max_depth: number  // Maximum crawl depth (1-5)
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface ScheduledCrawlSite {
  id: string
  folder_id: string
  name: string
  url: string
  description: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface FolderWithSites extends CrawlFolder {
  sites: ScheduledCrawlSite[]
}

export interface CreateFolderRequest {
  name: string
  schedule_type: ScheduleType
  schedule_time: string
  schedule_day?: number | null
  max_depth?: number
  enabled?: boolean
}

export interface UpdateFolderRequest {
  name?: string
  schedule_type?: ScheduleType
  schedule_time?: string
  schedule_day?: number | null
  max_depth?: number
  enabled?: boolean
}

export interface CreateSiteRequest {
  folder_id: string
  name: string
  url: string
  description?: string
  enabled?: boolean
}

export interface UpdateSiteRequest {
  name?: string
  url?: string
  description?: string
  enabled?: boolean
}