import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="bg-gray-700 text-white w-64 h-full">
      <ul>
        <li className="p-4 border-b border-gray-600">
          <Link href="/">Home</Link>
        </li>
        <li className="p-4 border-b border-gray-600">
          <Link href="/messages">Messages</Link>
        </li>
        <li className="p-4 border-b border-gray-600">
        <Link href="/waste-bins">Bins</Link>
        </li>
        <li className="p-4 border-b border-gray-600">
        <Link href="/routes">Routes</Link>
        </li>
      </ul>
    </div>
  );
}
