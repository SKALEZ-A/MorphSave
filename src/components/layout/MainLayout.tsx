'use client';

import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showFooter?: boolean;
  user?: {
    id: string;
    username: string;
    profileImage?: string;
    totalSaved: number;
    level: number;
    totalPoints: number;
  };
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  showSidebar = true,
  showFooter = true,
  user 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header
        user={user}
        onMenuToggle={handleMenuToggle}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex">
        {/* Sidebar - Desktop */}
        {showSidebar && (
          <div className="hidden md:block">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleSidebarToggle}
              className="h-[calc(100vh-4rem)] sticky top-16"
            />
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {showSidebar && isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-20 bg-black/50 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] md:hidden">
              <Sidebar className="h-full" />
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)]">
          <div className="container mx-auto px-4 py-6">
            {children}
          </div>
          
          {/* Footer */}
          {showFooter && <Footer />}
        </main>
      </div>
    </div>
  );
};

export { MainLayout };