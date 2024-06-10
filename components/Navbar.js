import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { FaUser } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

export default function Navbar({ toggleSidebar }) {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <nav className="bg-gray-800 text-white flex justify-between items-center p-3 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center">
        <button className="text-2xl" onClick={toggleSidebar}>☰</button>
        <div className="text-2xl font-bold ml-4">
          <Link href="/">WBM</Link>
        </div>
      </div>

      <div className="flex items-center relative">
        {session ? (
          <div className="flex items-center">
            <button className="text-2xl mr-2 relative" onClick={toggleDropdown}>
              <FaUser />
            </button>
            <span>Welcome, {session.user.email}</span>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded-md shadow-lg py-2">
                <button className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login">Login</Link>
        )}
      </div>
    </nav>
  );
}
