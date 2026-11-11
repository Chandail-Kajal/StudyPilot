'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';

export type AvatarPersona = 'scholar' | 'hologram' | 'friendly' | 'bot';
export type AvatarLayout = 'pip' | 'presenter' | 'docked';

interface AIAvatarInstructorProps {
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number;
  stageIdx: number;
  persona: AvatarPersona;
  onPersonaChange: (p: AvatarPersona) => void;
  layout: AvatarLayout;
  onLayoutChange: (l: AvatarLayout) => void;
  voiceoverText?: string;
  topicName?: string;
}

export const AIAvatarInstructor: React.FC<AIAvatarInstructorProps> = ({
  isSpeaking,
  isMuted,
  volume,
  stageIdx,
  persona,
  onPersonaChange,
  layout,
  onLayoutChange,
  voiceoverText,
  topicName = 'Concept'
}) => {
  const [mouthFrame, setMouthFrame] = useState(0);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);

  // Dynamic lip-sync cycle when speaking
  useEffect(() => {
    let interval: any;
    if (isSpeaking && !isMuted && volume > 0) {
      interval = setInterval(() => {
        setMouthFrame(prev => (prev + 1) % 4);
      }, 140);
    } else {
      setMouthFrame(0);
    }
    return () => clearInterval(interval);
  }, [isSpeaking, isMuted, volume]);

  const personaMeta: Record<AvatarPersona, { name: string; title: string; color: string; bg: string }> = {
    scholar: {
      name: 'Dr. Alex',
      title: 'Senior AI Professor',
      color: '#54C2F0',
      bg: 'rgba(84, 194, 240, 0.12)'
    },
    hologram: {
      name: 'Nova AI',
      title: 'Holographic Tutor',
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.14)'
    },
    friendly: {
      name: 'Maya',
      title: 'Mastery Mentor',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)'
    },
    bot: {
      name: 'PilotBot 3.0',
      title: 'Study Engine Android',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.12)'
    }
  };

  const cur = personaMeta[persona];

  // SVG Avatar Renderers
  const renderAvatarGraphic = (size = 140) => {
    const isActivelyTalking = isSpeaking && !isMuted && volume > 0;

    switch (persona) {
      case 'hologram':
        return (
          <svg width={size} height={size} viewBox="0 0 160 160" style={{ filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.5))' }}>
            <defs>
              <linearGradient id="holoRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
              <radialGradient id="holoGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* Pulsing Aura */}
            <circle cx="80" cy="80" r="72" fill="url(#holoGlow)" className={isActivelyTalking ? 'animate-pulse' : ''} />
            <circle cx="80" cy="80" r="66" fill="none" stroke="url(#holoRing)" strokeWidth="2.5" strokeDasharray={isActivelyTalking ? '6,4' : 'none'} style={{ transformOrigin: '80px 80px', animation: isActivelyTalking ? 'spin 12s linear infinite' : 'none' }} />

            {/* Torso & Shoulders */}
            <path d="M 40 148 C 44 116 116 116 120 148 Z" fill="#1E1B4B" stroke="#8B5CF6" strokeWidth="1.5" />
            <path d="M 60 148 L 80 126 L 100 148" fill="none" stroke="#38BDF8" strokeWidth="2" />

            {/* Head & Neck */}
            <rect x="73" y="98" width="14" height="20" rx="4" fill="#C4B5FD" />
            <ellipse cx="80" cy="74" rx="34" ry="40" fill="#2E1065" stroke="#8B5CF6" strokeWidth="2" />

            {/* Holographic Visor / Face Grid */}
            <path d="M 52 64 C 52 56 108 56 108 64 C 108 76 52 76 52 64 Z" fill="rgba(56, 189, 248, 0.25)" stroke="#38BDF8" strokeWidth="1.5" />

            {/* Eyes */}
            {isActivelyTalking ? (
              <>
                <circle cx="68" cy="64" r="5" fill="#38BDF8" />
                <circle cx="92" cy="64" r="5" fill="#38BDF8" />
                <circle cx="70" cy="62" r="2" fill="#FFFFFF" />
                <circle cx="94" cy="62" r="2" fill="#FFFFFF" />
              </>
            ) : (
              <>
                <circle cx="68" cy="64" r="4.5" fill="#A78BFA" />
                <circle cx="92" cy="64" r="4.5" fill="#A78BFA" />
              </>
            )}

            {/* Animated Mouth */}
            {isActivelyTalking ? (
              mouthFrame % 2 === 0 ? (
                <ellipse cx="80" cy="94" rx="8" ry="6" fill="#EC4899" stroke="#38BDF8" strokeWidth="1.5" />
              ) : (
                <path d="M 72 93 Q 80 102 88 93" fill="none" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" />
              )
            ) : (
              <path d="M 74 94 Q 80 98 86 94" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" />
            )}

            {/* Floating Cyber Circuit Node */}
            <circle cx="80" cy="38" r="4" fill="#38BDF8" className={isActivelyTalking ? 'animate-ping' : ''} />
          </svg>
        );

      case 'friendly':
        return (
          <svg width={size} height={size} viewBox="0 0 160 160" style={{ filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3))' }}>
            <defs>
              <linearGradient id="friendlySkin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            {/* Background Halo */}
            <circle cx="80" cy="80" r="70" fill="rgba(16, 185, 129, 0.15)" stroke="#10B981" strokeWidth="2" />

            {/* Torso */}
            <path d="M 36 148 C 42 112 118 112 124 148 Z" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
            <path d="M 64 122 Q 80 134 96 122" fill="none" stroke="#FDE68A" strokeWidth="3" />

            {/* Neck & Head */}
            <rect x="73" y="98" width="14" height="20" rx="3" fill="#FBBF24" />
            <ellipse cx="80" cy="74" rx="32" ry="38" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />

            {/* Hair */}
            <path d="M 46 72 C 44 40 116 40 114 72 C 114 54 100 46 80 46 C 60 46 46 54 46 72 Z" fill="#78350F" />
            <path d="M 44 72 Q 48 94 56 100" fill="none" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
            <path d="M 116 72 Q 112 94 104 100" fill="none" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />

            {/* Audio Headset */}
            <path d="M 42 74 C 42 36 118 36 118 74" fill="none" stroke="#10B981" strokeWidth="3.5" />
            <rect x="38" y="66" width="8" height="16" rx="4" fill="#047857" stroke="#10B981" strokeWidth="1.5" />
            <rect x="114" y="66" width="8" height="16" rx="4" fill="#047857" stroke="#10B981" strokeWidth="1.5" />
            {/* Mic */}
            <path d="M 42 78 Q 50 96 66 94" fill="none" stroke="#10B981" strokeWidth="2" />
            <circle cx="68" cy="94" r="3" fill="#34D399" />

            {/* Eyes */}
            <ellipse cx="68" cy="72" rx="4" ry="5" fill="#1F2937" />
            <ellipse cx="92" cy="72" rx="4" ry="5" fill="#1F2937" />
            <circle cx="70" cy="70" r="1.5" fill="#FFFFFF" />
            <circle cx="94" cy="70" r="1.5" fill="#FFFFFF" />
            {/* Cheerful Eyebrows */}
            <path d="M 63 64 Q 68 62 73 64" fill="none" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
            <path d="M 87 64 Q 92 62 97 64" fill="none" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />

            {/* Animated Talking Mouth */}
            {isActivelyTalking ? (
              mouthFrame === 0 ? (
                <ellipse cx="80" cy="92" rx="7" ry="5" fill="#DC2626" />
              ) : mouthFrame === 1 ? (
                <path d="M 72 90 Q 80 102 88 90 Z" fill="#DC2626" />
              ) : mouthFrame === 2 ? (
                <ellipse cx="80" cy="92" rx="5" ry="7" fill="#DC2626" />
              ) : (
                <path d="M 73 90 Q 80 98 87 90 Z" fill="#DC2626" />
              )
            ) : (
              <path d="M 73 90 Q 80 96 87 90" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
            )}
          </svg>
        );

      case 'bot':
        return (
          <svg width={size} height={size} viewBox="0 0 160 160" style={{ filter: 'drop-shadow(0 4px 14px rgba(245, 158, 11, 0.4))' }}>
            {/* Outer Hexagon / Shield Frame */}
            <polygon points="80,12 144,48 144,112 80,148 16,112 16,48" fill="#1E293B" stroke="#F59E0B" strokeWidth="2.5" />

            {/* Robot Antenna */}
            <line x1="80" y1="36" x2="80" y2="18" stroke="#F59E0B" strokeWidth="3" />
            <circle cx="80" cy="16" r="5" fill={isActivelyTalking ? '#EF4444' : '#F59E0B'} className={isActivelyTalking ? 'animate-ping' : ''} />

            {/* Head Core */}
            <rect x="42" y="38" width="76" height="66" rx="14" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />

            {/* Digital Screen Visor */}
            <rect x="50" y="46" width="60" height="34" rx="8" fill="#0284C7" fillOpacity="0.25" stroke="#38BDF8" strokeWidth="1.5" />

            {/* LED Matrix Eyes */}
            {isActivelyTalking ? (
              <>
                <path d="M 58 63 Q 66 54 72 63" fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M 88 63 Q 94 54 102 63" fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <rect x="60" y="58" width="10" height="8" rx="2" fill="#38BDF8" />
                <rect x="90" y="58" width="10" height="8" rx="2" fill="#38BDF8" />
              </>
            )}

            {/* Audio Wave Mouth (Soundwave frequency meter) */}
            {isActivelyTalking ? (
              <g transform="translate(62, 88)">
                <line x1="4" y1="8" x2="4" y2={8 - ((mouthFrame * 3) % 9)} stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="8" x2="12" y2={8 - (((mouthFrame + 2) * 4) % 12)} stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="20" y1="8" x2="20" y2={8 - (((mouthFrame + 1) * 3) % 10)} stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="28" y1="8" x2="28" y2={8 - (((mouthFrame + 3) * 4) % 11)} stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="36" y1="8" x2="36" y2={8 - ((mouthFrame * 2) % 8)} stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ) : (
              <line x1="66" y1="88" x2="94" y2="88" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
            )}

            {/* Shoulders */}
            <path d="M 44 116 L 30 142 L 130 142 L 116 116 Z" fill="#334155" stroke="#F59E0B" strokeWidth="1.5" />
          </svg>
        );

      case 'scholar':
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 160 160" style={{ filter: 'drop-shadow(0 4px 14px rgba(84, 194, 240, 0.35))' }}>
            <defs>
              <linearGradient id="scholarSuit" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
            </defs>

            {/* Glowing Knowledge Aura */}
            <circle cx="80" cy="80" r="70" fill="rgba(84, 194, 240, 0.12)" stroke="#54C2F0" strokeWidth="2" strokeDasharray={isActivelyTalking ? '6,3' : 'none'} />

            {/* Suit & Collar */}
            <path d="M 36 148 C 42 114 118 114 124 148 Z" fill="url(#scholarSuit)" stroke="#334155" strokeWidth="1.5" />
            <polygon points="80,118 70,148 90,148" fill="#54C2F0" />
            <polygon points="80,122 75,134 85,134" fill="#38BDF8" />
            <polygon points="66,118 80,136 74,148 60,128" fill="#E2E8F0" />
            <polygon points="94,118 80,136 86,148 100,128" fill="#E2E8F0" />

            {/* Neck & Head */}
            <rect x="73" y="98" width="14" height="20" rx="3" fill="#E2E8F0" />
            <ellipse cx="80" cy="74" rx="32" ry="38" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />

            {/* Hair - Sophisticated Academic Styling */}
            <path d="M 48 68 C 46 38 114 38 112 68 C 112 48 98 44 80 44 C 62 44 48 48 48 68 Z" fill="#334155" />

            {/* Stylish Glasses */}
            <rect x="54" y="66" width="22" height="15" rx="4" fill="rgba(84, 194, 240, 0.2)" stroke="#54C2F0" strokeWidth="2" />
            <rect x="84" y="66" width="22" height="15" rx="4" fill="rgba(84, 194, 240, 0.2)" stroke="#54C2F0" strokeWidth="2" />
            <line x1="76" y1="73" x2="84" y2="73" stroke="#54C2F0" strokeWidth="2" />
            <line x1="48" y1="72" x2="54" y2="72" stroke="#54C2F0" strokeWidth="1.5" />
            <line x1="106" y1="72" x2="112" y2="72" stroke="#54C2F0" strokeWidth="1.5" />

            {/* Eyes */}
            <circle cx="65" cy="73" r="3.5" fill="#0F172A" />
            <circle cx="95" cy="73" r="3.5" fill="#0F172A" />
            <circle cx="66" cy="71.5" r="1.2" fill="#FFFFFF" />
            <circle cx="96" cy="71.5" r="1.2" fill="#FFFFFF" />

            {/* Animated Talking Mouth */}
            {isActivelyTalking ? (
              mouthFrame === 0 ? (
                <ellipse cx="80" cy="94" rx="7" ry="5.5" fill="#991B1B" stroke="#F87171" strokeWidth="1" />
              ) : mouthFrame === 1 ? (
                <path d="M 72 92 Q 80 104 88 92 Z" fill="#991B1B" />
              ) : mouthFrame === 2 ? (
                <ellipse cx="80" cy="93" rx="5" ry="6.5" fill="#991B1B" />
              ) : (
                <path d="M 73 92 Q 80 99 87 92 Z" fill="#991B1B" />
              )
            ) : (
              <path d="M 74 93 Q 80 97 86 93" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        );
    }
  };

  const isActivelyTalking = isSpeaking && !isMuted && volume > 0;

  // 1. PRESENTERS LAYOUT (Dedicated Tutor Side Panel alongside the Canvas)
  if (layout === 'presenter') {
    return (
      <div
        style={{
          background: '#0F172A',
          borderRadius: '16px',
          border: `1.5px solid ${cur.color}`,
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          position: 'relative',
          boxShadow: `0 8px 30px ${cur.bg}`,
          transition: 'all 0.25s ease'
        }}
      >
        {/* Header with Persona Switcher */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActivelyTalking ? '#10B981' : '#64748B', boxShadow: isActivelyTalking ? '0 0 8px #10B981' : 'none' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: cur.color }}>
              AI INSTRUCTOR
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowPersonaPicker(!showPersonaPicker)}
              className="btn sm"
              style={{ fontSize: '11px', padding: '2px 8px', borderColor: '#334155', color: '#94A3B8' }}
              title="Change Avatar Persona"
            >
              🎭 Switch Avatar
            </button>
            <button
              onClick={() => onLayoutChange('pip')}
              className="btn sm"
              style={{ fontSize: '11px', padding: '2px 8px', borderColor: '#334155', color: '#94A3B8' }}
              title="Switch to Corner Picture-in-Picture"
            >
              📌 PIP
            </button>
          </div>
        </div>

        {/* Persona Selector Popover */}
        {showPersonaPicker && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', width: '100%', background: '#1E293B', padding: '8px', borderRadius: '10px', border: '1px solid #334155' }}>
            {(['scholar', 'hologram', 'friendly', 'bot'] as AvatarPersona[]).map(p => (
              <button
                key={p}
                onClick={() => {
                  onPersonaChange(p);
                  setShowPersonaPicker(false);
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: persona === p ? personaMeta[p].color : 'transparent',
                  background: persona === p ? personaMeta[p].bg : 'transparent',
                  color: persona === p ? '#FFFFFF' : '#94A3B8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {personaMeta[p].name}
              </button>
            ))}
          </div>
        )}

        {/* Avatar Graphic with Floating Motion */}
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          {renderAvatarGraphic(145)}

          {/* Soundwave Bars Indicator when talking */}
          {isActivelyTalking && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', position: 'absolute', bottom: '6px', background: 'rgba(15, 23, 42, 0.85)', padding: '4px 10px', borderRadius: '12px', border: `1px solid ${cur.color}` }}>
              {[12, 18, 24, 14, 20, 10].map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: '3px',
                    height: `${((h + mouthFrame * 4) % 18) + 6}px`,
                    background: cur.color,
                    borderRadius: '2px',
                    transition: 'height 0.1s ease'
                  }}
                />
              ))}
              <span style={{ fontSize: '10px', fontWeight: 800, color: cur.color, marginLeft: '4px' }}>
                LIVE SPEECH
              </span>
            </div>
          )}
        </div>

        {/* Instructor Bio & Role */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC' }}>{cur.name}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{cur.title}</div>
        </div>

        {/* Live Speech Bubble */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: `1px solid ${isActivelyTalking ? cur.color : '#334155'}`,
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '12.5px',
            lineHeight: 1.5,
            color: '#E2E8F0',
            width: '100%',
            position: 'relative'
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: cur.color, fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={12} />
            {isMuted ? 'Narration Muted' : isActivelyTalking ? 'Narrating Stage ' + (stageIdx + 1) : 'Attentive & Ready'}
          </div>
          <div style={{ fontStyle: isActivelyTalking ? 'italic' : 'normal', maxHeight: '72px', overflowY: 'auto' }}>
            {voiceoverText ? `“${voiceoverText}”` : `Explaining ${topicName} step-by-step.`}
          </div>
        </div>
      </div>
    );
  }

  // 2. CORNER PIP LAYOUT (Floating Interactive Presenter over the Video Canvas)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        border: `1.5px solid ${cur.color}`,
        borderRadius: '16px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px ${cur.bg}`,
        transition: 'all 0.25s ease'
      }}
    >
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowPersonaPicker(!showPersonaPicker)} title="Click to Change Persona">
        {renderAvatarGraphic(72)}
        {isActivelyTalking && (
          <span style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', border: '2px solid #0F172A', animation: 'pulse 1.5s infinite' }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '240px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#F8FAFC' }}>
            {cur.name}
          </span>
          <button
            onClick={() => onLayoutChange('presenter')}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '10px', cursor: 'pointer', padding: 0 }}
            title="Expand to Full Presenter Column"
          >
            🔲 Side View
          </button>
        </div>

        <span style={{ fontSize: '10.5px', color: cur.color, fontWeight: 600 }}>
          {isMuted ? 'Muted' : isActivelyTalking ? 'Speaking...' : 'Ready'}
        </span>

        {voiceoverText && (
          <span style={{ fontSize: '11px', color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
            {voiceoverText}
          </span>
        )}
      </div>

      {showPersonaPicker && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '8px',
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            width: '160px'
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Choose Instructor:
          </div>
          {(['scholar', 'hologram', 'friendly', 'bot'] as AvatarPersona[]).map(p => (
            <button
              key={p}
              onClick={() => {
                onPersonaChange(p);
                setShowPersonaPicker(false);
              }}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: persona === p ? personaMeta[p].color : 'transparent',
                background: persona === p ? personaMeta[p].bg : 'transparent',
                color: persona === p ? '#FFFFFF' : '#CBD5E1',
                fontSize: '11px',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              {personaMeta[p].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

