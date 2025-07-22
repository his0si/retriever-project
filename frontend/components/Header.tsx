import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session } = useSession();

  return (
    <div className="w-full bg-transparent">
      <div className="max-w-4xl mx-auto flex justify-between items-center py-8">
        <h1 className="text-3xl font-bold">Retriever Project</h1>
        <div className="flex items-center gap-4">
          {session?.user?.name ? (
            <>
              <span className="text-gray-600">안녕하세요, {session.user.name}님!</span>
              <button
                onClick={() => signOut({ callbackUrl: '/landing' })}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <span className="text-gray-500">게스트 모드</span>
              <a
                href="/auth/signin"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                로그인
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 