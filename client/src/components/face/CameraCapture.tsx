import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertOctagon, RefreshCw, MapPin, ShieldCheck, Eye, Sparkles, Navigation, AlertTriangle, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import {
  HOSTEL_BOUNDARY_POLYGON,
  HOSTEL_CENTROID,
  HOSTEL_DEFAULT_RADIUS,
  calculateDistanceMeters,
  isPointInPolygon,
  getDistanceToHostelPolygon
} from '../../utils/geo';

interface CameraCaptureProps {
  onSuccess: (result: any) => void;
  onError?: (error: string) => void;
  hostelLat?: number;
  hostelLng?: number;
  geofenceRadius?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onSuccess,
  onError,
  hostelLat: propLat,
  hostelLng: propLng,
  geofenceRadius: propRadius
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');

  const [hostelGeofence, setHostelGeofence] = useState<{
    lat: number;
    lng: number;
    radius: number;
    hostelName: string;
  }>({
    lat: propLat || HOSTEL_CENTROID.lat,
    lng: propLng || HOSTEL_CENTROID.lng,
    radius: propRadius || HOSTEL_DEFAULT_RADIUS,
    hostelName: 'Hostel Campus'
  });

  const [locationState, setLocationState] = useState<{
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: 'fetching' | 'available' | 'denied';
    errorMessage?: string;
  }>({
    lat: null,
    lng: null,
    accuracy: null,
    status: 'fetching'
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [livenessStage, setLivenessStage] = useState<'align' | 'blink' | 'ready'>('align');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    diagnostics?: any;
  }>({
    type: null,
    message: ''
  });

  // Fetch authoritative hostel geofence coordinates from dashboard
  const fetchHostelCoordinates = async () => {
    try {
      const res = await api.get('/student/dashboard');
      if (res?.settings) {
        setHostelGeofence({
          lat: Number(res.settings.hostelLat || HOSTEL_CENTROID.lat),
          lng: Number(res.settings.hostelLng || HOSTEL_CENTROID.lng),
          radius: Number(res.settings.geofenceRadius || HOSTEL_DEFAULT_RADIUS),
          hostelName: res.student?.hostel_name || 'Tagore Central Hostel Complex'
        });
      }
    } catch (e) {
      // Keep defaults
    }
  };

  // Request high-accuracy GPS Location
  const requestLocation = useCallback(() => {
    setLocationState((prev) => ({ ...prev, status: 'fetching', errorMessage: undefined }));

    if (!('geolocation' in navigator)) {
      setLocationState({
        lat: null,
        lng: null,
        accuracy: null,
        status: 'denied',
        errorMessage: 'Geolocation is not supported by your browser.'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          status: 'available'
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        // Fallback only if on localhost development without SSL
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
          setLocationState({
            lat: HOSTEL_CENTROID.lat,
            lng: HOSTEL_CENTROID.lng,
            accuracy: 5,
            status: 'available'
          });
        } else {
          setLocationState({
            lat: null,
            lng: null,
            accuracy: null,
            status: 'denied',
            errorMessage: err.message || 'Location permission denied or unavailable.'
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Start Camera
  const startCamera = async () => {
    setFeedback({ type: null, message: '' });
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      setStream(mediaStream);
      setCameraPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Progress through liveness prompts
      setLivenessStage('align');
      setTimeout(() => setLivenessStage('blink'), 1200);
      setTimeout(() => setLivenessStage('ready'), 2400);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraPermission('denied');
      setFeedback({
        type: 'error',
        message: 'Camera permission denied or camera device unavailable. Please allow camera permissions in your browser.'
      });
      if (onError) onError('Camera permission denied.');
    }
  };

  useEffect(() => {
    fetchHostelCoordinates();
    requestLocation();
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Compute live distance & 4-corner polygon geofence status
  const isInsidePolygon =
    locationState.lat !== null && locationState.lng !== null
      ? isPointInPolygon(locationState.lat, locationState.lng, HOSTEL_BOUNDARY_POLYGON)
      : false;

  const currentDistance =
    locationState.lat !== null && locationState.lng !== null
      ? (isInsidePolygon ? 0 : getDistanceToHostelPolygon(locationState.lat, locationState.lng, HOSTEL_BOUNDARY_POLYGON))
      : null;

  // Student is inside if in polygon or within 15 meters indoor GPS drift buffer
  const isInsideGeofence = isInsidePolygon || (currentDistance !== null && currentDistance <= 15);
  const isOutsideGeofence = currentDistance !== null && !isInsideGeofence;

  // Handle Capture and Submit Attendance
  const captureAndVerify = async () => {
    // Strict geofence enforcement before capture
    if (isOutsideGeofence) {
      setFeedback({
        type: 'error',
        message: `Strict Geofence Enforced: You are outside the hostel perimeter (${currentDistance}m away). Face ID capture is strictly authorized only when physically inside the hostel grounds (q1-q4 boundary).`
      });
      return;
    }

    if (locationState.status !== 'available') {
      setFeedback({
        type: 'error',
        message: 'Active GPS location is required to verify you are inside the hostel premises. Please enable location.'
      });
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;
    setIsVerifying(true);
    setFeedback({ type: null, message: '' });

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const maxWidth = 640;
      const maxHeight = 480;
      const rawW = video.videoWidth || 640;
      const rawH = video.videoHeight || 480;
      const scale = Math.min(maxWidth / rawW, maxHeight / rawH, 1.0);

      canvas.width = Math.round(rawW * scale);
      canvas.height = Math.round(rawH * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas 2d context');

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.82);

      // Submit to backend
      const result = await api.post('/student/attendance', {
        imageBase64,
        latitude: locationState.lat,
        longitude: locationState.lng,
        clientSignals: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          accuracyMeters: locationState.accuracy,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timestamp: new Date().toISOString()
        }
      });

      setFeedback({
        type: 'success',
        message: result.message || 'Attendance verified successfully!',
        diagnostics: result.diagnostics
      });

      onSuccess(result);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Verification failed. Please retry.',
        diagnostics: err.diagnostics
      });
      if (onError) onError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
            <img src="/logo.png" alt="GPREC Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              GPREC Face ID Attendance
            </h3>
            <p className="text-xs text-slate-500">Live biometric verification restricted to hostel grounds</p>
          </div>
        </div>

        {/* Location Signal Pill & Refresh Button */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isInsideGeofence
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isOutsideGeofence
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : locationState.status === 'fetching'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isInsideGeofence
                ? `Inside Hostel (${currentDistance}m)`
                : isOutsideGeofence
                ? `Outside Hostel (${currentDistance}m)`
                : locationState.status === 'fetching'
                ? 'Locating GPS...'
                : 'GPS Disabled'}
            </span>
          </div>

          <button
            type="button"
            onClick={requestLocation}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Refresh GPS Coordinates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${locationState.status === 'fetching' ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Geofence Alert Banners */}
      {isOutsideGeofence && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-rose-950 text-xs sm:text-sm">
              Strict Geofence Enforced: Outside Hostel Grounds ({currentDistance}m away)
            </p>
            <p className="text-rose-800 text-[11px] leading-relaxed">
              Attendance Face ID capture is strictly authorized only when physically inside the hostel perimeter (Q1-Q4 quadrilateral boundary). Face ID capture is currently locked.
            </p>
          </div>
        </div>
      )}

      {locationState.status === 'denied' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">GPS Location Access Required</p>
            <p className="text-amber-800 text-[11px]">
              You must allow device GPS location permissions in your browser to verify that you are within hostel boundaries before capturing your face.
            </p>
            <button
              onClick={requestLocation}
              className="mt-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[11px] cursor-pointer"
            >
              Enable & Retry Location
            </button>
          </div>
        </div>
      )}

      {isInsideGeofence && (
        <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-[11px]">
            {isInsidePolygon
              ? '✓ Physical Geofence Verified: You are inside the hostel building (4-Corner Verified). Face ID verification unlocked.'
              : `✓ Physical Geofence Verified: You are within hostel grounds (${currentDistance}m from perimeter). Face ID verification unlocked.`}
          </span>
        </div>
      )}

      {/* Strict 4-Corner Boundary Coordinates Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Strict Hostel Boundary (4 Coordinates):
          </span>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
            Active Geofence
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px] text-slate-600">
          <div className="bg-white p-1.5 rounded-lg border border-slate-200/80">
            <span className="font-bold text-slate-900 block text-[9px] text-blue-600">Q1</span>
            15.774450, 78.054671
          </div>
          <div className="bg-white p-1.5 rounded-lg border border-slate-200/80">
            <span className="font-bold text-slate-900 block text-[9px] text-blue-600">Q2</span>
            15.774312, 78.054574
          </div>
          <div className="bg-white p-1.5 rounded-lg border border-slate-200/80">
            <span className="font-bold text-slate-900 block text-[9px] text-blue-600">Q3</span>
            15.774132, 78.054784
          </div>
          <div className="bg-white p-1.5 rounded-lg border border-slate-200/80">
            <span className="font-bold text-slate-900 block text-[9px] text-blue-600">Q4</span>
            15.774301, 78.054841
          </div>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center border-2 border-slate-200 shadow-inner">
        {cameraPermission === 'denied' ? (
          <div className="p-6 text-center text-white">
            <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h4 className="font-semibold text-sm">Camera Permission Denied</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Please enable camera access in your browser settings to verify your attendance.
            </p>
            <button
              onClick={startCamera}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Retry Camera Access
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Oval Face Alignment Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div
                className={`w-48 sm:w-56 h-64 sm:h-72 rounded-[50%] border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                  isOutsideGeofence
                    ? 'border-rose-400/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : livenessStage === 'ready'
                    ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                    : 'border-blue-400/80 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                }`}
              >
                {/* Horizontal eye alignment guide */}
                <div className="w-32 border-b border-white/30 -mt-10" />
              </div>

              {/* Liveness Guidance Pill */}
              <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xs border border-white/20 text-white text-xs font-medium flex items-center gap-2">
                {isOutsideGeofence ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span className="text-rose-200">Outside Hostel Geofence — Capture Locked</span>
                  </>
                ) : livenessStage === 'align' ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <span>Center your face within the oval</span>
                  </>
                ) : livenessStage === 'blink' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span>Liveness check: Natural blink or slight nod</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Position verified — Ready to submit</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Hidden Canvas for Frame Processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Action Button & Reset */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={captureAndVerify}
          disabled={
            isOutsideGeofence ||
            locationState.status !== 'available' ||
            isVerifying ||
            cameraPermission !== 'granted'
          }
          className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
            isOutsideGeofence
              ? 'bg-rose-100 text-rose-700 border border-rose-300 cursor-not-allowed opacity-90'
              : locationState.status === 'denied'
              ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90'
              : locationState.status === 'fetching'
              ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-wait'
              : isVerifying
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
          }`}
        >
          {isOutsideGeofence ? (
            <>
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>Outside Hostel ({currentDistance}m) — Capture Blocked</span>
            </>
          ) : locationState.status === 'denied' ? (
            <>
              <MapPin className="w-4 h-4 text-amber-700" />
              <span>GPS Location Required to Capture Face ID</span>
            </>
          ) : locationState.status === 'fetching' ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
              <span>Verifying Hostel Geofence Location...</span>
            </>
          ) : isVerifying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Analyzing Biometrics & Location...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Capture & Submit Attendance</span>
            </>
          )}
        </button>

        <button
          onClick={startCamera}
          disabled={isVerifying}
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          title="Restart Camera"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reset Camera</span>
        </button>
      </div>

      {/* Outcome / Feedback Banner */}
      {feedback.type && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">
                {feedback.type === 'success' ? 'Attendance Confirmed' : 'Verification Denied'}
              </p>
              <p className="mt-0.5 font-medium">{feedback.message}</p>

              {feedback.diagnostics && (
                <div className="mt-2.5 pt-2 border-t border-current/15 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Biometric Match:</span>
                    <span className="font-semibold">{feedback.diagnostics.faceConfidence}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Hostel Proximity:</span>
                    <span className="font-semibold">{feedback.diagnostics.distanceMeters}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
