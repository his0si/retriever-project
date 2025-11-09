/**
 * 사용자 설정 API 클라이언트
 */

export interface Department {
  name: string
  url?: string
  enabled: boolean
}

export interface UserPreferences {
  id: string
  user_id: string
  preferred_departments: Department[]
  department_search_enabled: boolean
  search_mode: 'filter' | 'expand'
  created_at: string
  updated_at: string
}

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/backend`

/**
 * 사용자 설정 조회
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    console.log('[API] Fetching user preferences for:', userId)
    const url = `${API_BASE_URL}/user-preferences/${userId}`
    console.log('[API] Request URL:', url)
    const response = await fetch(url)
    console.log('[API] Response status:', response.status)
    if (response.status === 404) {
      console.log('[API] User preferences not found (404)')
      return null
    }
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] Failed to fetch user preferences:', errorText)
      throw new Error('Failed to fetch user preferences')
    }
    const data = await response.json()
    console.log('[API] User preferences fetched:', data)
    return data
  } catch (error) {
    console.error('[API] Error fetching user preferences:', error)
    return null
  }
}

/**
 * 사용자 설정 생성
 */
export async function createUserPreferences(
  userId: string,
  departments: Department[],
  departmentSearchEnabled: boolean,
  searchMode: 'filter' | 'expand'
): Promise<UserPreferences> {
  const payload = {
    user_id: userId,
    preferred_departments: departments,
    department_search_enabled: departmentSearchEnabled,
    search_mode: searchMode
  }
  console.log('[API] Creating user preferences:', payload)

  const response = await fetch(`${API_BASE_URL}/user-preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[API] Failed to create user preferences:', errorText)
    throw new Error('Failed to create user preferences')
  }

  const data = await response.json()
  console.log('[API] User preferences created:', data)
  return data
}

/**
 * 사용자 설정 업데이트
 */
export async function updateUserPreferences(
  userId: string,
  updates: {
    preferred_departments?: Department[]
    department_search_enabled?: boolean
    search_mode?: 'filter' | 'expand'
  }
): Promise<UserPreferences> {
  console.log('[API] Updating user preferences for:', userId, 'with:', updates)

  const response = await fetch(`${API_BASE_URL}/user-preferences/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[API] Failed to update user preferences:', errorText)
    throw new Error('Failed to update user preferences')
  }

  const data = await response.json()
  console.log('[API] User preferences updated:', data)
  return data
}

/**
 * 사용자 설정 삭제
 */
export async function deleteUserPreferences(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/user-preferences/${userId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error('Failed to delete user preferences')
  }
}
