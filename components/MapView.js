import React, { useState, useEffect } from 'react';
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
const zoomDistance = 16;

const MapView = ({ devices, directions = null, mapWidth = '100%', mapHeight = '80vh', travelMode = null, fetchDirections = null, onClick, userLocation, showLegend = true, deviceType }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [clickLocation, setClickLocation] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY,
    libraries: libraries,
  });

  useEffect(() => {
    if (fetchDirections && isLoaded && devices.length > 0) {
      fetchDirections(devices, travelMode);
    }
  }, [isLoaded, devices, travelMode]);

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  const handleMarkerClick = (device) => {
    setSelectedMarker(device);
  };

  const handleMapClick = (e) => {
    const latLng = e.latLng.toJSON();
    setClickLocation(latLng);
    if (onClick) {
      onClick(latLng);
    }
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
    if (deviceType === 'weather') {
      return battery > 20 ? 'green' : 'red';
    } else {
      if (level >= 80 && battery <= 25) {
        return 'purple'; // Both full bin and low battery
      } else if (level >= 80) {
        return 'red'; // Full bin
      } else if (battery <= 25) {
        return 'orange'; // Low battery
      } else {
        return 'green'; // No issues
      }
    }
  };

  const renderStatusIcons = (level, battery) => {
    const icons = [];
    if (battery <= 25) {
      icons.push(
        <FontAwesomeIcon
          key="battery"
          icon={faBatteryQuarter}
          className="text-orange-400 mr-2"
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

  const Legend = ({ deviceType }) => {
    if (deviceType === 'weather') {
      return (
        <div className="absolute bottom-4 left-4 bg-white p-4 shadow-lg rounded-lg">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-400 inline-block mr-2"></span>
              <span>Battery OK</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 bg-red-500 inline-block mr-2"></span>
              <span>Change Battery</span>
            </div>
          </div>
        </div>
      );
    }

    return (
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
            <span className="w-4 h-4 bg-orange-300 inline-block mr-2"></span>
            <span>Low battery</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 bg-green-400 inline-block mr-2"></span>
            <span>No issues</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        options={mapOptions}
        zoom={zoomDistance}
        center={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : mapCenter}
        mapContainerStyle={{ width: mapWidth, height: mapHeight }}
        key={directions ? 'with-directions' : 'no-directions'}
        onClick={handleMapClick}
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
                    {deviceType === 'bins' && (
                      <>
                        <p>Level: {device.level}%</p>
                      </>
                    )}
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
        {userLocation && (
          <Marker
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
            icon={{
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z',
              fillColor: 'blue',
              fillOpacity: 1,
              scale: 1.5,
              strokeColor: 'white',
              strokeWeight: 1,
            }}
            title="Your Location"
          />
        )}
        {clickLocation && (
          <Marker
            position={{ lat: clickLocation.lat, lng: clickLocation.lng }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: 'blue',
              fillOpacity: 0.8,
              scale: 8,
              strokeColor: 'white',
              strokeWeight: 2,
            }}
            title="Selected Location"
          />
        )}
      </GoogleMap>
      {showLegend && <Legend deviceType={deviceType} />}
    </div>
  );
};

export default MapView;
