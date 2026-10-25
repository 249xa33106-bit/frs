import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Shield, MapPin, Clock, Camera, RefreshCw, Database, Server, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

export const SystemSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    hostel_name: 'Tagore Central Hostel Complex',
    hostel_lat: '28.545000',
    hostel_lng: '77.192600',
    geofence_radius_meters: '250',
    attendance_curfew_time: '21:30',
    overdue_grace_minutes: '15',
    face_match_threshold: '0.70',
    liveness_check_enabled: '1'
  });

  const [serviceInfo, setServiceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsDetectMsg, setGpsDetectMsg] = useState<string | null>(null);

  const handleDetectCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings((prev) => ({
          ...prev,
          hostel_lat: pos.coords.latitude.toFixed(6),
          hostel_lng: pos.coords.longitude.toFixed(6)
        }));
        setGpsDetecting(false);
        setGpsDetectMsg(`Location acquired: (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}). Click 'Save Settings' to apply as campus center.`);
        setTimeout(() => setGpsDetectMsg(null), 8000);
      },
      (err) => {
        alert(`Could not fetch location: ${err.message}`);
        setGpsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Real Database Management State
  const [dbUrl, setDbUrl] = useState('');
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isMigratingDb, setIsMigratingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ connected: boolean; message: string; version?: string; database?: string } | null>(null);
  const [dbMigrationResult, setDbMigrationResult] = useState<{ success: boolean; message: string; database?: string; transferred?: any } | null>(null);

  const fetchSettingsAndStatus = async () => {
    try {
      // Fetch settings first and unblock UI immediately
      api.get('/admin/settings')
        .then((sRes) => {
          if (sRes.settings) {
            setSettings((prev) => ({ ...prev, ...sRes.settings }));
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));

      // Fetch status in parallel
      const sysRes = await api.get('/system/status');
      if (sysRes?.services) {
        setServiceInfo(sysRes.services);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndStatus();
  }, []);

  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await api.post('/system/test-db', { connectionString: dbUrl });
      setDbTestResult(res);
      if (res.connected) {
        fetchSettingsAndStatus();
      }
    } catch (err: any) {
      setDbTestResult({
        connected: false,
        message: err.message || 'Connection test failed'
      });
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleMigrateDatabase = async () => {
    if (!confirm('This will initialize the schema in PostgreSQL and transfer all 1,200 students, 300 rooms, 3 blocks, and attendance records. Proceed?')) {
      return;
    }
    setIsMigratingDb(true);
    setDbMigrationResult(null);
    try {
      const res = await api.post('/system/migrate-to-postgres', { connectionString: dbUrl });
      setDbMigrationResult(res);
      fetchSettingsAndStatus();
    } catch (err: any) {
      setDbMigrationResult({
        success: false,
        message: err.message || 'Migration failed'
      });
    } finally {
      setIsMigratingDb(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.post('/admin/settings', { settings });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-xs text-slate-400">Loading system settings...</div>;
  }

  const isFastAPIConnected = serviceInfo?.pythonFaceService?.status === 'Connected';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Hostel Safety System Settings
          </h1>
          <p className="text-xs text-slate-500">Configure geofencing, curfew timings, face recognition models, and audit rules</p>
        </div>
        <button
          onClick={fetchSettingsAndStatus}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Face Recognition & OpenCV Service Telemetry Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFastAPIConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Face Recognition & Liveness Microservice</h3>
              <p className="text-xs text-slate-500">Python FastAPI + OpenCV Cascade & Anti-spoofing Engine</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isFastAPIConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {isFastAPIConnected ? '● Online & Connected' : '● Client Matcher Active'}
          </span>
        </div>

        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Microservice Port</span>
            <span className="font-mono font-semibold text-slate-800">http://127.0.0.1:8005</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Detection Engine</span>
            <span className="font-semibold text-slate-800">HaarCascade FrontalFace + Eye Liveness</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Database</span>
            <span className="font-semibold text-slate-800">1,200 Students Seeded</span>
          </div>
        </div>
      </div>

      {/* Real Database Connection & PostgreSQL Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${serviceInfo?.databaseDetails?.postgresConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Real Enterprise Database Connection (PostgreSQL)</h3>
              <p className="text-xs text-slate-500">Connect to Cloud PostgreSQL (Supabase, Neon, AWS RDS, Railway) or Local Database</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              serviceInfo?.databaseDetails?.postgresConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {serviceInfo?.databaseDetails?.postgresConnected ? '● PostgreSQL Connected' : '● SQLite Operational (1,200 Students)'}
          </span>
        </div>

        {/* Status Breakdown */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Active Storage Engine:</span>
            <span className="font-bold text-slate-900">{serviceInfo?.databaseDetails?.engine || 'SQLite'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Operational Records:</span>
            <span className="font-medium text-slate-800">1,200 Students • 300 Rooms • 3 Blocks (Nalanda, Takshashila, Aryabhata)</span>
          </div>
          {serviceInfo?.databaseDetails?.postgresConnected && serviceInfo?.databaseDetails?.postgresVersion && (
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-600 text-[11px]">
              <span className="font-semibold">PostgreSQL Version:</span>
              <span className="font-mono truncate max-w-sm">{serviceInfo?.databaseDetails?.postgresVersion}</span>
            </div>
          )}
        </div>

        {/* Database Connection Input & Action Bar */}
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-semibold text-slate-700">
            PostgreSQL Connection URL (Optional / Override)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              placeholder="postgresql://user:password@endpoint.neon.tech/dbname?sslmode=require"
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestDatabase}
                disabled={isTestingDb || isMigratingDb}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTestingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-slate-500" />}
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleMigrateDatabase}
                disabled={isTestingDb || isMigratingDb}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isMigratingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Migrate & Connect
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-slate-500">Quick URL Formats:</span>
            <button
              type="button"
              onClick={() => setDbUrl('postgresql://neondb_owner:[PASSWORD]@[EP-NAME].us-east-2.aws.neon.tech/neondb?sslmode=require')}
              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 font-mono"
            >
              Neon (Cloud)
            </button>
            <button
              type="button"
              onClick={() => setDbUrl('postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres')}
              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 font-mono"
            >
              Supabase (Cloud)
            </button>
            <button
              type="button"
              onClick={() => setDbUrl('postgresql://postgres:postgrespassword@localhost:5432/hostel_safety')}
              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 font-mono"
            >
              Localhost (5432)
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Paste your real PostgreSQL connection string above and click <strong>Migrate & Connect</strong> to automatically create tables and transfer all 1,200 students. You can also save it directly to <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-mono">server/.env</code>.
          </p>
        </div>

        {/* Test Result Message */}
        {dbTestResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
              dbTestResult.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {dbTestResult.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{dbTestResult.message}</p>
              {dbTestResult.database && <p className="text-[11px] mt-0.5 font-mono">Database: {dbTestResult.database}</p>}
            </div>
          </div>
        )}

        {/* Migration Result Message */}
        {dbMigrationResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
              dbMigrationResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {dbMigrationResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{dbMigrationResult.message}</p>
                {dbMigrationResult.database && (
                  <p className="text-[11px] mt-0.5 font-mono">Target: {dbMigrationResult.database}</p>
                )}
              </div>
            </div>

            {dbMigrationResult.transferred && (
              <div className="mt-2 pt-2 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Students:</span>
                  <span className="font-bold text-slate-800">{dbMigrationResult.transferred.students}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Rooms:</span>
                  <span className="font-bold text-slate-800">{dbMigrationResult.transferred.rooms}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Attendance Logs:</span>
                  <span className="font-bold text-slate-800">{dbMigrationResult.transferred.attendance}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">Movements:</span>
                  <span className="font-bold text-slate-800">{dbMigrationResult.transferred.movements}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Settings updated and applied across all server inspection routines.</span>
          </div>
        )}

        {/* Section 1: Geofencing & Campus Coordinates */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Campus Geofencing Parameters
              </h3>
              <p className="text-xs text-slate-500">Defines the legitimate physical perimeter for student roll call</p>
            </div>
            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={gpsDetecting}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{gpsDetecting ? 'Detecting Location...' : '📍 Use My Current Location as Hostel GPS'}</span>
            </button>
          </div>

          {gpsDetectMsg && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{gpsDetectMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hostel Latitude</label>
              <input
                type="text"
                value={settings.hostel_lat}
                onChange={(e) => setSettings({ ...settings, hostel_lat: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hostel Longitude</label>
              <input
                type="text"
                value={settings.hostel_lng}
                onChange={(e) => setSettings({ ...settings, hostel_lng: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Geofence Radius (Meters)</label>
              <input
                type="number"
                value={settings.geofence_radius_meters}
                onChange={(e) => setSettings({ ...settings, geofence_radius_meters: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Attendance Curfew & Overdue Grace */}
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Timing & Overdue Rules
            </h3>
            <p className="text-xs text-slate-500">Configures daily curfew roll call cutoff and grace minutes before exception generation</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Daily Curfew Cutoff Time (HH:MM)</label>
              <input
                type="text"
                value={settings.attendance_curfew_time}
                onChange={(e) => setSettings({ ...settings, attendance_curfew_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Students must submit FRS attendance before this hour</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Overdue Grace Period (Minutes)</label>
              <input
                type="number"
                value={settings.overdue_grace_minutes}
                onChange={(e) => setSettings({ ...settings, overdue_grace_minutes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Minutes after scheduled return before triggering overdue alert</span>
            </div>
          </div>
        </div>

        {/* Section 3: Face Recognition Sensitivity */}
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Biometric Matching Thresholds
            </h3>
            <p className="text-xs text-slate-500">Tune cosine similarity tolerance and liveness enforcement</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cosine Match Threshold (0.50 - 0.95)</label>
              <input
                type="text"
                value={settings.face_match_threshold}
                onChange={(e) => setSettings({ ...settings, face_match_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Anti-Spoofing & Liveness Check</label>
              <select
                value={settings.liveness_check_enabled}
                onChange={(e) => setSettings({ ...settings, liveness_check_enabled: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="1">Enforced (Dual Eye Detection + Laplacian Sharpness)</option>
                <option value="0">Standard (Face Detection Only)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
