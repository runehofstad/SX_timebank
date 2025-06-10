export type Department = 'studio_x' | 'developer_team';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'project_manager' | 'developer';
  department?: Department;
  fcmTokens?: string[]; // Array to support multiple devices
  pushNotificationsEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timebank {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  status: 'active' | 'depleted' | 'expired';
  purchaseDate: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  teamMembers: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  timebankId: string;
  description: string;
  category: WorkCategory;
  hours: number;
  date: Date;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkCategory = 
  | 'backend'
  | 'frontend'
  | 'ai_development'
  | 'ai'
  | 'ios_native'
  | 'android_native'
  | 'react_native'
  | 'flutter'
  | 'ui_ux_design'
  | 'devops'
  | 'project_management'
  | 'qa'
  | 'workshop'
  | 'meeting'
  | 'video_production'
  | 'other';

export interface EmailNotification {
  id: string;
  clientId: string;
  timebankId: string;
  type: 'low_hours' | 'critical_hours' | 'depleted' | 'expiring_soon';
  sentAt: Date;
  sentTo: string[];
}

export type TimebankStatus = 'green' | 'yellow' | 'red';

export interface DashboardStats {
  totalClients: number;
  activeTimebanks: number;
  totalHoursAvailable: number;
  totalHoursUsed: number;
  projectsInProgress: number;
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  department?: Department;
  invitedBy: string;
  invitedAt: Date;
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  acceptedAt?: Date;
}

export interface PushNotification {
  id: string;
  userId: string;
  clientId: string;
  timebankId: string;
  projectId?: string;
  type: 'low_hours' | 'critical_hours' | 'depleted' | 'expiring_soon';
  title: string;
  body: string;
  sentAt: Date;
  clicked?: boolean;
  clickedAt?: Date;
}

export interface PushSubscription {
  id: string;
  userId: string;
  fcmToken: string;
  device?: string;
  createdAt: Date;
  lastUsed: Date;
}