export const API_URL = '/api'

export const CRAWL_CONSTANTS = {
  MAX_DEPTH_MIN: 1,
  MAX_DEPTH_MAX: 5,
  DEFAULT_MAX_DEPTH: 2,
  DB_STATUS_REFRESH_DELAY: 30000, // 30 seconds
  AUTO_CRAWL_REFRESH_DELAY: 60000, // 60 seconds
} as const