import Link from 'next/link';
import { FaHome, FaTrash, FaRoute, FaDatabase, FaCommentDots, FaTimes, FaPlus, FaSun, FaEdit } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { session, isAdmin } = useAuth();

  return (
    <div className={`bg-gray-700 text-white fixed top-0 left-0 w-64 h-full transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out z-50`}>
      <button onClick={toggleSidebar} className="text-white p-4 flex items-center">
        <FaTimes className="mr-2" />
        Close
      </button>
      <ul className="mt-4">
        <Link href="/" onClick={toggleSidebar}>
          <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
            <FaHome className="mr-2" />
            <span className="group-hover:text-white">Home</span>
          </li>
        </Link>
        <Link href="/waste-bins" onClick={toggleSidebar}>
          <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
            <FaTrash className="mr-2" />
            <span className="group-hover:text-white">Bins</span>
          </li>
        </Link>
        <Link href="/weather-sensors" onClick={toggleSidebar}>
          <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
            <FaSun className="mr-2" />
            <span className="group-hover:text-white">Weather Sensors</span>
          </li>
        </Link>
        <Link href="/routes" onClick={toggleSidebar}>
          <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
            <FaRoute className="mr-2" />
            <span className="group-hover:text-white">Routes</span>
          </li>
        </Link>
        <Link href="/feedback" onClick={toggleSidebar}>
          <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
            <FaCommentDots className="mr-2" />
            <span className="group-hover:text-white">Feedback</span>
          </li>
        </Link>
        {isAdmin && (
          <>
            <Link href="/historical-data" onClick={toggleSidebar}>
              <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
                <FaDatabase className="mr-2" />
                <span className="group-hover:text-white">Data</span>
              </li>
            </Link>
            <div className="w-full h-2 bg-gray-500"></div>
            <Link href="/update-device" onClick={toggleSidebar}>
              <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
                <FaEdit className="mr-2" />
                <span className="group-hover:text-white">Update Device</span>
              </li>
            </Link>
            <Link href="/register-device" onClick={toggleSidebar}>
              <li className="flex items-center p-4 border-b border-gray-600 hover:bg-gray-600 transition-colors cursor-pointer group">
                <FaPlus className="mr-2" />
                <span className="group-hover:text-white">Register New Device</span>
              </li>
            </Link>
          </>
        )}
      </ul>
    </div>
  );
}
