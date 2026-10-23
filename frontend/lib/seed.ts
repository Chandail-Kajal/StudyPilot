import { StudyPlan } from "@/types";

export const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => 
  d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const parse = (s: string) => { 
  const p = s.split('-').map(Number); 
  return new Date(p[0], p[1] - 1, p[2]); 
};

export const addDays = (s: string, n: number) => { 
  const d = parse(s); 
  d.setDate(d.getDate() + n); 
  return ymd(d); 
};

export const today = () => {
  if (typeof window === 'undefined') return '2026-10-19';
  return ymd(new Date());
};

export const daysBetween = (a: string, b: string) => 
  Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);

export const weekStartOf = (s: string) => { 
  const d = parse(s); 
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); 
  return ymd(d); 
};

let _idCounter = 1000;
export const uid = () => {
  if (typeof window === 'undefined') {
    _idCounter++;
    return `sp_${_idCounter}`;
  }
  return Math.random().toString(36).slice(2, 9);
};

export const fmtMins = (m: number) => 
  m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm';

export const fmtShort = (s: string) => 
  parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const fmtWd = (s: string) => 
  parse(s).toLocaleDateString('en-IN', { weekday: 'short' });

export const clamp = (n: number, a: number, b: number) => 
  Math.min(b, Math.max(a, n));

export const INTERVALS = [1, 3, 7, 14, 30];
export const COLORS = ['#3E7BE0', '#1FA095', '#D99211', '#D04F73', '#7C62D9', '#4C9A2A'];
export const PLAN_KEY = 'studypilot.v1';
export const AUTH_KEY = 'studypilot.auth';
export const THEME_KEY = 'studypilot.theme';

export function seedPlan(): StudyPlan {
  const t = today();
  const subjects = [
    {
      id: 'phy',
      name: 'Physics',
      color: COLORS[0],
      topics: [
        ['Rotational motion', 2, 0],
        ['Electrostatics', 3, 4],
        ['Thermodynamics', 1, -1],
        ['Ray optics', 0, 0]
      ]
    },
    {
      id: 'che',
      name: 'Organic Chemistry',
      color: COLORS[1],
      topics: [
        ['Reaction mechanisms', 2, 2],
        ['Stereochemistry', 1, 0],
        ['Named reactions', 4, 9]
      ]
    },
    {
      id: 'mat',
      name: 'Calculus',
      color: COLORS[2],
      topics: [
        ['Limits and continuity', 4, 12],
        ['Integration by parts', 2, 1],
        ['Differential equations', 0, 0]
      ]
    },
    {
      id: 'bio',
      name: 'Biology',
      color: COLORS[3],
      topics: [
        ['Cell cycle', 3, 5],
        ['Genetics', 1, -2],
        ['Human physiology', 2, 3]
      ]
    }
  ].map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    topics: s.topics.map(x => ({
      id: uid(),
      name: x[0] as string,
      stage: x[1] as number,
      next: addDays(t, x[2] as number)
    }))
  }));

  const T = (title: string, sid: string, off: number, mins: number, prio: 'high' | 'med' | 'low', done = false) => ({
    id: uid(),
    title,
    subjectId: sid,
    date: addDays(t, off),
    mins,
    prio,
    done
  });

  const tasks = [
    T('Solve 20 problems on rotational dynamics', 'phy', 0, 60, 'high'),
    T('Revise SN1 and SN2 mechanisms', 'che', 0, 45, 'med'),
    T('Past paper: limits and continuity', 'mat', 0, 90, 'high', true),
    T('Cell cycle flashcards', 'bio', 0, 30, 'low'),
    T('Electrostatics numericals', 'phy', 1, 60, 'med'),
    T('Integration by parts drills', 'mat', 1, 60, 'high'),
    T('Stereochemistry with the model kit', 'che', 2, 45, 'med'),
    T('Genetics cross diagrams', 'bio', 2, 40, 'med'),
    T('Full-length mock test', 'mat', 3, 180, 'high'),
    T('Ray optics diagrams', 'phy', 5, 40, 'low'),
    T('Thermodynamics summary notes', 'phy', -1, 50, 'med', true),
    T('Mock test: biology section', 'bio', -1, 60, 'med', true)
  ];

  const sessions: StudyPlan['sessions'] = [];
  const dayMins = [0, 120, 95, 150, 140, 165, 50];
  dayMins.forEach((m, i) => {
    if (!m) return;
    const off = i - 6;
    const date = addDays(t, off);
    const a = subjects[(i + 6) % 4], b = subjects[(i + 7) % 4];
    const m1 = Math.round(m * 0.6 / 5) * 5, m2 = m - m1;
    const base = parse(date).getTime();
    sessions.push({ id: uid(), date, mins: m1, subjectId: a.id, at: base + 9 * 36e5 });
    if (m2 > 0) sessions.push({ id: uid(), date, mins: m2, subjectId: b.id, at: base + 12 * 36e5 });
  });

  return {
    v: 1,
    subjects,
    tasks,
    sessions,
    exam: { name: 'Mid-term exams', date: addDays(t, 23) },
    goalMins: 180,
    settings: { focus: 25, short: 5, long: 15 },
    sittingCapacityMins: 45
  };
}

export function getYesterdayTopics(plan: StudyPlan): Array<{ name: string; subjectId: string; subjectName: string; topicId?: string }> {
  const yDate = addDays(today(), -1);
  const detected: Array<{ name: string; subjectId: string; subjectName: string; topicId?: string }> = [];
  const seenNames = new Set<string>();

  // 1. Check completed tasks from yesterday
  const yesterdayTasks = plan.tasks.filter(t => t.date === yDate && t.done);
  yesterdayTasks.forEach(t => {
    const subj = plan.subjects.find(s => s.id === t.subjectId);
    const subjName = subj ? subj.name : 'General';
    let matchedTopicName = t.title;
    if (subj) {
      for (const tp of subj.topics) {
        if (t.title.toLowerCase().includes(tp.name.toLowerCase())) {
          matchedTopicName = tp.name;
          break;
        }
      }
    }
    if (!seenNames.has(matchedTopicName)) {
      seenNames.add(matchedTopicName);
      detected.push({
        name: matchedTopicName,
        subjectId: t.subjectId,
        subjectName: subjName
      });
    }
  });

  // 2. Check study sessions from yesterday
  const yesterdaySessions = plan.sessions.filter(s => s.date === yDate);
  yesterdaySessions.forEach(s => {
    const subj = plan.subjects.find(sub => sub.id === s.subjectId);
    if (subj && subj.topics.length > 0) {
      const tp = subj.topics[0];
      if (!seenNames.has(tp.name)) {
        seenNames.add(tp.name);
        detected.push({
          name: tp.name,
          subjectId: subj.id,
          subjectName: subj.name,
          topicId: tp.id
        });
      }
    }
  });

  // Fallback: if user hasn't studied yesterday, pick completed tasks or stage 1 topics
  if (detected.length === 0) {
    const anyCompleted = plan.tasks.filter(t => t.done).slice(0, 2);
    if (anyCompleted.length > 0) {
      anyCompleted.forEach(t => {
        const subj = plan.subjects.find(s => s.id === t.subjectId);
        let nameClean = t.title.replace(/^(Solve \d+ problems on |Revise |Past paper: |Drills on )/i, '');
        if (!seenNames.has(nameClean)) {
          seenNames.add(nameClean);
          detected.push({
            name: nameClean,
            subjectId: t.subjectId,
            subjectName: subj ? subj.name : 'General'
          });
        }
      });
    } else if (plan.subjects.length > 0 && plan.subjects[0].topics.length > 0) {
      const tp = plan.subjects[0].topics[0];
      detected.push({
        name: tp.name,
        subjectId: plan.subjects[0].id,
        subjectName: plan.subjects[0].name,
        topicId: tp.id
      });
    }
  }

  return detected;
}

export function getTopicImportanceClient(topicName: string): 'very_important' | 'important' | 'standard' {
  const t = topicName.toLowerCase();
  const veryImp = [
    'rotational motion', 'electrostatics', 'thermodynamics', 'reaction mechanisms',
    'stereochemistry', 'limits and continuity', 'integration by parts', 'cell cycle', 'genetics'
  ];
  if (veryImp.some(v => t.includes(v) || v.includes(t))) return 'very_important';
  const imp = [
    'ray optics', 'named reactions', 'differential equations', 'human physiology'
  ];
  if (imp.some(v => t.includes(v) || v.includes(t))) return 'important';
  return 'standard';
}
