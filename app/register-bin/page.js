'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchUserDetails, fetchNewDevices, updateDeviceRegistration } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { subscribeToTableChanges } from '@/lib/realtimeSubscription';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function RegisterDevicesPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [newDevices, setNewDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [binHeight, setBinHeight] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      fetchUserDetails(session.user.id).then(data => {
        if (!data) router.push('/login');
      });
      fetchNewDevices().then(data => setNewDevices(data));

      const unsubscribe = subscribeToTableChanges('devices', () => {
        fetchNewDevices().then(data => setNewDevices(data));
      });

      return () => {
        unsubscribe();
      };
    }
  }, [session, router]);

  const handleRegisterDevice = async () => {
    if (!selectedDeviceId) {
      setFormError("Please select a device.");
      return;
    }
    if (!binHeight) {
      setFormError("Please enter the bin height.");
      return;
    }
    if (!latitude || !longitude) {
      setFormError("Please select coordinates on the map or enter them manually.");
      return;
    }

    const updatedDevice = {
      id: selectedDeviceId,
      bin_height: binHeight,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      is_registered: true
    };

    const { data, error } = await updateDeviceRegistration(updatedDevice);

    if (error) {
      setFormError("Failed to register device. Please try again.");
    } else {
      clearInputs();
      setSuccessMessage("Device registered successfully.");
      setFormError(""); // Clear error message on successful submission

      // Clear the success message after a few seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  };

  const clearInputs = () => {
    setSelectedDeviceId("");
    setBinHeight("");
    setLatitude("");
    setLongitude("");
  };

  const handleMapClick = (latLng) => {
    setLatitude(latLng.lat);
    setLongitude(latLng.lng);
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setFormError("Failed to get location. Please try again.");
        }
      );
    } else {
      setFormError("Geolocation is not supported by this browser.");
    }
  };

  if (!session || !session.user) return null;

  return (
    <div className="flex h-screen">
      <div className="flex-1 transition-all duration-300">
        <main className="p-4">
          <h1 className="text-2xl font-bold mb-4">Register New Devices</h1>
          {formError && <p className="text-red-500 mb-4">{formError}</p>}
          {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}
          <div className="mb-6">
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                setFormError(""); // Clear any existing error when user changes the value
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            >
              <option value="">Select a device to register</option>
              {newDevices.map((device) => (
                <option key={device.id} value={device.unique_id}>
                  ID: {device.unique_id}, Battery: {device.battery}%, Level: {device.level}%
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Bin Height..."
              value={binHeight}
              onChange={(e) => {
                setBinHeight(e.target.value);
                setFormError(""); // Clear any existing error when user changes the value
              }}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            />
            <input
              type="text"
              placeholder="Latitude..."
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            />
            <input
              type="text"
              placeholder="Longitude..."
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="p-2 border border-gray-300 rounded w-full mb-2"
            />
            <div className="mb-4">
              <button onClick={handleGetLocation} className="p-2 bg-blue-500 text-white rounded mb-4">
                Use My Location
              </button>
              <MapView
                devices={[]}
                mapWidth="100%"
                mapHeight="600px"
                onClick={handleMapClick}
                userLocation={userLocation}
                showLegend={false}
              />
            </div>
            <button onClick={handleRegisterDevice} className="p-2 bg-blue-500 text-white rounded">Register Device</button>
          </div>
        </main>
      </div>
    </div>
  );
}
