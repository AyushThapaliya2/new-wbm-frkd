import Link from 'next/link';
import { FaHome, FaTrash, FaRoute, FaDatabase, FaCommentDots, FaTimes } from 'react-icons/fa';

export default function Sidebar({ isOpen, toggleSidebar }) {
  return (
    <div className={`bg-gray-700 text-white fixed top-0 left-0 w-64 h-full transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out z-50`}>
      <button onClick={toggleSidebar} className="text-white p-4 flex items-center">
        <FaTimes className="mr-2" />
        Close
      </button>
      <ul className="mt-4">
        <li className="flex items-center p-4 border-b border-gray-600">
          <FaHome className="mr-2" />
          <Link href="/" onClick={toggleSidebar}>Home</Link>
        </li>
        <li className="flex items-center p-4 border-b border-gray-600">
          <FaTrash className="mr-2" />
          <Link href="/waste-bins" onClick={toggleSidebar}>Bins</Link>
        </li>
        <li className="flex items-center p-4 border-b border-gray-600">
          <FaRoute className="mr-2" />
          <Link href="/routes" onClick={toggleSidebar}>Routes</Link>
        </li>
        <li className="flex items-center p-4 border-b border-gray-600">
          <FaDatabase className="mr-2" />
          <Link href="/historical-data" onClick={toggleSidebar}>Data</Link>
        </li>
        <li className="flex items-center p-4 border-b border-gray-600">
          <FaCommentDots className="mr-2" />
          <Link href="/feedback" onClick={toggleSidebar}>Feedback</Link>
        </li>
      </ul>
    </div>
  );
}
