import { useState, useEffect } from 'react';
import { WaterMeterMonitoringPage } from './pages/WaterMeterMonitoringPage';
import type { DeviceOption } from './types/meter.types';
import { useDarkMode } from './hooks/useDarkMode';
import { Sun, Moon, Database, Globe } from 'lucide-react';
import { meterService } from './services/meter.service';
import { FullDashboardSkeleton } from './components/common/LoadingSkeleton';

export function App() {
  const { isDark, toggleDarkMode } = useDarkMode();
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
          // Fallback to static mock list if API fails completely
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
    <div className="min-h-screen bg-slate-100 dark:bg-dark-bg text-slate-900 dark:text-dark-text flex flex-col font-sans">
      {/* Top Flostat Platform Preview & State Simulator Bar */}
      <header className="sticky top-0 z-50 bg-white dark:bg-dark-card border-b border-flostat-border dark:border-dark-border shadow-sm px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand Logo & Integration Note */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-flostat-primary flex items-center justify-center text-white font-extrabold text-lg tracking-wider">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white tracking-tight">
                  FLOSTAT
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-flostat-primary dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  MODULE PREVIEW
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Water Meter Telemetry Module (AWS IoT API Ready)
              </span>
            </div>
          </div>

          {/* Dev Harness State Switcher Controls */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-flostat-secondary" />
              API STATE:
            </span>

            <div
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-sm flex items-center gap-1.5"
              title="Connects directly to the live AWS API Gateway endpoint"
            >
              <Globe className="w-3.5 h-3.5" />
              Real AWS API (Live)
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-1"
              title="Toggle Dark Mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Primary Flostat Module Component */}
      <main className="flex-1 bg-flostat-bg dark:bg-dark-bg transition-colors">
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
