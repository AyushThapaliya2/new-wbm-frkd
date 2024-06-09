import React, { useState } from 'react';
import { GoogleMap, Marker, InfoWindow, DirectionsRenderer, useLoadScript } from '@react-google-maps/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBatteryQuarter, faTrash } from '@fortawesome/free-solid-svg-icons';

const mapCenter = { lat: 34.242245312686954, lng: -118.53043313617162 };
const mapOptions = {
  mapTypeId: 'satellite',
  clickableIcons: true,
  scrollwheel: true,
};
const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '80vh',
};

const zoomDistance = 16;

const MapView = ({ devices, directions }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY,
    libraries: libraries,
  });

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  const handleMarkerClick = (device) => {
    setSelectedMarker(device);
  };

  const getMarkerIcon = (level, battery) => {
    const color = getStatusColor(level, battery);
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.9,
      scale: 8,
      strokeColor: 'white',
      strokeWeight: 2,
    };
  };

  const getStatusColor = (level, battery) => {
    if (level >= 80 && battery <= 25) {
      return 'purple'; // Both full bin and low battery
    } else if (level >= 80) {
      return 'red'; // Full bin
    } else if (battery <= 25) {
      return 'orange'; // Low battery
    } else {
      return 'green'; // No issues
    }
  };

  const renderStatusIcons = (level, battery) => {
    const icons = [];
    if (battery <= 25) {
      icons.push(
        <FontAwesomeIcon
          key="battery"
          icon={faBatteryQuarter}
          className="text-yellow-500 mr-2"
        />
      ); // Low battery icon
    }
    if (level >= 80) {
      icons.push(
        <FontAwesomeIcon key="bin" icon={faTrash} className="text-red-500 mr-2" />
      ); // Full bin icon
    }
    return icons;
  };

  const Legend = () => (
    <div className="absolute bottom-4 left-4 bg-white p-4 shadow-lg rounded-lg">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center">
          <span className="w-4 h-4 bg-purple-500 inline-block mr-2"></span>
          <span>Full bin + low battery</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-red-500 inline-block mr-2"></span>
          <span>Full bin</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-yellow-300 inline-block mr-2"></span>
          <span>Low battery</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-green-300 inline-block mr-2"></span>
          <span>No issues</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        options={mapOptions}
        zoom={zoomDistance}
        center={mapCenter}
        mapContainerStyle={mapContainerStyle}
        key={directions ? 'with-directions' : 'no-directions'}
      >
        {directions && <DirectionsRenderer directions={directions} />}
        {devices.map((device) => {
          const icon = getMarkerIcon(device.level, device.battery);
          return (
            <React.Fragment key={device.id}>
              <Marker
                position={{
                  lat: parseFloat(device.lat),
                  lng: parseFloat(device.lng),
                }}
                icon={icon}
                onClick={() => handleMarkerClick(device)}
              />
              {selectedMarker === device && (
                <InfoWindow
                  position={{
                    lat: parseFloat(device.lat),
                    lng: parseFloat(device.lng),
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-2 bg-white rounded shadow-md">
                    {renderStatusIcons(device.level, device.battery)}
                    <p className="font-bold">ID: {device.unique_id}</p>
                    <p>Battery: {device.battery}%</p>
                    <p>Level: {device.level}%</p>
                    <p>Checked: {device.last_updated}</p>
                    <button className="bg-blue-500 text-white px-2 py-1 mt-2 rounded">
                      Submit Feedback
                    </button>
                    <button className="bg-green-500 text-white px-2 py-1 mt-2 ml-2 rounded">
                      View Historical Data
                    </button>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>
      <Legend />
    </div>
  );
};

export default MapView;
