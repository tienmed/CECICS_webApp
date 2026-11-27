import fs from 'fs';
import path from 'path';
import type { MeetingMinutesRecord, MeetingTaskRecord } from '@/core/types';

const MINUTES_FILE = path.join(process.cwd(), 'data', 'meeting_minutes.json');
const TASKS_FILE = path.join(process.cwd(), 'data', 'meeting_tasks.json');

export function getStoredMeetingMinutes(): MeetingMinutesRecord[] {
  try {
    if (fs.existsSync(MINUTES_FILE)) {
      return JSON.parse(fs.readFileSync(MINUTES_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Lỗi đọc meeting_minutes.json:', err);
  }
  return [];
}

export function saveStoredMeetingMinutes(minutes: MeetingMinutesRecord[]): void {
  try {
    fs.writeFileSync(MINUTES_FILE, JSON.stringify(minutes, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi ghi meeting_minutes.json:', err);
  }
}

export function getStoredMeetingTasks(): MeetingTaskRecord[] {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Lỗi đọc meeting_tasks.json:', err);
  }
  return [];
}

export function saveStoredMeetingTasks(tasks: MeetingTaskRecord[]): void {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi ghi meeting_tasks.json:', err);
  }
}
