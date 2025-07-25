'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, updateDoc, increment, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Project, Client, User, TimeEntry, Timebank } from '@/types';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  Calendar, 
  Briefcase, 
  Activity,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  X,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { formatHours, calculateTimebankStatus, getStatusColor, workCategories, getCategoryLabel } from '@/utils/timebank';
import { Dialog, Transition } from '@headlessui/react';
import { WorkCategory } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert Firestore timestamps to Date
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date();
};

// Category groups for better organization
const categoryGroups: Record<string, WorkCategory[]> = {
  'Development': ['backend', 'frontend', 'ios_native', 'android_native', 'react_native', 'flutter'],
  'AI & Innovation': ['ai_development', 'ai'],
  'Design & UX': ['ui_ux_design'],
  'Operations': ['devops', 'qa'],
  'Management': ['project_management', 'meeting', 'workshop'],
  'Creative': ['video_production'],
  'Other': ['other']
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timebanks, setTimebanks] = useState<Timebank[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeentries' | 'team'>('overview');
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showTimebankModal, setShowTimebankModal] = useState(false);
  // const [showEditTimebankModal, setShowEditTimebankModal] = useState(false); // Removed edit functionality
  // const [editingTimebank, setEditingTimebank] = useState<Timebank | null>(null); // Removed edit functionality
  const [timeRegistrationMode, setTimeRegistrationMode] = useState<'default' | 'multiple'>('default');
  const [recentCategories, setRecentCategories] = useState<WorkCategory[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [timeFormData, setTimeFormData] = useState({
    description: '',
    category: '' as WorkCategory,
    hours: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [multipleTimeFormData, setMultipleTimeFormData] = useState<{
    category: WorkCategory;
    description: string;
    weekData: { [key: string]: string };
  }>({
    category: '' as WorkCategory,
    description: '',
    weekData: {}
  });
  const [timebankFormData, setTimebankFormData] = useState(() => {
    const today = new Date();
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    return {
      name: '',
      description: '',
      totalHours: '',
      purchaseDate: format(today, 'yyyy-MM-dd'),
      expiryDate: format(oneYearLater, 'yyyy-MM-dd')
    };
  });
  // const [editTimebankFormData, setEditTimebankFormData] = useState({
  //   name: '',
  //   description: '',
  //   totalHours: '',
  //   remainingHours: '',
  //   expiryDate: ''
  // }); // Removed edit functionality
  const [submitting, setSubmitting] = useState(false);
  
  // Filter states
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterCategory, setFilterCategory] = useState<WorkCategory | 'all'>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  
  // Edit time entry states
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [editTimeFormData, setEditTimeFormData] = useState({
    description: '',
    category: '' as WorkCategory,
    hours: '',
    date: ''
  });
  
  // Export states
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportDropdown && !(event.target as HTMLElement).closest('.export-dropdown')) {
        setShowExportDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  useEffect(() => {
    if (params.id) {
      fetchProjectData();
    }
  }, [params.id]);

  // Load recent categories when user profile is available
  useEffect(() => {
    if (userProfile && timeEntries.length > 0) {
      // Get user's recent categories from their time entries
      const userEntries = timeEntries
        .filter(entry => entry.userId === userProfile.id)
        .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
        .slice(0, 20); // Last 20 entries

      // Count category usage
      const categoryCount = new Map<WorkCategory, number>();
      userEntries.forEach(entry => {
        if (entry.category) {
          categoryCount.set(entry.category, (categoryCount.get(entry.category) || 0) + 1);
        }
      });

      // Sort by usage and get top 4
      const sortedCategories = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([category]) => category);

      setRecentCategories(sortedCategories);
    }
  }, [userProfile, timeEntries]);

  const fetchProjectData = async () => {
    try {
      // Fetch project
      const projectDoc = await getDoc(doc(db, 'projects', params.id));
      if (!projectDoc.exists()) {
        router.push('/projects');
        return;
      }
      
      const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project;
      setProject(projectData);

      // Fetch client
      const clientDoc = await getDoc(doc(db, 'clients', projectData.clientId));
      if (clientDoc.exists()) {
        setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
      }

      // Fetch team members
      if (projectData.teamMembers && projectData.teamMembers.length > 0) {
        const membersPromises = projectData.teamMembers.map(memberId => 
          getDoc(doc(db, 'users', memberId))
        );
        const memberDocs = await Promise.all(membersPromises);
        const members = memberDocs
          .filter(doc => doc.exists())
          .map(doc => ({ id: doc.id, ...doc.data() } as User));
        setTeamMembers(members);
      }

      // Fetch time entries
      const entriesQuery = query(
        collection(db, 'timeEntries'),
        where('projectId', '==', params.id),
        orderBy('date', 'desc')
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const entries = entriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TimeEntry));
      setTimeEntries(entries);

      // Fetch client's timebanks
      const timebanksQuery = query(
        collection(db, 'timebanks'),
        where('clientId', '==', projectData.clientId)
      );
      const timebanksSnapshot = await getDocs(timebanksQuery);
      const timebanksList = timebanksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Timebank));
      setTimebanks(timebanksList);

    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get week dates
  const getWeekDates = (baseDate: Date) => {
    const dates = [];
    const startOfWeek = new Date(baseDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push({
        date: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEE'),
        dayNumber: format(date, 'd'),
        isWeekend: i >= 5
      });
    }
    return dates;
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setSelectedWeek(newWeek);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setSelectedWeek(newWeek);
  };

  // Get week range string
  const getWeekRangeString = (date: Date) => {
    const weekDates = getWeekDates(date);
    const firstDay = new Date(weekDates[0].date);
    const lastDay = new Date(weekDates[6].date);
    
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'd, yyyy')}`;
    } else if (firstDay.getFullYear() === lastDay.getFullYear()) {
      return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'MMM d, yyyy')}`;
    } else {
      return `${format(firstDay, 'MMM d, yyyy')} - ${format(lastDay, 'MMM d, yyyy')}`;
    }
  };

  // Check if a date is in the current week
  const isCurrentWeek = (date: Date) => {
    const now = new Date();
    const weekDates = getWeekDates(date);
    const firstDay = new Date(weekDates[0].date);
    const lastDay = new Date(weekDates[6].date);
    return now >= firstDay && now <= lastDay;
  };

  const handleRegisterTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !project) return;

    setSubmitting(true);
    try {
      const hours = parseFloat(timeFormData.hours);
      
      // Get active timebanks sorted by remaining hours (ascending, to use smaller ones first)
      const activeTimebanks = timebanks
        .filter(tb => tb.status === 'active')
        .sort((a, b) => a.remainingHours - b.remainingHours);

      if (activeTimebanks.length === 0) {
        throw new Error('No active timebanks available for this project');
      }

      // Allow negative balance - no need to check
      const totalAvailableHours = activeTimebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
      
      // Optional: Log if going negative for debugging
      if (hours > totalAvailableHours) {
        console.log(`Time registration will result in negative balance: ${hours - totalAvailableHours} hours`);
      }

      // Allocate hours across timebanks (allow going negative on the last one)
      let remainingHours = hours;
      const allocations: { timebankId: string; hours: number }[] = [];

      for (let i = 0; i < activeTimebanks.length; i++) {
        const timebank = activeTimebanks[i];
        if (remainingHours <= 0) break;

        let hoursToAllocate: number;
        if (i === activeTimebanks.length - 1) {
          // Last timebank - allocate all remaining hours even if it goes negative
          hoursToAllocate = remainingHours;
        } else {
          // Not the last timebank - only use what's available
          hoursToAllocate = Math.min(remainingHours, Math.max(0, timebank.remainingHours));
        }
        
        if (hoursToAllocate > 0) {
          allocations.push({
            timebankId: timebank.id,
            hours: hoursToAllocate
          });
          remainingHours -= hoursToAllocate;
        }
      }

      // Create time entries and update timebanks
      for (const allocation of allocations) {
        // Create time entry
        const timeEntry = {
          userId: userProfile.id,
          projectId: project.id,
          timebankId: allocation.timebankId,
          description: timeFormData.description,
          category: timeFormData.category,
          hours: allocation.hours,
          date: new Date(timeFormData.date),
          status: 'approved',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await addDoc(collection(db, 'timeEntries'), timeEntry);

        // Update timebank hours
        const timebankRef = doc(db, 'timebanks', allocation.timebankId);
        await updateDoc(timebankRef, {
          usedHours: increment(allocation.hours),
          remainingHours: increment(-allocation.hours),
          updatedAt: new Date()
        });
      }

      // Reset form and refresh data
      setTimeFormData({
        description: '',
        category: '' as WorkCategory,
        hours: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      setShowTimeModal(false);
      await fetchProjectData();
    } catch (error) {
      console.error('Error registering time:', error);
      alert(error instanceof Error ? error.message : 'Failed to register time');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterMultipleTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !project) return;

    setSubmitting(true);
    try {
      const entries = Object.entries(multipleTimeFormData.weekData)
        .filter(([, hours]) => hours && parseFloat(hours) > 0)
        .map(([date, hours]) => ({
          date,
          hours: parseFloat(hours)
        }));

      if (entries.length === 0) {
        throw new Error('Please enter hours for at least one day');
      }

      // Calculate total hours needed
      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      
      // Get active timebanks
      const activeTimebanks = timebanks
        .filter(tb => tb.status === 'active' && tb.remainingHours > 0)
        .sort((a, b) => a.remainingHours - b.remainingHours);

      if (activeTimebanks.length === 0) {
        throw new Error('No active timebanks available for this project');
      }

      // Check if total available hours is sufficient
      const totalAvailableHours = activeTimebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
      if (totalHours > totalAvailableHours) {
        throw new Error(`Not enough hours available. Total available: ${totalAvailableHours.toFixed(2)} hours`);
      }

      // Create time entries for each day
      for (const entry of entries) {
        let remainingHours = entry.hours;
        const allocations: { timebankId: string; hours: number }[] = [];

        // Allocate hours across timebanks
        for (const timebank of activeTimebanks) {
          if (remainingHours <= 0) break;

          const hoursToAllocate = Math.min(remainingHours, timebank.remainingHours);
          allocations.push({
            timebankId: timebank.id,
            hours: hoursToAllocate
          });
          remainingHours -= hoursToAllocate;
        }

        // Create time entries and update timebanks
        for (const allocation of allocations) {
          const timeEntry = {
            userId: userProfile.id,
            projectId: project.id,
            timebankId: allocation.timebankId,
            description: multipleTimeFormData.description,
            category: multipleTimeFormData.category,
            hours: allocation.hours,
            date: new Date(entry.date),
            status: 'approved',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await addDoc(collection(db, 'timeEntries'), timeEntry);

          // Update timebank hours
          const timebankRef = doc(db, 'timebanks', allocation.timebankId);
          await updateDoc(timebankRef, {
            usedHours: increment(allocation.hours),
            remainingHours: increment(-allocation.hours),
            updatedAt: new Date()
          });
        }
      }

      // Reset form and refresh data
      setMultipleTimeFormData({
        category: '' as WorkCategory,
        description: '',
        weekData: {}
      });
      setShowTimeModal(false);
      await fetchProjectData();
    } catch (error) {
      console.error('Error registering multiple time entries:', error);
      alert(error instanceof Error ? error.message : 'Failed to register time');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTimebank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSubmitting(true);
    try {
      const newHours = parseFloat(timebankFormData.totalHours);
      
      // Always create a new timebank - each timebank should be separate
      const timebankName = timebankFormData.name.trim() || `${project.name} Timebank`;
      
      const timebankData = {
        clientId: project.clientId,
        name: timebankName,
        description: timebankFormData.description.trim() || null,
        totalHours: newHours,
        usedHours: 0,
        remainingHours: newHours,
        lastTopUpAmount: newHours,
        lastTopUpDate: new Date(timebankFormData.purchaseDate),
        status: 'active',
        purchaseDate: new Date(timebankFormData.purchaseDate),
        expiryDate: timebankFormData.expiryDate ? new Date(timebankFormData.expiryDate) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'timebanks'), timebankData);

      // Reset form and refresh data
      const today = new Date();
      const oneYearLater = new Date(today);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      
      setTimebankFormData({
        name: '',
        description: '',
        totalHours: '',
        purchaseDate: format(today, 'yyyy-MM-dd'),
        expiryDate: format(oneYearLater, 'yyyy-MM-dd')
      });
      setShowTimebankModal(false);
      await fetchProjectData();
    } catch (error) {
      console.error('Error creating timebank:', error);
      alert('Failed to create timebank');
    } finally {
      setSubmitting(false);
    }
  };

  // Removed edit functionality
  /* const handleEditTimebank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimebank) return;

    setSubmitting(true);
    try {
      const timebankRef = doc(db, 'timebanks', editingTimebank.id);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        name: editTimebankFormData.name,
        description: editTimebankFormData.description || null,
        updatedAt: new Date()
      };
      
      // Only update totalHours and remainingHours if they changed
      const newTotalHours = parseFloat(editTimebankFormData.totalHours);
      const newRemainingHours = parseFloat(editTimebankFormData.remainingHours);
      
      if (newTotalHours !== editingTimebank.totalHours) {
        updateData.totalHours = newTotalHours;
      }
      
      if (newRemainingHours !== editingTimebank.remainingHours) {
        updateData.remainingHours = newRemainingHours;
        // Recalculate used hours
        updateData.usedHours = newTotalHours - newRemainingHours;
      }
      
      if (editTimebankFormData.expiryDate) {
        updateData.expiryDate = new Date(editTimebankFormData.expiryDate);
      }
      
      await updateDoc(timebankRef, updateData);
      
      // setShowEditTimebankModal(false); // Removed edit functionality
      setEditingTimebank(null);
      await fetchProjectData();
    } catch (error) {
      console.error('Error updating timebank:', error);
      alert('Failed to update timebank');
    } finally {
      setSubmitting(false);
    }
  }; */

  // Removed edit timebank functionality
  // const openEditTimebankModal = (timebank: Timebank) => {
  //   setEditingTimebank(timebank);
  //   setEditTimebankFormData({
  //     name: timebank.name,
  //     description: timebank.description || '',
  //     totalHours: timebank.totalHours.toString(),
  //     remainingHours: timebank.remainingHours.toString(),
  //     expiryDate: timebank.expiryDate 
  //       ? format(toDate(timebank.expiryDate), 'yyyy-MM-dd')
  //       : ''
  //   });
  //   setShowEditTimebankModal(true);
  // };

  const handleDeleteTimebank = async (timebankId: string) => {
    // Check if timebank has been used
    const timebank = timebanks.find(tb => tb.id === timebankId);
    if (!timebank) return;

    if (timebank.usedHours > 0) {
      alert('Cannot delete a timebank that has been used. You can only delete unused timebanks where hours were entered incorrectly.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this unused timebank? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'timebanks', timebankId));
      await fetchProjectData();
    } catch (error) {
      console.error('Error deleting timebank:', error);
      alert('Failed to delete timebank');
    }
  };

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return <Activity className="h-5 w-5 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-studio-x" />;
      case 'on_hold':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  // Get unique periods from time entries
  const getUniquePeriods = () => {
    const periods = new Set<string>();
    timeEntries.forEach(entry => {
      if (entry.date) {
        const date = toDate(entry.date);
        periods.add(format(date, 'MMMM yyyy'));
      }
    });
    return Array.from(periods).sort((a, b) => {
      const dateA = parse(a, 'MMMM yyyy', new Date());
      const dateB = parse(b, 'MMMM yyyy', new Date());
      return dateB.getTime() - dateA.getTime();
    });
  };

  // Filter time entries
  const filteredTimeEntries = timeEntries.filter(entry => {
    // Period filter
    if (filterPeriod !== 'all' && entry.date) {
      const entryDate = toDate(entry.date);
      const entryPeriod = format(entryDate, 'MMMM yyyy');
      if (entryPeriod !== filterPeriod) return false;
    }

    // Category filter
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;

    // User filter
    if (filterUser !== 'all' && entry.userId !== filterUser) return false;

    // Department filter
    if (filterDepartment !== 'all') {
      const user = teamMembers.find(m => m.id === entry.userId);
      if (!user || user.department !== filterDepartment) return false;
    }

    return true;
  });

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const approvedHours = timeEntries
    .filter(entry => entry.status === 'approved')
    .reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = timeEntries
    .filter(entry => entry.status === 'pending')
    .reduce((sum, entry) => sum + entry.hours, 0);

  // Export to PDF function
  const exportToPDF = () => {
    if (!project) return;
    
    const doc = new jsPDF();
    
    // Add logo/header
    doc.setFontSize(20);
    doc.setTextColor(255, 51, 102); // Studio X color (#FF3366)
    doc.text('TIMEBANK', 14, 20);
    
    // Add project info
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(project.name, 14, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Client: ${client?.name || 'Unknown'}`, 14, 42);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, 14, 48);
    
    // Add filter info if any filters are applied
    let yPosition = 58;
    if (filterPeriod !== 'all' || filterCategory !== 'all' || filterUser !== 'all' || filterDepartment !== 'all') {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Applied Filters:', 14, yPosition);
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (filterPeriod !== 'all') {
        doc.text(`Period: ${filterPeriod}`, 14, yPosition);
        yPosition += 5;
      }
      if (filterCategory !== 'all') {
        const categoryLabel = workCategories.find(c => c.value === filterCategory)?.label || filterCategory;
        doc.text(`Category: ${categoryLabel}`, 14, yPosition);
        yPosition += 5;
      }
      if (filterUser !== 'all') {
        const userName = teamMembers.find(m => m.id === filterUser)?.name || 'Unknown';
        doc.text(`User: ${userName}`, 14, yPosition);
        yPosition += 5;
      }
      if (filterDepartment !== 'all') {
        const deptLabel = filterDepartment === 'studio_x' ? 'Studio X' : 'Developer Team';
        doc.text(`Department: ${deptLabel}`, 14, yPosition);
        yPosition += 5;
      }
      yPosition += 5;
    }
    
    // Add summary statistics
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary:', 14, yPosition);
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const filteredTotal = filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const filteredApproved = filteredTimeEntries
      .filter(entry => entry.status === 'approved')
      .reduce((sum, entry) => sum + entry.hours, 0);
    const filteredPending = filteredTimeEntries
      .filter(entry => entry.status === 'pending')
      .reduce((sum, entry) => sum + entry.hours, 0);
    
    doc.text(`Total Hours: ${formatHours(filteredTotal)}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Approved: ${formatHours(filteredApproved)}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Pending: ${formatHours(filteredPending)}`, 14, yPosition);
    yPosition += 10;
    
    // Add time entries table
    const tableColumns = ['Date', 'Category', 'Description', 'User', 'Hours', 'Status'];
    const tableRows = filteredTimeEntries.map(entry => {
      const user = teamMembers.find(m => m.id === entry.userId);
      return [
        entry.date ? format(toDate(entry.date), 'MMM dd, yyyy') : 'N/A',
        getCategoryLabel(entry.category || 'other'),
        entry.description || '',
        user?.name || 'Unknown',
        formatHours(entry.hours),
        entry.status
      ];
    });
    
    // Add total row
    tableRows.push([
      'Total',
      '',
      '',
      '',
      formatHours(filteredTotal),
      ''
    ]);
    
    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: {
        fillColor: [255, 51, 102], // Studio X color (#FF3366)
        textColor: [255, 255, 255]
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      didParseCell: function(data) {
        // Style the total row
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
    
    // Save the PDF
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_timesheet_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  // Export to CSV function
  const exportToCSV = () => {
    if (!project) return;
    
    // Prepare CSV headers
    const headers = ['Date', 'Category', 'Description', 'User', 'Hours', 'Status'];
    
    // Prepare CSV rows
    const rows = filteredTimeEntries.map(entry => {
      const user = teamMembers.find(m => m.id === entry.userId);
      return [
        entry.date ? format(toDate(entry.date), 'yyyy-MM-dd') : 'N/A',
        entry.category ? getCategoryLabel(entry.category) : 'Other',
        entry.description,
        user?.name || 'Unknown',
        entry.hours.toString(),
        entry.status
      ];
    });
    
    // Add total row
    rows.push(['', '', '', 'Total Hours:', filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0).toString(), '']);
    
    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_timesheet_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle edit time entry
  const handleEditTimeEntry = (entry: TimeEntry) => {
    console.log('Editing time entry:', entry);
    setEditingTimeEntry(entry);
    setEditTimeFormData({
      description: entry.description,
      category: entry.category,
      hours: entry.hours.toString(),
      date: format(toDate(entry.date), 'yyyy-MM-dd')
    });
    setShowEditTimeModal(true);
  };

  // Handle update time entry
  const handleUpdateTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimeEntry || !project) return;

    setSubmitting(true);
    try {
      const newHours = parseFloat(editTimeFormData.hours);
      const hoursDifference = newHours - editingTimeEntry.hours;

      const updatedData = {
        description: editTimeFormData.description,
        category: editTimeFormData.category,
        hours: newHours,
        date: new Date(editTimeFormData.date),
        updatedAt: new Date()
      };

      console.log('Updating time entry:', {
        id: editingTimeEntry.id,
        collection: 'timeEntries',
        data: updatedData,
        fullEntry: editingTimeEntry
      });

      // Verify the ID is valid
      if (!editingTimeEntry.id || editingTimeEntry.id.includes('/')) {
        throw new Error(`Invalid time entry ID: ${editingTimeEntry.id}`);
      }

      // Update the time entry
      const timeEntryRef = doc(db, 'timeEntries', editingTimeEntry.id);
      console.log('Document reference path:', timeEntryRef.path);
      await updateDoc(timeEntryRef, updatedData);
      
      // Update the timebank hours if there's a difference
      if (hoursDifference !== 0 && editingTimeEntry.timebankId) {
        try {
          const timebankRef = doc(db, 'timebanks', editingTimeEntry.timebankId);
          console.log('Updating timebank:', editingTimeEntry.timebankId);
          
          // Check if timebank exists in our local data
          const timebankExists = timebanks.some(tb => tb.id === editingTimeEntry.timebankId);
          if (!timebankExists) {
            console.warn('Timebank not found locally, skipping update:', editingTimeEntry.timebankId);
          } else {
            await updateDoc(timebankRef, {
              usedHours: increment(hoursDifference),
              remainingHours: increment(-hoursDifference),
              updatedAt: new Date()
            });
          }
        } catch (timebankError) {
          console.error('Error updating timebank hours:', timebankError);
          // Don't fail the entire operation if timebank update fails
          // The time entry has already been updated successfully
        }
      }
      
      setShowEditTimeModal(false);
      setEditingTimeEntry(null);
      setEditTimeFormData({
        description: '',
        category: '' as WorkCategory,
        hours: '',
        date: ''
      });
      
      await fetchProjectData();
    } catch (error) {
      console.error('Error updating time entry:', error);
      alert('Failed to update time entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete time entry
  const handleDeleteTimeEntry = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this time entry? This action cannot be undone.')) {
      return;
    }

    try {
      // Get the time entry details first
      const entryToDelete = timeEntries.find(e => e.id === entryId);
      if (!entryToDelete) return;

      // Delete the time entry
      await deleteDoc(doc(db, 'timeEntries', entryId));

      // Update the timebank to restore the hours if it exists
      if (entryToDelete.timebankId) {
        try {
          const timebankExists = timebanks.some(tb => tb.id === entryToDelete.timebankId);
          if (timebankExists) {
            const timebankRef = doc(db, 'timebanks', entryToDelete.timebankId);
            await updateDoc(timebankRef, {
              usedHours: increment(-entryToDelete.hours),
              remainingHours: increment(entryToDelete.hours),
              updatedAt: new Date()
            });
          } else {
            console.warn('Timebank not found for deleted entry, skipping hours restoration:', entryToDelete.timebankId);
          }
        } catch (timebankError) {
          console.error('Error updating timebank after deletion:', timebankError);
          // Don't fail - the time entry has been deleted successfully
        }
      }

      await fetchProjectData();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Failed to delete time entry');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Project not found</h2>
            <Link href="/projects" className="mt-4 text-studio-x hover:text-studio-x-600">
              Back to projects
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">{project.name}</h1>
                  <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500 dark:text-muted-foreground">
                    <div className="flex items-center">
                      <Briefcase className="h-4 w-4 mr-1" />
                      {client?.name || 'Unknown Client'}
                    </div>
                    <div className="flex items-center">
                      {getStatusIcon(project.status)}
                      <span className="ml-1 capitalize">{project.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowTimeModal(true)}
                  className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
                >
                  <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Register</span> Time
                </button>
                <button
                  onClick={() => setShowTimebankModal(true)}
                  className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="sm:hidden">{timebanks.some(tb => tb.status === 'active') ? 'Hours' : 'Timebank'}</span>
                  <span className="hidden sm:inline">{timebanks.some(tb => tb.status === 'active') ? 'Add Hours' : 'Add Timebank'}</span>
                </button>
                {userProfile?.role === 'admin' && (
                  <Link
                    href={`/projects/${project.id}/edit`}
                    className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x"
                  >
                    <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Edit</span> <span className="sm:hidden">Edit</span>
                  </Link>
                )}
              </div>
            </div>

            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-4">{project.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">Team Members</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-foreground">{teamMembers.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">Total Hours</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-foreground">{formatHours(totalHours)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">Approved</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-foreground">{formatHours(approvedHours)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">Pending</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-foreground">{formatHours(pendingHours)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-b border-gray-200 dark:border-border">
              <nav className="-mb-px flex space-x-8">
                {(['overview', 'timeentries', 'team'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab
                        ? 'border-studio-x text-studio-x'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {tab === 'overview' && 'Overview'}
                    {tab === 'timeentries' && 'Time Entries'}
                    {tab === 'team' && 'Team'}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 rounded-lg p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4">Project Timebanks</h3>
                  {timebanks.length > 0 ? (
                    <>
                      {/* Aggregated Timebank Summary */}
                      <div className="mb-6 p-4 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h4 className="font-medium text-gray-900 dark:text-foreground mb-2">Total Available Hours</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-muted-foreground">Total Hours</p>
                            <p className="text-xl font-semibold text-gray-900 dark:text-foreground">
                              {formatHours(timebanks.reduce((sum, tb) => sum + tb.totalHours, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-muted-foreground">Used Hours</p>
                            <p className="text-xl font-semibold text-gray-900 dark:text-foreground">
                              {formatHours(timebanks.reduce((sum, tb) => sum + tb.usedHours, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-muted-foreground">Remaining Hours</p>
                            <p className={`text-xl font-semibold ${
                              timebanks.reduce((sum, tb) => sum + tb.remainingHours, 0) < 0 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {formatHours(timebanks.reduce((sum, tb) => sum + tb.remainingHours, 0))}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-4 rounded-full transition-all duration-300 ${
                                getStatusColor(calculateTimebankStatus({
                                  totalHours: timebanks.reduce((sum, tb) => sum + tb.totalHours, 0),
                                  usedHours: timebanks.reduce((sum, tb) => sum + tb.usedHours, 0),
                                  remainingHours: timebanks.reduce((sum, tb) => sum + tb.remainingHours, 0)
                                } as Timebank))
                              }`}
                              style={{ 
                                width: `${
                                  (timebanks.reduce((sum, tb) => sum + tb.usedHours, 0) / 
                                   timebanks.reduce((sum, tb) => sum + tb.totalHours, 0)) * 100
                                }%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Timebank Details */}
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Timebank Details</h4>
                      <div className="space-y-4">
                        {timebanks.map((timebank) => {
                          const status = calculateTimebankStatus(timebank);
                          const percentageRemaining = ((timebank.totalHours - timebank.usedHours) / timebank.totalHours) * 100;
                          
                          // Check expiration
                          let isExpiring = false;
                          let daysUntilExpiry: number | null = null;
                          if (timebank.expiryDate) {
                            const expiryDate = timebank.expiryDate instanceof Date 
                              ? timebank.expiryDate 
                              : toDate(timebank.expiryDate);
                            const today = new Date();
                            daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            isExpiring = daysUntilExpiry <= 30;
                          }
                          
                          return (
                            <div key={timebank.id} className={`border rounded-lg p-4 ${
                              timebank.remainingHours < 0 
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' 
                                : ''
                            }`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-foreground">{timebank.name}</h4>
                                  {timebank.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{timebank.description}</p>
                                  )}
                                  <p className={`text-sm mt-2 ${
                                    timebank.remainingHours < 0 
                                      ? 'text-red-600 dark:text-red-500 font-medium' 
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {formatHours(timebank.remainingHours)} of {formatHours(timebank.totalHours)} hours remaining
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {userProfile?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDeleteTimebank(timebank.id)}
                                      disabled={timebank.usedHours > 0}
                                      className={`p-1.5 rounded-md transition-colors ${
                                        timebank.usedHours > 0 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
                                      }`}
                                      title={timebank.usedHours > 0 ? 'Cannot delete - hours have been used' : 'Delete timebank'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    timebank.status === 'active' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {timebank.status}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(status)}`}
                                    style={{ width: `${(timebank.usedHours / timebank.totalHours) * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <p className={`text-xs font-medium ${
                                    status === 'green' ? 'text-green-600' : 
                                    status === 'yellow' ? 'text-yellow-600' : 
                                    'text-red-600'
                                  }`}>
                                    {percentageRemaining.toFixed(0)}% remaining
                                  </p>
                                  {isExpiring && daysUntilExpiry !== null && (
                                    <p className="text-xs font-medium text-orange-600">
                                      {daysUntilExpiry <= 0 
                                        ? 'Expired!' 
                                        : daysUntilExpiry === 1 
                                          ? 'Expires tomorrow!' 
                                          : `Expires in ${daysUntilExpiry} days`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Show inactive/expired timebanks separately */}
                        {timebanks.filter(tb => tb.status !== 'active').length > 0 && (
                          <>
                            <h4 className="font-medium text-gray-500 mt-6 mb-2">Previous Timebanks</h4>
                            <div className="space-y-2">
                              {timebanks.filter(tb => tb.status !== 'active').map((timebank) => (
                                <div key={timebank.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-secondary">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">{timebank.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-muted-foreground">
                                        Used {formatHours(timebank.usedHours)} of {formatHours(timebank.totalHours)} hours
                                      </p>
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-muted-foreground capitalize">{timebank.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 dark:text-muted-foreground">No timebanks available for this project</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Project Timeline</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Created: {project.createdAt ? format(toDate(project.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Updated: {project.updatedAt ? format(toDate(project.updatedAt), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timeentries' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 sm:mb-0">Time Entries</h3>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Period Filter */}
                    <select
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                      className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                    >
                      <option value="all">All Periods</option>
                      {getUniquePeriods().map(period => (
                        <option key={period} value={period}>{period}</option>
                      ))}
                    </select>

                    {/* Category Filter */}
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value as WorkCategory | 'all')}
                      className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                    >
                      <option value="all">All Categories</option>
                      {workCategories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>

                    {/* User Filter */}
                    <select
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                    >
                      <option value="all">All Users</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>

                    {/* Department Filter */}
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                    >
                      <option value="all">All Departments</option>
                      <option value="studio_x">Studio X</option>
                      <option value="developer_team">Developer Team</option>
                    </select>

                    {/* Export Dropdown */}
                    <div className="relative export-dropdown">
                      <button
                        onClick={() => setShowExportDropdown(!showExportDropdown)}
                        className="inline-flex items-center px-4 py-2 bg-studio-x text-white rounded-md hover:bg-studio-x-600 transition-colors text-sm font-medium"
                        disabled={filteredTimeEntries.length === 0}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export
                        <svg className="ml-2 -mr-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showExportDropdown && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-card ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                exportToPDF();
                                setShowExportDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Export as PDF
                            </button>
                            <button
                              onClick={() => {
                                exportToCSV();
                                setShowExportDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Export as CSV
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {filteredTimeEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-secondary">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Hours
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredTimeEntries.map((entry) => {
                          const user = teamMembers.find(m => m.id === entry.userId);
                          return (
                            <tr key={entry.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                                {entry.date ? format(toDate(entry.date), 'MMM dd, yyyy') : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  {entry.category ? getCategoryLabel(entry.category) : 'Other'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-foreground">
                                {entry.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                                {user?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                                {formatHours(entry.hours)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  entry.status === 'approved' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                                  entry.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' :
                                  'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                }`}>
                                  {entry.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditTimeEntry(entry)}
                                    className="text-studio-x hover:text-studio-x-700"
                                    title="Edit time entry"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTimeEntry(entry.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete time entry"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-secondary border-t-2 border-gray-300 dark:border-gray-600">
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-foreground text-right">
                            Total Hours:
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-foreground">
                            {formatHours(filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0))}
                          </td>
                          <td></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-muted-foreground">
                      {timeEntries.length === 0 
                        ? 'No time entries recorded yet' 
                        : 'No time entries match the selected filters'}
                    </p>
                    {timeEntries.length > 0 && (
                      <button
                        onClick={() => {
                          setFilterPeriod('all');
                          setFilterCategory('all');
                          setFilterUser('all');
                          setFilterDepartment('all');
                        }}
                        className="mt-2 text-sm text-studio-x hover:text-studio-x-600"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>
                {teamMembers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="border dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-foreground">{member.name}</p>
                            <p className="text-xs text-gray-500 dark:text-muted-foreground capitalize">{member.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-muted-foreground">No team members assigned yet</p>
                )}
              </div>
            )}
          </div>

          {/* Register Time Modal */}
          <Transition appear show={showTimeModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowTimeModal(false)}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-card p-8 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-semibold leading-6 text-gray-900 dark:text-foreground flex justify-between items-center mb-2"
                      >
                        Register Time
                        <button
                          onClick={() => setShowTimeModal(false)}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </Dialog.Title>
                      
                      {/* Segmented Controller */}
                      <div className="flex bg-gray-100 dark:bg-secondary rounded-lg p-1 mb-6">
                        <button
                          type="button"
                          onClick={() => setTimeRegistrationMode('default')}
                          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            timeRegistrationMode === 'default'
                              ? 'bg-white dark:bg-card text-gray-900 dark:text-foreground shadow'
                              : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeRegistrationMode('multiple')}
                          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            timeRegistrationMode === 'multiple'
                              ? 'bg-white dark:bg-card text-gray-900 dark:text-foreground shadow'
                              : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          Multiple
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        {timeRegistrationMode === 'default' 
                          ? `Record your work hours for ${project.name}`
                          : `Record hours for the entire week for ${project.name}`
                        }
                      </p>

                      <form onSubmit={timeRegistrationMode === 'default' ? handleRegisterTime : handleRegisterMultipleTime} className="space-y-6">
                        {/* Show available hours summary */}
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <div className="flex items-center">
                            <Clock className="h-5 w-5 text-green-600 mr-2" />
                            <div>
                              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                Available hours: <span className="text-lg font-semibold">
                                  {formatHours(timebanks
                                    .filter(tb => tb.status === 'active')
                                    .reduce((sum, tb) => sum + tb.remainingHours, 0))}
                                </span>
                              </p>
                              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                                Hours will be automatically allocated across available timebanks
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            What type of work did you do?
                          </label>
                          <select
                            id="category"
                            value={timeRegistrationMode === 'default' ? timeFormData.category : multipleTimeFormData.category}
                            onChange={(e) => {
                              const value = e.target.value as WorkCategory;
                              if (timeRegistrationMode === 'default') {
                                setTimeFormData({ ...timeFormData, category: value });
                              } else {
                                setMultipleTimeFormData({ ...multipleTimeFormData, category: value });
                              }
                            }}
                            className="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            required
                          >
                            <option value="">Select a category...</option>
                            
                            {/* Recently used categories */}
                            {recentCategories.length > 0 && (
                              <>
                                <optgroup label="Recently Used">
                                  {recentCategories.map((categoryValue) => {
                                    const category = workCategories.find(c => c.value === categoryValue);
                                    if (!category) return null;
                                    return (
                                      <option key={`recent-${category.value}`} value={category.value}>
                                        {category.label}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              </>
                            )}
                            
                            {/* All categories grouped */}
                            {Object.entries(categoryGroups).map(([groupName, categoryValues]) => (
                              <optgroup key={groupName} label={groupName}>
                                {categoryValues.map(value => {
                                  const category = workCategories.find(c => c.value === value);
                                  if (!category) return null;
                                  return (
                                    <option key={category.value} value={category.value}>
                                      {category.label}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        {timeRegistrationMode === 'default' ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  When did you work?
                                </label>
                                <input
                                  type="date"
                                  value={timeFormData.date}
                                  onChange={(e) => setTimeFormData({ ...timeFormData, date: e.target.value })}
                                  className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  How many hours?
                                </label>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0.25"
                                  value={timeFormData.hours}
                                  onChange={(e) => setTimeFormData({ ...timeFormData, hours: e.target.value })}
                                  className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                                  placeholder="e.g., 2.5"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Describe what you worked on
                              </label>
                              <textarea
                                value={timeFormData.description}
                                onChange={(e) => setTimeFormData({ ...timeFormData, description: e.target.value })}
                                className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                                rows={4}
                                placeholder="Provide a brief description of the work completed... (optional)"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Multiple mode - Week grid */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Enter hours for each day
                              </label>
                              
                              {/* Week navigation */}
                              <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-secondary rounded-lg p-3">
                                <button
                                  type="button"
                                  onClick={goToPreviousWeek}
                                  className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  aria-label="Previous week"
                                >
                                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                </button>
                                
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-medium text-gray-900 dark:text-foreground">
                                    {getWeekRangeString(selectedWeek)}
                                  </span>
                                  {isCurrentWeek(selectedWeek) && (
                                    <span className="text-xs text-studio-x font-medium mt-0.5">Current Week</span>
                                  )}
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={goToNextWeek}
                                  className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  aria-label="Next week"
                                >
                                  <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                </button>
                              </div>
                              
                              {/* Quick navigation */}
                              {!isCurrentWeek(selectedWeek) && (
                                <div className="text-center mb-4">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedWeek(new Date())}
                                    className="text-sm text-studio-x hover:text-studio-x-600 font-medium"
                                  >
                                    ← Back to current week
                                  </button>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                {getWeekDates(selectedWeek).map((day) => {
                                  const isToday = format(new Date(), 'yyyy-MM-dd') === day.date;
                                  return (
                                    <div
                                      key={day.date}
                                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                        isToday
                                          ? 'bg-studio-x-50 dark:bg-studio-x/10 border-studio-x dark:border-studio-x/50 ring-2 ring-studio-x/20'
                                          : day.isWeekend 
                                            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' 
                                            : 'bg-white dark:bg-card border-gray-300 dark:border-gray-600'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-3">
                                        <div className="text-center">
                                          <div className={`text-xs font-medium ${
                                            isToday ? 'text-studio-x' : 'text-gray-500 dark:text-gray-400'
                                          }`}>
                                            {day.dayName}
                                          </div>
                                          <div className={`text-lg font-semibold ${
                                            isToday ? 'text-studio-x' : 'text-gray-900 dark:text-foreground'
                                          }`}>
                                            {day.dayNumber}
                                          </div>
                                        </div>
                                        <div className="flex flex-col">
                                          <div className={`text-sm ${
                                            isToday ? 'text-studio-x-700 dark:text-studio-x font-medium' : 'text-gray-600 dark:text-gray-400'
                                          }`}>
                                            {format(new Date(day.date), 'MMM d, yyyy')}
                                          </div>
                                          {isToday && (
                                            <span className="text-xs text-studio-x font-medium">Today</span>
                                          )}
                                        </div>
                                      </div>
                                      <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max="24"
                                        value={multipleTimeFormData.weekData[day.date] || ''}
                                        onChange={(e) => setMultipleTimeFormData({
                                          ...multipleTimeFormData,
                                          weekData: {
                                            ...multipleTimeFormData.weekData,
                                            [day.date]: e.target.value
                                          }
                                        })}
                                        className="w-24 px-3 py-2 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input text-center"
                                        placeholder="0"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-3 flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Total hours for the week:</span>
                                <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                  {Object.values(multipleTimeFormData.weekData)
                                    .reduce((sum, hours) => sum + (parseFloat(hours) || 0), 0)
                                    .toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Describe what you worked on this week
                              </label>
                              <textarea
                                value={multipleTimeFormData.description}
                                onChange={(e) => setMultipleTimeFormData({ ...multipleTimeFormData, description: e.target.value })}
                                className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                                rows={4}
                                placeholder="Provide a brief description of the work completed this week... (optional)"
                              />
                            </div>
                          </>
                        )}

                        <div className="mt-8 flex justify-end space-x-4 pt-6 border-t dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => setShowTimeModal(false)}
                            className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={
                              submitting || 
                              (timeRegistrationMode === 'default' 
                                ? !timeFormData.category || !timeFormData.hours 
                                : !multipleTimeFormData.category || Object.values(multipleTimeFormData.weekData).every(h => !h || parseFloat(h) === 0)
                              )
                            }
                            className="px-6 py-3 text-base font-medium text-white bg-studio-x border border-transparent rounded-lg hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {submitting ? 'Registering...' : 'Register Time'}
                          </button>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>

          {/* Add Timebank Modal */}
          <Transition appear show={showTimebankModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowTimebankModal(false)}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-card p-8 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-semibold leading-6 text-gray-900 dark:text-foreground flex justify-between items-center mb-2"
                      >
                        {timebanks.some(tb => tb.status === 'active') ? 'Add Hours to Timebank' : 'Add Timebank'}
                        <button
                          onClick={() => setShowTimebankModal(false)}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        {timebanks.some(tb => tb.status === 'active') 
                          ? `Add more hours to the existing timebank for ${project.name}`
                          : `Create a new timebank for ${project.name}`}
                      </p>

                      <form onSubmit={handleCreateTimebank} className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Timebank Name
                          </label>
                          <input
                            type="text"
                            value={timebankFormData.name}
                            onChange={(e) => setTimebankFormData({ ...timebankFormData, name: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            placeholder={`e.g., ${project.name} ${timebanks.length + 1}`}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">Leave blank to auto-generate: &quot;{project.name} {timebanks.length + 1}&quot;</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            value={timebankFormData.description}
                            onChange={(e) => setTimebankFormData({ ...timebankFormData, description: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            rows={3}
                            placeholder="Add any notes or details about this timebank..."
                          />
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Clock className="inline h-4 w-4 mr-1" />
                            {timebanks.some(tb => tb.status === 'active') ? 'Hours to Add' : 'Total Hours'}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={timebankFormData.totalHours}
                            onChange={(e) => setTimebankFormData({ ...timebankFormData, totalHours: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input text-lg font-medium"
                            placeholder="e.g., 100"
                            required
                          />
                          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                            {timebanks.some(tb => tb.status === 'active') 
                              ? 'These hours will be added to the existing timebank balance'
                              : 'The total number of hours available in this timebank'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              <Calendar className="inline h-4 w-4 mr-1" />
                              Purchase Date
                            </label>
                            <input
                              type="date"
                              value={timebankFormData.purchaseDate}
                              onChange={(e) => {
                                const newPurchaseDate = e.target.value;
                                const purchaseDate = new Date(newPurchaseDate);
                                const expiryDate = new Date(purchaseDate);
                                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                                
                                setTimebankFormData({ 
                                  ...timebankFormData, 
                                  purchaseDate: newPurchaseDate,
                                  expiryDate: format(expiryDate, 'yyyy-MM-dd')
                                });
                              }}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              <AlertCircle className="inline h-4 w-4 mr-1" />
                              Expiry Date
                            </label>
                            <input
                              type="date"
                              value={timebankFormData.expiryDate}
                              onChange={(e) => setTimebankFormData({ ...timebankFormData, expiryDate: e.target.value })}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                              required
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-4">Expiry date is automatically set to 1 year from purchase date, but can be edited</p>

                        <div className="mt-8 flex justify-end space-x-4 pt-6 border-t dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => setShowTimebankModal(false)}
                            className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-3 text-base font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {submitting ? 'Creating...' : 'Create Timebank'}
                          </button>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>

          {/* Edit Timebank Modal - Removed edit functionality */}
          {/* <Transition appear show={showEditTimebankModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowEditTimebankModal(false)}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-card p-8 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-semibold leading-6 text-gray-900 dark:text-foreground flex justify-between items-center mb-2"
                      >
                        Edit Timebank
                        <button
                          onClick={() => setShowEditTimebankModal(false)}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Update timebank details for {editingTimebank?.name}</p>

                      <form onSubmit={handleEditTimebank} className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Timebank Name
                          </label>
                          <input
                            type="text"
                            value={editTimebankFormData.name}
                            onChange={(e) => setEditTimebankFormData({ ...editTimebankFormData, name: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            value={editTimebankFormData.description}
                            onChange={(e) => setEditTimebankFormData({ ...editTimebankFormData, description: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            rows={3}
                            placeholder="Add any notes or details about this timebank..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              <Clock className="inline h-4 w-4 mr-1" />
                              Total Hours
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.1"
                              value={editTimebankFormData.totalHours}
                              onChange={(e) => setEditTimebankFormData({ ...editTimebankFormData, totalHours: e.target.value })}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input text-lg font-medium"
                              required
                            />
                            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">Total capacity of this timebank</p>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Current Status
                            </label>
                            <div className="space-y-1">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Used:</span> {formatHours(editingTimebank?.usedHours || 0)}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Remaining:</span> {formatHours(editingTimebank?.remainingHours || 0)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <AlertCircle className="inline h-4 w-4 mr-1" />
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={editTimebankFormData.expiryDate}
                            onChange={(e) => setEditTimebankFormData({ ...editTimebankFormData, expiryDate: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-input"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave empty if no expiry date</p>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <div className="flex items-start">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">
                              <p className="font-medium">Important Notes:</p>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Changing the total hours will maintain the used hours ({formatHours(editingTimebank?.usedHours || 0)}) and automatically recalculate the remaining hours.</li>
                                {editingTimebank && editingTimebank.usedHours > 0 && (
                                  <li>This timebank cannot be deleted because it has been used. Only unused timebanks can be deleted.</li>
                                )}
                                {editingTimebank && editingTimebank.usedHours === 0 && (
                                  <li>This timebank can be deleted if it was created with incorrect hours.</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-between pt-6 border-t dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => handleDeleteTimebank(editingTimebank!.id)}
                            disabled={!!(editingTimebank && editingTimebank.usedHours > 0)}
                            className={`px-6 py-3 text-base font-medium border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card transition-colors ${
                              editingTimebank && editingTimebank.usedHours > 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            }`}
                            title={editingTimebank && editingTimebank.usedHours > 0 ? 'Cannot delete a timebank that has been used' : 'Delete this timebank'}
                          >
                            <Trash2 className="inline h-4 w-4 mr-2" />
                            Delete Timebank
                          </button>
                          <div className="flex space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                // setShowEditTimebankModal(false); // Removed edit functionality
                                setEditingTimebank(null);
                              }}
                              className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x transition-colors"
                          >
                            Cancel
                          </button>
                            <button
                              type="submit"
                              disabled={submitting}
                              className="px-6 py-3 text-base font-medium text-white bg-studio-x border border-transparent rounded-lg hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {submitting ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition> */}

          {/* Edit Time Entry Modal */}
          <Transition appear show={showEditTimeModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowEditTimeModal(false)}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-card p-8 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-semibold leading-6 text-gray-900 dark:text-foreground mb-6"
                      >
                        Edit Time Entry
                      </Dialog.Title>
                      
                      <form onSubmit={handleUpdateTimeEntry} className="space-y-6">
                        <div>
                          <label htmlFor="edit-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Date
                          </label>
                          <input
                            type="date"
                            id="edit-date"
                            name="date"
                            value={editTimeFormData.date}
                            onChange={(e) => setEditTimeFormData({ ...editTimeFormData, date: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm dark:bg-gray-800 dark:text-white"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Category
                          </label>
                          <select
                            id="edit-category"
                            name="category"
                            value={editTimeFormData.category}
                            onChange={(e) => setEditTimeFormData({ ...editTimeFormData, category: e.target.value as WorkCategory })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm dark:bg-gray-800 dark:text-white"
                            required
                          >
                            <option value="">Select category</option>
                            {workCategories.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="edit-hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Hours
                          </label>
                          <input
                            type="number"
                            id="edit-hours"
                            name="hours"
                            step="0.5"
                            min="0.5"
                            value={editTimeFormData.hours}
                            onChange={(e) => setEditTimeFormData({ ...editTimeFormData, hours: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm dark:bg-gray-800 dark:text-white"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            id="edit-description"
                            name="description"
                            rows={3}
                            value={editTimeFormData.description}
                            onChange={(e) => setEditTimeFormData({ ...editTimeFormData, description: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm dark:bg-gray-800 dark:text-white"
                            placeholder="Optional description"
                          />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setShowEditTimeModal(false)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? 'Updating...' : 'Update Entry'}
                          </button>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}