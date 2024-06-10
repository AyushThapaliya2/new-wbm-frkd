'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function MessagesPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      const channel = supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
          setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== payload.old.id));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session, router]);

  const addMessage = async () => {
    if (newMessage.trim() === '') return;
    await supabase.from('messages').insert([{ content: newMessage, user_id: session.user.id }]);
    setNewMessage('');
  };

  const removeMessage = async (id) => {
    await supabase.from('messages').delete().eq('id', id);
  };

  if (!session || !session.user) return null;

  return (
    <div className="flex h-screen">
      <div className="flex-1 transition-all duration-300">
        <main className="p-4">
          <h1 className="text-2xl font-bold">Messages</h1>
          <div>
            <h2 className="text-xl">Messages</h2>
            <div className="mb-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="p-2 border border-gray-300 rounded"
                placeholder="Add a new message"
              />
              <button onClick={addMessage} className="ml-2 p-2 bg-blue-500 text-white rounded">Add</button>
            </div>
            <ul>
              {messages.map((msg) => (
                <li key={msg.id} className="mb-2 flex justify-between items-center">
                  {msg.content}
                  <button onClick={() => removeMessage(msg.id)} className="ml-2 p-1 bg-red-500 text-white rounded">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
