'use client'
import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function RootLayout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <html lang="en">
      <body className="flex flex-col h-screen overflow-hidden">
        <AuthProvider>
          <Navbar toggleSidebar={toggleSidebar} />
          <div className="relative flex flex-1 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="flex-1 overflow-auto">
              <main className="pt-16">{children}</main> {/* Adjust padding as needed */}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
