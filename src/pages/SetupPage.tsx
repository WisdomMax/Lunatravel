import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, CheckCircle, User, Sparkles, ArrowRight, Plus } from 'lucide-react';
import { LUNA_PERSONAS } from '../constants';

// 루나 기본 이미지 3종 + 페르소나 매핑
const LUNA_PRESETS = [
    { id: 'luna-1', src: '/assets/luna/luna-1.webp', label: '루나 A (발랄)', persona: LUNA_PERSONAS['luna-1'] },
    { id: 'luna-2', src: '/assets/luna/luna-2.webp', label: '루나 B (차분)', persona: LUNA_PERSONAS['luna-2'] },
    { id: 'luna-3', src: '/assets/luna/luna-3.webp', label: '루나 C (츤데레)', persona: LUNA_PERSONAS['luna-3'] },
];

interface SetupPageProps {
    onComplete: () => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
    const [userPhoto, setUserPhoto] = useState<string>(() =>
        localStorage.getItem('user_photo') || ''
    );

    const [lunaSelection, setLunaSelection] = useState<string>(() =>
        localStorage.getItem('luna_selection') || 'luna-1'
    );
    const [lunaCustomPhoto, setLunaCustomPhoto] = useState<string>(() =>
        localStorage.getItem('luna_custom_photo') || ''
    );

    const userPhotoInputRef = useRef<HTMLInputElement>(null);
    const lunaCustomInputRef = useRef<HTMLInputElement>(null);

    const handleUserPhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setUserPhoto(base64);
            localStorage.setItem('user_photo', base64);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleLunaCustomUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setLunaCustomPhoto(base64);
            setLunaSelection('custom');
            localStorage.setItem('luna_custom_photo', base64);
            localStorage.setItem('luna_selection', 'custom');
            // 커스텀은 기본 페르소나 사용
            localStorage.setItem('luna_persona', LUNA_PERSONAS['luna-1']);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleSelectPreset = useCallback((presetId: string) => {
        setLunaSelection(presetId);
        localStorage.setItem('luna_selection', presetId);
        const preset = LUNA_PRESETS.find(p => p.id === presetId);
        if (preset) {
            localStorage.setItem('luna_photo', preset.src);
            localStorage.setItem('luna_persona', preset.persona);
        }
    }, []);

    const handleStart = useCallback(() => {
        if (!userPhoto) return;
        if (lunaSelection === 'custom' && lunaCustomPhoto) {
            localStorage.setItem('luna_photo', lunaCustomPhoto);
            if (!localStorage.getItem('luna_persona')) {
                localStorage.setItem('luna_persona', LUNA_PERSONAS['luna-1']);
            }
        } else {
            const preset = LUNA_PRESETS.find(p => p.id === lunaSelection);
            if (preset) {
                localStorage.setItem('luna_photo', preset.src);
                localStorage.setItem('luna_persona', preset.persona);
            }
        }
        onComplete();
    }, [userPhoto, lunaSelection, lunaCustomPhoto, onComplete]);

    return (
        <div className="min-h-screen w-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-pink-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />

            <div className="relative z-10 w-full max-w-2xl">
                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-400/30 mb-5">
                        <Sparkles size={14} className="text-violet-400" />
                        <span className="text-violet-300 text-sm font-medium">AI 여행 친구 루나와 함께</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">여행 시작 전 설정</h1>
                    <p className="text-slate-400 text-base">사진을 등록하면 루나가 AI 여행 사진을 만들어드립니다 📸</p>
                </div>

                {/* 내 사진 등록 */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <User size={16} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">내 사진</h2>
                            <p className="text-slate-400 text-xs">얼굴 정면 사진 (증명사진 스타일 권장)</p>
                        </div>
                        {userPhoto && <CheckCircle size={16} className="text-green-400 ml-auto" />}
                    </div>

                    <div className="flex gap-4 items-start">
                        <div
                            onClick={() => userPhotoInputRef.current?.click()}
                            className="relative w-[120px] h-[160px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-slate-600 hover:border-blue-400 cursor-pointer transition-all group bg-slate-800/50"
                        >
                            {userPhoto ? (
                                <>
                                    <img src={userPhoto} alt="내 사진" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Upload size={20} className="text-white" />
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
                                    <Camera size={28} className="text-slate-400" />
                                    <p className="text-slate-500 text-xs text-center">클릭하여 업로드</p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg mb-3">
                                <p className="text-blue-300 text-xs leading-relaxed">
                                    📋 <strong>등록 팁</strong><br />
                                    얼굴이 선명하게 보이는 정면 사진을 사용하세요.<br />
                                    배경이 단순할수록 AI 합성 품질이 좋아집니다.
                                </p>
                            </div>
                            <button
                                onClick={() => userPhotoInputRef.current?.click()}
                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <Upload size={14} />
                                {userPhoto ? '사진 변경' : '사진 등록'}
                            </button>
                        </div>
                    </div>
                    <input ref={userPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleUserPhotoUpload} />
                </div>

                {/* 루나 선택 */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                            <Sparkles size={16} className="text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-sm">루나 선택</h2>
                            <p className="text-slate-400 text-xs">기본 3종 또는 직접 업로드</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {LUNA_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handleSelectPreset(preset.id)}
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${lunaSelection === preset.id
                                    ? 'border-violet-400 shadow-lg shadow-violet-500/30'
                                    : 'border-slate-600 hover:border-slate-400'
                                    }`}
                            >
                                <img
                                    src={preset.src}
                                    alt={preset.label}
                                    className="w-full h-full object-cover bg-slate-800"
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        img.style.display = 'none';
                                        const parent = img.parentElement;
                                        if (parent && !parent.querySelector('.placeholder')) {
                                            const div = document.createElement('div');
                                            div.className = 'placeholder absolute inset-0 flex flex-col items-center justify-center bg-slate-800 gap-1';
                                            div.innerHTML = `<span style="font-size:24px">🤖</span><span style="color:#94a3b8;font-size:11px">${preset.label}</span>`;
                                            parent.appendChild(div);
                                        }
                                    }}
                                />
                                {lunaSelection === preset.id && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <CheckCircle size={16} className="text-violet-400 drop-shadow" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                                    <p className="text-white text-xs text-center font-medium">{preset.label}</p>
                                </div>
                            </button>
                        ))}

                        {/* 커스텀 업로드 */}
                        <button
                            onClick={() => lunaCustomInputRef.current?.click()}
                            className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${lunaSelection === 'custom'
                                ? 'border-pink-400 shadow-lg shadow-pink-500/30'
                                : 'border-dashed border-slate-600 hover:border-slate-400'
                                }`}
                        >
                            {lunaCustomPhoto ? (
                                <>
                                    <img src={lunaCustomPhoto} alt="커스텀" className="w-full h-full object-cover" />
                                    {lunaSelection === 'custom' && (
                                        <div className="absolute top-1.5 right-1.5">
                                            <CheckCircle size={16} className="text-pink-400 drop-shadow" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                                        <p className="text-white text-xs text-center font-medium">커스텀</p>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-800/50">
                                    <Plus size={22} className="text-slate-400" />
                                    <p className="text-slate-400 text-xs text-center">직접<br />업로드</p>
                                </div>
                            )}
                        </button>
                    </div>
                    <input ref={lunaCustomInputRef} type="file" accept="image/*" className="hidden" onChange={handleLunaCustomUpload} />

                    <p className="mt-3 text-center text-slate-400 text-xs">
                        {lunaSelection === 'custom'
                            ? '✨ 커스텀 사진 선택됨'
                            : `✨ ${LUNA_PRESETS.find(p => p.id === lunaSelection)?.label ?? ''} 선택됨`}
                    </p>
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
