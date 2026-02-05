export type SetType = 'warmup' | 'working' | 'failure' | 'drop';

export interface Set {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null; // 1-10
  completed: boolean;
  previous: string | null; // e.g. "200x8"
}

export interface Exercise {
  id: string;
  name: string;
  notes: string;
  historyNote: string | null;
  sets: Set[];
}

export interface Block {
  id: string;
  type: 'single' | 'superset';
  exercises: Exercise[];
}

export interface ActiveCell {
  blockId: string;
  exerciseId: string;
  setId: string;
  field: 'weight' | 'reps' | 'rpe' | 'note';
}

export interface SessionState {
  status: 'active' | 'finished';
  startTime: Date;
  blocks: Block[];
  activeCell: ActiveCell | null;
}
