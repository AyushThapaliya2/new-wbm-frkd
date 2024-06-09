import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { session } = useAuth();

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-2xl font-bold">
          <Link href="/">WBM</Link>
        </div>
        <div>
          {session ? (
            <span>Welcome, {session.user.email}</span>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
