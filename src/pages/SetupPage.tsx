import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, CheckCircle, User, Sparkles, ArrowRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Changed from 'motion/react' to 'framer-motion' for AnimatePresence and motion.div
import { LUNA_PERSONAS } from '../constants';

// 루나 기본 이미지 3종 + 페르소나 매핑
const LUNA_PRESETS = [
    {
        id: 'luna-1',
        src: '/assets/luna/luna-1.webp',
        label: '루나 C',
        subLabel: '츤데레 가이드',
        description: '겉으론 까칠해도 속은 누구보다 따뜻해요. "흥, 나니까 알려주는 거야!"라며 툴툴대지만 모르는 게 없는 똑순이랍니다.',
        stats: { love: 40, knowledge: 95, energy: 60 },
        color: 'text-amber-400',
        persona: LUNA_PERSONAS['luna-1']
    },
    {
        id: 'luna-2',
        src: '/assets/luna/luna-2.webp',
        label: '루나 B',
        subLabel: '매혹적인 조력자',
        description: '지적이고 차분한 매력 뒤에 묘한 설렘을 숨기고 있어요. 오빠와의 은밀한 썸을 즐기는 성숙한 여행 동반자예요.',
        stats: { love: 75, knowledge: 85, energy: 50 },
        color: 'text-rose-400',
        persona: LUNA_PERSONAS['luna-2']
    },
    {
        id: 'luna-3',
        src: '/assets/luna/luna-3.webp',
        label: '루나 A',
        subLabel: '해피 바이러스',
        description: '오빠를 너무너무 좋아하는 귀염둥이 여동생! "오빠랑 있으면 어디든 좋아!"라며 무조건적인 호감을 표현해줄 거예요.',
        stats: { love: 99, knowledge: 40, energy: 95 },
        color: 'text-sky-400',
        persona: LUNA_PERSONAS['luna-3']
    },
];

const StatBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] font-bold text-slate-400 w-12 tracking-tighter uppercase">{label}</span>
        <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden border border-white/5">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full ${colorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
            />
        </div>
        <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{value}</span>
    </div>
);

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

    const selectedLuna = LUNA_PRESETS.find(p => p.id === lunaSelection);

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
            localStorage.setItem('luna_persona', LUNA_PERSONAS['luna-3']); // 적극적인 성격 기본값
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
                localStorage.setItem('luna_persona', LUNA_PERSONAS['luna-3']);
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
        <div className="min-h-screen w-screen bg-[#0a0b1e] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* 시네마틱 배경 요소 */}
            <div className="absolute inset-0 z-0 opactiy-20 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
                <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

                {/* 왼쪽: 내 캐릭터 정보 */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="mb-8">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-blue-500/10 border-l-4 border-blue-500 mb-4"
                        >
                            <User size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-xs font-black uppercase tracking-widest">Player Profile</span>
                        </motion.div>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter mb-2">
                            TRAVELER <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">SETUP</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-medium tracking-tight">당신의 정보를 입력하고 모험을 시작하세요.</p>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-[#151933] border border-white/5 rounded-2xl p-6 overflow-hidden">
                            <div className="flex gap-6">
                                <div
                                    onClick={() => userPhotoInputRef.current?.click()}
                                    className="relative w-[140px] h-[180px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-blue-400 cursor-pointer transition-all bg-[#0a0b1e] group"
                                >
                                    {userPhoto ? (
                                        <>
                                            <img src={userPhoto} alt="내 사진" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Upload size={24} className="text-white drop-shadow-lg" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-white/5">
                                                <Camera size={24} className="text-slate-500" />
                                            </div>
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Upload Photo</p>
                                        </div>
                                    )}
                                    {/* 스캔 라인 효과 */}
                                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-20 w-full animate-[scan_3s_linear_infinite]" />
                                </div>

                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                                            My Image
                                            {userPhoto && <CheckCircle size={16} className="text-blue-400" />}
                                        </h3>
                                        <div className="space-y-2 mb-4">
                                            <p className="text-slate-400 text-xs leading-relaxed">
                                                <span className="text-blue-400 mr-2">▶</span> 정면 증명사진 스타일 권장
                                            </p>
                                            <p className="text-slate-400 text-xs leading-relaxed">
                                                <span className="text-blue-400 mr-2">▶</span> 고화질일수록 합성 품질 향상
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => userPhotoInputRef.current?.click()}
                                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} />
                                        {userPhoto ? 'REFORM ENTRY' : 'REGISTER NOW'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 루나 캐릭터 선택 정보 */}
                <div className="lg:col-span-7">
                    <div className="bg-[#151933]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white italic tracking-tight flex items-center gap-3">
                                    <Sparkles className="text-violet-400" size={24} />
                                    SELECT YOUR MATE
                                </h2>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Choose a partner for your journey</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Luna Database</span>
                                <div className="text-violet-400 font-mono text-xs">v2.5_LIVE_CONNECTED</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-8">
                            {LUNA_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleSelectPreset(preset.id)}
                                    className={`relative aspect-[3/4.2] rounded-2xl overflow-hidden border-2 transition-all duration-300 group ${lunaSelection === preset.id
                                        ? 'border-violet-500 shadow-[0_0_25px_rgba(139,92,246,0.3)] scale-[1.05] z-10'
                                        : 'border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <img
                                        src={preset.src}
                                        alt={preset.label}
                                        className={`w-full h-full object-cover transition-transform duration-500 ${lunaSelection === preset.id ? 'scale-110' : 'group-hover:scale-105'}`}
                                    />
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80`} />

                                    {lunaSelection === preset.id && (
                                        <motion.div
                                            layoutId="activeBorder"
                                            className="absolute inset-0 border-2 border-violet-400 z-20 pointer-events-none"
                                            initial={false}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}

                                    <div className="absolute bottom-3 left-0 right-0 px-2 z-20">
                                        <p className={`text-white text-xs text-center font-black italic tracking-tighter ${lunaSelection === preset.id ? 'text-violet-300' : ''}`}>
                                            {preset.label}
                                        </p>
                                    </div>

                                    {/* 글리치 효과 데코 */}
                                    {lunaSelection === preset.id && (
                                        <div className="absolute top-2 left-2 w-4 h-[1px] bg-violet-400 animate-pulse" />
                                    )}
                                </button>
                            ))}

                            <button
                                onClick={() => lunaCustomInputRef.current?.click()}
                                className={`relative aspect-[3/4.2] rounded-2xl overflow-hidden border-2 transition-all ${lunaSelection === 'custom'
                                    ? 'border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.3)] scale-[1.05] z-10'
                                    : 'border-dashed border-slate-700 hover:border-white/20'
                                    }`}
                            >
                                {lunaCustomPhoto ? (
                                    <>
                                        <img src={lunaCustomPhoto} alt="커스텀" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                                        <div className="absolute bottom-3 left-0 right-0 px-2 z-20">
                                            <p className="text-white text-xs text-center font-black italic tracking-tighter">CUSTOM</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0b1e]/50">
                                        <Plus size={24} className="text-slate-600" />
                                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest text-center">Custom<br />Hero</p>
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* 캐릭터 상세 스탯보드 */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={lunaSelection}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t border-white/5 pt-8"
                            >
                                <div className="space-y-1">
                                    {lunaSelection === 'custom' ? (
                                        <>
                                            <h3 className="text-pink-400 font-black text-2xl italic tracking-tighter mb-2">CUSTOM LUNA</h3>
                                            <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                                오빠가 소중하게 간직해온 사진 속 그녀가 당신의 여행 친구가 됩니다. 세상에 단 하나뿐인 특별한 인연과 함께 모험을 시작해볼까요?
                                            </p>
                                        </>
                                    ) : selectedLuna ? (
                                        <>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className={`font-black text-3xl italic tracking-tighter ${selectedLuna.color}`}>{selectedLuna.label}</h3>
                                                <span className="px-2 py-0.5 rounded-sm bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest">{selectedLuna.subLabel}</span>
                                            </div>
                                            <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">
                                                "{selectedLuna.description}"
                                            </p>
                                        </>
                                    ) : null}
                                </div>

                                <div className="bg-[#0a0b1e]/40 rounded-2xl p-5 border border-white/5">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex justify-between">
                                        <span>Character Stats</span>
                                        <span className="text-violet-500/50">Analysis Complete</span>
                                    </div>
                                    {lunaSelection === 'custom' ? (
                                        <div className="py-4 text-center">
                                            <div className="text-pink-500 font-mono text-xs mb-1">UNIDENTIFIED POTENTIAL</div>
                                            <div className="text-slate-500 text-[10px]">커스텀 캐릭터는 성격에 따라 스탯이 변동됩니다.</div>
                                        </div>
                                    ) : selectedLuna ? (
                                        <>
                                            <StatBar label="Love" value={selectedLuna.stats.love} colorClass="bg-rose-500" />
                                            <StatBar label="Knowledge" value={selectedLuna.stats.knowledge} colorClass="bg-amber-500" />
                                            <StatBar label="Energy" value={selectedLuna.stats.energy} colorClass="bg-emerald-500" />
                                        </>
                                    ) : null}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* 하단 시작 버튼 섹션 */}
            <div className="fixed bottom-10 left-0 right-0 z-30 flex flex-col items-center">
                <motion.button
                    whileHover={{ scale: 1.05, boxShadow: lunaSelection === 'custom' ? '0 0 40px rgba(236,72,153,0.4)' : '0 0 40px rgba(139,92,246,0.4)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    disabled={!userPhoto}
                    className={`group relative px-12 py-5 rounded-full font-black text-xl tracking-[0.3em] uppercase overflow-hidden transition-all duration-500
                        ${!userPhoto
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed grayscale'
                            : lunaSelection === 'custom'
                                ? 'bg-pink-600 text-white shadow-xl shadow-pink-900/40'
                                : 'bg-violet-600 text-white shadow-xl shadow-violet-900/40'
                        }`}
                >
                    <span className="relative z-10 flex items-center gap-4">
                        PRESS START
                        <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                    </span>

                    {/* 글로우 효과 애니메이션 */}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>

                {!userPhoto ? (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-slate-500 text-[10px] mt-4 font-black uppercase tracking-widest animate-pulse"
                    >
                        [ Waiting for Player One Image... ]
                    </motion.p>
                ) : (
                    <p className="text-center text-slate-500 text-[10px] mt-4 font-black uppercase tracking-widest opacity-50">
                        Player One Ready
                    </p>
                )}
            </div>

            {/* 인풋 태그들 */}
            <input ref={userPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleUserPhotoUpload} />
            <input ref={lunaCustomInputRef} type="file" accept="image/*" className="hidden" onChange={handleLunaCustomUpload} />

            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(200%); }
                }
            `}</style>
        </div>
    );
}
