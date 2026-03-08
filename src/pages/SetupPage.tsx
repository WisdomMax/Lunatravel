import React, { useState, useRef, useCallback } from 'react';
import { Camera, RefreshCcw, Upload, CheckCircle, User, Sparkles, ArrowRight } from 'lucide-react';

const LUNA_DEFAULT_IMAGE = '/assets/luna/luna-default.png';

interface SetupPageProps {
    onComplete: () => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
    const [userPhoto, setUserPhoto] = useState<string>(() =>
        localStorage.getItem('user_photo') || ''
    );
    const [lunaPhoto, setLunaPhoto] = useState<string>(() =>
        localStorage.getItem('luna_photo') || ''
    );

    const userPhotoInputRef = useRef<HTMLInputElement>(null);
    const lunaPhotoInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = useCallback(
        (type: 'user' | 'luna', e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                if (type === 'user') {
                    setUserPhoto(base64);
                    localStorage.setItem('user_photo', base64);
                } else {
                    setLunaPhoto(base64);
                    localStorage.setItem('luna_photo', base64);
                }
            };
            reader.readAsDataURL(file);
        },
        []
    );

    const resetLunaPhoto = useCallback(() => {
        setLunaPhoto('');
        localStorage.removeItem('luna_photo');
    }, []);

    const handleStart = useCallback(() => {
        if (!userPhoto) return;
        onComplete();
    }, [userPhoto, onComplete]);

    const lunaDisplayPhoto = lunaPhoto || LUNA_DEFAULT_IMAGE;

    return (
        <div className="min-h-screen w-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* 배경 장식 */}
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-pink-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '3s' }} />

            <div className="relative z-10 w-full max-w-2xl">
                {/* 헤더 */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-400/30 mb-6">
                        <Sparkles size={14} className="text-violet-400" />
                        <span className="text-violet-300 text-sm font-medium">AI 여행 친구 루나와 함께</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
                        여행 시작 전 설정
                    </h1>
                    <p className="text-slate-400 text-base leading-relaxed">
                        사진을 등록하면 루나가 AI로 여행 사진을 만들어드립니다 📸
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* 사용자 사진 카드 */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <User size={16} className="text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-sm">내 사진</h2>
                                <p className="text-slate-400 text-xs">얼굴 정면 사진</p>
                            </div>
                            {userPhoto && (
                                <CheckCircle size={16} className="text-green-400 ml-auto" />
                            )}
                        </div>

                        {/* 사진 미리보기 */}
                        <div
                            onClick={() => userPhotoInputRef.current?.click()}
                            className="relative w-full aspect-[3/4] max-w-[180px] mx-auto rounded-xl overflow-hidden border-2 border-dashed border-slate-600 hover:border-blue-400 cursor-pointer transition-all group bg-slate-800/50"
                        >
                            {userPhoto ? (
                                <>
                                    <img
                                        src={userPhoto}
                                        alt="내 사진"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Upload size={24} className="text-white" />
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                                        <Camera size={28} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-400 text-xs text-center leading-tight">
                                        클릭하여 사진 업로드
                                    </p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={userPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload('user', e)}
                        />

                        {/* 안내 박스 */}
                        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                            <p className="text-blue-300 text-xs leading-relaxed">
                                📋 <strong>등록 팁:</strong> 얼굴이 잘 보이는 정면 사진을 사용하세요. 증명사진처럼 배경이 단순할수록 AI 합성 품질이 좋아집니다.
                            </p>
                        </div>

                        <button
                            onClick={() => userPhotoInputRef.current?.click()}
                            className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            <Upload size={14} />
                            {userPhoto ? '사진 변경' : '사진 등록'}
                        </button>
                    </div>

                    {/* 루나 사진 카드 */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <Sparkles size={16} className="text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-sm">루나 사진</h2>
                                <p className="text-slate-400 text-xs">AI 여행 친구</p>
                            </div>
                            {!lunaPhoto && (
                                <span className="ml-auto text-xs text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">기본</span>
                            )}
                        </div>

                        {/* 루나 사진 미리보기 */}
                        <div
                            onClick={() => lunaPhotoInputRef.current?.click()}
                            className="relative w-full aspect-[3/4] max-w-[180px] mx-auto rounded-xl overflow-hidden border-2 border-dashed border-slate-600 hover:border-violet-400 cursor-pointer transition-all group bg-slate-800/50"
                        >
                            <img
                                src={lunaDisplayPhoto}
                                alt="루나 사진"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    // 기본 이미지 로드 실패 시 플레이스홀더 표시
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload size={24} className="text-white" />
                            </div>
                        </div>
                        <input
                            ref={lunaPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload('luna', e)}
                        />

                        <div className="mt-4 p-3 bg-violet-500/10 border border-violet-400/20 rounded-lg">
                            <p className="text-violet-300 text-xs leading-relaxed">
                                ✨ 루나의 기본 이미지가 설정되어 있습니다. 원하면 다른 사진으로 변경할 수 있어요.
                            </p>
                        </div>

                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => lunaPhotoInputRef.current?.click()}
                                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <Upload size={14} />
                                {lunaPhoto ? '변경' : '사진 변경'}
                            </button>
                            {lunaPhoto && (
                                <button
                                    onClick={resetLunaPhoto}
                                    title="기본 이미지로 초기화"
                                    className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
                                >
                                    <RefreshCcw size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 시작 버튼 */}
                <button
                    onClick={handleStart}
                    disabled={!userPhoto}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-2xl ${userPhoto
                            ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-violet-500/30 active:scale-[0.98]'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    {userPhoto ? (
                        <>
                            <Sparkles size={20} />
                            루나와 여행 시작하기
                            <ArrowRight size={20} />
                        </>
                    ) : (
                        '내 사진을 먼저 등록해주세요'
                    )}
                </button>

                {userPhoto && (
                    <p className="text-center text-slate-500 text-xs mt-4">
                        이미지는 기기에만 저장되며 외부로 전송되지 않습니다.
                    </p>
                )}
            </div>
        </div>
    );
}
