import React, { useEffect, useRef, useState, useMemo } from 'react';
import { z } from 'zod';
import {
  Eye, EyeOff, Radio, StopCircle, AlertCircle, Video, Link2, Wrench, Plus, X, Check
} from 'lucide-react';
import {
  useStartStream,
  useStopStream,
  useGetStreamStatus,
  getGetStreamStatusQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ── Platform definitions ────────────────────────────────────────────────────

type PlatformId = 'facebook' | 'youtube' | 'tiktok' | 'instagram' | 'custom';

interface Platform {
  id: PlatformId;
  label: string;
  rtmpUrl: string;
  color: string;
  icon: React.ReactNode;
}

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

const PLATFORMS: Platform[] = [
  {
    id: 'facebook',
    label: 'فيسبوك',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    color: '#1877F2',
    icon: <FacebookIcon />,
  },
  {
    id: 'youtube',
    label: 'يوتيوب',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
    color: '#FF0000',
    icon: <YouTubeIcon />,
  },
  {
    id: 'tiktok',
    label: 'تيك توك',
    rtmpUrl: 'rtmp://push.tiktokv.com/live/',
    color: '#010101',
    icon: <TikTokIcon />,
  },
  {
    id: 'instagram',
    label: 'انستقرام',
    rtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp/',
    color: '#E1306C',
    icon: <InstagramIcon />,
  },
  {
    id: 'custom',
    label: 'مخصص',
    rtmpUrl: '',
    color: '#a1a1aa',
    icon: <Wrench className="w-5 h-5" />,
  },
];

type SourceMode = 'camera' | 'url';

const keyHints: Record<PlatformId, string> = {
  facebook: 'Creator Studio → بث مباشر → مفتاح البث',
  youtube: 'YouTube Studio → البث المباشر → مفتاح البث',
  tiktok: 'Live Studio أو إعدادات البث المباشر',
  instagram: 'Professional Dashboard → البث المباشر',
  custom: 'أدخل مفتاح البث الخاص بمنصتك',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function Studio() {
  const [sourceMode, setSourceMode] = useState<SourceMode>('camera');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceUrlError, setSourceUrlError] = useState('');

  // Per-platform state
  const [activePlatforms, setActivePlatforms] = useState<Set<PlatformId>>(new Set(['facebook']));
  const [platformKeys, setPlatformKeys] = useState<Record<PlatformId, string>>({
    facebook: '', youtube: '', tiktok: '', instagram: '', custom: '',
  });
  const [platformCustomUrls, setPlatformCustomUrls] = useState<Record<'custom', string>>({ custom: '' });
  const [showKeys, setShowKeys] = useState<Record<PlatformId, boolean>>({
    facebook: false, youtube: false, tiktok: false, instagram: false, custom: false,
  });
  const [formError, setFormError] = useState('');

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const queryClient = useQueryClient();
  const startStreamMutation = useStartStream();
  const stopStreamMutation = useStopStream();

  const { data: streamStatus } = useGetStreamStatus({
    query: { refetchInterval: 3000, queryKey: getGetStreamStatusQueryKey() },
  });

  // Camera init
  useEffect(() => {
    if (sourceMode !== 'camera') return;
    let active: MediaStream | null = null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        active = s;
        setMediaStream(s);
        setCameraError(null);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        setCameraError('تعذر الوصول إلى الكاميرا. يرجى التحقق من الصلاحيات.');
      }
    })();
    return () => { active?.getTracks().forEach(t => t.stop()); };
  }, [sourceMode]);

  // Elapsed timer
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (streamStatus?.status === 'live' && streamStatus.startedAt) {
      iv = setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - new Date(streamStatus.startedAt!).getTime()) / 1000)));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(iv);
  }, [streamStatus?.status, streamStatus?.startedAt]);

  const togglePlatform = (id: PlatformId) => {
    setActivePlatforms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build destinations from active platforms with filled keys
  const destinations = useMemo(() => {
    return PLATFORMS.filter(p => activePlatforms.has(p.id) && platformKeys[p.id].trim())
      .map(p => ({
        rtmpUrl: p.id === 'custom' ? platformCustomUrls.custom.trim() : p.rtmpUrl,
        streamKey: platformKeys[p.id].trim(),
      }))
      .filter(d => d.rtmpUrl && d.streamKey);
  }, [activePlatforms, platformKeys, platformCustomUrls]);

  const handleStartStream = () => {
    setFormError('');
    setSourceUrlError('');

    // Validate
    if (activePlatforms.size === 0) {
      setFormError('اختر منصة واحدة على الأقل');
      return;
    }

    // Every active platform must have a stream key (and custom needs RTMP URL too)
    for (const p of PLATFORMS.filter(pl => activePlatforms.has(pl.id))) {
      if (!platformKeys[p.id].trim()) {
        setFormError(`أدخل مفتاح البث لـ ${p.label}`);
        return;
      }
      if (p.id === 'custom' && !platformCustomUrls.custom.trim()) {
        setFormError('أدخل رابط RTMP للمنصة المخصصة');
        return;
      }
    }

    if (sourceMode === 'url' && !sourceUrl.trim()) {
      setSourceUrlError('رابط المصدر مطلوب');
      return;
    }

    startStreamMutation.mutate(
      {
        data: {
          destinations,
          sourceUrl: sourceMode === 'url' ? sourceUrl.trim() : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStreamStatusQueryKey() });
          if (sourceMode === 'camera' && mediaStream) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
            wsRef.current = ws;
            ws.onopen = () => {
              try {
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                  ? 'video/webm;codecs=vp8,opus'
                  : 'video/webm';
                const rec = new MediaRecorder(mediaStream, { mimeType });
                recorderRef.current = rec;
                rec.ondataavailable = e => {
                  if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
                };
                rec.start(1000);
              } catch (e) { console.error('MediaRecorder error', e); }
            };
          }
        },
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : 'فشل في بدء البث');
        },
      }
    );
  };

  const handleStopStream = () => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    wsRef.current?.close();
    wsRef.current = null;
    recorderRef.current = null;
    stopStreamMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetStreamStatusQueryKey() }),
    });
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sc = (s % 60).toString().padStart(2, '0');
    return h === '00' ? `${m}:${sc}` : `${h}:${m}:${sc}`;
  };

  const statusColor = useMemo(() => {
    switch (streamStatus?.status) {
      case 'live': return 'bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.65)] animate-pulse';
      case 'connecting': return 'bg-amber-500 text-black';
      case 'error': return 'bg-red-500 text-white';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  }, [streamStatus?.status]);

  const statusText = useMemo(() => {
    switch (streamStatus?.status) {
      case 'live': return 'مباشر';
      case 'connecting': return 'جاري الاتصال...';
      case 'error': return 'خطأ';
      default: return 'متوقف';
    }
  }, [streamStatus?.status]);

  const isLiveOrConnecting = streamStatus?.status === 'live' || streamStatus?.status === 'connecting';
  const canSubmit = destinations.length > 0 && !startStreamMutation.isPending && (sourceMode !== 'camera' || !!mediaStream);

  const activePlatformList = PLATFORMS.filter(p => activePlatforms.has(p.id));

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#09090b] text-zinc-100 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 bg-[#09090b]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <Radio className="w-4 h-4 text-zinc-300" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">بث مباشر</h1>
        </div>
        <div className="flex items-center gap-4">
          {streamStatus?.status === 'live' && (
            <span className="font-mono text-lg font-medium text-zinc-300 tabular-nums" dir="ltr">{formatTime(elapsed)}</span>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${statusColor}`}>
            {streamStatus?.status === 'live' && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
            {statusText}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto w-full">

        {/* Preview */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
            {sourceMode === 'camera' ? (
              <>
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 bg-red-950/10">
                    <AlertCircle className="w-10 h-10" /><p className="font-medium">{cameraError}</p>
                  </div>
                ) : !mediaStream ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
                    <div className="w-9 h-9 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                    <p>جاري تشغيل الكاميرا...</p>
                  </div>
                ) : null}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
                <Link2 className="w-12 h-12 text-zinc-700" />
                {isLiveOrConnecting ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-9 h-9 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
                    <p className="text-zinc-400">{streamStatus?.status === 'live' ? 'البث يعمل من الرابط المصدر' : 'جاري الاتصال...'}</p>
                  </div>
                ) : (
                  <p className="text-zinc-600 text-sm">أدخل رابط المصدر وابدأ البث</p>
                )}
              </div>
            )}
            {streamStatus?.status === 'live' && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
              </div>
            )}
          </div>

          {(streamStatus?.error || streamStatus?.status === 'error') && (
            <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">حدث خطأ في البث</p>
                <p className="text-sm mt-1 text-red-400/80 whitespace-pre-line">
                  {streamStatus.error || 'يرجى التحقق من الرابط والمفتاح وإعدادات الاتصال.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[460px] flex flex-col gap-5">

          {!isLiveOrConnecting ? (
            <>
              {/* Source mode toggle */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-1.5 flex gap-1">
                <button type="button" onClick={() => setSourceMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${sourceMode === 'camera' ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  <Video className="w-4 h-4" />الكاميرا
                </button>
                <button type="button" onClick={() => setSourceMode('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${sourceMode === 'url' ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  <Link2 className="w-4 h-4" />رابط بث
                </button>
              </div>

              {/* Source URL */}
              {sourceMode === 'url' && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <Label className="text-zinc-300">رابط المصدر</Label>
                  <Input
                    dir="ltr"
                    value={sourceUrl}
                    onChange={e => { setSourceUrl(e.target.value); setSourceUrlError(''); }}
                    placeholder="https://youtube.com/watch?v=... أو رابط بث مباشر"
                    className="bg-zinc-950/50 border-zinc-800 text-left font-mono placeholder:text-zinc-600 focus-visible:ring-zinc-600 focus-visible:border-zinc-500"
                  />
                  {sourceUrlError && <p className="text-red-400 text-sm">{sourceUrlError}</p>}
                  <p className="text-zinc-600 text-xs leading-relaxed">
                    يدعم: يوتيوب (فيديو عادي أو بث مباشر)، Twitch، m3u8، RTMP — روابط يوتيوب تُحَل تلقائياً عبر yt-dlp.
                  </p>
                </div>
              )}

              {/* Platform picker — multi-select */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-3 font-medium">
                  المنصات — اختر واحدة أو أكثر وأدخل مفتاح كل منصة
                </p>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {PLATFORMS.map(p => {
                    const active = activePlatforms.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        title={p.label}
                        className={`
                          relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-all duration-200 select-none
                          ${active
                            ? 'border-zinc-400 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/80'
                          }
                        `}
                        style={active ? { boxShadow: `0 0 14px ${p.color}55` } : {}}
                      >
                        {active && (
                          <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          </span>
                        )}
                        <span className="transition-colors" style={{ color: active ? p.color : '#71717a' }}>
                          {p.icon}
                        </span>
                        <span className={`text-[10px] font-medium leading-none ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Keys for active platforms */}
                {activePlatforms.size > 0 && (
                  <div className="space-y-3">
                    {PLATFORMS.filter(p => activePlatforms.has(p.id)).map(p => (
                      <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
                        {/* Platform label */}
                        <div className="flex items-center gap-2">
                          <span style={{ color: p.color }}>{p.icon}</span>
                          <span className="text-sm font-medium text-zinc-300">{p.label}</span>
                          <button
                            type="button"
                            onClick={() => togglePlatform(p.id)}
                            className="mr-auto text-zinc-600 hover:text-zinc-400 transition-colors"
                            title="إزالة"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Custom RTMP URL */}
                        {p.id === 'custom' && (
                          <div className="space-y-1">
                            <Label className="text-zinc-500 text-xs">رابط RTMP</Label>
                            <Input
                              dir="ltr"
                              value={platformCustomUrls.custom}
                              onChange={e => setPlatformCustomUrls({ custom: e.target.value })}
                              placeholder="rtmp://..."
                              className="bg-zinc-900/50 border-zinc-800 text-left font-mono text-xs placeholder:text-zinc-600 focus-visible:ring-zinc-600 h-8"
                            />
                          </div>
                        )}

                        {/* Stream key */}
                        <div className="space-y-1">
                          <Label className="text-zinc-500 text-xs">مفتاح البث</Label>
                          <div className="relative">
                            <Input
                              dir="ltr"
                              type={showKeys[p.id] ? 'text' : 'password'}
                              value={platformKeys[p.id]}
                              onChange={e => setPlatformKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="••••••••••••"
                              autoComplete="new-password"
                              className="bg-zinc-900/50 border-zinc-800 text-left font-mono pr-9 text-xs placeholder:text-zinc-700 focus-visible:ring-zinc-600 h-8"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                              {showKeys[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-zinc-600 text-[11px]">{keyHints[p.id]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activePlatforms.size === 0 && (
                  <p className="text-zinc-600 text-xs text-center py-2">اضغط على أيقونة منصة لتفعيلها</p>
                )}
              </div>

              {/* Error */}
              {formError && (
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Submit button */}
              <Button
                type="button"
                onClick={handleStartStream}
                disabled={!canSubmit}
                className="w-full h-12 text-base font-bold transition-all disabled:opacity-40"
                style={canSubmit && activePlatformList.length > 0 ? {
                  background: activePlatformList.length === 1
                    ? activePlatformList[0].color
                    : `linear-gradient(135deg, ${activePlatformList.map(p => p.color).join(', ')})`,
                  color: '#fff',
                  boxShadow: `0 0 24px ${activePlatformList[0]?.color ?? '#fff'}44`,
                } : {}}
              >
                {startStreamMutation.isPending
                  ? 'جاري التحضير...'
                  : destinations.length === 0
                    ? 'ابدأ البث المباشر'
                    : destinations.length === 1
                      ? `ابدأ البث على ${activePlatformList.find(p => destinations[0]?.rtmpUrl.includes(p.rtmpUrl.split('/')[2] ?? '__'))?.label ?? activePlatformList[0]?.label}`
                      : `ابدأ البث على ${destinations.length} منصات`
                }
              </Button>
            </>
          ) : (
            /* Live / Connecting state */
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col gap-5">
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 font-medium">يُبث إلى</p>
                {activePlatformList.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span style={{ color: p.color }}>{p.icon}</span>
                    <span className="text-sm text-zinc-300 font-medium">{p.label}</span>
                    {streamStatus?.status === 'live' && (
                      <span className="mr-auto text-xs font-semibold text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                        مباشر
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">المصدر</p>
                <p className="text-sm text-zinc-300 font-medium">
                  {sourceMode === 'url' ? 'رابط بث خارجي' : 'الكاميرا والميكروفون'}
                </p>
              </div>
              <Button
                onClick={handleStopStream}
                variant="destructive"
                className="w-full h-12 text-base font-bold shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_32px_rgba(220,38,38,0.45)] transition-all"
              >
                <StopCircle className="w-5 h-5 ml-2" />
                أوقف البث
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
