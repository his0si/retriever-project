import Profile from './Profile';
import ChatHistory from './ChatHistory';

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  selectedSessionId,
  setSelectedSessionId
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
}) {
  return (
    <div className={`relative transition-all duration-300 ${sidebarOpen ? 'w-1/3' : 'w-12'} flex flex-col gap-4`}>
      {sidebarOpen && (
        <>
          <Profile sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <ChatHistory
            onSelectSession={(id) => setSelectedSessionId(id || '')}
            selectedSessionId={selectedSessionId}
          />
        </>
      )}
    </div>
  );
} 