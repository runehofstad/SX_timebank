export type Department = 'studio_x' | 'developer_team';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'project_manager' | 'developer';
  department?: Department;
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
  | 'project_management'
  | 'ios_development'
  | 'android_development'
  | 'flutter_development'
  | 'react_native_development'
  | 'ui_ux_design'
  | 'meeting'
  | 'backend_development'
  | 'frontend_development'
  | 'testing'
  | 'other';

export interface EmailNotification {
  id: string;
  clientId: string;
  timebankId: string;
  type: 'low_hours' | 'depleted' | 'expiring_soon';
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