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
        <div className="min-h-screen w-screen bg-[#0a0b1e] flex items-center justify-center p-4 sm:p-8 xl:p-12 relative overflow-hidden font-sans select-none">
            {/* 시네마틱 배경 요소 보강 */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />

                {/* 앰비언트 글로우 레이어 */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.15, 0.1]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600 rounded-full blur-[180px]"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.1, 0.15, 0.1]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-600 rounded-full blur-[180px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0b1e]/0 via-[#0a0b1e]/50 to-[#0a0b1e]" />
            </div>

            <div className="relative z-10 w-full max-w-xl lg:max-w-5xl xl:max-w-[1440px] grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-32 items-center py-12 lg:py-0">

                {/* 왼쪽: 내 캐릭터 정보 */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                    <div className="mb-4 xl:mb-12">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-blue-500/10 border-l-4 border-blue-500 mb-6"
                        >
                            <User size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-[10px] xl:text-xs font-black uppercase tracking-widest">Player Profile</span>
                        </motion.div>
                        <h1 className="text-4xl xl:text-7xl font-black text-white italic tracking-tighter mb-4 leading-none">
                            TRAVELER <br className="hidden xl:block" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400">SETUP</span>
                        </h1>
                        <p className="text-slate-500 text-sm xl:text-lg font-medium tracking-tight">당신의 정보를 입력하고 모험을 시작하세요.</p>
                    </div>

                    <div className="relative group max-w-xl mx-auto lg:mx-0">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-violet-600 to-purple-700 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-[#151933] border border-white/5 rounded-2xl p-6 xl:p-10 overflow-hidden">
                            <div className="flex flex-col sm:flex-row gap-8">
                                <div
                                    onClick={() => userPhotoInputRef.current?.click()}
                                    className="relative w-full sm:w-[160px] xl:w-[220px] aspect-[3/4] sm:h-auto flex-shrink-0 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-blue-400 cursor-pointer transition-all bg-[#0a0b1e] group shadow-2xl"
                                >
                                    {userPhoto ? (
                                        <>
                                            <img src={userPhoto} alt="내 사진" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-blue-600/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Upload size={32} className="text-white drop-shadow-lg" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-white/5 shadow-inner">
                                                <Camera size={28} className="text-slate-500" />
                                            </div>
                                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Upload Photo</p>
                                        </div>
                                    )}
                                    {/* 스캔 라인 효과 */}
                                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-blue-500/20 to-transparent h-24 w-full animate-[scan_3s_linear_infinite]" />
                                </div>

                                <div className="flex-1 flex flex-col justify-between py-2">
                                    <div>
                                        <h3 className="text-white font-black text-xl xl:text-2xl mb-4 flex items-center gap-3 italic">
                                            PLAYER IDENTITIY
                                            {userPhoto && <CheckCircle size={20} className="text-blue-400" />}
                                        </h3>
                                        <div className="space-y-3 mb-6">
                                            <p className="text-slate-400 text-sm xl:text-base leading-relaxed flex items-start gap-3">
                                                <span className="text-blue-500 font-bold mt-1">01</span> 정면 증명사진 스타일 권장
                                            </p>
                                            <p className="text-slate-400 text-sm xl:text-base leading-relaxed flex items-start gap-3">
                                                <span className="text-blue-500 font-bold mt-1">02</span> 고화질일수록 합성 품질 향상
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => userPhotoInputRef.current?.click()}
                                        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-base font-black transition-all shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider"
                                    >
                                        <Upload size={18} />
                                        {userPhoto ? 'SYNCHRONIZE' : 'INITIATE ENTRY'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 루나 캐릭터 선택 정보 */}
                <div className="lg:col-span-12 xl:col-span-7">
                    <div className="bg-[#151933]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 xl:p-14 relative shadow-2xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
                            <div>
                                <h2 className="text-3xl xl:text-5xl font-black text-white italic tracking-tighter flex items-center gap-4">
                                    <Sparkles className="text-violet-400" size={32} />
                                    SELECT YOUR MATE
                                </h2>
                                <p className="text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mt-2 ml-11">Choose a partner for your journey</p>
                            </div>
                            <div className="hidden sm:block text-right">
                                <span className="text-[10px] xl:text-xs font-mono text-slate-500 uppercase tracking-widest">Luna Database</span>
                                <div className="text-violet-400 font-mono text-xs xl:text-sm">v2.5_LIVE_CONNECTED</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xl:gap-8 mb-12">
                            {LUNA_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleSelectPreset(preset.id)}
                                    className={`relative aspect-[3/4.2] rounded-2xl overflow-hidden border-2 transition-all duration-500 group ${lunaSelection === preset.id
                                        ? 'border-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.4)] scale-[1.08] z-10'
                                        : 'border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <img
                                        src={preset.src}
                                        alt={preset.label}
                                        className={`w-full h-full object-cover transition-transform duration-700 ${lunaSelection === preset.id ? 'scale-110' : 'group-hover:scale-105'}`}
                                    />
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90`} />

                                    {lunaSelection === preset.id && (
                                        <motion.div
                                            layoutId="activeBorder"
                                            className="absolute inset-0 border-2 border-violet-400 z-20 pointer-events-none"
                                            initial={false}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}

                                    <div className="absolute bottom-4 left-0 right-0 px-2 z-20">
                                        <p className={`text-white text-sm xl:text-lg text-center font-black italic tracking-tighter ${lunaSelection === preset.id ? 'text-violet-300' : ''}`}>
                                            {preset.label}
                                        </p>
                                    </div>

                                    {/* 글리치 효과 데코 */}
                                    {lunaSelection === preset.id && (
                                        <div className="absolute top-3 left-3 w-6 h-[1px] bg-violet-400 animate-pulse" />
                                    )}
                                </button>
                            ))}

                            <button
                                onClick={() => lunaCustomInputRef.current?.click()}
                                className={`relative aspect-[3/4.2] rounded-2xl overflow-hidden border-2 transition-all duration-500 ${lunaSelection === 'custom'
                                    ? 'border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.4)] scale-[1.08] z-10'
                                    : 'border-dashed border-slate-700 hover:border-white/20'
                                    }`}
                            >
                                {lunaCustomPhoto ? (
                                    <>
                                        <img src={lunaCustomPhoto} alt="커스텀" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
                                        <div className="absolute bottom-4 left-0 right-0 px-2 z-20">
                                            <p className="text-white text-sm xl:text-lg text-center font-black italic tracking-tighter">CUSTOM</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0b1e]/50 hover:bg-[#0a0b1e]/30 transition-colors">
                                        <Plus size={32} className="text-slate-600" />
                                        <p className="text-slate-600 text-xs font-black uppercase tracking-widest text-center">Custom<br />Hero</p>
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* 캐릭터 상세 스탯보드 */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={lunaSelection}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center border-t border-white/5 pt-12"
                            >
                                <div className="space-y-4">
                                    {lunaSelection === 'custom' ? (
                                        <>
                                            <h3 className="text-pink-400 font-black text-3xl xl:text-4xl italic tracking-tighter mb-4">CUSTOM LUNA</h3>
                                            <p className="text-slate-400 text-base xl:text-lg leading-relaxed mb-4">
                                                오빠가 직접 등록한 그녀가 여행의 소중한 동반자가 됩니다. 세상에 단 하나뿐인 특별한 인연과 함께 여행을 시작하세요.
                                            </p>
                                        </>
                                    ) : selectedLuna ? (
                                        <>
                                            <div className="flex items-center flex-wrap gap-4 mb-4">
                                                <h3 className={`font-black text-4xl xl:text-6xl italic tracking-tighter ${selectedLuna.color}`}>{selectedLuna.label}</h3>
                                                <span className="px-3 py-1 rounded-sm bg-white/10 text-white text-xs xl:text-sm font-bold uppercase tracking-widest border border-white/10 shadow-lg">{selectedLuna.subLabel}</span>
                                            </div>
                                            <p className="text-slate-200 text-base xl:text-xl leading-relaxed mb-6 italic opacity-80">
                                                "{selectedLuna.description}"
                                            </p>
                                        </>
                                    ) : null}
                                </div>

                                <div className="bg-[#0a0b1e]/60 rounded-3xl p-8 xl:p-12 border border-white/5 shadow-inner">
                                    <div className="text-xs xl:text-sm font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex justify-between items-center">
                                        <span>Character Stats</span>
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                                            <span className="text-violet-500/70">ANALYZING...</span>
                                        </div>
                                    </div>
                                    {lunaSelection === 'custom' ? (
                                        <div className="py-8 text-center bg-pink-500/5 rounded-2xl border border-pink-500/10">
                                            <div className="text-pink-500 font-mono text-sm xl:text-base font-black mb-2 tracking-widest">UNIDENTIFIED POTENTIAL</div>
                                            <div className="text-slate-500 text-xs xl:text-sm font-medium">커스텀 캐릭터는 대화를 통해 능력이 개화됩니다.</div>
                                        </div>
                                    ) : selectedLuna ? (
                                        <div className="space-y-4 xl:space-y-6">
                                            <StatBar label="Love" value={selectedLuna.stats.love} colorClass="bg-gradient-to-r from-rose-600 to-pink-500" />
                                            <StatBar label="Intel" value={selectedLuna.stats.knowledge} colorClass="bg-gradient-to-r from-amber-600 to-yellow-500" />
                                            <StatBar label="Sync" value={selectedLuna.stats.energy} colorClass="bg-gradient-to-r from-emerald-600 to-cyan-500" />
                                        </div>
                                    ) : null}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* 하단 시작 버튼 섹션 */}
            <div className="fixed bottom-8 sm:bottom-12 left-0 right-0 z-30 flex flex-col items-center">
                <motion.button
                    whileHover={{
                        scale: 1.05,
                        boxShadow: lunaSelection === 'custom'
                            ? '0 0 60px rgba(236,72,153,0.5)'
                            : '0 0 60px rgba(139,92,246,0.5)'
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    disabled={!userPhoto}
                    className={`group relative px-16 xl:px-24 py-6 xl:py-8 rounded-full font-black text-2xl xl:text-4xl tracking-[0.4em] uppercase overflow-hidden transition-all duration-500
                        ${!userPhoto
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed grayscale'
                            : lunaSelection === 'custom'
                                ? 'bg-pink-600 text-white shadow-2xl shadow-pink-900/40'
                                : 'bg-violet-600 text-white shadow-2xl shadow-violet-900/40'
                        }`}
                >
                    <span className="relative z-10 flex items-center gap-6">
                        PRESS START
                        <ArrowRight className="group-hover:translate-x-4 transition-transform duration-300" size={32} />
                    </span>

                    {/* 글로우 및 입자 애니메이션 데코 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="absolute inset-x-10 bottom-1 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>

                {!userPhoto ? (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-slate-500 text-xs xl:text-sm mt-6 font-black uppercase tracking-[0.3em] animate-pulse"
                    >
                        [ Waiting for Player One Image Identification... ]
                    </motion.p>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center mt-6"
                    >
                        <p className="text-emerald-400 text-xs xl:text-sm font-black uppercase tracking-[0.4em] drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                            Player One Ready
                        </p>
                        <p className="text-slate-600 text-[10px] mt-2 font-bold uppercase tracking-widest">Initialization Complete</p>
                    </motion.div>
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
