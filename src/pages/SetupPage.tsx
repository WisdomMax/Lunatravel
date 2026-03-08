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
        <div className="min-h-screen w-screen bg-[#0d091a] flex items-center justify-center p-4 sm:p-8 xl:p-12 relative overflow-hidden font-sans select-none text-white">
            {/* 미연시 감성 배경 연출: 격자무늬 + 은은한 파스텔 글로우 */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `linear-gradient(#2a1b4d 1px, transparent 1px), linear-gradient(90deg, #2a1b4d 1px, transparent 1px)`,
                    backgroundSize: '32px 32px'
                }} />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-[#1a0b33]/40 to-[#0d091a]" />

                {/* 파스텔톤 글로우 레이어 (더 화사하게) */}
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-[1440px] flex flex-col items-center">

                {/* 상단 타이틀 섹션 (미연시풍 폰트 연출 느낌) */}
                <div className="text-center mb-10 xl:mb-16">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-block px-4 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 text-[11px] font-black uppercase tracking-[0.2em] mb-4 shadow-[0_0_15px_rgba(219,39,119,0.4)]"
                    >
                        New Adventure Setup
                    </motion.div>
                    <h1 className="text-5xl xl:text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                        LUNA <span className="text-pink-400">CONNECT</span>
                    </h1>
                </div>

                <div className="w-full flex flex-col gap-10">

                    {/* 메인 콘텐츠: 좌(캐릭터 선택) / 우(내 정보/상세) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">

                        {/* 왼쪽 캐릭터 선택 패널 (미연시 카드 리스트) */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="flex items-end justify-center gap-4 xl:gap-6 min-h-[420px] mb-8 pb-4">
                                {LUNA_PRESETS.map((preset) => {
                                    const isSelected = lunaSelection === preset.id;
                                    return (
                                        <motion.button
                                            key={preset.id}
                                            onClick={() => handleSelectPreset(preset.id)}
                                            animate={{
                                                y: isSelected ? -20 : 0,
                                                scale: isSelected ? 1.05 : 0.85,
                                                zIndex: isSelected ? 20 : 10,
                                            }}
                                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                            className={`group relative w-[180px] xl:w-[240px] aspect-[1/1.5] transition-all rounded-xl overflow-hidden border-4 shadow-2xl ${isSelected ? 'border-pink-500 ring-4 ring-pink-500/20' : 'border-slate-800 opacity-60 grayscale-[50%]'}`}
                                        >
                                            <img src={preset.src} alt={preset.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                            {/* 이름 태그 */}
                                            <div className={`absolute bottom-0 inset-x-0 p-3 bg-black/60 backdrop-blur-md border-t border-slate-700/50`}>
                                                <p className={`text-center font-black italic text-lg xl:text-2xl ${isSelected ? 'text-pink-400' : 'text-slate-400'}`}>
                                                    {preset.label}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center animate-bounce shadow-lg">
                                                    <Sparkles size={16} className="text-white" />
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}

                                {/* 커스텀 선택 카드 */}
                                <motion.button
                                    onClick={() => lunaCustomInputRef.current?.click()}
                                    animate={{
                                        y: lunaSelection === 'custom' ? -20 : 0,
                                        scale: lunaSelection === 'custom' ? 1.05 : 0.85,
                                    }}
                                    className={`relative w-[150px] xl:w-[200px] aspect-[1/1.5] transition-all rounded-xl overflow-hidden border-4 border-dashed shadow-2xl ${lunaSelection === 'custom' ? 'border-purple-400 bg-purple-900/20' : 'border-slate-800 opacity-50'}`}
                                >
                                    {lunaCustomPhoto ? (
                                        <img src={lunaCustomPhoto} alt="Custom" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                                            <Plus size={40} strokeWidth={1} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-center italic">Create<br />Partner</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-black/60 backdrop-blur-md border-t border-slate-700/50">
                                        <p className={`text-center font-black italic text-lg xl:text-xl ${lunaSelection === 'custom' ? 'text-purple-400' : 'text-slate-500'}`}>CUSTOM</p>
                                    </div>
                                </motion.button>
                            </div>
                        </div>

                        {/* 오른쪽 플레이어 프로필 (미연시 주인공 설정 느낌) */}
                        <div className="lg:col-span-4 self-stretch">
                            <div className="h-full bg-black/40 backdrop-blur-xl border-4 border-slate-800 rounded-2xl p-6 flex flex-col shadow-[15px_15px_0px_0px_rgba(0,0,0,0.3)]">
                                <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse" />
                                    <h2 className="text-sm font-black italic tracking-widest uppercase text-slate-400">Sync Master Profile</h2>
                                </div>

                                <div className="flex flex-col gap-6">
                                    <div
                                        onClick={() => userPhotoInputRef.current?.click()}
                                        className="relative w-full aspect-square bg-[#0a0a14] rounded-xl overflow-hidden cursor-pointer group border-2 border-slate-700 hover:border-pink-500 transition-colors shadow-inner"
                                    >
                                        {userPhoto ? (
                                            <img src={userPhoto} alt="Me" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-4">
                                                <Camera size={48} strokeWidth={0.5} className="group-hover:text-pink-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-center opacity-50 italic">Insert Player Identity</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Upload className="text-white drop-shadow-lg" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-slate-900/50 p-4 border border-slate-800 rounded-lg">
                                            <p className="text-[10px] font-black uppercase text-pink-500 mb-1">■ Current Status</p>
                                            <p className="text-xs text-slate-400 font-medium italic">
                                                {userPhoto ? "Ready to initialize connection." : "Identity data required for synchronization."}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => userPhotoInputRef.current?.click()}
                                            className={`w-full py-4 rounded-lg font-black text-xs uppercase tracking-[0.3em] transition-all shadow-[0_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1
                                                ${userPhoto ? 'bg-pink-600 hover:bg-pink-500' : 'bg-slate-700 text-slate-400'}
                                            `}
                                        >
                                            Update Identity
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 하단 미연시 전형적인 대화창 (하이라이트) */}
                    <div className="relative mt-4">
                        {/* 캐릭터 대사 말머리 (이름표) */}
                        <div className="absolute -top-7 left-10 z-20">
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                key={lunaSelection}
                                className={`px-10 py-1.5 rounded-t-xl font-black italic text-xl xl:text-2xl shadow-lg border-x-4 border-t-4 ${lunaSelection === 'custom' ? 'bg-purple-600 border-purple-400' : `${selectedLuna?.color.replace('text-', 'bg-').split(' ')[0]} border-white/20`}`}
                            >
                                {lunaSelection === 'custom' ? '???' : selectedLuna?.label}
                            </motion.div>
                        </div>

                        {/* 대화창 본체 */}
                        <div className="relative bg-black/60 backdrop-blur-xl border-4 border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-1 rounded-3xl">
                            <div className="bg-[#1a0b33]/40 border-2 border-white/5 p-8 xl:p-12 rounded-[22px] flex flex-col lg:flex-row items-center gap-10">

                                {/* 캐릭터 대사 영역 */}
                                <div className="flex-1">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={lunaSelection}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="min-h-[100px] xl:min-h-[140px] flex flex-col justify-center"
                                        >
                                            <div className="text-xl xl:text-3xl font-black italic leading-snug tracking-tight text-pink-50 text-wrap max-w-[900px]">
                                                {lunaSelection === 'custom'
                                                    ? '"우리만의 특별한 이야기를 만들어볼까? 오빠가 골라준 내 모습, 정말 마음에 들어!"'
                                                    : `"${selectedLuna?.description}"`}
                                            </div>
                                            {/* 대화창 하단 삼각형 (다음 버튼 느낌) */}
                                            <motion.div
                                                animate={{ y: [0, 5, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                className="self-end mt-4 text-pink-500"
                                            >
                                                ▶
                                            </motion.div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* 스탯 패널 (호감도 게이지 느낌) */}
                                <div className="w-full lg:w-[350px] xl:w-[450px] bg-black/50 p-6 xl:p-10 border-2 border-white/5 rounded-2xl shadow-inner">
                                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Affection Analysis</span>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                                        </div>
                                    </div>

                                    {lunaSelection === 'custom' ? (
                                        <div className="py-8 text-center bg-purple-500/5 rounded-xl border border-purple-500/10">
                                            <div className="text-purple-400 font-mono text-xs font-black tracking-widest animate-pulse uppercase mb-2">Syncing Soul Data...</div>
                                            <div className="text-slate-500 text-[10px] italic">Deep learning character persona active.</div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <StatBar label="Love" value={selectedLuna?.stats.love || 0} colorClass="bg-gradient-to-r from-pink-600 to-rose-400 shadow-[0_0_10px_rgba(219,39,119,0.3)]" />
                                            <StatBar label="Intel" value={selectedLuna?.stats.knowledge || 0} colorClass="bg-gradient-to-r from-cyan-600 to-blue-400 shadow-[0_0_10px_rgba(8,145,178,0.3)]" />
                                            <StatBar label="Energy" value={selectedLuna?.stats.energy || 0} colorClass="bg-gradient-to-r from-amber-500 to-orange-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 가장 하단 시작 버튼 (START ADVENTURE 느낌) */}
                    <div className="mt-10 mb-20 flex flex-col items-center">
                        <motion.button
                            whileHover={userPhoto ? { scale: 1.05 } : {}}
                            whileTap={userPhoto ? { scale: 0.95 } : {}}
                            onClick={handleStart}
                            disabled={!userPhoto}
                            className={`group relative px-24 xl:px-40 py-6 xl:py-9 rounded-2xl font-black text-3xl xl:text-5xl italic tracking-tighter uppercase transition-all duration-500 shadow-[0_20px_40px_rgba(0,0,0,0.5)]
                                ${!userPhoto
                                    ? 'bg-slate-800 text-slate-600 grayscale border-4 border-slate-900 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 bg-[length:200%_100%] hover:bg-[100%_0] border-4 border-white/20 text-white'
                                }
                            `}
                        >
                            <span className="flex items-center gap-8">
                                START STORY
                                <ArrowRight size={44} className="group-hover:translate-x-4 transition-transform duration-300" />
                            </span>
                        </motion.button>
                        {!userPhoto && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-8 text-pink-500/[0.4] font-mono text-[11px] uppercase tracking-[0.5em] animate-pulse"
                            >
                                &lt;&lt; Warning: Identity Sync Required to Begin &gt;&gt;
                            </motion.p>
                        )}
                        {userPhoto && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 flex flex-col items-center gap-1"
                            >
                                <div className="px-6 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                                    <span className="text-emerald-400 text-xs font-black uppercase tracking-[0.4em] drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">READY TO START</span>
                                </div>
                                <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-50">All systems green • Connection stable</span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* 인풋 태그들 */}
            <input ref={userPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleUserPhotoUpload} />
            <input ref={lunaCustomInputRef} type="file" accept="image/*" className="hidden" onChange={handleLunaCustomUpload} />
        </div>
    );
}
