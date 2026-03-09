import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, CheckCircle, User, Sparkles, Plus, Heart, Brain, Zap, UserPlus, Dog, Wand2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LUNA_PERSONAS } from '../constants';
import { RetroSound } from '../utils/retroSound';

const LUNA_PRESETS = [
    {
        id: 'luna-1',
        src: '/assets/luna/luna-1.webp',
        label: 'Luna A',
        subLabel: 'Your Tsundere Best Friend',
        description: 'A reliable travel buddy who complains but always tags along. She acts tough but secretly cares about you.',
        dialogue: "You're taking me on a trip? Hmph... Fine, I guess I have no choice but to tag along so you don't get lost.",
        stats: { love: 90, knowledge: 60, energy: 75 },
        tags: ['Tsundere', 'Caring', 'Friend'],
        persona: LUNA_PERSONAS['luna-1']
    },
    {
        id: 'luna-2',
        src: '/assets/luna/luna-2.webp',
        label: 'Luna B',
        subLabel: 'The Flirty Professional Guide',
        description: 'An intelligent guide who politely calls you by your name, but constantly creates a subtle, sexy, and romantic tension between you two.',
        dialogue: "The world is wide and full of wonders. I know all the best spots... How about we explore them together, just the two of us?",
        stats: { love: 75, knowledge: 95, energy: 60 },
        tags: ['Elegant', 'Formal', 'Flirty'],
        persona: LUNA_PERSONAS['luna-2']
    },
    {
        id: 'luna-3',
        src: '/assets/luna/luna-3.webp',
        label: 'Luna C',
        subLabel: 'The Sweet Little Sister',
        description: 'An energetic and affectionate younger sister who follows you around calling you "Oppa!". She hides nothing.',
        dialogue: "Oppa! Are we finally going on a trip together? I've been waiting for this moment so much! Hehe, let's go!",
        stats: { love: 100, knowledge: 45, energy: 95 },
        tags: ['Sweet', 'Energy', 'Oppa!'],
        persona: LUNA_PERSONAS['luna-3']
    },
];

const StatBar = ({ label, value, colorClass, barColorClass, icon: Icon }: { label: string, value: number, colorClass: string, barColorClass: string, icon: any }) => (
    <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-center text-[10px] xl:text-xs font-mulmaru uppercase tracking-wider">
            <div className="flex items-center gap-1.5 font-bold">
                <Icon size={12} className={colorClass} />
                <span className="translate-y-0.5">{label}</span>
            </div>
            <span className={`${colorClass} font-bold`}>{value}%</span>
        </div>
        <div className="h-2 xl:h-3 w-full bg-white/10 p-[2px] rounded-none relative overflow-hidden border border-white/5 shadow-inner">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1, ease: "circOut" }}
                className={`h-full ${barColorClass} rounded-none shadow-[0_0_12px_rgba(255,255,255,0.4)]`}
            />
        </div>
    </div>
);

interface SetupPageProps {
    onComplete: () => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
    const [userPhoto, setUserPhoto] = useState<string>(() => localStorage.getItem('user_photo') || '');
    const [userName, setUserName] = useState<string>(() => localStorage.getItem('user_name') || '');
    const [activeDialogue, setActiveDialogue] = useState<{ name: string, text: string } | null>(null);
    const [displayedText, setDisplayedText] = useState("");
    const [isFocusedName, setIsFocusedName] = useState(false);
    const [lunaSelection, setLunaSelection] = useState<string>(() => localStorage.getItem('luna_selection') || 'luna-2');
    const [isStarting, setIsStarting] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingDots, setLoadingDots] = useState('');
    const [hoveredLuna, setHoveredLuna] = useState<string | null>(null);
    const [lunaCustomPhoto, setLunaCustomPhoto] = useState<string>(() => localStorage.getItem('luna_custom_photo') || '');
    const [customPartnerName, setCustomPartnerName] = useState(() => localStorage.getItem('custom_partner_name') || '');
    const [customPartnerSummary, setCustomPartnerSummary] = useState(() => localStorage.getItem('custom_partner_summary') || '');
    const [customType, setCustomType] = useState('female');
    const [isRefining, setIsRefining] = useState(false);

    const userPhotoInputRef = useRef<HTMLInputElement>(null);
    const lunaCustomInputRef = useRef<HTMLInputElement>(null);

    // 브라우저 오디오 자동 재생 정책 대응 (첫 클릭/터치 시 AudioContext 해제)
    useEffect(() => {
        const unlockAudio = () => {
            RetroSound.unlockAudioContext();
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
    }, []);

    // 서버 설정 초기 로드
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (data.user_name) setUserName(data.user_name);
                if (data.luna_selection) setLunaSelection(data.luna_selection);
                if (data.luna_custom_photo) setLunaCustomPhoto(data.luna_custom_photo);
                if (data.user_photo) setUserPhoto(data.user_photo);
            } catch (err) {
                console.warn("Failed to load settings from server, using local storage fallback.");
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        if (!activeDialogue) return;
        let i = 0;
        setDisplayedText("");
        const interval = setInterval(() => {
            setDisplayedText(activeDialogue.text.slice(0, i));
            i++;
            if (i > activeDialogue.text.length) clearInterval(interval);
        }, 40);

        const timeout = setTimeout(() => {
            setActiveDialogue(null);
        }, Math.max(5000, activeDialogue.text.length * 40 + 3000));

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [activeDialogue]);

    // 이미지 업로드 공통 위젯 로직 (서버 저장)
    const uploadToServer = async (base64: string, name: string, type?: 'user' | 'luna') => {
        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, name, type })
            });
            const data = await response.json();
            return data.url; // 예: /uploads/12345_user.webp
        } catch (err) {
            console.error("Upload failed:", err);
            return base64; // 실패시 base64 유지
        }
    };

    // 설정 서버 동기화 함수
    const syncSettings = async (updates: any) => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (err) {
            console.error("Settings sync failed:", err);
        }
    };

    const handleUserPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const serverUrl = await uploadToServer(base64String, 'user', 'user');
                setUserPhoto(serverUrl);
                localStorage.setItem('user_photo', serverUrl);
                RetroSound.playSuccess();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLunaCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const serverUrl = await uploadToServer(base64String, 'custom_luna', 'luna');
                setLunaCustomPhoto(serverUrl);
                setLunaSelection('custom');
                localStorage.setItem('luna_custom_photo', serverUrl);
                localStorage.setItem('luna_selection', 'custom');
                // 서버에도 luna_custom_photo 명시적 기록
                syncSettings({ luna_custom_photo: serverUrl, luna_selection: 'custom' });
            };
            reader.readAsDataURL(file);
        }
    };

    const playTTS = (id: string) => {
        try {
            if ((window as any).currentLunaAudio) {
                (window as any).currentLunaAudio.pause();
            }
            // WAV 파일 우선 재생 (브라우저 자체 지원)
            const audioPath = `/assets/audio/${id}.wav`;
            const audio = new Audio(audioPath);
            audio.volume = 0.8;
            (window as any).currentLunaAudio = audio;
            audio.play().catch(e => console.error("Audio block:", e));
        } catch (err) {
            console.error("Static TTS play failed:", err);
        }
    };

    const handleSelectPreset = (id: string) => {
        setLunaSelection(id);
        localStorage.setItem('luna_selection', id);
        RetroSound.playClick();
        playTTS(id);
        const preset = LUNA_PRESETS.find(p => p.id === id);
        if (preset) {
            localStorage.setItem('luna_name', preset.label);
            localStorage.setItem('luna_photo', preset.src);
            syncSettings({
                luna_selection: id,
                luna_name: preset.label,
                luna_photo: preset.src
            });
            setActiveDialogue({ name: preset.label, text: preset.dialogue });
        }
    };

    const handleRefinePersona = async () => {
        if (!customPartnerSummary.trim()) return;
        setIsRefining(true);
        try {
            const response = await fetch('/api/refine-persona', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: customPartnerSummary, type: customType })
            });
            const data = await response.json();
            if (data.persona) {
                localStorage.setItem('custom_partner_persona', data.persona);
                localStorage.setItem('custom_partner_summary', customPartnerSummary);
                syncSettings({ luna_persona: data.persona, custom_partner_summary: customPartnerSummary });
                RetroSound.playSuccess();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsRefining(false);
        }
    };

    const handleStart = () => {
        if (!userPhoto || !userName.trim() || isStarting) {
            alert("플레이어 사진과 이름을 모두 입력해주세요!");
            return;
        }

        // 커스텀 루나 선택 시 유효성 검사
        if (lunaSelection === 'custom') {
            if (!lunaCustomPhoto) {
                alert("커스텀 캐릭터의 사진을 업로드해주세요!");
                return;
            }
            if (!customPartnerName.trim()) {
                alert("커스텀 캐릭터의 이름을 입력해주세요!");
                return;
            }
            if (!customPartnerSummary.trim()) {
                alert("커스텀 캐릭터의 성격(설명)을 입력하고 마법봉 버튼을 눌러 확정해주세요!");
                return;
            }
        }
        setIsStarting(true);
        setShowLoadingOverlay(true);
        RetroSound.playBoot();

        let dots = '';
        const dotsInterval = setInterval(() => {
            dots = dots.length >= 3 ? '' : dots + '.';
            setLoadingDots(dots);
        }, 150);

        localStorage.setItem('user_name', userName);
        if (lunaSelection === 'custom') {
            localStorage.setItem('luna_name', customPartnerName);
            localStorage.setItem('custom_partner_name', customPartnerName);
            localStorage.setItem('luna_photo', lunaCustomPhoto);
            const finalPersona = localStorage.getItem('custom_partner_persona');
            if (finalPersona) localStorage.setItem('luna_persona', finalPersona);

            // 시작 시 최종 커스텀 정보 서버 동기화
            syncSettings({
                luna_name: customPartnerName,
                luna_photo: lunaCustomPhoto,
                luna_custom_photo: lunaCustomPhoto,
                luna_selection: 'custom'
            });
        } else {
            const preset = LUNA_PRESETS.find(p => p.id === lunaSelection);
            if (preset) {
                localStorage.setItem('luna_name', preset.label);
                localStorage.setItem('luna_photo', preset.src);
                localStorage.setItem('luna_persona', preset.persona);

                // 시작 시 프리셋 정보 서버 동기화
                syncSettings({
                    luna_name: preset.label,
                    luna_photo: preset.src,
                    luna_selection: lunaSelection
                });
            }
        }

        setTimeout(() => {
            clearInterval(dotsInterval);
            onComplete();
        }, 1200);
    };

    return (
        <div className="retro-theme relative h-screen w-screen overflow-hidden bg-black text-white font-dos select-none">
            {/* Cinematic Pixel Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-70 image-rendering-pixelated"
                style={{ backgroundImage: 'url("/assets/pixel_bg.webp")' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/95 pointer-events-none" />

            {/* CRT Scanlines Layer */}
            <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.06] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,4px_100%]" />

            <div className="relative z-10 w-full h-full flex flex-col p-4 xl:p-6">
                <header className="flex items-center justify-between mb-4 animate-fade-in shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 xl:w-10 xl:h-10 bg-rose-600 rotate-45 flex items-center justify-center border-2 border-white/20 shadow-lg">
                            <Sparkles size={18} className="-rotate-45 text-white" />
                        </div>
                        <h1 className="text-2xl xl:text-4xl font-mulmaru tracking-widest uppercase translate-y-1">
                            TRAVEL THE WORLD <span className="text-white/60 font-medium font-mulmaru">WITH LUNA</span>
                        </h1>
                    </div>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center py-2 xl:py-4 overflow-hidden">
                    <div className="text-center mb-6 xl:mb-10 animate-slide-up">
                        <h2 className="text-4xl xl:text-8xl font-mulmaru font-bold mb-4 tracking-widest drop-shadow-[0_0_30px_rgba(225,29,72,0.4)] text-white uppercase italic">Luna's Hidden Route</h2>
                        <div className="w-40 xl:w-60 h-1.5 xl:h-2 bg-rose-600 mx-auto mb-6 xl:mb-10 shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
                        <p className="text-xs xl:text-xl font-dos text-white/70 uppercase tracking-[0.4em] drop-shadow-lg font-bold">Explore the world with Luna</p>
                    </div>

                    <div className="flex flex-wrap justify-center items-end gap-6 xl:gap-20 w-full px-6 overflow-visible h-full max-h-[60%]">
                        {LUNA_PRESETS.map((luna) => (
                            <motion.div
                                key={luna.id}
                                onMouseEnter={() => { setHoveredLuna(luna.id); RetroSound.playHover(); }}
                                onMouseLeave={() => setHoveredLuna(null)}
                                whileHover={{ y: -20, scale: 1.15, zIndex: 100 }}
                                onClick={() => handleSelectPreset(luna.id)}
                                className={`relative w-[160px] xl:w-[260px] aspect-[4/6.2] cursor-pointer group transition-all duration-700 rounded-none overflow-hidden ${lunaSelection === luna.id ? 'shadow-[0_0_120px_rgba(225,29,72,0.6)]' : 'ring-2 ring-white/10 hover:ring-white/40 shadow-2xl'}`}
                            >
                                {lunaSelection === luna.id && (
                                    <div className="absolute inset-0 border-4 xl:border-8 border-rose-600 pointer-events-none z-50 animate-game-blink" style={{ animationDuration: '0.4s' }} />
                                )}
                                <img src={luna.src} alt={luna.label} className={`w-full h-full object-cover image-rendering-pixelated transition-transform duration-1000 ${lunaSelection === luna.id ? 'scale-105' : 'group-hover:scale-110'}`} />
                                <div className="absolute inset-x-0 bottom-0 p-3 xl:p-6 bg-gradient-to-t from-black via-black/90 to-transparent pt-24 text-left">
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <h3 className="text-xl xl:text-3xl font-mulmaru mb-0.5 leading-none">{luna.label}</h3>
                                            <p className="text-[8px] xl:text-[10px] font-dos text-rose-500 uppercase tracking-widest font-bold font-normal">{luna.subLabel}</p>
                                        </div>
                                        {lunaSelection === luna.id && <span className="px-3 py-1 bg-rose-600 text-[10px] font-mulmaru rounded-none shadow-lg h-fit mb-1 border border-white/20 animate-pulse">LOCKED</span>}
                                    </div>
                                    <AnimatePresence>
                                        {hoveredLuna === luna.id && (
                                            <motion.div initial={{ opacity: 0, y: 30, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 30, height: 0 }} className="space-y-4 xl:space-y-5 pt-3 border-t border-white/10 mt-3">
                                                <p className="text-[9px] xl:text-sm font-dos text-white/90 leading-tight drop-shadow-md">"{luna.description}"</p>
                                                <div className="space-y-3">
                                                    <StatBar label="Love" value={luna.stats.love} colorClass="text-rose-500" barColorClass="bg-rose-500" icon={Heart} />
                                                    <StatBar label="Knowledge" value={luna.stats.knowledge} colorClass="text-blue-400" barColorClass="bg-blue-400" icon={Brain} />
                                                    <StatBar label="Energy" value={luna.stats.energy} colorClass="text-emerald-400" barColorClass="bg-emerald-400" icon={Zap} />
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {luna.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-white/10 rounded-none text-[8px] xl:text-[10px] font-mulmaru uppercase opacity-70 border border-white/5 tracking-wider whitespace-nowrap">#{tag}</span>)}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        ))}

                        {/* CUSTOM CREATE */}
                        <motion.div
                            onMouseEnter={() => { setHoveredLuna('custom'); RetroSound.playHover(); }}
                            onMouseLeave={() => setHoveredLuna(null)}
                            whileHover={{ y: -20, scale: 1.15, zIndex: 100 }}
                            onClick={() => {
                                if (!lunaCustomPhoto) {
                                    lunaCustomInputRef.current?.click();
                                    RetroSound.playClick();
                                } else {
                                    setLunaSelection('custom');
                                    localStorage.setItem('luna_selection', 'custom');
                                    setActiveDialogue({ name: 'SYSTEM', text: "Please design your own special partner for the journey." });
                                    playTTS('custom');
                                }
                            }}
                            className={`relative w-[150px] xl:w-[240px] aspect-[4/6.2] cursor-pointer group transition-all duration-700 rounded-none overflow-hidden flex flex-col items-center justify-center bg-black/50 ${lunaSelection === 'custom' ? 'shadow-[0_0_80px_rgba(147,51,234,0.6)]' : 'border-2 xl:border-4 border-dashed border-white/20 hover:border-white/50'}`}
                        >
                            {lunaSelection === 'custom' && (
                                <div className="absolute inset-0 border-4 xl:border-8 border-purple-600 pointer-events-none z-50 animate-game-blink" style={{ animationDuration: '0.4s' }} />
                            )}

                            {/* 상시 노출될 사진 변경 버튼 (사진이 있을 때만) */}
                            {lunaCustomPhoto && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); lunaCustomInputRef.current?.click(); RetroSound.playClick(); }}
                                    className="absolute top-4 right-4 z-[60] bg-purple-600/90 hover:bg-purple-500 p-2 border-2 border-white/30 shadow-xl transition-all active:scale-95 group/btn"
                                >
                                    <Camera size={20} className="text-white group-hover/btn:scale-110 transition-transform" />
                                </button>
                            )}

                            {lunaCustomPhoto ? <img src={lunaCustomPhoto} alt="Custom" className="w-full h-full object-cover image-rendering-pixelated" /> : (
                                <div className="flex flex-col items-center gap-2 xl:gap-4 group-hover:scale-105 transition-transform px-4 text-center">
                                    <div className="w-12 h-12 xl:w-20 xl:h-20 rounded-none border-2 border-white/20 flex items-center justify-center bg-white/5 opacity-30"><Plus size={32} className="text-white" /></div>
                                    <span className="text-[10px] xl:text-xl font-mulmaru tracking-widest uppercase opacity-50 font-medium break-all">CREATE_SOUL</span>
                                </div>
                            )}
                            <AnimatePresence>
                                {hoveredLuna === 'custom' && lunaSelection === 'custom' && (
                                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="absolute inset-0 bg-black/98 p-2 xl:p-3 flex flex-col justify-end" onClick={(e) => e.stopPropagation()}>
                                        {/* 이미 플로팅 카메라 버튼이 있으므로, 패널 내 업로드 영역은 더 간소하게 처리하거나 캡션으로 대체 */}
                                        {!lunaCustomPhoto && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); lunaCustomInputRef.current?.click(); RetroSound.playClick(); }}
                                                onMouseEnter={() => RetroSound.playHover()}
                                                className="w-full bg-white/5 hover:bg-rose-600/20 border-2 border-dashed border-white/20 hover:border-white py-4 xl:py-6 flex flex-col items-center justify-center gap-2 mb-4 xl:mb-6 transition-all font-dos group/upload relative rounded-none"
                                            >
                                                <Camera size={20} className="text-white/50 group-hover/upload:text-rose-400 group-hover/upload:scale-110 transition-transform" />
                                                <span className="text-[10px] xl:text-xs text-white/50 group-hover/upload:text-rose-100 uppercase tracking-widest font-bold">
                                                    UPLOAD LUNA PHOTO
                                                </span>
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-rose-600/10 animate-pulse pointer-events-none" />
                                            </button>
                                        )}

                                        <div className="mb-4 text-left">
                                            <div className="flex gap-2 xl:gap-3 mb-4 xl:mb-6">
                                                {[{ id: 'female', icon: User, label: 'FEMALE' }, { id: 'male', icon: UserPlus, label: 'MALE' }, { id: 'animal', icon: Dog, label: 'ANIMAL' }].map(type => (
                                                    <button key={type.id} onClick={() => { setCustomType(type.id); RetroSound.playClick(); }} onMouseEnter={() => RetroSound.playHover()} className={`flex-1 flex flex-col items-center gap-2 py-3 border-2 transition-all ${customType === type.id ? 'bg-purple-600 border-white text-white scale-105 shadow-lg' : 'bg-white/5 border-white/10 text-white/40'}`}><type.icon size={20} /><span className="text-[8px] font-mulmaru font-bold">{type.label}</span></button>
                                                ))}
                                            </div>
                                            <div className="group mb-2 xl:mb-4">
                                                <p className="text-[8px] font-mulmaru text-purple-400 mb-1 tracking-widest uppercase font-bold">[[ INPUT_NAME ]]</p>
                                                <input
                                                    type="text"
                                                    value={customPartnerName}
                                                    onChange={(e) => {
                                                        const name = e.target.value;
                                                        setCustomPartnerName(name);
                                                        syncSettings({ luna_name: name, custom_partner_name: name });
                                                    }}
                                                    className="bg-transparent border-b-2 border-white/10 outline-none text-xl xl:text-2xl font-sans w-full pb-1 placeholder-white/5 focus:border-purple-600 transition-all font-medium"
                                                    placeholder="NAME_YOUR_PARTNER"
                                                />
                                            </div>
                                            <div className="relative">
                                                <p className="text-[8px] font-mulmaru text-purple-400 mb-1 tracking-widest uppercase font-bold">[[ ENTER_PERSONALITY ]]</p>
                                                <textarea value={customPartnerSummary} onChange={(e) => setCustomPartnerSummary(e.target.value)} placeholder="DESCRIBE DESIRED CHARACTER PERSONALITY..." className="w-full bg-white/5 border border-white/10 p-2 xl:p-3 rounded-none outline-none text-[10px] xl:text-base font-sans text-purple-300 min-h-[50px] xl:min-h-[80px] resize-none leading-relaxed focus:border-purple-600" />
                                                <button onClick={() => { handleRefinePersona(); RetroSound.playClick(); }} className="absolute right-2 bottom-2 bg-purple-600 p-2 rounded-none hover:bg-purple-500 shadow-lg">{isRefining ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}</button>
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-purple-900/50">
                                            <StatBar label="SOUL_SYNC" value={50} colorClass="text-purple-400" barColorClass="bg-purple-600" icon={Sparkles} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>

                    {/* RPG Style Dialogue Box */}
                    <AnimatePresence>
                        {activeDialogue && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 30 }}
                                className="absolute bottom-[10%] xl:bottom-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-[900px] z-[150] pointer-events-none"
                            >
                                <div className="bg-black/85 border-4 border-white/30 p-6 xl:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative rounded-none backdrop-blur-sm">
                                    <div className="absolute -top-7 xl:-top-9 left-6 xl:left-8 bg-rose-600 px-6 py-2 border-2 xl:border-4 border-white/20 shadow-lg">
                                        <span className="text-sm xl:text-xl font-mulmaru font-bold tracking-widest uppercase text-white drop-shadow-md">
                                            {activeDialogue.name}
                                        </span>
                                    </div>
                                    <p className="text-2xl xl:text-4xl font-dos text-white leading-[1.6] tracking-wide drop-shadow-md min-h-[80px] xl:min-h-[120px]">
                                        {displayedText}
                                        <span className="inline-block w-3 h-6 xl:w-5 xl:h-10 bg-white ml-2 align-middle animate-game-blink"></span>
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                <footer className="mt-8 shrink-0 animate-fade-in relative z-40">
                    <div className="w-full max-w-[1400px] mx-auto bg-black/90 border-2 xl:border-4 border-white/10 rounded-none p-6 xl:p-10 flex flex-col md:flex-row items-center gap-10 xl:gap-20 relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
                        <div className="shrink-0 flex flex-col items-center gap-3 group relative">
                            <motion.div onClick={() => { userPhotoInputRef.current?.click(); RetroSound.playClick(); }} onMouseEnter={() => RetroSound.playHover()} whileHover={{ scale: 1.05, rotate: -2 }} className={`relative w-28 h-28 xl:w-44 xl:h-44 rounded-none overflow-hidden border-2 xl:border-4 cursor-pointer transition-all ${userPhoto ? 'border-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.5)]' : 'border-white/30 hover:border-white shadow-xl'} bg-slate-950`}>
                                {userPhoto ? <img src={userPhoto} alt="User" className="w-full h-full object-cover image-rendering-pixelated" /> : (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30 group-hover:text-white/80 transition-all">
                                        <Camera className="w-10 h-10 xl:w-20 xl:h-20 opacity-30" />
                                        <span className="text-[10px] xl:text-xs font-mulmaru text-center px-4 tracking-widest leading-relaxed font-bold">UPLOAD<br />IDENT_DATA</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-rose-600/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload size={40} className="text-white scale-125 opacity-30" /></div>
                            </motion.div>
                            <span className="text-[10px] xl:text-xs font-mulmaru text-rose-500 font-bold tracking-[0.3em] uppercase drop-shadow-lg">UPLOAD PHOTO</span>
                        </div>

                        <div className="flex-1 flex flex-col gap-6 w-full text-left">
                            <div className="flex items-center gap-6">
                                <div className="px-4 py-1.5 bg-rose-600 font-mulmaru text-[11px] xl:text-2xl uppercase tracking-[0.2em] shadow-xl font-bold">PLAYER_CODENAME</div>
                                <div className="flex-1 h-[2px] bg-gradient-to-r from-rose-600/50 to-transparent" />
                            </div>
                            <div className="relative group overflow-hidden">
                                {/* Visual rendering of text and retro cursor combined */}
                                <div className="w-full bg-transparent border-b-2 xl:border-b-4 border-white/20 px-2 py-2 xl:py-6 transition-all flex items-center overflow-x-auto whitespace-pre snap-none group-focus-within:border-rose-600">
                                    <div className="relative inline-flex items-center pointer-events-none text-3xl xl:text-7xl font-sans text-white uppercase tracking-normal">
                                        <span>
                                            {userName || <span className="text-white/5 font-sans">ENTER_YOUR_NAME</span>}
                                        </span>
                                        {/* Cursor right next to the text */}
                                        {isFocusedName && (
                                            <span className="text-rose-500 font-dos font-bold animate-game-blink ml-1 xl:ml-2">_</span>
                                        )}
                                    </div>
                                </div>
                                {/* Real invisible input handling multi-lang logic */}
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => {
                                        const newName = e.target.value;
                                        setUserName(newName);
                                        localStorage.setItem('user_name', newName);
                                        syncSettings({ user_name: newName });
                                    }}
                                    onFocus={() => setIsFocusedName(true)}
                                    onBlur={() => setIsFocusedName(false)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-text z-20 outline-none uppercase"
                                />
                                <div className="absolute bottom-0 left-0 w-0 h-1 xl:h-2 bg-rose-600 group-focus-within:w-full transition-all duration-700 z-10 pointer-events-none" />
                            </div>
                        </div>

                        <button
                            onClick={handleStart}
                            onMouseEnter={() => !isStarting && RetroSound.playHover()}
                            disabled={!userPhoto || !userName.trim() || isStarting}
                            className={`group relative px-10 xl:px-20 py-6 xl:py-10 rounded-[1.2rem] xl:rounded-[2rem] flex items-center justify-center font-mulmaru transition-all duration-300 active:scale-95 overflow-hidden ${(!userPhoto || !userName.trim() || isStarting) ? 'bg-slate-950 text-slate-800 opacity-20 cursor-not-allowed border-2 border-white/5 grayscale' : 'bg-rose-600 text-white hover:bg-rose-500 hover:scale-110 hover:shadow-[0_0_120px_rgba(225,29,72,0.9)] shadow-[0_0_60px_rgba(225,29,72,0.5)] border-4 border-white/30 hover:border-white'}`}
                        >
                            <div className={`flex flex-col items-center leading-none translate-y-1 ${(!userPhoto || !userName.trim() || isStarting) ? '' : 'animate-game-blink group-hover:animate-none group-hover:scale-110 transition-transform'}`}>
                                <span className="text-4xl xl:text-8xl font-bold tracking-normal leading-tight">START</span>
                                <span className="text-[10px] xl:text-xl font-dos opacity-80 tracking-[0.4em] font-bold">JOURNEY</span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine rounded-[1.2rem] xl:rounded-[2rem] pointer-events-none" />
                        </button>
                    </div>
                </footer>

                <input ref={userPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleUserPhotoUpload} />
                <input ref={lunaCustomInputRef} type="file" accept="image/*" className="hidden" onChange={handleLunaCustomUpload} />
            </div >

            {/* FULL SCREEN LOADING OVERLAY */}
            <AnimatePresence>
                {
                    showLoadingOverlay && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
                            <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.1] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.1),rgba(0,255,0,0.05),rgba(0,0,255,0.1))] bg-[size:100%_4px,4px_100%]" />
                            <div className="flex flex-col items-center gap-8">
                                <div className="flex flex-col items-center">
                                    <h2 className="text-6xl xl:text-8xl font-mulmaru tracking-[0.3em] mb-4 text-rose-600 animate-pulse">LOADING{loadingDots}</h2>
                                    <p className="text-[10px] xl:text-sm font-dos text-white/40 tracking-[0.8em] uppercase">Initializing Destiny Neural Link</p>
                                </div>
                                <div className="w-64 xl:w-96 h-1 bg-white/10 rounded-none overflow-hidden relative">
                                    <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 1.2, ease: "linear" }} className="absolute inset-0 bg-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
                                </div>
                                <div className="flex flex-col items-center gap-1 font-dos text-[8px] xl:text-[10px] text-rose-500/60 uppercase tracking-widest overflow-hidden h-4">
                                    <span className="animate-slide-up-loading opacity-80 italic">[[ ACCESSING_GPS_SATELLITE_COORDINATES... ]]</span>
                                </div>
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shine { 100% { transform: translateX(100%); } }
                .animate-shine { animation: shine 1.5s infinite; }
                .animate-fade-in { animation: fadeIn 1s ease-out forwards; }
                .animate-slide-up { animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-game-blink { animation: blink 0.8s infinite steps(1); }
                .animate-slide-up-loading { animation: slideUpLoading 2s infinite linear; }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes slideUp { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes slideUpLoading { 
                    0% { transform: translateY(20px); opacity: 0; }
                    10% { transform: translateY(0); opacity: 1; }
                    90% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-20px); opacity: 0; }
                }
                @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
                ::placeholder { font-family: 'DosStory', sans-serif !important; color: rgba(255,255,255,1) !important; }
                input, textarea { font-family: 'Inter', sans-serif !important; }
                .font-mulmaru { font-family: 'MulmaruMono', sans-serif !important; }
                .font-dos { font-family: 'DosStory', sans-serif !important; }
            ` }} />
        </div >
    );
}
