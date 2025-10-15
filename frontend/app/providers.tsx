'use client'

import { SessionProvider } from 'next-auth/react'
import { createContext, useContext, useEffect, useState } from 'react';

// 다크모드 컨텍스트 생성
export const DarkModeContext = createContext<{
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
} | undefined>(undefined);

// SSR을 고려한 초기값 설정 함수
function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('darkMode');
  if (stored !== null) return stored === 'true';
  // 시스템 설정 확인
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(getInitialDarkMode);

  // 초기 렌더링 시 즉시 dark 클래스 적용
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [darkMode]);

  // darkMode가 바뀔 때 <html> 클래스와 localStorage 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const html = document.documentElement;
      // 부드러운 전환을 위해 transition 일시적 비활성화
      html.style.transition = 'none';
      
      if (darkMode) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      
      // 리플로우 강제 실행
      html.offsetHeight;
      
      // transition 다시 활성화
      html.style.transition = '';
      
      localStorage.setItem('darkMode', String(darkMode));
    }
  }, [darkMode]);

  const setDarkMode = (v: boolean) => {
    setDarkModeState(v);
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const ctx = useContext(DarkModeContext);
  if (!ctx) throw new Error('useDarkMode must be used within DarkModeProvider');
  return ctx;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DarkModeProvider>
        {children}
      </DarkModeProvider>
    </SessionProvider>
  );
} 