import { Timebank, TimebankStatus, WorkCategory } from '@/types';

export function calculateTimebankStatus(timebank: Timebank): TimebankStatus {
  const percentageRemaining = ((timebank.totalHours - timebank.usedHours) / timebank.totalHours) * 100;
  
  if (percentageRemaining >= 50) {
    return 'green';
  } else if (percentageRemaining >= 25) {
    return 'yellow';
  }
  return 'red';
}

export function getStatusColor(status: TimebankStatus): string {
  switch (status) {
    case 'green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function formatHours(hours: number): string {
  return hours.toFixed(2);
}

export function calculateRemainingPercentage(timebank: Timebank): number {
  return ((timebank.totalHours - timebank.usedHours) / timebank.totalHours) * 100;
}

export const workCategories: { value: WorkCategory; label: string }[] = [
  { value: 'project_management', label: 'Project Management' },
  { value: 'ios_development', label: 'iOS Development' },
  { value: 'android_development', label: 'Android Development' },
  { value: 'flutter_development', label: 'Flutter Development' },
  { value: 'react_native_development', label: 'React Native Development' },
  { value: 'ui_ux_design', label: 'UI/UX Design' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'backend_development', label: 'Backend Development' },
  { value: 'frontend_development', label: 'Frontend Development' },
  { value: 'testing', label: 'Testing' },
  { value: 'video_production', label: 'Video Production' },
  { value: 'other', label: 'Other' }
];

export function getCategoryLabel(category: WorkCategory): string {
  const found = workCategories.find(c => c.value === category);
  return found ? found.label : category;
}