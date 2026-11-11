/* eslint-disable prefer-const */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';
import { AIAvatarInstructor, AvatarPersona, AvatarLayout } from '../AIAvatarInstructor';

interface AILearningStudioViewProps {
  token: string | null;
  activeExam: Exam | null;
  topicId: string | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenPracticeForTopic?: (topicId: string) => void;
}

// ============================================================================
// Robust SVG Multi-Line Text Wrapping & Archetype Diagram Engine (Frontend)
// Guarantees zero text overflow, perfect vertical/horizontal alignment & rich visuals
// ============================================================================

function splitTextIntoTspans(
  text: string,
  centerX: number,
  centerY: number,
  maxCharsPerLine: number = 20,
  fontSize: number = 13,
  lineHeight: number = 17,
  fillColor: string = '#FFFFFF'
): string {
  const words = (text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length === 0) lines.push(text || 'Concept');

  const totalH = (lines.length - 1) * lineHeight;
  const startY = centerY - totalH / 2;

  const tspans = lines
    .map((line, idx) => `<tspan x="${centerX}" y="${(startY + idx * lineHeight).toFixed(1)}">${line}</tspan>`)
    .join('');

  return `<text x="${centerX}" fill="${fillColor}" font-size="${fontSize}" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">${tspans}</text>`;
}

function detectTopicArchetype(topicName: string = '', subjectName: string = ''): 'data_structure' | 'cycle' | 'pipeline' | 'formula' | 'concept' {
  const combined = `${topicName} ${subjectName}`.toLowerCase();
  if (['linked list', 'binary tree', 'bst', 'heap', 'stack', 'queue', 'graph', 'hash table', 'data structure', 'pointer', 'node'].some(k => combined.includes(k))) {
    return 'data_structure';
  }
  if (['cycle', 'krebs', 'carbon', 'nitrogen', 'water cycle', 'calvin', 'cardiac', 'cell cycle', 'carnot', 'refrigeration', 'circulation'].some(k => combined.includes(k))) {
    return 'cycle';
  }
  if (['how it works', 'pipeline', 'protocol', 'compiler', 'dns', 'http', 'internet', 'digestion', 'reflex', 'algorithm', 'process', 'synthesis', 'transmission'].some(k => combined.includes(k))) {
    return 'pipeline';
  }
  if (['formula', 'equation', 'law', 'derivation', 'energy', 'force', 'gravity', 'calculus', 'velocity', 'acceleration', 'ohm', 'thermodynamics', 'integral', 'derivative'].some(k => combined.includes(k))) {
    return 'formula';
  }
  return 'concept';
}

function renderLinkedListSvg(topicName: string): string {
  const titleTspans = splitTextIntoTspans(topicName, 360, 24, 38, 13, 17, '#38BDF8');
  return `<svg viewBox="0 0 720 170" width="100%" height="100%" style="max-height: 170px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="feNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2438"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <marker id="feArrNext" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="feArrPrev" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 10 1 L 0 5 L 10 9 z" fill="#C084FC"/>
    </marker>
  </defs>

  ${titleTspans}

  <!-- Node 1: HEAD -->
  <g transform="translate(40, 52)">
    <rect width="160" height="72" rx="10" fill="url(#feNodeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(56, 189, 248, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">HEAD [0]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 12</text>
    <circle cx="128" cy="36" r="6" fill="#38BDF8"/>
    <text x="128" y="55" fill="#38BDF8" font-size="9" font-family="monospace" text-anchor="middle">next</text>
  </g>

  <!-- Forward Pointer (Node 1 -> Node 2) -->
  <line x1="200" y1="76" x2="265" y2="76" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#feArrNext)"/>
  <!-- Backward Pointer (Node 2 -> Node 1 for Doubly) -->
  <line x1="265" y1="96" x2="200" y2="96" stroke="#C084FC" stroke-width="2" stroke-dasharray="3" marker-start="url(#feArrPrev)"/>

  <!-- Node 2 -->
  <g transform="translate(275, 52)">
    <rect width="160" height="72" rx="10" fill="url(#feNodeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(56, 189, 248, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">NODE [1]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 45</text>
    <circle cx="128" cy="36" r="6" fill="#38BDF8"/>
    <text x="128" y="55" fill="#38BDF8" font-size="9" font-family="monospace" text-anchor="middle">next</text>
  </g>

  <!-- Forward Pointer (Node 2 -> Node 3) -->
  <line x1="435" y1="76" x2="500" y2="76" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#feArrNext)"/>
  <!-- Backward Pointer (Node 3 -> Node 2 for Doubly) -->
  <line x1="500" y1="96" x2="435" y2="96" stroke="#C084FC" stroke-width="2" stroke-dasharray="3" marker-start="url(#feArrPrev)"/>

  <!-- Node 3: TAIL -->
  <g transform="translate(510, 52)">
    <rect width="160" height="72" rx="10" fill="url(#feNodeGrad)" stroke="#10B981" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(16, 185, 129, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">TAIL [2]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 99</text>
    <rect x="110" y="26" width="36" height="20" rx="4" fill="#0C131B" stroke="#64748B"/>
    <text x="128" y="40" fill="#EF4444" font-size="10" font-weight="700" font-family="monospace" text-anchor="middle">NULL</text>
  </g>

  <!-- Legend -->
  <g transform="translate(200, 150)">
    <line x1="0" y1="6" x2="25" y2="6" stroke="#38BDF8" stroke-width="2.5"/>
    <text x="32" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Next Pointer (Singly/Doubly)</text>
    <line x1="210" y1="6" x2="235" y2="6" stroke="#C084FC" stroke-width="2" stroke-dasharray="3"/>
    <text x="242" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Prev Pointer (Doubly Only)</text>
  </g>
</svg>`;
}

function renderCycleSvg(topicName: string): string {
  const centerTspans = splitTextIntoTspans(topicName, 360, 110, 18, 12, 16, '#FFFFFF');
  return `<svg viewBox="0 0 720 220" width="100%" height="100%" style="max-height: 220px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="feCycleCenter" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C1E32"/>
      <stop offset="100%" stop-color="#082F49"/>
    </linearGradient>
  </defs>

  <path id="feOrbitLoop" d="M 360,35 A 190,75 0 1,1 359.9,35 Z" fill="none" stroke="rgba(56, 189, 248, 0.25)" stroke-width="2" stroke-dasharray="6 4"/>
  <circle r="4.5" fill="#38BDF8">
    <animateMotion dur="5s" repeatCount="indefinite">
      <mpath href="#feOrbitLoop"/>
    </animateMotion>
  </circle>
  <circle r="4" fill="#34D399">
    <animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite">
      <mpath href="#feOrbitLoop"/>
    </animateMotion>
  </circle>

  <g transform="translate(280, 8)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="80" y="20" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 1: GENESIS</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Input / Evaporation</text>
  </g>

  <g transform="translate(530, 88)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="80" y="20" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 2: TRANSFORMATION</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Condensation / Synthesis</text>
  </g>

  <g transform="translate(280, 168)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#10B981" stroke-width="1.5"/>
    <text x="80" y="20" fill="#10B981" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 3: RELEASE</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Precipitation / Action</text>
  </g>

  <g transform="translate(30, 88)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#C084FC" stroke-width="1.5"/>
    <text x="80" y="20" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 4: RECOVERY</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Return to Initial State</text>
  </g>

  <circle cx="360" cy="110" r="48" fill="url(#feCycleCenter)" stroke="#38BDF8" stroke-width="2"/>
  ${centerTspans}
</svg>`;
}

function renderPipelineSvg(topicName: string): string {
  const titleTspans = splitTextIntoTspans(topicName, 360, 24, 38, 13, 17, '#38BDF8');
  return `<svg viewBox="0 0 720 150" width="100%" height="100%" style="max-height: 150px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="fePipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2438"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <marker id="fePipeArr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
  </defs>

  ${titleTspans}

  <g transform="translate(20, 50)">
    <rect width="140" height="64" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="70" y="28" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 1: INGESTION</text>
    <text x="70" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Input Request</text>
  </g>
  <line x1="160" y1="82" x2="195" y2="82" stroke="#38BDF8" stroke-width="2" marker-end="url(#fePipeArr)"/>

  <g transform="translate(195, 50)">
    <rect width="150" height="64" rx="10" fill="url(#fePipeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <text x="75" y="28" fill="#54C2F0" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 2: PARSER</text>
    <text x="75" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Validation & Routing</text>
  </g>
  <line x1="345" y1="82" x2="380" y2="82" stroke="#38BDF8" stroke-width="2" marker-end="url(#fePipeArr)"/>

  <g transform="translate(380, 50)">
    <rect width="150" height="64" rx="10" fill="url(#fePipeGrad)" stroke="#818CF8" stroke-width="1.8"/>
    <text x="75" y="28" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 3: EXECUTION</text>
    <text x="75" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Core Compute Rule</text>
  </g>
  <line x1="530" y1="82" x2="565" y2="82" stroke="#10B981" stroke-width="2" marker-end="url(#fePipeArr)"/>

  <g transform="translate(565, 50)">
    <rect width="135" height="64" rx="10" fill="#064E3B" stroke="#10B981" stroke-width="1.5"/>
    <text x="67" y="28" fill="#10B981" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 4: OUTPUT</text>
    <text x="67" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Verified Result</text>
  </g>

  <circle r="4" fill="#38BDF8">
    <animate attributeName="cx" values="160;565" dur="3s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="82;82" dur="3s" repeatCount="indefinite"/>
  </circle>
</svg>`;
}

function renderFormulaSvg(topicName: string): string {
  const titleTspans = splitTextIntoTspans(topicName, 150, 95, 20, 12, 16, '#FFFFFF');
  return `<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="feEqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>
  </defs>

  <g transform="translate(20, 20)">
    <rect width="260" height="120" rx="12" fill="url(#feEqGrad)" stroke="#818CF8" stroke-width="1.8"/>
    <text x="130" y="32" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" letter-spacing="1" text-anchor="middle">GOVERNING EQUATION</text>
    <text x="130" y="66" fill="#FBBF24" font-size="20" font-weight="700" font-family="serif" text-anchor="middle">y = f(x) · ΔS / Δt</text>
  </g>
  ${titleTspans}

  <g transform="translate(300, 20)">
    <rect width="400" height="120" rx="12" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>

    <g transform="translate(18, 22)">
      <circle cx="10" cy="10" r="10" fill="rgba(56, 189, 248, 0.2)"/>
      <text x="10" y="14" fill="#38BDF8" font-size="10" font-weight="800" text-anchor="middle">1</text>
      <text x="30" y="14" fill="#E2E8F0" font-size="12" font-weight="600" font-family="system-ui">Identify given variables and convert units to SI standard</text>
    </g>

    <g transform="translate(18, 56)">
      <circle cx="10" cy="10" r="10" fill="rgba(192, 132, 252, 0.2)"/>
      <text x="10" y="14" fill="#C084FC" font-size="10" font-weight="800" text-anchor="middle">2</text>
      <text x="30" y="14" fill="#E2E8F0" font-size="12" font-weight="600" font-family="system-ui">Apply algebraic transformation and boundary constraints</text>
    </g>

    <g transform="translate(18, 90)">
      <circle cx="10" cy="10" r="10" fill="rgba(16, 185, 129, 0.2)"/>
      <text x="10" y="14" fill="#10B981" font-size="10" font-weight="800" text-anchor="middle">3</text>
      <text x="30" y="14" fill="#10B981" font-size="12" font-weight="700" font-family="system-ui">Dimensional consistency checked → Final calibrated answer</text>
    </g>
  </g>
</svg>`;
}

function renderArchitectureFlowSvg(topicName: string): string {
  const centerTspans = splitTextIntoTspans(topicName, 360, 78, 22, 13, 17, '#FFFFFF');
  return `<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="feArchCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C2338"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <linearGradient id="feArchInGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141E2A"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="feArchOutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <marker id="feArchArr1" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="feArchArr2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981"/>
    </marker>
  </defs>

  <!-- Left: Input State -->
  <g transform="translate(24, 44)">
    <rect width="130" height="62" rx="12" fill="url(#feArchInGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="65" y="32" fill="#94A3B8" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle">Input Stimulus</text>
    <text x="65" y="49" fill="#64748B" font-size="10" font-family="monospace" text-anchor="middle">[Initial State]</text>
  </g>

  <!-- Line 1: Input -> Core -->
  <line x1="154" y1="75" x2="208" y2="75" stroke="#38BDF8" stroke-width="2.5" stroke-dasharray="4" marker-end="url(#feArchArr1)"/>
  <circle r="3.5" fill="#38BDF8">
    <animate attributeName="cx" from="154" to="208" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="75;75" dur="1.8s" repeatCount="indefinite"/>
  </circle>

  <!-- Center: Core Governing Principle Box (Spacious 288px wide, wrapped text, never overflows) -->
  <g transform="translate(216, 28)">
    <rect width="288" height="94" rx="14" fill="url(#feArchCoreGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <text x="144" y="24" fill="#54C2F0" font-size="10" font-weight="800" font-family="system-ui" letter-spacing="1" text-anchor="middle">✦ CORE MECHANISM</text>
  </g>
  ${centerTspans}

  <!-- Line 2: Core -> Output -->
  <line x1="504" y1="75" x2="558" y2="75" stroke="#10B981" stroke-width="2.5" marker-end="url(#feArchArr2)"/>
  <circle r="3.5" fill="#10B981">
    <animate attributeName="cx" from="504" to="558" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="75;75" dur="1.8s" repeatCount="indefinite"/>
  </circle>

  <!-- Right: Output State -->
  <g transform="translate(566, 44)">
    <rect width="130" height="62" rx="12" fill="url(#feArchOutGrad)" stroke="#10B981" stroke-width="1.5"/>
    <text x="65" y="32" fill="#FFFFFF" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle">Stable Output</text>
    <text x="65" y="49" fill="#A7F3D0" font-size="10" font-family="monospace" text-anchor="middle">[Equilibrium]</text>
  </g>
</svg>`;
}

function renderConceptBadgeSvg(topicName: string): string {
  const titleTspans = splitTextIntoTspans(topicName, 360, 105, 28, 15, 19, '#FFFFFF');
  return `<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <rect x="20" y="16" width="680" height="128" rx="16" fill="#111C2B" stroke="#0284C7" stroke-width="1.8"/>
  <circle cx="360" cy="52" r="26" fill="#0284C7"/>
  <text x="360" y="58" fill="#FFFFFF" font-size="18" text-anchor="middle" font-weight="bold">✦</text>
  ${titleTspans}
  <text x="360" y="132" fill="#38BDF8" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Core Educational Pillar</text>
</svg>`;
}

function renderRecapChecklistSvg(topicName: string): string {
  return `<svg viewBox="0 0 720 140" width="100%" height="100%" style="max-height: 140px; display: block; margin: 0 auto;">
  <rect x="20" y="12" width="680" height="116" rx="14" fill="#0F172A" stroke="#38BDF8" stroke-width="1.5"/>
  <g transform="translate(60, 42)">
    <circle cx="10" cy="10" r="10" fill="#10B981"/>
    <text x="10" y="14" fill="#FFFFFF" font-size="11" font-weight="900" text-anchor="middle">✓</text>
    <text x="32" y="14" fill="#F1F5F9" font-size="13" font-weight="600" font-family="system-ui">Foundational Definitions & Core Invariants Understood</text>
  </g>
  <g transform="translate(60, 72)">
    <circle cx="10" cy="10" r="10" fill="#10B981"/>
    <text x="10" y="14" fill="#FFFFFF" font-size="11" font-weight="900" text-anchor="middle">✓</text>
    <text x="32" y="14" fill="#F1F5F9" font-size="13" font-weight="600" font-family="system-ui">Dimensional Limits, SI Units & Governing Equations Verified</text>
  </g>
  <g transform="translate(60, 102)">
    <circle cx="10" cy="10" r="10" fill="#38BDF8"/>
    <text x="10" y="14" fill="#0C131B" font-size="11" font-weight="900" text-anchor="middle">★</text>
    <text x="32" y="14" fill="#38BDF8" font-size="13" font-weight="700" font-family="system-ui">Practice Test Drills & Common Trap Elimination Mastered</text>
  </g>
</svg>`;
}

// Master formatter: intercepts any SVG and ensures it uses the wrapped, archetype-appropriate SVG
const formatDiagramSvg = (rawSvg?: string | null, topicName: string = 'Core Concept', subjectName: string = ''): string => {
  const cleanT = (topicName || 'Core Concept').trim();
  const arch = detectTopicArchetype(cleanT, subjectName);

  // If already clean and responsive with tspan text and 720 viewBox, return as-is
  if (rawSvg && rawSvg.includes('viewBox="0 0 720') && rawSvg.includes('<tspan')) {
    return rawSvg;
  }

  // If topic is data structure (e.g. Singly and Doubly Linked Lists), ALWAYS return the linked list diagram!
  if (arch === 'data_structure') {
    return renderLinkedListSvg(cleanT);
  }

  // If rawSvg represents concept badge
  if (rawSvg && (rawSvg.includes('✦') || rawSvg.includes('concept_badge'))) {
    return renderConceptBadgeSvg(cleanT);
  }

  // If rawSvg represents checklist or summary
  if (rawSvg && (rawSvg.includes('checklist') || rawSvg.includes('✔') || rawSvg.includes('✓'))) {
    return renderRecapChecklistSvg(cleanT);
  }

  // If topic is cycle
  if (arch === 'cycle') {
    return renderCycleSvg(cleanT);
  }

  // If topic is pipeline
  if (arch === 'pipeline') {
    return renderPipelineSvg(cleanT);
  }

  // If topic is formula
  if (arch === 'formula') {
    return renderFormulaSvg(cleanT);
  }

  // Otherwise return spacious, auto-wrapped 3-block architecture flow
  return renderArchitectureFlowSvg(cleanT);
};


export const AILearningStudioView: React.FC<AILearningStudioViewProps> = ({
  token,
  activeExam,
  topicId,
  onNavigate,
  showToast,
  onOpenPracticeForTopic
}) => {
  const [loading, setLoading] = useState(false);
  const [studioData, setStudioData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'learn' | 'video' | 'activities' | 'comprehension' | 'practice' | 'tutor'>('learn');

  // Animated Video Player state
  const [videoData, setVideoData] = useState<any>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoEngine, setVideoEngine] = useState<'remotion' | 'manim' | 'hybrid'>('remotion');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showCaptions, setShowCaptions] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoHover, setVideoHover] = useState<boolean>(false);

  const resolvedAudioUrl = videoData?.audio_url ||
    (videoData?.video_url && (videoData.video_url.endsWith('.wav') || videoData.video_url.endsWith('.mp3') || videoData.video_url.includes('/static/audio/'))
      ? videoData.video_url
      : null);

  // AI Avatar Instructor State
  const [showAvatar, setShowAvatar] = useState<boolean>(true);
  const [avatarPersona, setAvatarPersona] = useState<AvatarPersona>('scholar');
  const [avatarLayout, setAvatarLayout] = useState<AvatarLayout>('pip');

  // 9-Step Masterclass Journey State
  const [masteryStep, setMasteryStep] = useState<number>(1);

  // Lesson Text Audio Reader State
  const [isLessonAudioPlaying, setIsLessonAudioPlaying] = useState<boolean>(false);
  const [lessonAudioSpeed, setLessonAudioSpeed] = useState<number>(1.0);
  const [lessonAudioVolume, setLessonAudioVolume] = useState<number>(85);
  const [lessonAudioMuted, setLessonAudioMuted] = useState<boolean>(false);

  // Section 12 Interactive Evaluation & Simplified Re-Explanation State
  const [selectedSection12Answers, setSelectedSection12Answers] = useState<Record<number, number>>({});
  const [expandedSimplerExpl, setExpandedSimplerExpl] = useState<Record<number, boolean>>({});

  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<number, number>>({});
  const [checkpointRevealed, setCheckpointRevealed] = useState<Record<number, boolean>>({});
  const [simParams, setSimParams] = useState<Record<number, number>>({});
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [showAnalogyMode, setShowAnalogyMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Flashcards & Activities state
  const [currentFcIndex, setCurrentFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [reviewedFcIds, setReviewedFcIds] = useState<Set<string>>(new Set());
  
  // Flipcards state
  const [openFlipCardIds, setOpenFlipCardIds] = useState<Set<string>>(new Set());
  
  // Mini Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  
  // Worked Examples state
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0]));

  // Matching Exercise state
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});

  // Comprehension checks state
  const [compAnswers, setCompAnswers] = useState<Record<number, number>>({});
  const [compSubmitted, setCompSubmitted] = useState(false);
  const [compScore, setCompScore] = useState<number>(0);

  // In-Topic AI Tutor Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; message: string; created_at?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Practice state inside studio
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [practiceDifficulty, setPracticeDifficulty] = useState<string>('intermediate');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceEvaluations, setPracticeEvaluations] = useState<Record<string, any>>({});
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [immediateReveal, setImmediateReveal] = useState(true);
  const [revealedSolutions, setRevealedSolutions] = useState<Set<number>>(new Set());
  const [revealedLearnHints, setRevealedLearnHints] = useState<Set<number>>(new Set());

  // Load Studio Content
  const loadStudioContent = async (tid: string) => {
    if (!token) return;
    setLoading(true);
    setRevealedSolutions(new Set());
    setRevealedLearnHints(new Set());
    setCheckpointAnswers({});
    setCheckpointRevealed({});
    setSimParams({});
    setActiveHotspot(null);
    try {
      const res = await api.getInteractiveTopicStudio(token, tid);
      setStudioData(res);
      if (res.video) {
        setVideoData(res.video);
      } else {
        try {
          const vRes = await api.getTopicVideo(token, tid);
          if (vRes.has_video && vRes.video) setVideoData(vRes.video);
        } catch (err) {}
      }
      // Load chat history
      try {
        const hRes = await api.getTopicChatHistory(token, tid);
        if (hRes.history && hRes.history.length > 0) {
          setChatMessages(hRes.history);
        } else {
          setChatMessages([
            {
              role: 'assistant',
              message: `Hello! I am your AI Tutor for **${res.topic?.topic_name}**. Ask me to explain concepts in simpler words, provide more real-life examples, or test your comprehension step-by-step!`
            }
          ]);
        }
      } catch (err) {}
      // Load practice questions
      loadPracticeQuestions(tid, 'intermediate');
    } catch (e: any) {
      showToast(e.message || 'Failed to load topic studio');
    } finally {
      setLoading(false);
    }
  };

  // Video Generation & Playback Handlers
  const handleGenerateVideo = async (engine: string = videoEngine) => {
    if (!token || !topicId) return;
    setVideoLoading(true);
    try {
      const res = await api.generateTopicVideo(token, topicId, engine);
      if (res.video) {
        setVideoData(res.video);
        showToast('🎬 Animated Educational Video generated with voiceover!');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to generate video');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRegenerateVideo = async () => {
    if (!token || !topicId) return;
    setVideoLoading(true);
    try {
      const res = await api.regenerateTopicVideo(token, topicId, videoEngine);
      if (res.video) {
        setVideoData(res.video);
        showToast('🎬 Video regenerated successfully!');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to regenerate video');
    } finally {
      setVideoLoading(false);
    }
  };

  // Stop voice and audio when tab changes or component unmounts
  useEffect(() => {
    if (activeTab !== 'video') {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [volume, isMuted]);

  // Synchronize playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Web Speech fallback synthesis for voice narration
  const speakSceneWithWebSpeech = (sceneIdx: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isMuted || volume === 0) return;

    const scenes = videoData?.scenes_json || [];
    const scene = scenes[sceneIdx];
    const text = scene?.voiceover_text || scene?.title || '';
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = isMuted ? 0 : volume / 100;
    utterance.rate = Math.min(1.5, Math.max(0.7, playbackSpeed));

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Zira'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (audioRef.current && resolvedAudioUrl) {
        audioRef.current.volume = isMuted ? 0 : volume / 100;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().catch((err) => {
          console.warn('Audio playback interrupted or blocked, falling back to Web Speech:', err);
          speakSceneWithWebSpeech(currentSceneIdx);
        });
      } else {
        speakSceneWithWebSpeech(currentSceneIdx);
      }
    }
  };

  const jumpToScene = (idx: number) => {
    if (!videoData?.scenes_json) return;
    const scenes = videoData.scenes_json;
    if (idx < 0 || idx >= scenes.length) return;
    setCurrentSceneIdx(idx);
    setActiveHotspot(null);
    let targetTime = 0;
    for (let i = 0; i < idx; i++) {
      targetTime += parseFloat(scenes[i].duration_seconds || 18);
    }
    setPlaybackTime(targetTime);
    if (audioRef.current && resolvedAudioUrl) {
      audioRef.current.currentTime = targetTime;
      if (isPlaying) {
        audioRef.current.play().catch(() => speakSceneWithWebSpeech(idx));
      }
    } else if (isPlaying) {
      speakSceneWithWebSpeech(idx);
    }
  };

  // When scene advances while playing with Web Speech
  useEffect(() => {
    if (isPlaying && (!resolvedAudioUrl || !audioRef.current || audioRef.current.paused)) {
      speakSceneWithWebSpeech(currentSceneIdx);
    }
  }, [currentSceneIdx, isPlaying]);

  // 9-Step Journey Navigation
  const handleStepNavigation = (stepId: number) => {
    setMasteryStep(stepId);
    if (stepId === 1 || stepId === 2 || stepId === 4 || stepId === 5 || stepId === 7 || stepId === 9) {
      setActiveTab('learn');
    } else if (stepId === 3) {
      setActiveTab('video');
    } else if (stepId === 6) {
      setActiveTab('comprehension');
    } else if (stepId === 8) {
      setActiveTab('activities');
    }
  };

  // Lesson Text Audio Reader Handler
  const toggleLessonAudio = () => {
    if (isLessonAudioPlaying) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsLessonAudioPlaying(false);
    } else {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const topicIntroText = studioContent?.topic_introduction || topic?.topic_name || '';
      const simpleExplText = studioContent?.simple_explanation || '';
      const detailedExplText = studioContent?.detailed_explanation || '';
      const pts = (studioContent?.points_to_remember || []).join('. ');

      const fullText = `${topicIntroText}. Intuitive concept overview: ${simpleExplText}. In depth theoretical analysis: ${detailedExplText}. High yield summary to remember: ${pts}`;

      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.volume = lessonAudioMuted ? 0 : lessonAudioVolume / 100;
      utterance.rate = Math.min(1.5, Math.max(0.7, lessonAudioSpeed));

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Zira'))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        setIsLessonAudioPlaying(false);
        api.updateTopicInteraction(token!, topicId!, { audio_listened_seconds: 60 });
      };
      utterance.onerror = () => setIsLessonAudioPlaying(false);

      window.speechSynthesis.speak(utterance);
      setIsLessonAudioPlaying(true);
      showToast('🎙️ Spoken audio lesson started!');
    }
  };

  const readSectionAloud = (textToRead: string, label: string = 'Section') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.volume = lessonAudioMuted ? 0 : lessonAudioVolume / 100;
    utterance.rate = lessonAudioSpeed;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Samantha') || v.name.includes('David'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => setIsLessonAudioPlaying(false);
    utterance.onerror = () => setIsLessonAudioPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsLessonAudioPlaying(true);
    showToast(`🎙️ Reading ${label} aloud...`);
  };

  // Synchronize playback timeline when playing without audio or updating time
  useEffect(() => {
    let interval: any;
    if (isPlaying && (!audioRef.current || audioRef.current.paused)) {
      interval = setInterval(() => {
        setPlaybackTime(prev => {
          const totalDur = parseFloat(videoData?.duration_seconds || 90);
          const next = prev + 0.5 * playbackSpeed;
          if (next >= totalDur) {
            setIsPlaying(false);
            return totalDur;
          }
          // Find matching scene
          let acc = 0;
          const scenes = videoData?.scenes_json || [];
          for (let i = 0; i < scenes.length; i++) {
            acc += parseFloat(scenes[i].duration_seconds || 18);
            if (next <= acc) {
              setCurrentSceneIdx(i);
              break;
            }
          }
          return next;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, videoData]);

  const loadPracticeQuestions = async (tid: string, diff: string) => {
    if (!token) return;
    setPracticeLoading(true);
    try {
      const res = await api.getTopicPracticeQuestions(token, tid, diff);
      setPracticeQuestions(res.questions || []);
      setPracticeAnswers({});
      setPracticeEvaluations({});
    } catch (e: any) {
      console.error(e);
    } finally {
      setPracticeLoading(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      loadStudioContent(topicId);
    }
  }, [topicId, token]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  // Flashcard Actions
  const handleNextFc = () => {
    const flashcards = studioData?.studio_content?.interactive_elements?.flashcards || [];
    if (currentFcIndex < flashcards.length - 1) {
      setCurrentFcIndex(currentFcIndex + 1);
      setFcFlipped(false);
    }
  };

  const handlePrevFc = () => {
    if (currentFcIndex > 0) {
      setCurrentFcIndex(currentFcIndex - 1);
      setFcFlipped(false);
    }
  };

  const handleMarkFcReviewed = (fcId: string) => {
    const nextSet = new Set(reviewedFcIds);
    nextSet.add(fcId);
    setReviewedFcIds(nextSet);
    if (token && topicId) {
      api.updateTopicInteraction(token, topicId, {
        flashcards_reviewed: nextSet.size
      }).catch(() => {});
    }
    showToast('Flashcard marked reviewed!');
  };

  // Submit Comprehension Checks
  const handleSubmitComprehension = async () => {
    const checks = studioData?.studio_content?.comprehension_checks || [];
    if (checks.length === 0) return;

    let correct = 0;
    checks.forEach((c: any, i: number) => {
      if (compAnswers[i] === c.correct_index) {
        correct++;
      }
    });

    const scorePct = Math.round((correct / checks.length) * 100);
    setCompScore(scorePct);
    setCompSubmitted(true);

    if (token && topicId) {
      try {
        await api.updateTopicInteraction(token, topicId, {
          comprehension_score: scorePct,
          mark_mastered: scorePct >= 75
        });
        if (scorePct >= 75) {
          showToast(`Mastery Achieved! Score: ${scorePct}%`);
        } else {
          showToast(`Comprehension recorded: ${scorePct}%. Review the explanations below.`);
        }
      } catch (err) {}
    }
  };

  // Chat with AI Tutor
  const handleSendChatMessage = async (msgOverride?: string) => {
    const query = (msgOverride || chatInput).trim();
    if (!query || !token || !topicId || chatLoading) return;

    const newMsgs = [...chatMessages, { role: 'user', message: query }];
    setChatMessages(newMsgs);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.chatWithTopicTutor(token, topicId, query, newMsgs);
      setChatMessages([...newMsgs, { role: 'assistant', message: res.reply }]);
    } catch (e: any) {
      showToast(e.message || 'AI Tutor temporarily unavailable');
      setChatMessages([...newMsgs, { role: 'assistant', message: 'I encountered an error replying. Please ask again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Submit Single Practice Question
  const handlePracticeSubmit = async (q: any, chosenAnswer: string) => {
    if (!token || !topicId) return;
    setPracticeAnswers(prev => ({ ...prev, [q.id]: chosenAnswer }));

    try {
      const res = await api.submitTopicPracticeAnswer(token, topicId, {
        question_id: q.id,
        question_text: q.question,
        user_answer: chosenAnswer,
        correct_answer: q.correct_answer || (q.options ? q.options[q.correct_index || 0] : 'A'),
        difficulty: practiceDifficulty,
        used_hint: revealedHints.has(q.id)
      });
      setPracticeEvaluations(prev => ({ ...prev, [q.id]: res.evaluation }));
      if (res.evaluation?.is_correct) {
        showToast('Correct! Great job.');
      } else {
        showToast('Not quite. Review the mistake explanation.');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to submit practice question');
    }
  };

  if (!topicId) {
    return (
      <div className="view-container" style={{ padding: '32px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '540px', margin: '60px auto', padding: '40px' }}>
          <Icon name="sparkles" size={48} />
          <h2 style={{ marginTop: '16px', fontSize: '22px' }}>Interactive AI Learning Studio</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 24px' }}>
            Select a topic from your syllabus to open its level-adapted interactive learning studio, flashcards, tutor, and practice exercises.
          </p>
          <button className="btn primary" onClick={() => onNavigate('manage_syllabus')}>
            <Icon name="layers" size={16} /> Open Syllabus Hierarchy
          </button>
        </div>
      </div>
    );
  }

  if (loading || !studioData) {
    return (
      <div className="view-container" style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ animation: 'pulse 1.5s infinite', fontSize: '18px', fontWeight: 600 }}>
          <Icon name="sparkles" size={32} />
          <div style={{ marginTop: '12px' }}>Preparing Interactive AI Learning Studio...</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            Adapting explanations, flashcards, and checks to your learning level.
          </div>
        </div>
      </div>
    );
  }

  const topic = studioData.topic || {};
  const levelProfile = studioData.level_profile || {};
  const studioContent = studioData.studio_content || {};
  const interaction = studioData.interaction || {};
  const sections = studioContent.sections || [];
  const interactiveEls = studioContent.interactive_elements || {};
  const flashcards = interactiveEls.flashcards || [];
  const flipcards = interactiveEls.flip_cards || interactiveEls.flipcards || [];
  const miniQuiz = interactiveEls.mini_quiz || [];
  const matchingPairs = interactiveEls.matching_pairs || [];
  const workedExamples = interactiveEls.worked_examples || [];
  const mnemonics = interactiveEls.mnemonics || [];
  const compChecks = studioContent.comprehension_checks || [];
  const keyTakeaways = studioContent.key_takeaways || [];
  const prerequisites = studioContent.prerequisites || [];

  const currentFlashcard = flashcards[currentFcIndex];

  // 13-Point Structured Curriculum Content
  const topicIntro = studioContent.topic_introduction || topic.topic_name;
  const learningObjs: string[] = studioContent.learning_objectives || [];
  const simpleExpl = studioContent.simple_explanation || '';
  const detailedExpl = studioContent.detailed_explanation || '';
  const importantDefs: Array<{ term: string; definition: string }> = studioContent.important_definitions || [];
  const stepExamples: Array<{ title: string; problem: string; steps: string[]; solution: string }> = studioContent.step_by_step_examples || [];
  const realWorldApps: string[] = studioContent.real_world_applications || [];
  const importantFormulas: Array<{ name: string; formula: string; description: string; variables?: string[] }> = studioContent.important_formulas || [];
  const diagramsVisuals = studioContent.diagrams_and_visuals || null;
  const pointsToRemember: string[] = studioContent.points_to_remember || keyTakeaways || [];
  const topicSummary = studioContent.topic_summary || studioContent.summary || '';
  const practiceQList: Array<any> = studioContent.practice_questions || [];
  const faqList: Array<{ question: string; answer: string }> = studioContent.faqs || [];

  // Solutions and hints are tracked at top of component


  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Studio Header & Level Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
          <button className="linkbtn" onClick={() => onNavigate('manage_syllabus')}>
            &larr; Syllabus Hierarchy
          </button>
          <span>/</span>
          <span>{topic.subject_name || 'Subject'}</span>
          <span>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{topic.topic_name}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
                {topic.topic_name}
              </h1>
              <span className="pill primary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                🎓 {levelProfile.name || 'Level-Adapted'}
              </span>
              {interaction.has_mastered ? (
                <span className="pill good" style={{ fontSize: '11px' }}>
                  ✓ Mastered ({interaction.comprehension_score || 100}%)
                </span>
              ) : interaction.has_studied ? (
                <span className="pill" style={{ fontSize: '11px', background: 'var(--surface-hover)' }}>
                  📖 In Progress
                </span>
              ) : (
                <span className="pill" style={{ fontSize: '11px' }}>New Topic</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', maxWidth: '850px' }}>
              {studioContent.summary || `Personalized learning experience adapted for ${levelProfile.name || 'your education level'}.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn sm"
              onClick={() => {
                api.updateTopicInteraction(token!, topicId, { mark_mastered: true });
                showToast('Topic marked as Mastered!');
                setStudioData((prev: any) => ({
                  ...prev,
                  interaction: { ...prev.interaction, has_mastered: true, has_studied: true }
                }));
              }}
            >
              <Icon name="check" size={14} /> Mark Mastered
            </button>
            <button
              className="btn sm primary"
              onClick={() => setActiveTab('practice')}
            >
              <Icon name="play" size={14} /> Quick Practice
            </button>
          </div>
        </div>
      </div>

      {/* 9-Step Multimedia Learning Masterclass Stepper */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
          border: '1px solid #334155',
          color: '#E8EEF4',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.04em' }}>
              🚀 9-STEP SEQUENTIAL MULTIMEDIA LEARNING JOURNEY
            </span>
            <span className="pill" style={{ background: 'rgba(56, 189, 248, 0.18)', color: '#38BDF8', fontSize: '11px', fontWeight: 700 }}>
              Step {masteryStep} of 9
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleStepNavigation(Math.max(1, masteryStep - 1))}
              disabled={masteryStep === 1}
              className="btn sm"
              style={{ fontSize: '11px', borderColor: '#334155', color: '#94A3B8' }}
            >
              ← Previous Step
            </button>
            <button
              onClick={() => handleStepNavigation(Math.min(9, masteryStep + 1))}
              disabled={masteryStep === 9}
              className="btn sm primary"
              style={{ fontSize: '11px' }}
            >
              Next Step →
            </button>
          </div>
        </div>

        {/* Stepper Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
          {[
            { id: 1, label: '1. Introduction', icon: '🌟' },
            { id: 2, label: '2. Explanation', icon: '📖' },
            { id: 3, label: '3. Video & Avatar', icon: '🎬' },
            { id: 4, label: '4. Visual Demo', icon: '🔬' },
            { id: 5, label: '5. Worked Example', icon: '📐' },
            { id: 6, label: '6. Checkpoint Quiz', icon: '❓' },
            { id: 7, label: '7. Re-Explanation', icon: '💡' },
            { id: 8, label: '8. Practice Drills', icon: '🃏' },
            { id: 9, label: '9. Quick Revision', icon: '⚡' }
          ].map(st => {
            const isCurrent = masteryStep === st.id;
            const isCompleted = masteryStep > st.id || (st.id === 9 && interaction.has_mastered);

            return (
              <button
                key={st.id}
                onClick={() => handleStepNavigation(st.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isCurrent ? '#38BDF8' : isCompleted ? '#10B981' : '#334155'}`,
                  background: isCurrent ? 'rgba(56, 189, 248, 0.2)' : isCompleted ? 'rgba(16, 185, 129, 0.15)' : '#0F172A',
                  color: isCurrent ? '#FFFFFF' : isCompleted ? '#34D399' : '#94A3B8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '13px' }}>{isCompleted ? '✓' : st.icon}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {st.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic Learning Flow Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '8px',
          marginBottom: '24px',
          overflowX: 'auto'
        }}
      >
        <button
          className={`btn sm ${activeTab === 'learn' ? 'primary' : ''}`}
          onClick={() => setActiveTab('learn')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="book" size={15} /> 1. 13-Point Curriculum
        </button>
        <button
          className={`btn sm ${activeTab === 'video' ? 'primary' : ''}`}
          onClick={() => setActiveTab('video')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="play" size={15} /> 2. Animated Video & Visuals {videoData ? '🎬' : ''}
        </button>
        <button
          className={`btn sm ${activeTab === 'activities' ? 'primary' : ''}`}
          onClick={() => setActiveTab('activities')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="layers" size={15} /> 2. Flashcards & Activities ({flashcards.length + flipcards.length})
        </button>
        <button
          className={`btn sm ${activeTab === 'comprehension' ? 'primary' : ''}`}
          onClick={() => setActiveTab('comprehension')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="check" size={15} /> 3. Check Understanding
          {compSubmitted && <span className="badge badge-sm" style={{ background: 'var(--good)' }}>{compScore}%</span>}
        </button>
        <button
          className={`btn sm ${activeTab === 'practice' ? 'primary' : ''}`}
          onClick={() => setActiveTab('practice')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="play" size={15} /> 4. Topic Practice ({practiceQuestions.length})
        </button>
        <button
          className={`btn sm ${activeTab === 'tutor' ? 'primary' : ''}`}
          onClick={() => setActiveTab('tutor')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          <Icon name="sparkles" size={15} /> Ask AI Tutor
        </button>
      </div>

      {/* TAB 1: 13-POINT COMPLETE CURRICULUM (All 13 Structured Sections) */}
      {activeTab === 'learn' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* AI Lesson Audio Reader Bar */}
            <div
              className="card"
              style={{
                padding: '14px 20px',
                borderRadius: '14px',
                background: isLessonAudioPlaying ? 'rgba(56, 189, 248, 0.12)' : 'var(--surface-hover)',
                border: `1.5px solid ${isLessonAudioPlaying ? '#38BDF8' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: isLessonAudioPlaying ? '0 4px 20px rgba(56, 189, 248, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={toggleLessonAudio}
                  className="btn primary"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                  title={isLessonAudioPlaying ? 'Pause Audio Narration' : 'Listen to Full Lesson Audio'}
                >
                  <Icon name={isLessonAudioPlaying ? 'pause' : 'play'} size={16} />
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                      🎙️ AI Lesson Audio Narration
                    </span>
                    <span className="pill good" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {isLessonAudioPlaying ? 'Playing' : 'Ready'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Listen to full spoken lesson explanation with synchronized speech
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Speed Selector */}
                <select
                  value={lessonAudioSpeed}
                  onChange={(e) => setLessonAudioSpeed(parseFloat(e.target.value))}
                  style={{ height: '30px', fontSize: '11px', padding: '0 6px', borderRadius: '6px', background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="1.0">1.0x Speed</option>
                  <option value="1.25">1.25x Speed</option>
                  <option value="1.5">1.5x Speed</option>
                </select>

                {/* Volume Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => setLessonAudioMuted(!lessonAudioMuted)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: lessonAudioMuted ? '#EF4444' : 'var(--primary)', padding: 0 }}
                    title={lessonAudioMuted ? 'Unmute' : 'Mute'}
                  >
                    <Icon name={lessonAudioMuted ? 'volume-x' : 'volume-2'} size={15} />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lessonAudioMuted ? 0 : lessonAudioVolume}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setLessonAudioVolume(v);
                      if (lessonAudioMuted && v > 0) setLessonAudioMuted(false);
                    }}
                    style={{ width: '60px', accentColor: 'var(--primary)', height: '4px' }}
                  />
                </div>

                {/* Soundwave Bars */}
                {isLessonAudioPlaying && !lessonAudioMuted && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
                    {[10, 16, 8, 14, 18, 12].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: '3px',
                          height: `${h}px`,
                          background: 'var(--primary)',
                          borderRadius: '2px',
                          animation: 'pulse 1s infinite alternate',
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 1 & 2: Topic Introduction & Learning Objectives */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 1 & 2</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Overview & Target Objectives</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px', color: 'var(--text)' }}>
                {topic.topic_name}: Introduction
              </h2>
              <p style={{ fontSize: '14.5px', lineHeight: '1.7', color: 'var(--text)', margin: '0 0 16px' }}>
                {topicIntro}
              </p>

              {learningObjs.length > 0 && (
                <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="check" size={14} /> Core Learning Objectives
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {learningObjs.map((obj: string, oIdx: number) => (
                      <div key={oIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>🎯</span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3: Simple Explanation (Analogy) */}
            {simpleExpl && (
              <div
                className="card"
                style={{
                  padding: '22px',
                  borderRadius: '16px',
                  background: 'rgba(243, 156, 18, 0.07)',
                  border: '1px solid rgba(243, 156, 18, 0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="pill" style={{ background: 'rgba(243, 156, 18, 0.2)', color: '#d35400', fontSize: '11px', fontWeight: 700 }}>
                    SECTION 3 &middot; SIMPLE EXPLANATION
                  </span>
                  <span style={{ fontSize: '12px', color: '#d35400', fontWeight: 600 }}>💡 Intuitive Everyday Analogy</span>
                </div>
                <div style={{ fontSize: '14.5px', lineHeight: '1.7', color: 'var(--text)' }}>
                  {simpleExpl}
                </div>
              </div>
            )}

            {/* 4: Detailed Academic Explanation */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 4</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Detailed Academic Theory</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
                Comprehensive Theoretical Analysis
              </h3>
              <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: 'var(--text)', margin: '0 0 16px' }}>
                {detailedExpl || (sections[0]?.content || 'Theoretical foundations and governing principles.')}
              </p>

              {/* Additional chunked parts if present */}
              {sections.slice(1).map((sec: any, idx: number) => (
                <div key={sec.id || idx} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>{sec.title}</h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text)', margin: 0 }}>{sec.content}</p>
                </div>
              ))}
            </div>

            {/* 5: Important Definitions */}
            {importantDefs.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 5</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Key Definitions & Glossary</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Important Definitions
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {importantDefs.map((def: any, dIdx: number) => (
                    <div key={dIdx} style={{ padding: '14px 16px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)', marginBottom: '4px' }}>
                        {def.term}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.55' }}>
                        {def.definition}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6: Step-by-Step Examples */}
            {stepExamples.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 6</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Step-by-Step Worked Problems</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Worked Examples & Solutions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {stepExamples.map((ex: any, eIdx: number) => (
                    <div key={eIdx} style={{ padding: '18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '6px' }}>
                        {ex.title || `Worked Problem ${eIdx + 1}`}
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text)', margin: '0 0 12px', fontStyle: 'italic' }}>
                        {ex.problem}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 12px' }}>
                        {(ex.steps || []).map((step: string, sIdx: number) => (
                          <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{sIdx + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: '10px 14px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '8px', borderLeft: '4px solid #2ecc71', fontSize: '13px', color: 'var(--text)' }}>
                        <span style={{ fontWeight: 700, color: '#27ae60' }}>Final Verified Solution: </span>
                        <span>{ex.solution || ex.final_answer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7: Real-World Applications */}
            {realWorldApps.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill good" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 7</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Real-World & Industry Applications</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Practical Applications
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {realWorldApps.map((appStr: string, aIdx: number) => (
                    <div key={aIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '13.5px' }}>
                      <span style={{ color: '#2ecc71', fontWeight: 700, flexShrink: 0 }}>🌍</span>
                      <span style={{ color: 'var(--text)' }}>{appStr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8: Important Formulas */}
            {importantFormulas.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill" style={{ background: 'rgba(240, 178, 60, 0.15)', color: '#A86B00', fontSize: '11px', fontWeight: 700 }}>
                    SECTION 8 &middot; FORMULAS
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Mathematical & Governing Laws</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Important Formulas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {importantFormulas.map((form: any, fIdx: number) => (
                    <div key={fIdx} style={{ padding: '14px 18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{form.name}</span>
                      </div>
                      <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', color: 'var(--primary)', marginBottom: '8px' }}>
                        📐 {form.formula}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '6px' }}>{form.description}</div>
                      {form.variables && form.variables.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {form.variables.map((v: string, vIdx: number) => (
                            <span key={vIdx} className="pill" style={{ fontSize: '11px' }}>{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9: Diagrams & Visual Representations */}
            {diagramsVisuals && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 9</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Diagrams & Visual Models</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
                  {diagramsVisuals.title || 'Visual Model Representation'}
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  {diagramsVisuals.description}
                </p>
                {diagramsVisuals.diagram_svg && (
                  <div
                    style={{
                      background: '#0C131B',
                      borderRadius: '14px',
                      padding: '24px 16px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflowX: 'auto',
                      border: '1px solid #263648',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                    }}
                    dangerouslySetInnerHTML={{ __html: formatDiagramSvg(diagramsVisuals.diagram_svg, topic.topic_name, topic.subject_name) }}
                  />
                )}
                {diagramsVisuals.ascii_art && !diagramsVisuals.diagram_svg && (
                  <pre style={{ background: 'var(--bg)', padding: '16px', borderRadius: '10px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', border: '1px solid var(--border)' }}>
                    {diagramsVisuals.ascii_art}
                  </pre>
                )}
              </div>
            )}

            {/* 10 & 11: Points to Remember & Topic Summary */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 10 & 11</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Points to Remember & Summary</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
                Important Points to Remember
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                {pointsToRemember.map((pt: string, pIdx: number) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>📌</span>
                    <span style={{ color: 'var(--text)' }}>{pt}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '16px', background: 'var(--surface-hover)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', marginBottom: '4px' }}>
                  Topic Summary
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: '1.6' }}>
                  {topicSummary}
                </div>
              </div>
            </div>

            {/* 12: Practice Questions with Step-by-Step Solutions */}
            {practiceQList.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 12</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Self-Assessment Questions</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Practice Questions & Evaluation
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {practiceQList.map((q: any, qIdx: number) => {
                    const isSolRevealed = revealedSolutions.has(qIdx);
                    const isHintRevealed = revealedLearnHints.has(qIdx);

                    return (
                      <div key={qIdx} style={{ padding: '18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)', marginBottom: '10px' }}>
                          Q{qIdx + 1}: {q.question}
                        </div>
                        {q.options && q.options.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                            {q.options.map((opt: string, optIdx: number) => {
                              const isSelected = selectedSection12Answers[qIdx] === optIdx;
                              const hasAnswered = selectedSection12Answers[qIdx] !== undefined;
                              const isCorrect = optIdx === q.correct_idx;

                              let borderColor = 'var(--border)';
                              let bgColor = 'var(--bg)';
                              let textColor = 'var(--text)';

                              if (hasAnswered) {
                                if (isCorrect) {
                                  borderColor = '#10B981';
                                  bgColor = 'rgba(16, 185, 129, 0.15)';
                                  textColor = '#10B981';
                                } else if (isSelected && !isCorrect) {
                                  borderColor = '#EF4444';
                                  bgColor = 'rgba(239, 68, 68, 0.15)';
                                  textColor = '#EF4444';
                                }
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => {
                                    if (hasAnswered) return;
                                    setSelectedSection12Answers(prev => ({ ...prev, [qIdx]: optIdx }));
                                    if (optIdx !== q.correct_idx) {
                                      setExpandedSimplerExpl(prev => ({ ...prev, [qIdx]: true }));
                                      api.updateTopicInteraction(token!, topicId!, { incorrect_answers_count: 1 });
                                      showToast('Incorrect. Review the simplified explanation below!');
                                    } else {
                                      showToast('✓ Correct! Outstanding understanding.');
                                      api.updateTopicInteraction(token!, topicId!, { comprehension_score: 90 });
                                    }
                                  }}
                                  disabled={hasAnswered}
                                  style={{
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    background: bgColor,
                                    border: `1.5px solid ${borderColor}`,
                                    color: textColor,
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    textAlign: 'left',
                                    cursor: hasAnswered ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: hasAnswered && isCorrect ? '#10B981' : hasAnswered && isSelected ? '#EF4444' : 'var(--surface2)',
                                    color: hasAnswered && (isCorrect || isSelected) ? '#FFFFFF' : 'var(--text)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    {hasAnswered && isCorrect ? '✓' : hasAnswered && isSelected ? '✗' : String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span style={{ flex: 1 }}>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Immediate Feedback & Simplified Re-Explanation Accordion on Incorrect Choice */}
                        {selectedSection12Answers[qIdx] !== undefined && selectedSection12Answers[qIdx] !== q.correct_idx && (
                          <div style={{
                            marginBottom: '14px',
                            padding: '14px 18px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(239, 68, 68, 0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontWeight: 700, fontSize: '13px' }}>
                              <span>✗ Incorrect. Correct Choice is Option {String.fromCharCode(65 + q.correct_idx)}:</span>
                            </div>

                            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>
                              {q.solution}
                            </div>

                            <div style={{
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              color: '#F59E0B'
                            }}>
                              <div style={{ fontWeight: 800, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <span>💡 Simplified Re-Explanation & Everyday Analogy:</span>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>
                                {q.simplified_re_explanation || simpleExpl || `Think of ${topic.topic_name} like an automated safety valve: when inputs exceed threshold, it activates deterministic rules to ensure system invariants and stability.`}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              <button
                                className="btn sm"
                                style={{ fontSize: '11px', borderColor: 'var(--line)' }}
                                onClick={() => {
                                  setActiveTab('tutor');
                                  handleSendChatMessage(`I got this practice question wrong on ${topic.topic_name}: "${q.question}". Can you explain why "${q.options[q.correct_idx]}" is the right answer using a simpler everyday analogy?`);
                                }}
                              >
                                💬 Ask AI Tutor for Simpler Breakdown
                              </button>
                              <button
                                className="btn sm"
                                style={{ fontSize: '11px', borderColor: 'var(--line)' }}
                                onClick={() => {
                                  setSelectedSection12Answers(prev => {
                                    const next = { ...prev };
                                    delete next[qIdx];
                                    return next;
                                  });
                                }}
                              >
                                🔁 Try Answering Again
                              </button>
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {q.hint && (
                            <button
                              className="btn sm"
                              style={{ fontSize: '11px' }}
                              onClick={() => {
                                const next = new Set(revealedLearnHints);
                                if (next.has(qIdx)) next.delete(qIdx);
                                else next.add(qIdx);
                                setRevealedLearnHints(next);
                              }}
                            >
                              💡 {isHintRevealed ? 'Hide Hint' : 'Show Hint'}
                            </button>
                          )}
                          <button
                            className="btn sm primary"
                            style={{ fontSize: '11px' }}
                            onClick={() => {
                              const next = new Set(revealedSolutions);
                              if (next.has(qIdx)) next.delete(qIdx);
                              else next.add(qIdx);
                              setRevealedSolutions(next);
                            }}
                          >
                            ✓ {isSolRevealed ? 'Hide Solution' : 'Reveal Solution'}
                          </button>
                        </div>
                        {isHintRevealed && q.hint && (
                          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(243, 156, 18, 0.08)', borderRadius: '8px', fontSize: '12.5px', color: '#d35400' }}>
                            <strong>Hint: </strong>{q.hint}
                          </div>
                        )}
                        {isSolRevealed && (
                          <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)' }}>
                            <strong>Correct Option: </strong>{String.fromCharCode(65 + (q.correct_idx || 0))}<br />
                            <strong>Step-by-Step Solution: </strong>{q.solution}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 13: Frequently Asked Questions (FAQs) */}
            {faqList.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 13</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Frequently Asked Questions</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Frequently Asked Questions (FAQs)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {faqList.map((faq: any, fIdx: number) => (
                    <div key={fIdx} style={{ padding: '14px 16px', background: 'var(--surface-hover)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
                        ❓ {faq.question}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.55' }}>
                        {faq.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Key Takeaways & Quick Tutor Prompt */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Key Takeaways */}
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="check" size={16} /> Key Takeaways
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {keyTakeaways.map((point: string, idx: number) => (
                  <li key={idx} style={{ color: 'var(--text)' }}>{point}</li>
                ))}
              </ul>
            </div>

            {/* Quick Ask Tutor Box */}
            <div className="card" style={{ padding: '20px', background: 'rgba(62, 123, 224, 0.05)', border: '1px solid rgba(62, 123, 224, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Icon name="sparkles" size={16} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Stuck on this topic?</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px' }}>
                Your level-adapted AI tutor is ready with instant personalized explanations:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Can you explain this concept in simpler words for me?');
                  }}
                >
                  💬 Explain in simpler words
                </button>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Can you give me another real-life example of this?');
                  }}
                >
                  🌱 Give me another real-life example
                </button>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Break down this concept step-by-step for a beginner.');
                  }}
                >
                  🔢 Explain step-by-step for a beginner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ANIMATED EDUCATIONAL VIDEO & VISUALS (YOUTUBE MASTERCLASS THEATER) */}
      {activeTab === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Top Masterclass Action & Setting Strip */}
          <div
            className="card"
            style={{
              padding: '16px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(20, 30, 48, 0.9) 100%)',
              border: '1px solid rgba(84, 194, 240, 0.25)',
              borderRadius: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>▶</span> YOUTUBE MASTERCLASS
              </span>

              <span className="pill" style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                🎬 1080p 60fps HD
              </span>

              <span className="pill" style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                🎙️ AI Neural Voice Synced
              </span>

              <span className="pill" style={{ fontSize: '11px' }}>
                ⏱ {videoData?.duration_seconds ? `${Math.round(videoData.duration_seconds)}s` : '160s'} Total
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={videoEngine}
                onChange={(e) => setVideoEngine(e.target.value as any)}
                style={{ height: '34px', fontSize: '12px', padding: '0 10px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(84, 194, 240, 0.3)', color: '#E8EEF4' }}
              >
                <option value="remotion">Remotion Dynamic Slides</option>
                <option value="manim">Manim Mathematical Engine</option>
                <option value="hybrid">Hybrid (Remotion + Manim)</option>
              </select>

              {/* AI Avatar Instructor Controls */}
              <button
                className="btn sm"
                onClick={() => setShowAvatar(!showAvatar)}
                style={{
                  background: showAvatar ? 'rgba(84, 194, 240, 0.18)' : 'transparent',
                  borderColor: showAvatar ? '#54C2F0' : 'rgba(255, 255, 255, 0.15)',
                  color: showAvatar ? '#54C2F0' : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: 600
                }}
                title="Toggle AI Talking Avatar Instructor"
              >
                🤖 Avatar {showAvatar ? 'ON' : 'OFF'}
              </button>

              {showAvatar && (
                <select
                  value={avatarPersona}
                  onChange={(e) => setAvatarPersona(e.target.value as AvatarPersona)}
                  style={{ height: '34px', fontSize: '11.5px', padding: '0 8px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(84, 194, 240, 0.3)', color: '#E8EEF4' }}
                  title="Choose AI Instructor Persona"
                >
                  <option value="scholar">🎓 Dr. Alex (Professor)</option>
                  <option value="hologram">⚡ Nova (Holo AI)</option>
                  <option value="friendly">🌟 Maya (Peer Mentor)</option>
                  <option value="bot">🤖 PilotBot (Android)</option>
                </select>
              )}

              <button
                className="btn sm"
                onClick={handleRegenerateVideo}
                disabled={videoLoading}
                style={{ background: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38BDF8' }}
                title="Regenerate video script, narration, and scenes"
              >
                <Icon name="refresh" size={14} className={videoLoading ? 'animate-spin' : ''} />
                {videoLoading ? 'Generating...' : 'Regenerate'}
              </button>
            </div>
          </div>

          {/* Main Video Theater Player */}
          {videoLoading ? (
            <div className="card" style={{ padding: '80px 24px', textAlign: 'center', background: '#070B14', color: '#E8EEF4', borderRadius: '20px', border: '1px solid #263648' }}>
              <Icon name="sparkles" size={44} style={{ color: '#54C2F0', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
                Rendering YouTube Masterclass Video & Synthesizing Voice...
              </h3>
              <p style={{ color: '#92A3B5', fontSize: '13.5px', maxWidth: '480px', margin: '0 auto' }}>
                Structuring 11 progressive chapters from Basic to Advanced, generating dynamic archetype animations, and aligning synchronized speech closed-captions.
              </p>
            </div>
          ) : !videoData ? (
            <div className="card" style={{ padding: '70px 24px', textAlign: 'center', borderRadius: '20px', border: '1px dashed var(--line)', background: '#070B14' }}>
              <Icon name="play" size={52} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', color: '#FFFFFF' }}>
                No Video Generated Yet for {topic.topic_name}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '500px', margin: '0 auto 24px' }}>
                Generate a professional YouTube-style visual masterclass complete with 11 structured teaching chapters, animated concept diagrams, voice narration, and synchronized subtitles.
              </p>
              <button
                className="btn primary"
                onClick={() => handleGenerateVideo(videoEngine)}
                style={{ fontSize: '14px', padding: '12px 24px', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', border: 'none', boxShadow: '0 4px 18px rgba(239, 68, 68, 0.4)' }}
              >
                <Icon name="sparkles" size={16} /> Generate YouTube Masterclass Video
              </button>
            </div>
          ) : (
            (() => {
              const scenes = videoData.scenes_json || [];
              const currentScene = scenes[currentSceneIdx] || scenes[0] || {};
              const slide = currentScene.slide_content || {};
              const totalDuration = videoData.duration_seconds || 160;
              const progressPct = totalDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / totalDuration) * 100)) : 0;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* ========================================================================= */}
                  {/* 1. CINEMATIC 16:9 YOUTUBE VIDEO CANVAS                                    */}
                  {/* ========================================================================= */}
                  <div
                    onMouseEnter={() => setVideoHover(true)}
                    onMouseLeave={() => setVideoHover(false)}
                    style={{
                      position: isFullscreen ? 'fixed' : 'relative',
                      inset: isFullscreen ? '0' : undefined,
                      zIndex: isFullscreen ? 9999 : 1,
                      width: '100%',
                      aspectRatio: isFullscreen ? undefined : '16 / 9',
                      minHeight: isFullscreen ? '100vh' : '420px',
                      maxHeight: isFullscreen ? '100vh' : '560px',
                      background: '#070B14',
                      borderRadius: isFullscreen ? '0' : '22px',
                      overflow: 'hidden',
                      boxShadow: '0 24px 60px -15px rgba(0, 0, 0, 0.8), 0 0 50px -10px rgba(56, 189, 248, 0.25)',
                      border: '1px solid rgba(84, 194, 240, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      userSelect: 'none'
                    }}
                  >
                    {/* Top HUD Overlay (Fades on hover or pause) */}
                    <div
                      style={{
                        padding: '18px 24px',
                        background: 'linear-gradient(180deg, rgba(7, 11, 20, 0.95) 0%, rgba(7, 11, 20, 0) 100%)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 10,
                        opacity: videoHover || !isPlaying ? 1 : 0.85,
                        transition: 'opacity 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            background: 'rgba(56, 189, 248, 0.18)',
                            color: '#38BDF8',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.06em'
                          }}
                        >
                          CHAPTER {currentSceneIdx + 1} OF {scenes.length}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FFFFFF' }}>
                          {currentScene.level_badge || currentScene.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8', background: 'rgba(15, 23, 42, 0.8)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          1080p HD
                        </span>
                        {isFullscreen && (
                          <button
                            onClick={() => setIsFullscreen(false)}
                            className="btn sm"
                            style={{ background: 'rgba(0,0,0,0.6)', color: '#FFFFFF', padding: '4px 8px' }}
                          >
                            Exit Fullscreen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Center Video Stage: Animated Concepts & Diagrams */}
                    <div
                      onClick={togglePlayPause}
                      style={{
                        flex: 1,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px 28px',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Ambient Concept Glow */}
                      <div
                        style={{
                          position: 'absolute',
                          width: '400px',
                          height: '240px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, transparent 70%)',
                          pointerEvents: 'none'
                        }}
                      />

                      {/* Main Animated Concept Diagram Canvas */}
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '780px',
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          borderRadius: '16px',
                          border: '1.5px solid rgba(56, 189, 248, 0.3)',
                          padding: '18px 22px',
                          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          position: 'relative',
                          zIndex: 2
                        }}
                      >
                        {/* Slide Title Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            ✦ {slide.heading || currentScene.title}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {slide.subheading || 'Animated Concept Simulation'}
                          </span>
                        </div>

                        {/* Animated Archetype SVG Container */}
                        <div
                          style={{
                            width: '100%',
                            minHeight: '170px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}
                          dangerouslySetInnerHTML={{
                            __html: formatDiagramSvg(slide.diagram_svg, topic.topic_name, topic.subject_name)
                          }}
                        />

                        {/* Interactive Diagram Hotspots underneath diagram */}
                        {currentScene.hotspots && currentScene.hotspots.length > 0 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              gap: '8px',
                              flexWrap: 'wrap',
                              justifyContent: 'center',
                              width: '100%',
                              paddingTop: '6px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                            }}
                          >
                            {currentScene.hotspots.map((h: any) => {
                              const isSpotActive = activeHotspot === h.id;
                              return (
                                <button
                                  key={h.id}
                                  onClick={() => setActiveHotspot(isSpotActive ? null : h.id)}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    border: isSpotActive ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                                    background: isSpotActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                                    color: isSpotActive ? '#FFFFFF' : '#94A3B8',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span style={{ color: '#38BDF8', fontWeight: 800, marginRight: '4px' }}>[{h.badge || '✦'}]</span>
                                  {h.title}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {activeHotspot && (() => {
                          const spot = currentScene.hotspots.find((h: any) => h.id === activeHotspot);
                          if (!spot) return null;
                          return (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                borderRadius: '8px',
                                border: '1px solid #38BDF8',
                                fontSize: '12px',
                                color: '#FFFFFF',
                                textAlign: 'left'
                              }}
                            >
                              <strong style={{ color: '#38BDF8' }}>{spot.title}:</strong> {spot.desc}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Big Center Play / Pause Indicator */}
                      {(!isPlaying || videoHover) && (
                        <div
                          style={{
                            position: 'absolute',
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: isPlaying ? 'rgba(15, 23, 42, 0.85)' : 'rgba(239, 68, 68, 0.95)',
                            color: '#FFFFFF',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: isPlaying ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 30px rgba(239, 68, 68, 0.55)',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            zIndex: 5,
                            pointerEvents: 'none',
                            transform: 'scale(1)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        >
                          <Icon name={isPlaying ? 'pause' : 'play'} size={24} style={{ marginLeft: isPlaying ? '0' : '3px' }} />
                        </div>
                      )}

                      {/* Corner Picture-in-Picture AI Avatar Instructor */}
                      {showAvatar && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '16px',
                            right: '20px',
                            zIndex: 8
                          }}
                        >
                          <AIAvatarInstructor
                            isSpeaking={isPlaying}
                            isMuted={isMuted}
                            volume={volume}
                            stageIdx={currentSceneIdx}
                            persona={avatarPersona}
                            onPersonaChange={setAvatarPersona}
                            layout="pip"
                            onLayoutChange={setAvatarLayout}
                            voiceoverText={(() => {
                              const subs = videoData.subtitles_json || [];
                              const matchingSub = subs.find((s: any) => playbackTime >= s.start && playbackTime <= s.end);
                              return matchingSub ? matchingSub.text : currentScene.voiceover_text;
                            })()}
                            topicName={topic.topic_name}
                          />
                        </div>
                      )}

                      {/* YouTube Closed Captions (CC) Overlay */}
                      {showCaptions && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '16px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            maxWidth: '75%',
                            background: 'rgba(0, 0, 0, 0.88)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            borderRadius: '8px',
                            padding: '8px 18px',
                            textAlign: 'center',
                            fontSize: '13.5px',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            lineHeight: 1.45,
                            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
                            zIndex: 7
                          }}
                        >
                          {(() => {
                            const subs = videoData.subtitles_json || [];
                            const matchingSub = subs.find((s: any) => playbackTime >= s.start && playbackTime <= s.end);
                            const captionText = matchingSub ? matchingSub.text : (currentScene.voiceover_text || 'Playing visual educational masterclass...');
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#38BDF8', fontSize: '11px', fontWeight: 800 }}>CC</span>
                                <span>“{captionText}”</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* YouTube Bottom Player Controls Bar & Seekbar */}
                    <div
                      style={{
                        background: 'linear-gradient(0deg, rgba(7, 11, 20, 0.98) 0%, rgba(7, 11, 20, 0.85) 60%, rgba(7, 11, 20, 0) 100%)',
                        padding: '12px 20px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        zIndex: 10
                      }}
                    >
                      {/* Scrubbing Timeline Bar with 11 Chapter Notches */}
                      <div style={{ position: 'relative', width: '100%', height: '8px', display: 'flex', alignItems: 'center' }}>
                        {/* Background Track */}
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '999px', position: 'relative', overflow: 'hidden' }}>
                          {/* Watched Progress Red Line */}
                          <div
                            style={{
                              width: `${progressPct}%`,
                              height: '100%',
                              background: '#EF4444',
                              borderRadius: '999px',
                              transition: 'width 0.1s linear'
                            }}
                          />
                        </div>

                        {/* Interactive Range Input Overlay */}
                        <input
                          type="range"
                          min="0"
                          max={totalDuration}
                          step="0.5"
                          value={playbackTime}
                          onChange={(e) => {
                            const t = parseFloat(e.target.value);
                            setPlaybackTime(t);
                            if (audioRef.current) audioRef.current.currentTime = t;
                          }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            zIndex: 4
                          }}
                        />

                        {/* Chapter Divider Notches */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', zIndex: 2 }}>
                          {scenes.map((_: any, i: number) => {
                            if (i === 0) return null;
                            const pct = (i / scenes.length) * 100;
                            return (
                              <div
                                key={i}
                                style={{
                                  position: 'absolute',
                                  left: `${pct}%`,
                                  top: '1px',
                                  width: '2px',
                                  height: '6px',
                                  background: '#070B14'
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* YouTube Bottom Player Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        {/* Left Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Play / Pause Button */}
                          <button
                            onClick={togglePlayPause}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#FFFFFF',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'grid',
                              placeItems: 'center'
                            }}
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
                          </button>

                          {/* Skip -10s */}
                          <button
                            onClick={() => {
                              const nt = Math.max(0, playbackTime - 10);
                              setPlaybackTime(nt);
                              if (audioRef.current) audioRef.current.currentTime = nt;
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}
                            title="Skip back 10 seconds"
                          >
                            ↺ 10s
                          </button>

                          {/* Skip +10s */}
                          <button
                            onClick={() => {
                              const nt = Math.min(totalDuration, playbackTime + 10);
                              setPlaybackTime(nt);
                              if (audioRef.current) audioRef.current.currentTime = nt;
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700 }}
                            title="Skip forward 10 seconds"
                          >
                            ↻ 10s
                          </button>

                          {/* Prev Chapter */}
                          <button
                            onClick={() => jumpToScene(Math.max(0, currentSceneIdx - 1))}
                            disabled={currentSceneIdx === 0}
                            style={{ background: 'transparent', border: 'none', color: currentSceneIdx === 0 ? '#475569' : '#CBD5E1', cursor: currentSceneIdx === 0 ? 'default' : 'pointer' }}
                            title="Previous Chapter"
                          >
                            ⏮
                          </button>

                          {/* Next Chapter */}
                          <button
                            onClick={() => jumpToScene(Math.min(scenes.length - 1, currentSceneIdx + 1))}
                            disabled={currentSceneIdx === scenes.length - 1}
                            style={{ background: 'transparent', border: 'none', color: currentSceneIdx === scenes.length - 1 ? '#475569' : '#CBD5E1', cursor: currentSceneIdx === scenes.length - 1 ? 'default' : 'pointer' }}
                            title="Next Chapter"
                          >
                            ⏭
                          </button>

                          {/* Volume & Mute */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                if (isMuted) {
                                  setIsMuted(false);
                                  if (volume === 0) setVolume(80);
                                } else {
                                  setIsMuted(true);
                                }
                              }}
                              style={{ background: 'transparent', border: 'none', color: isMuted ? '#EF4444' : '#CBD5E1', cursor: 'pointer', padding: 0 }}
                              title={isMuted ? 'Unmute' : 'Mute'}
                            >
                              <Icon name={isMuted || volume === 0 ? 'volume-x' : volume < 50 ? 'volume-1' : 'volume-2'} size={18} />
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                setVolume(v);
                                if (v > 0 && isMuted) setIsMuted(false);
                              }}
                              style={{ width: '55px', height: '4px', accentColor: '#EF4444', cursor: 'pointer' }}
                            />
                          </div>

                          {/* Time Readout */}
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#E2E8F0' }}>
                            {Math.floor(playbackTime / 60)}:{String(Math.floor(playbackTime % 60)).padStart(2, '0')} / {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
                          </span>
                        </div>

                        {/* Right Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {/* Active Chapter Label */}
                          <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 700 }}>
                            Ch {currentSceneIdx + 1}: {currentScene.title}
                          </span>

                          {/* CC Toggle */}
                          <button
                            onClick={() => setShowCaptions(!showCaptions)}
                            style={{
                              background: 'transparent',
                              border: showCaptions ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.2)',
                              color: showCaptions ? '#EF4444' : '#94A3B8',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title="Subtitles (CC)"
                          >
                            CC
                          </button>

                          {/* Playback Speed */}
                          <select
                            value={playbackSpeed}
                            onChange={(e) => {
                              const spd = parseFloat(e.target.value);
                              setPlaybackSpeed(spd);
                              if (audioRef.current) audioRef.current.playbackRate = spd;
                            }}
                            style={{
                              height: '26px',
                              padding: '0 6px',
                              fontSize: '11px',
                              background: 'rgba(15, 23, 42, 0.8)',
                              color: '#FFFFFF',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="0.75">0.75x</option>
                            <option value="1.0">1.0x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2.0">2.0x</option>
                          </select>

                          {/* Fullscreen Toggle */}
                          <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: 0 }}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                          >
                            <Icon name="maximize" size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Hidden Audio Element */}
                    {resolvedAudioUrl && (
                      <audio
                        ref={audioRef}
                        src={resolvedAudioUrl.startsWith('http') ? resolvedAudioUrl : `http://127.0.0.1:8000${resolvedAudioUrl}`}
                        preload="auto"
                        onTimeUpdate={() => {
                          if (audioRef.current) {
                            const ct = audioRef.current.currentTime;
                            setPlaybackTime(ct);
                            let acc = 0;
                            for (let i = 0; i < scenes.length; i++) {
                              acc += parseFloat(scenes[i].duration_seconds || 18);
                              if (ct <= acc) {
                                setCurrentSceneIdx(i);
                                break;
                              }
                            }
                          }
                        }}
                        onEnded={() => {
                          setIsPlaying(false);
                          setPlaybackTime(0);
                          setCurrentSceneIdx(0);
                        }}
                        onError={(e) => {
                          console.warn('Audio playback error, falling back to Web Speech:', e);
                        }}
                        style={{ display: 'none' }}
                      />
                    )}
                  </div>

                  {/* ========================================================================= */}
                  {/* 2. YOUTUBE VIDEO TITLE & METADATA BAR                                     */}
                  {/* ========================================================================= */}
                  <div
                    style={{
                      background: 'var(--surface)',
                      borderRadius: '16px',
                      border: '1px solid var(--line)',
                      padding: '18px 24px',
                      boxShadow: 'var(--shadow)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px 0' }}>
                        Visual Masterclass: {topic.topic_name} — Complete In-Depth Guide
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8', fontWeight: 700 }}>
                          ✦ StudyPilot AI Academy
                        </span>
                        <span>•</span>
                        <span>{scenes.length} Progressive Chapters</span>
                        <span>•</span>
                        <span>Curriculum: {topic.subject_name}</span>
                        <span>•</span>
                        <span>Exam Focus: {activeExam?.exam_name || 'Target Examination'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setActiveTab('tutor');
                          handleSendChatMessage(`In the animated video masterclass for "${topic.topic_name}", Chapter ${currentSceneIdx + 1} (${currentScene.title}): Can you provide an even deeper explanation with additional real-world analogies?`);
                        }}
                        className="btn sm primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Icon name="robot" size={14} /> Ask AI Tutor
                      </button>

                      {currentScene.analogy && (
                        <button
                          onClick={() => setShowAnalogyMode(!showAnalogyMode)}
                          className="btn sm"
                          style={{
                            background: showAnalogyMode ? 'rgba(251, 191, 36, 0.2)' : 'var(--surface2)',
                            borderColor: showAnalogyMode ? '#FBBF24' : 'var(--line)',
                            color: showAnalogyMode ? '#FBBF24' : 'var(--muted)',
                            fontWeight: 700
                          }}
                        >
                          💡 {showAnalogyMode ? 'Analogy Active' : 'Everyday Analogy'}
                        </button>
                      )}

                      <button
                        onClick={() => setShowTranscript(!showTranscript)}
                        className="btn sm"
                        style={{
                          background: showTranscript ? 'rgba(56, 189, 248, 0.18)' : 'var(--surface2)',
                          borderColor: showTranscript ? '#38BDF8' : 'var(--line)',
                          color: showTranscript ? '#38BDF8' : 'var(--muted)',
                          fontWeight: 700
                        }}
                      >
                        📜 {showTranscript ? 'Hide Transcript' : 'Transcript'}
                      </button>
                    </div>
                  </div>

                  {/* Everyday Analogy Banner */}
                  {showAnalogyMode && currentScene.analogy && (
                    <div style={{ padding: '14px 20px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '14px', color: '#FEF3C7', fontSize: '14px', lineHeight: 1.6 }}>
                      <strong style={{ color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        💡 Beginner Intuition & Everyday Analogy:
                      </strong>
                      {currentScene.analogy}
                    </div>
                  )}

                  {/* Synced Interactive Transcript */}
                  {showTranscript && (
                    <div style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--line)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="file-text" size={14} />
                        <span>Interactive Synchronized Transcript (Click any line to jump)</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(videoData.subtitles_json || []).map((sub: any, sIdx: number) => {
                          const isCurrent = playbackTime >= sub.start && playbackTime <= sub.end;
                          return (
                            <button
                              key={sIdx}
                              onClick={() => {
                                setPlaybackTime(sub.start);
                                if (audioRef.current) {
                                  audioRef.current.currentTime = sub.start;
                                  if (!isPlaying) audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                                }
                              }}
                              style={{
                                textAlign: 'left',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                border: isCurrent ? '1px solid #38BDF8' : '1px solid transparent',
                                color: isCurrent ? 'var(--ink)' : 'var(--muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'baseline'
                              }}
                            >
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#38BDF8', flexShrink: 0 }}>
                                {Math.floor(sub.start / 60)}:{String(Math.floor(sub.start % 60)).padStart(2, '0')}
                              </span>
                              <span>{sub.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* 3. TWO-COLUMN YOUTUBE LAYOUT (DEEP NOTES + CHAPTER PLAYLIST)              */}
                  {/* ========================================================================= */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '24px', alignItems: 'start' }}>
                    
                    {/* Left Column: Deep Explanation Notes & Hands-On Simulators */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Deep Explanation Card (YouTube Description & Lecture Notes) */}
                      <div
                        className="card"
                        style={{
                          padding: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          background: 'var(--surface)',
                          borderRadius: '16px',
                          border: '1px solid var(--line)',
                          boxShadow: 'var(--shadow)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38BDF8', fontWeight: 800 }}>
                            📖 Deep Concept Explanation
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Chapter {currentSceneIdx + 1}
                          </span>
                        </div>

                        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                          {currentScene.title}
                        </h2>

                        <p style={{ fontSize: '14.5px', color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>
                          {currentScene.deep_explanation || currentScene.voiceover_text}
                        </p>

                        {/* Bullet Points Breakdown */}
                        {slide.bullet_points && slide.bullet_points.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--surface2)', padding: '14px 18px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>
                              Core Key Invariants:
                            </div>
                            {slide.bullet_points.map((pt: string, pIdx: number) => (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--ink)' }}>
                                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
                                <span>{pt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* LaTeX Formula Callout Box if applicable */}
                        {slide.formula_latex && (
                          <div style={{ padding: '12px 18px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '10px', color: '#FBBF24', fontFamily: 'monospace', fontSize: '14px' }}>
                            📐 Governing Law: {slide.formula_latex}
                          </div>
                        )}
                      </div>

                      {/* Interactive Hands-On Variable Parameter Simulator */}
                      {currentScene.interactive_sim && (() => {
                        const sim = currentScene.interactive_sim;
                        const curVal = simParams[currentSceneIdx] ?? sim.default ?? 2;
                        const stateInfo = sim.states ? (sim.states[String(curVal)] || sim.states[curVal]) : null;

                        return (
                          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>🔬 Hands-On Simulator:</span>
                                <span style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>{sim.param_name}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface2)', padding: '4px 10px', borderRadius: '6px' }}>
                                Setting: <strong style={{ color: '#38BDF8' }}>{curVal} {sim.unit || ''}</strong> {stateInfo?.label ? `(${stateInfo.label})` : ''}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Min ({sim.min || 1})</span>
                              <input
                                type="range"
                                min={sim.min || 1}
                                max={sim.max || 5}
                                step={1}
                                value={curVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setSimParams(prev => ({ ...prev, [currentSceneIdx]: val }));
                                }}
                                style={{ flex: 1, accentColor: '#10B981', height: '6px', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Max ({sim.max || 5})</span>
                            </div>

                            {stateInfo && (
                              <div style={{ fontSize: '13px', color: 'var(--ink)', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #10B981', lineHeight: 1.5 }}>
                                <strong style={{ color: '#10B981' }}>System Response:</strong> {stateInfo.effect}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* In-Video Understanding Checkpoint Quiz */}
                      {currentScene.checkpoint_quiz && (() => {
                        const quiz = currentScene.checkpoint_quiz;
                        const selectedOpt = checkpointAnswers[currentSceneIdx];
                        const isRevealed = checkpointRevealed[currentSceneIdx];
                        const isCorrect = selectedOpt === quiz.correct_index;

                        return (
                          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FBBF24' }}>💡 Chapter {currentSceneIdx + 1} Knowledge Check:</span>
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>(Confirm comprehension)</span>
                              </div>
                              {isRevealed && (
                                <span style={{ fontSize: '12px', fontWeight: 700, color: isCorrect ? '#10B981' : '#EF4444' }}>
                                  {isCorrect ? '✓ Correct! Concept Mastered.' : '✘ Not quite. See hint below.'}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>
                              {quiz.question}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {(quiz.options || []).map((opt: string, oIdx: number) => {
                                const isThisSelected = selectedOpt === oIdx;
                                let optBg = 'var(--surface2)';
                                let optBorder = 'var(--line)';
                                let optColor = 'var(--ink)';

                                if (isRevealed) {
                                  if (oIdx === quiz.correct_index) {
                                    optBg = 'rgba(16, 185, 129, 0.15)';
                                    optBorder = '#10B981';
                                    optColor = '#10B981';
                                  } else if (isThisSelected) {
                                    optBg = 'rgba(239, 68, 68, 0.15)';
                                    optBorder = '#EF4444';
                                    optColor = '#EF4444';
                                  }
                                } else if (isThisSelected) {
                                  optBg = 'rgba(56, 189, 248, 0.15)';
                                  optBorder = '#38BDF8';
                                  optColor = '#38BDF8';
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => {
                                      setCheckpointAnswers(prev => ({ ...prev, [currentSceneIdx]: oIdx }));
                                      setCheckpointRevealed(prev => ({ ...prev, [currentSceneIdx]: true }));
                                    }}
                                    style={{
                                      padding: '10px 14px',
                                      borderRadius: '8px',
                                      textAlign: 'left',
                                      fontSize: '13px',
                                      background: optBg,
                                      border: `1px solid ${optBorder}`,
                                      color: optColor,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, marginRight: '8px' }}>{String.fromCharCode(65 + oIdx)}.</span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>

                            {isRevealed && (
                              <div style={{ padding: '10px 14px', borderRadius: '8px', background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                                <strong>{isCorrect ? 'Explanation:' : 'Hint:'}</strong> {isCorrect ? quiz.explanation : (quiz.hint || quiz.explanation)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Column: YouTube "Up Next / Chapters Playlist" */}
                    <div
                      className="card"
                      style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        background: 'var(--surface)',
                        borderRadius: '16px',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow)',
                        position: 'sticky',
                        top: '20px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                          📑 Video Chapters ({scenes.length})
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Click to Jump
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                        {scenes.map((sc: any, idx: number) => {
                          const isActive = currentSceneIdx === idx;
                          let accTime = 0;
                          for (let i = 0; i < idx; i++) {
                            accTime += parseFloat(scenes[i].duration_seconds || 18);
                          }

                          return (
                            <button
                              key={sc.id || idx}
                              onClick={() => jumpToScene(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: isActive ? '1.5px solid #38BDF8' : '1px solid var(--line)',
                                background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'var(--surface2)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {/* Chapter Thumbnail Icon */}
                              <div
                                style={{
                                  width: '42px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  background: isActive ? '#38BDF8' : '#0F172A',
                                  color: isActive ? '#070B14' : '#38BDF8',
                                  display: 'grid',
                                  placeItems: 'center',
                                  flexShrink: 0,
                                  fontWeight: 800,
                                  fontSize: '12px'
                                }}
                              >
                                {isActive ? '▶' : `${idx + 1}`}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: isActive ? '#38BDF8' : 'var(--muted)', fontWeight: 800 }}>
                                    {isActive ? 'ılılı PLAYING' : `Chapter ${idx + 1}`}
                                  </span>
                                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--muted)' }}>
                                    {Math.floor(accTime / 60)}:{String(Math.floor(accTime % 60)).padStart(2, '0')}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12.5px', fontWeight: 700, color: isActive ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {sc.title}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
      {/* TAB 2: INTERACTIVE ACTIVITIES (Flashcards, Flip Cards, Matching, Worked Examples, Mnemonics) */}
      {activeTab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Section 1: Active Recall Flashcard Deck */}
          {flashcards.length > 0 && currentFlashcard && (
            <div className="card" style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🃏 Interactive Flashcard Deck
                </span>
                <span className="badge" style={{ fontSize: '12px' }}>
                  Card {currentFcIndex + 1} of {flashcards.length}
                </span>
              </div>

              {/* 3D Flip Card Container */}
              <div
                onClick={() => setFcFlipped(!fcFlipped)}
                style={{
                  minHeight: '220px',
                  borderRadius: '16px',
                  background: fcFlipped
                    ? 'linear-gradient(135deg, var(--surface), rgba(62, 123, 224, 0.15))'
                    : 'linear-gradient(135deg, var(--surface), var(--surface-hover))',
                  border: fcFlipped ? '2px solid var(--primary)' : '1px solid var(--border)',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                <span className="pill" style={{ fontSize: '10px', marginBottom: '16px' }}>
                  {fcFlipped ? 'Answer / Concept Insight' : currentFlashcard.tag || 'Definition'}
                </span>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', lineHeight: '1.5' }}>
                  {fcFlipped ? currentFlashcard.back : currentFlashcard.front}
                </div>
                <span style={{ marginTop: '20px', fontSize: '11px', color: 'var(--muted)' }}>
                  Click to {fcFlipped ? 'view front' : 'flip & reveal answer'}
                </span>
              </div>

              {/* Flashcard Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  className="btn sm"
                  onClick={handlePrevFc}
                  disabled={currentFcIndex === 0}
                >
                  &larr; Previous Card
                </button>
                <button
                  className={`btn sm ${reviewedFcIds.has(currentFlashcard.id) ? 'good' : ''}`}
                  onClick={() => handleMarkFcReviewed(currentFlashcard.id)}
                >
                  {reviewedFcIds.has(currentFlashcard.id) ? '✓ Reviewed' : 'Mark as Reviewed'}
                </button>
                <button
                  className="btn sm"
                  onClick={handleNextFc}
                  disabled={currentFcIndex === flashcards.length - 1}
                >
                  Next Card &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Flip Cards for Q&A */}
          {flipcards.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎯 Concept Q&A Flip Cards
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {flipcards.map((fl: any, idx: number) => {
                  const isOpen = openFlipCardIds.has(fl.id || String(idx));
                  return (
                    <div
                      key={fl.id || idx}
                      className="card"
                      style={{ padding: '18px', border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border)' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                        Q: {fl.question}
                      </div>
                      {isOpen ? (
                        <div style={{ background: 'rgba(62, 123, 224, 0.08)', borderRadius: '8px', padding: '12px', marginTop: '10px', fontSize: '13px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Answer: </span>
                          <span>{fl.answer}</span>
                        </div>
                      ) : (
                        fl.hint && (
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                            Hint: {fl.hint}
                          </div>
                        )
                      )}
                      <button
                        className="btn sm"
                        style={{ marginTop: '12px', width: '100%' }}
                        onClick={() => {
                          const next = new Set(openFlipCardIds);
                          if (isOpen) next.delete(fl.id || String(idx));
                          else next.add(fl.id || String(idx));
                          setOpenFlipCardIds(next);
                        }}
                      >
                        {isOpen ? 'Hide Answer' : 'Reveal Answer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Worked Examples with Step-by-Step Expansion */}
          {workedExamples.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📐 Step-by-Step Worked Problems
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {workedExamples.map((ex: any, idx: number) => {
                  const isExp = expandedExamples.has(idx);
                  return (
                    <div key={idx} className="card" style={{ padding: '20px' }}>
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          const next = new Set(expandedExamples);
                          if (isExp) next.delete(idx);
                          else next.add(idx);
                          setExpandedExamples(next);
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          Example #{idx + 1}: {ex.problem}
                        </div>
                        <button className="linkbtn">
                          {isExp ? 'Collapse Steps ▲' : 'Show Solution Steps ▼'}
                        </button>
                      </div>

                      {isExp && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                            {ex.steps?.map((step: string, sIdx: number) => (
                              <div
                                key={sIdx}
                                style={{
                                  background: 'var(--bg)',
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  borderLeft: '3px solid var(--primary)'
                                }}
                              >
                                {step}
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              background: 'rgba(46, 204, 113, 0.1)',
                              border: '1px solid rgba(46, 204, 113, 0.3)',
                              borderRadius: '8px',
                              padding: '12px',
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: '#27ae60'
                            }}
                          >
                            Final Result: {ex.final_answer}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Memory Tricks & Mnemonics */}
          {mnemonics.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Memory Tricks & Mnemonics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {mnemonics.map((mn: any, idx: number) => (
                  <div key={idx} className="card" style={{ padding: '18px', borderLeft: '4px solid #9b59b6' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#8e44ad', marginBottom: '6px' }}>
                      "{mn.trick_phrase || mn.phrase || mn}"
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.5' }}>
                      {mn.memory_explanation || mn.explanation || 'Use this trick to recall sequence and formulas under exam pressure.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHECK UNDERSTANDING (3 Graded Comprehension Checks) */}
      {activeTab === 'comprehension' && (
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
              Comprehension Check: Demonstrate Understanding
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: 0 }}>
              Before marking this topic as mastered, answer these 3 quick concept verification questions.
              A score of 75% or higher unlocks topic mastery!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {compChecks.map((q: any, qIdx: number) => {
              const selectedIdx = compAnswers[qIdx];
              const isSubmitted = compSubmitted;
              const isCorrect = selectedIdx === q.correct_index;

              return (
                <div key={qIdx} className="card" style={{ padding: '22px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>
                    {qIdx + 1}. {q.question}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {q.options?.map((opt: string, optIdx: number) => {
                      let btnStyle: React.CSSProperties = {
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: isSubmitted ? 'default' : 'pointer',
                        fontSize: '13.5px'
                      };

                      if (isSubmitted) {
                        if (optIdx === q.correct_index) {
                          btnStyle.border = '2px solid #2ecc71';
                          btnStyle.background = 'rgba(46, 204, 113, 0.12)';
                        } else if (selectedIdx === optIdx) {
                          btnStyle.border = '2px solid #e74c3c';
                          btnStyle.background = 'rgba(231, 76, 60, 0.12)';
                        }
                      } else if (selectedIdx === optIdx) {
                        btnStyle.border = '2px solid var(--primary)';
                        btnStyle.background = 'rgba(62, 123, 224, 0.12)';
                      }

                      return (
                        <div
                          key={optIdx}
                          style={btnStyle}
                          onClick={() => {
                            if (!isSubmitted) {
                              setCompAnswers({ ...compAnswers, [qIdx]: optIdx });
                            }
                          }}
                        >
                          <span style={{ fontWeight: 600, marginRight: '8px' }}>
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  {isSubmitted && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: isCorrect ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: isCorrect ? '#27ae60' : '#c0392b', marginBottom: '4px' }}>
                        {isCorrect ? '✓ Correct!' : '✗ Explanation:'}
                      </div>
                      <div style={{ color: 'var(--text)' }}>{q.explanation}</div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              {!compSubmitted ? (
                <button
                  className="btn primary"
                  style={{ padding: '12px 32px', fontSize: '15px' }}
                  disabled={Object.keys(compAnswers).length < compChecks.length}
                  onClick={handleSubmitComprehension}
                >
                  Submit Comprehension Checks
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    className="btn"
                    onClick={() => {
                      setCompSubmitted(false);
                      setCompAnswers({});
                    }}
                  >
                    Retake Checks
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => setActiveTab('practice')}
                  >
                    Proceed to Topic Practice &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TOPIC PRACTICE (Configurable difficulty, instant feedback, hints) */}
      {activeTab === 'practice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Practice Controls Bar */}
          <div className="card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Difficulty Level:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['beginner', 'easy', 'intermediate', 'advanced', 'exam_level'].map(d => (
                  <button
                    key={d}
                    className={`btn sm ${practiceDifficulty === d ? 'primary' : ''}`}
                    style={{ textTransform: 'capitalize', fontSize: '12px' }}
                    onClick={() => {
                      setPracticeDifficulty(d);
                      if (topicId) loadPracticeQuestions(topicId, d);
                    }}
                  >
                    {d.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={immediateReveal}
                  onChange={(e) => setImmediateReveal(e.target.checked)}
                />
                Instant Answer Feedback
              </label>
              <button
                className="btn sm"
                onClick={() => topicId && loadPracticeQuestions(topicId, practiceDifficulty)}
              >
                <Icon name="refresh" size={14} /> Generate More Questions
              </button>
            </div>
          </div>

          {practiceLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              Generating {practiceDifficulty} practice questions for {topic.topic_name}...
            </div>
          ) : practiceQuestions.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              No practice questions generated yet. Click "Generate More Questions" above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {practiceQuestions.map((q: any, qIdx: number) => {
                const userAns = practiceAnswers[q.id];
                const evalData = practiceEvaluations[q.id];
                const hintRevealed = revealedHints.has(q.id);

                return (
                  <div key={q.id || qIdx} className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="badge" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                        Question {qIdx + 1} &middot; {q.difficulty || practiceDifficulty}
                      </span>
                      {evalData && (
                        <span className={`pill ${evalData.is_correct ? 'good' : 'danger'}`} style={{ fontSize: '11px' }}>
                          {evalData.is_correct ? '✓ Correct Answer' : '✗ Incorrect Response'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
                      {q.question}
                    </div>

                    {/* Options Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {q.options?.map((opt: string, optIdx: number) => {
                        const isChosen = userAns === opt || userAns === String(optIdx);
                        let borderStyle = '1px solid var(--border)';
                        let bgStyle = 'var(--surface)';

                        if (evalData) {
                          if (opt === evalData.correct_answer || optIdx === evalData.correct_index) {
                            borderStyle = '2px solid #2ecc71';
                            bgStyle = 'rgba(46, 204, 113, 0.12)';
                          } else if (isChosen && !evalData.is_correct) {
                            borderStyle = '2px solid #e74c3c';
                            bgStyle = 'rgba(231, 76, 60, 0.12)';
                          }
                        } else if (isChosen) {
                          borderStyle = '2px solid var(--primary)';
                          bgStyle = 'rgba(62, 123, 224, 0.12)';
                        }

                        return (
                          <div
                            key={optIdx}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: borderStyle,
                              background: bgStyle,
                              cursor: evalData ? 'default' : 'pointer',
                              fontSize: '13.5px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            onClick={() => {
                              if (!evalData) {
                                if (immediateReveal) {
                                  handlePracticeSubmit(q, opt);
                                } else {
                                  setPracticeAnswers(prev => ({ ...prev, [q.id]: opt }));
                                }
                              }
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, marginRight: '10px' }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              {opt}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Hint Button if not yet submitted or if struggling */}
                    {!evalData && q.hint && (
                      <div style={{ marginTop: '12px' }}>
                        {hintRevealed ? (
                          <div style={{ fontSize: '12.5px', color: '#f39c12', background: 'rgba(243, 156, 18, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                            💡 <strong>Hint:</strong> {q.hint}
                          </div>
                        ) : (
                          <button
                            className="linkbtn"
                            style={{ fontSize: '12px', color: 'var(--muted)' }}
                            onClick={() => {
                              setRevealedHints(prev => new Set(prev).add(q.id));
                            }}
                          >
                            💡 Need a hint before answering?
                          </button>
                        )}
                      </div>
                    )}

                    {/* Submit button when immediateReveal is disabled */}
                    {!immediateReveal && !evalData && userAns && (
                      <button
                        className="btn sm primary"
                        style={{ marginTop: '14px' }}
                        onClick={() => handlePracticeSubmit(q, userAns)}
                      >
                        Submit Answer
                      </button>
                    )}

                    {/* Evaluation Details */}
                    {evalData && (
                      <div
                        style={{
                          marginTop: '16px',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '13px'
                        }}
                      >
                        <div>
                          <strong>Explanation: </strong>
                          <span style={{ color: 'var(--text)' }}>{evalData.explanation}</span>
                        </div>
                        {evalData.mistake_analysis && (
                          <div style={{ color: '#e74c3c' }}>
                            <strong>Common Pitfall: </strong>{evalData.mistake_analysis}
                          </div>
                        )}
                        {evalData.prerequisite_topic && (
                          <div style={{ color: 'var(--primary)', marginTop: '4px' }}>
                            📚 <strong>Recommended Review: </strong>{evalData.prerequisite_topic}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ASK AI TUTOR (Contextual In-Topic Conversational AI) */}
      {activeTab === 'tutor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Chat Window */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: 0 }}>
            {/* Chat Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span className="mark" style={{ width: '28px', height: '28px', borderRadius: '8px' }}>
                <Icon name="sparkles" size={15} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>AI Topic Tutor: {topic.topic_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Level: {levelProfile.name} &middot; Contextual In-Topic Assistant
                </div>
              </div>
            </div>

            {/* Chat Messages List */}
            <div
              ref={chatScrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {chatMessages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      gap: '8px'
                    }}
                  >
                    {!isUser && (
                      <span className="mark" style={{ width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0, marginTop: '2px' }}>
                        <Icon name="sparkles" size={13} />
                      </span>
                    )}
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: isUser ? 'var(--primary)' : 'var(--surface-hover)',
                        color: isUser ? '#fff' : 'var(--text)',
                        fontSize: '13.5px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  <span className="mark" style={{ width: '24px', height: '24px', borderRadius: '6px' }}>
                    <Icon name="sparkles" size={12} />
                  </span>
                  <span>AI Tutor is thinking and structuring explanation...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                style={{ display: 'flex', gap: '10px' }}
              >
                <input
                  type="text"
                  placeholder={`Ask anything about ${topic.topic_name}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{ flex: 1, borderRadius: '8px' }}
                  disabled={chatLoading}
                />
                <button type="submit" className="btn primary" disabled={chatLoading || !chatInput.trim()}>
                  <Icon name="send" size={16} /> Send
                </button>
              </form>
            </div>
          </div>

          {/* Quick Prompts Helper Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="sparkles" size={14} /> Quick In-Topic Questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Explain this concept in simpler words.',
                  'Give me another real-life example.',
                  'Explain it step by step.',
                  'What is the difference between this and related concepts?',
                  'Why do students commonly get this wrong?',
                  'Test whether I have understood this topic.'
                ].map((promptText, i) => (
                  <button
                    key={i}
                    className="btn sm"
                    style={{ textAlign: 'left', fontSize: '12px', whiteSpace: 'normal', lineHeight: '1.4' }}
                    onClick={() => handleSendChatMessage(promptText)}
                    disabled={chatLoading}
                  >
                    💬 {promptText}
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'var(--bg)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
                💡 <strong>Tutor Note:</strong> Answers are strictly contextualized to <strong>{topic.topic_name}</strong> and adhere to the <strong>{levelProfile.name}</strong> vocabulary and depth level.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

