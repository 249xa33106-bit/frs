import React, { useRef, useState, useEffect } from 'react';
import { Camera, CheckCircle2, AlertOctagon, RefreshCw, X, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';

interface FaceEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentId?: string; // If admin is enrolling for a specific student, otherwise self
  onSuccess: () => void;
}

export const FaceEnrollModal: React.FC<FaceEnrollModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentId,
  onSuccess
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

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
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraPermission('denied');
      setFeedback({
        type: 'error',
        message: 'Camera permission denied. Please allow camera access in your browser to enroll your face.'
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      setFeedback({ type: null, message: '' });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen]);

  const captureAndEnroll = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsEnrolling(true);
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

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

      const endpoint = studentId
        ? `/admin/students/${studentId}/face-enroll`
        : '/student/enroll-face';

      const res = await api.post(endpoint, { imageBase64 });

      setFeedback({
        type: 'success',
        message: res.message || 'Face template registered successfully!'
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1600);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Face enrollment failed. Please look straight into the camera.'
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Enroll Biometric Face Template</h3>
              <p className="text-xs text-slate-500">Resident: <span className="font-semibold text-slate-700">{studentName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Camera Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center border-2 border-slate-200 shadow-inner">
            {cameraPermission === 'denied' ? (
              <div className="p-6 text-center text-white">
                <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                <p className="text-xs text-slate-300">Camera permission denied. Allow camera access in your browser.</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-3 py-1.5 text-xs bg-white text-slate-900 rounded-lg font-medium cursor-pointer"
                >
                  Retry Permission
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Biometric Oval Guide Frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-64 border-2 border-blue-500/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs">
                      Align Face in Frame
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-3 py-1 rounded-full font-medium">
                  Look directly at the camera
                </div>
              </>
            )}
          </div>

          {/* Feedback messages */}
          {feedback.message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{feedback.message}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed text-center">
            OpenCV extracts a private 32-bin normalized spatial descriptor. Raw face images are processed in-memory and not stored indefinitely.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isEnrolling}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={captureAndEnroll}
            disabled={isEnrolling || cameraPermission !== 'granted'}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isEnrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>Capture & Enroll Face</span>
          </button>
        </div>
      </div>
    </div>
  );
};
