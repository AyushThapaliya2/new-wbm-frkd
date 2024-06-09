'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import bcrypt from 'bcryptjs';
import Link from 'next/link';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fname, setFname] = useState('');
  const [lname, setLname] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if email already exists
    const { data: existingUsers, error: selectError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email);

    if (selectError) {
      alert(selectError.message);
      return;
    }

    if (existingUsers.length > 0) {
      alert('Email already in use. Please use a different email.');
      return;
    }

    const { error: insertError } = await supabase.from('users').insert([
      { email, password: hashedPassword, fname, lname, role, start_date: startDate }
    ]);

    if (insertError) {
      alert(insertError.message);
    } else {
      alert('Signup successful! You can now log in.');
      router.push('/login');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignup} className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">Sign Up</h1>
        <div className="mb-4">
          <label htmlFor="fname" className="block text-gray-700">First Name</label>
          <input
            type="text"
            id="fname"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="lname" className="block text-gray-700">Last Name</label>
          <input
            type="text"
            id="lname"
            value={lname}
            onChange={(e) => setLname(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
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
        <div className="mb-4">
          <label htmlFor="role" className="block text-gray-700">Role</label>
          <input
            type="text"
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="startDate" className="block text-gray-700">Start Date</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mt-1"
            required
          />
        </div>
        <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Sign Up</button>
        <div className="mt-4 text-center">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="text-blue-500">
              Log In
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
