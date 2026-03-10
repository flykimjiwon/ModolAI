'use client';

function ChatLayout({ children, sidebarOpen = false }) {
  return (
    <div
      id='chat-layout'
      data-testid='chat-layout'
      className={`h-screen overflow-hidden flex flex-col bg-background transition-colors duration-200 relative transition-all duration-300 ease-in-out pl-0 ${
        sidebarOpen ? 'lg:pl-80' : 'lg:pl-16'
      }`}
    >
      {children}
    </div>
  );
}

export default ChatLayout;
