import { useState, useEffect } from 'react';
import { WaterMeterMonitoringPage } from './pages/WaterMeterMonitoringPage';
import type { DeviceOption } from './types/meter.types';
import { meterService } from './services/meter.service';
import { FullDashboardSkeleton } from './components/common/LoadingSkeleton';

export function App() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceOption | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function loadDevices() {
      try {
        setIsLoadingDevices(true);
        const apiDevices = await meterService.getAvailableDevices(true);
        if (active) {
          const flostat001FromApi = apiDevices?.find((d) => d.id === 'FLOSTAT_001');
          
          const deviceList: DeviceOption[] = [
            {
              id: 'FLOSTAT_001',
              name: 'FLOSTAT_001',
              facility: flostat001FromApi?.facility || 'Default Site',
              status: flostat001FromApi?.status || 'online',
              location: 'Main Overhead Tank',
              lastSeen: flostat001FromApi?.lastSeen,
            },
            {
              id: 'FLOSTAT_002',
              name: 'FLOSTAT_002',
              facility: 'Default Site',
              status: 'online',
              location: 'Ground Tank',
            },
            {
              id: 'FLOSTAT_003',
              name: 'FLOSTAT_003',
              facility: 'Default Site',
              status: 'online',
              location: 'Block A Tank',
            },
            {
              id: 'FLOSTAT_004',
              name: 'FLOSTAT_004',
              facility: 'Default Site',
              status: 'offline',
              location: 'Block B Tank',
            },
            {
              id: 'FLOSTAT_005',
              name: 'FLOSTAT_005',
              facility: 'Default Site',
              status: 'online',
              location: 'Fire Tank',
            },
          ];
          
          setDevices(deviceList);
          setSelectedDevice(deviceList[0]);
        }
      } catch (err) {
        console.error('Failed to load devices:', err);
        if (active) {
          const fallbackList: DeviceOption[] = [
            { id: 'FLOSTAT_001', name: 'FLOSTAT_001', facility: 'Default Site', status: 'online', location: 'Main Overhead Tank' },
            { id: 'FLOSTAT_002', name: 'FLOSTAT_002', facility: 'Default Site', status: 'online', location: 'Ground Tank' },
            { id: 'FLOSTAT_003', name: 'FLOSTAT_003', facility: 'Default Site', status: 'online', location: 'Block A Tank' },
            { id: 'FLOSTAT_004', name: 'FLOSTAT_004', facility: 'Default Site', status: 'offline', location: 'Block B Tank' },
            { id: 'FLOSTAT_005', name: 'FLOSTAT_005', facility: 'Default Site', status: 'online', location: 'Fire Tank' },
          ];
          setDevices(fallbackList);
          setSelectedDevice(fallbackList[0]);
        }
      } finally {
        if (active) {
          setIsLoadingDevices(false);
        }
      }
    }
    loadDevices();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      <main className="flex-1 bg-[#F8FAFC]">
        {isLoadingDevices ? (
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <FullDashboardSkeleton />
          </div>
        ) : (
          <WaterMeterMonitoringPage
            devStateOverride={undefined}
            connectedDataStream={null}
            devices={devices}
            selectedDevice={selectedDevice}
            onDeviceChange={(dev) => setSelectedDevice(dev)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
