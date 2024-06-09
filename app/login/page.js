'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import bcrypt from 'bcryptjs';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', email);

    if (error || users.length === 0) {
      alert('Invalid email or password');
      return;
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      alert('Invalid email or password');
      return;
    }

    // Set user session and navigate to dashboard
    login(user);
    router.push('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block text-gray-700">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Login</button>
        <div className="mt-4 text-center">
          <p>
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-500">
              Sign Up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
