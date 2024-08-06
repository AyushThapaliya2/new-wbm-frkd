// waste-bins/page.js
'use client';

import React, { useState, useEffect } from 'react';
import MapView from '@/components/MapView';
import ListView from '@/components/ListView';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchBinDevices } from '@/lib/dataProvider';
import { convertLevelToPercentage } from '@/utils/deviceHelpers';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';

export default function BinView() {
  const { session } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [view, setView] = useState('map');
  console.log(devices);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    }
    else{
      router.push('waste-bins');
    }
  }, [session, router]);

  useEffect(() => {
    const getDevices = async () => {
      const data = await fetchBinDevices();
      setDevices(convertLevelToPercentage(data));
    };

    getDevices();

    const unsubscribe = subscribeToTableChanges('devices', (payload) => {
      console.log('Change received!', payload);
      getDevices();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const mapListToggle = () => {
    if (view === 'map') {
      return <MapView devices={devices} deviceType='bins' />;
    } else if (view === 'list') {
      return <ListView devices={devices} deviceType='bins' />;
    } else {
      return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex h-screen">
      <div className="flex-1 transition-all duration-300">
        <main className="p-4">
          <div className="flex justify-center mb-4 space-x-4">
            <button
              onClick={() => setView('map')}
              className={`px-4 py-2 ${view === 'map' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Map View
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              List View
            </button>
          </div>
          
          {mapListToggle()}
        </main>
      </div>
    </div>
  );
}
