import NextAuth from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

// 타입 확장을 위한 인터페이스 정의
interface ExtendedToken extends JWT {
  accessToken?: string;
  provider?: string;
  role?: string;
}

interface ExtendedSession extends Session {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    accessToken?: string;
    provider?: string;
    role?: string;
  }
}

const handler = NextAuth({
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      profile(profile) {
        // email이 없으면 대체 이메일 생성
        const kakaoId = profile.id;
        const email = profile.kakao_account?.email || `kakao_${kakaoId}@noemail.local`;
        return {
          id: kakaoId,
          name: profile.properties?.nickname,
          email,
          image: profile.properties?.profile_image,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "admin",
      name: "Admin",
      credentials: {
        username: { label: "관리자 ID", type: "text" },
        password: { label: "비밀번호", type: "password" }
      },
      async authorize(credentials) {
        // 환경변수에서 관리자 정보 가져오기
        const adminUsername = process.env.ADMIN_USERNAME || "admin";
        const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
        
        if (credentials?.username === adminUsername && 
            credentials?.password === adminPassword) {
          return {
            id: "admin",
            name: "관리자",
            email: "admin@retriever.com",
            role: "admin"
          };
        }
        return null;
      }
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // 로그인 시 JWT 토큰에 추가 정보 포함
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          provider: account.provider,
          role: (user as any).role || 'user', // 관리자 역할 추가
        };
      }
      return token;
    },
    async session({ session, token }) {
      // 세션에 추가 정보 포함
      const extendedToken = token as ExtendedToken;
      const extendedSession = session as ExtendedSession;
      
      if (extendedSession.user) {
        extendedSession.user.accessToken = extendedToken.accessToken;
        extendedSession.user.provider = extendedToken.provider;
        extendedSession.user.role = extendedToken.role;
      }
      
      return extendedSession;
    },
  },
});

export { handler as GET, handler as POST };