'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function Dashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      const channel = supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session, router]);

  if (!session || !session.user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        <main className="p-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div>
            <h2 className="text-xl">Messages</h2>
            <ul>
              {messages.map((msg) => (
                <li key={msg.id}>{msg.content}</li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
