'use client';

import { useEffect, useState, Fragment } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { DashboardStats, Timebank, Project, Client, WorkCategory } from '@/types';
import { Users, Clock, FolderOpen, AlertTriangle, Filter, ArrowUpDown, DollarSign, Activity, X } from 'lucide-react';
import { formatHours, workCategories } from '@/utils/timebank';
import { useRouter } from 'next/navigation';
import { Dialog, Transition } from '@headlessui/react';
import { format, isWithinInterval, addDays } from 'date-fns';

type FilterType = 'alphabetic' | 'balance-low-high' | 'balance-high-low' | 'activity';

interface ProjectWithTimebank extends Project {
  client?: Client;
  timebanks: Timebank[];
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  lastActivity?: Date;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
}

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeTimebanks: 0,
    totalHoursAvailable: 0,
    totalHoursUsed: 0,
    projectsInProgress: 0,
  });
  const [projectsWithTimebanks, setProjectsWithTimebanks] = useState<ProjectWithTimebank[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithTimebank[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('alphabetic');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithTimebank | null>(null);
  const [timeFormData, setTimeFormData] = useState({
    description: '',
    category: 'other' as WorkCategory,
    hours: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userProfile) {
      fetchDashboardData();
    }
  }, [userProfile]);
  
  useEffect(() => {
    applyFilter(projectsWithTimebanks, filterType);
  }, [filterType, projectsWithTimebanks]);
  
  const applyFilter = (projectsList: ProjectWithTimebank[], filter: FilterType) => {
    if (!projectsList || !Array.isArray(projectsList)) {
      setFilteredProjects([]);
      return;
    }
    const sorted = [...projectsList];
    
    switch (filter) {
      case 'alphabetic':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'balance-low-high':
        sorted.sort((a, b) => a.remainingHours - b.remainingHours);
        break;
      case 'balance-high-low':
        sorted.sort((a, b) => b.remainingHours - a.remainingHours);
        break;
      case 'activity':
        sorted.sort((a, b) => {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
        break;
    }
    
    setFilteredProjects(sorted);
  };

  const fetchDashboardData = async () => {
    try {
      let clients: Record<string, Client> = {};
      let timebanks: Timebank[] = [];
      let projects: Project[] = [];
      
      if (userProfile?.role === 'admin') {
        // Admins see everything
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        clients = clientsSnapshot.docs.reduce((acc, doc) => {
          acc[doc.id] = { id: doc.id, ...doc.data() } as Client;
          return acc;
        }, {} as Record<string, Client>);
        
        const timebanksSnapshot = await getDocs(collection(db, 'timebanks'));
        timebanks = timebanksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Timebank));
        
        const projectsQuery = query(collection(db, 'projects'), where('status', '==', 'active'));
        const projectsSnapshot = await getDocs(projectsQuery);
        projects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Project));
        
      } else {
        // Developers and Project Managers only see their assigned projects
        const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
        const allProjects = allProjectsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Project))
          .filter(project => project.teamMembers?.includes(userProfile!.id));
        
        // Get active projects from user's assigned projects
        projects = allProjects.filter(p => p.status === 'active');
        
        // Get unique client IDs from user's projects
        const userClientIds = Array.from(new Set(allProjects.map(p => p.clientId)));
        
        // Fetch only relevant clients
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        clients = clientsSnapshot.docs.reduce((acc, doc) => {
          const clientData = { id: doc.id, ...doc.data() } as Client;
          if (userClientIds.includes(doc.id)) {
            acc[doc.id] = clientData;
          }
          return acc;
        }, {} as Record<string, Client>);
        
        // Fetch only relevant timebanks
        const timebanksSnapshot = await getDocs(collection(db, 'timebanks'));
        timebanks = timebanksSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Timebank))
          .filter(tb => userClientIds.includes(tb.clientId));
      }
      
      // Calculate stats
      const totalClients = Object.keys(clients).length;
      const activeTimebanks = timebanks.filter(tb => tb.status === 'active').length;
      const totalHoursAvailable = timebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
      const totalHoursUsed = timebanks.reduce((sum, tb) => sum + tb.usedHours, 0);
      const projectsInProgress = projects.length;
      
      // Group timebanks by clientId
      const timebanksByClient = timebanks.reduce((acc, tb) => {
        if (!acc[tb.clientId]) acc[tb.clientId] = [];
        acc[tb.clientId].push(tb);
        return acc;
      }, {} as Record<string, Timebank[]>);
      
      // Combine projects with their client's timebanks and fetch last activity
      const projectsWithTimebankData = await Promise.all(
        projects.map(async (project) => {
          const clientTimebanks = timebanksByClient[project.clientId] || [];
          
          // Find the active timebank (should be only one per client with new logic)
          const activeTimebank = clientTimebanks.find(tb => tb.status === 'active');
          
          // Calculate based on the active timebank's current state
          let totalHours: number;
          let usedHours: number;
          let remainingHours: number;
          
          if (activeTimebank) {
            // For active timebank: use its actual values
            totalHours = activeTimebank.totalHours;
            usedHours = activeTimebank.usedHours;
            remainingHours = activeTimebank.remainingHours;
          } else {
            // Legacy support: sum all timebanks
            totalHours = clientTimebanks.reduce((sum, tb) => sum + tb.totalHours, 0);
            usedHours = clientTimebanks.reduce((sum, tb) => sum + tb.usedHours, 0);
            remainingHours = clientTimebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
          }
          
          // Check if timebank is expiring soon (within 30 days)
          let isExpiringSoon = false;
          let daysUntilExpiry: number | null = null;
          if (activeTimebank && activeTimebank.expiryDate) {
            const expiryDate = activeTimebank.expiryDate instanceof Date 
              ? activeTimebank.expiryDate 
              : (activeTimebank.expiryDate as { toDate: () => Date }).toDate();
            const today = new Date();
            const thirtyDaysFromNow = addDays(today, 30);
            
            isExpiringSoon = isWithinInterval(expiryDate, { start: today, end: thirtyDaysFromNow });
            daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }
          
          // Get last activity from time entries
          let lastActivity: Date | undefined;
          try {
            const entriesQuery = query(
              collection(db, 'timeEntries'),
              where('projectId', '==', project.id),
              orderBy('date', 'desc'),
              limit(1)
            );
            const entriesSnapshot = await getDocs(entriesQuery);
            if (entriesSnapshot.docs.length > 0) {
              const entryData = entriesSnapshot.docs[0].data();
              lastActivity = entryData.date?.toDate ? entryData.date.toDate() : new Date(entryData.date);
            }
          } catch (error) {
            console.error('Error fetching last activity:', error);
          }
          
          return {
            ...project,
            client: clients[project.clientId],
            timebanks: clientTimebanks,
            totalHours,
            usedHours,
            remainingHours,
            lastActivity,
            isExpiringSoon,
            daysUntilExpiry,
          } as ProjectWithTimebank;
        })
      );

      setStats({
        totalClients,
        activeTimebanks,
        totalHoursAvailable,
        totalHoursUsed,
        projectsInProgress,
      });

      setProjectsWithTimebanks(projectsWithTimebankData);
      applyFilter(projectsWithTimebankData, filterType);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Total Clients',
      value: stats.totalClients,
      icon: Users,
      color: 'bg-studio-x',
    },
    {
      name: 'Active Timebanks',
      value: stats.activeTimebanks,
      icon: Clock,
      color: 'bg-green-500',
    },
    {
      name: 'Hours Available',
      value: stats.totalHoursAvailable.toFixed(1),
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Projects in Progress',
      value: stats.projectsInProgress,
      icon: FolderOpen,
      color: 'bg-purple-500',
    },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
              Welcome back, {userProfile?.name}!
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <div
                key={stat.name}
                className="relative overflow-hidden rounded-lg bg-white dark:bg-card px-4 pt-5 pb-12 shadow dark:shadow-gray-800 sm:px-6 sm:pt-6"
              >
                <dt>
                  <div className={`absolute rounded-md ${stat.color} p-3`}>
                    <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-muted-foreground">{stat.name}</p>
                </dt>
                <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-foreground">{stat.value}</p>
                </dd>
              </div>
            ))}
          </div>

          {/* Active Projects */}
          <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                  Active Projects
                </h3>
                
                {/* Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-border text-sm font-medium rounded-md text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </button>
                  
                  {showFilterDropdown && (
                    <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-card ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-10">
                      <div className="py-1" role="menu">
                        <button
                          onClick={() => {
                            setFilterType('alphabetic');
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-secondary flex items-center ${
                            filterType === 'alphabetic' ? 'text-studio-x bg-studio-x-50 dark:bg-studio-x/10' : 'text-gray-700 dark:text-foreground'
                          }`}
                        >
                          <ArrowUpDown className="h-4 w-4 mr-2" />
                          Alphabetic
                        </button>
                        <button
                          onClick={() => {
                            setFilterType('balance-low-high');
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-secondary flex items-center ${
                            filterType === 'balance-low-high' ? 'text-studio-x bg-studio-x-50 dark:bg-studio-x/10' : 'text-gray-700 dark:text-foreground'
                          }`}
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Saldo: Low to High
                        </button>
                        <button
                          onClick={() => {
                            setFilterType('balance-high-low');
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-secondary flex items-center ${
                            filterType === 'balance-high-low' ? 'text-studio-x bg-studio-x-50 dark:bg-studio-x/10' : 'text-gray-700 dark:text-foreground'
                          }`}
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Saldo: High to Low
                        </button>
                        <button
                          onClick={() => {
                            setFilterType('activity');
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-secondary flex items-center ${
                            filterType === 'activity' ? 'text-studio-x bg-studio-x-50 dark:bg-studio-x/10' : 'text-gray-700 dark:text-foreground'
                          }`}
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          By Activity
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x mx-auto"></div>
                </div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-gray-500 dark:text-muted-foreground text-center py-4">No active projects</p>
              ) : (
                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    // Calculate actual usage percentage from the current timebank
                    const usedPercentage = project.totalHours > 0 
                      ? (project.usedHours / project.totalHours) * 100 
                      : 0;
                    const remainingPercentage = 100 - usedPercentage;
                    
                    // Determine colors based on remaining percentage
                    let statusColor = 'text-green-600';
                    let progressBarColor = 'bg-green-500';
                    
                    if (remainingPercentage <= 25) {
                      statusColor = 'text-red-600';
                      progressBarColor = 'bg-red-500';
                    } else if (remainingPercentage <= 50) {
                      statusColor = 'text-yellow-600';
                      progressBarColor = 'bg-yellow-500';
                    }
                    
                    return (
                      <div 
                        key={project.id} 
                        className="border dark:border-border rounded-lg p-4 hover:shadow-md dark:hover:shadow-gray-700 transition-shadow dark:shadow-gray-800"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => router.push(`/projects/${project.id}`)}
                          >
                            <h4 className="text-base font-medium text-gray-900 dark:text-foreground">{project.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-muted-foreground">{project.client?.name || 'Unknown Client'}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProject(project);
                                setShowTimeModal(true);
                              }}
                              className="p-1.5 rounded-md text-studio-x hover:bg-studio-x-50 dark:hover:bg-studio-x/10 transition-colors"
                              title="Register time"
                            >
                              <Clock className="h-5 w-5" />
                            </button>
                            <span 
                              className="text-sm text-gray-600 dark:text-muted-foreground font-medium cursor-pointer hover:text-studio-x"
                              onClick={() => router.push(`/projects/${project.id}`)}
                            >
                              View Details →
                            </span>
                          </div>
                        </div>
                        
                        <div 
                          className="mt-3 cursor-pointer"
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          <div className="flex justify-between text-sm text-gray-600 dark:text-muted-foreground mb-1">
                            <span>{formatHours(project.usedHours)} used of {formatHours(project.totalHours)} total</span>
                            <span className={`font-medium ${statusColor}`}>
                              {formatHours(project.remainingHours)} remaining
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 transition-all ${progressBarColor}`}
                              style={{ width: `${usedPercentage}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Warning messages */}
                        <div className="mt-2 space-y-1">
                          {remainingPercentage <= 50 && (
                            <div className={`flex items-center text-sm ${
                              remainingPercentage <= 25 ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              {remainingPercentage <= 25 
                                ? 'Critical: Less than 25% hours remaining' 
                                : 'Warning: Less than 50% hours remaining'}
                            </div>
                          )}
                          {project.isExpiringSoon && project.daysUntilExpiry !== null && project.daysUntilExpiry !== undefined && (
                            <div className="flex items-center text-sm text-orange-600">
                              <Clock className="h-4 w-4 mr-1" />
                              {project.daysUntilExpiry <= 0 
                                ? 'Timebank expired!' 
                                : project.daysUntilExpiry === 1 
                                  ? 'Timebank expires tomorrow!' 
                                  : `Timebank expires in ${project.daysUntilExpiry} days`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
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
                        Register Time
                        <button
                          onClick={() => setShowTimeModal(false)}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 dark:text-gray-500"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 dark:text-muted-foreground mb-6">Record your work hours for {selectedProject?.name}</p>

                      <form onSubmit={handleRegisterTime} className="space-y-6">
                        {/* Show available hours summary */}
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <div className="flex items-center">
                            <Clock className="h-5 w-5 text-green-600 mr-2" />
                            <div>
                              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                Available hours: <span className="text-lg font-semibold">
                                  {formatHours(selectedProject?.remainingHours || 0)}
                                </span>
                              </p>
                              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                                Hours will be automatically allocated across available timebanks
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            What type of work did you do?
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {workCategories.map((category) => (
                              <button
                                key={category.value}
                                type="button"
                                onClick={() => setTimeFormData({ ...timeFormData, category: category.value })}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${
                                  timeFormData.category === category.value
                                    ? 'border-studio-x bg-studio-x-50 dark:bg-studio-x/10 text-studio-x-700 dark:text-studio-x'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <div className="font-medium">{category.label}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {category.value === 'project_management' && 'Planning, coordination, meetings'}
                                  {category.value === 'ios_development' && 'iPhone & iPad app development'}
                                  {category.value === 'android_development' && 'Android app development'}
                                  {category.value === 'flutter_development' && 'Cross-platform Flutter apps'}
                                  {category.value === 'react_native_development' && 'Cross-platform React Native apps'}
                                  {category.value === 'ui_ux_design' && 'Interface design, user experience'}
                                  {category.value === 'meeting' && 'Client meetings, team sync'}
                                  {category.value === 'backend_development' && 'Server, API, database work'}
                                  {category.value === 'frontend_development' && 'Web interface development'}
                                  {category.value === 'testing' && 'QA, testing, bug verification'}
                                  {category.value === 'video_production' && 'Editing, Recording and streaming'}
                                  {category.value === 'other' && 'Other development tasks'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              When did you work?
                            </label>
                            <input
                              type="date"
                              value={timeFormData.date}
                              onChange={(e) => setTimeFormData({ ...timeFormData, date: e.target.value })}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-card"
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
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-card"
                              placeholder="e.g., 2.5"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Describe what you worked on
                          </label>
                          <textarea
                            value={timeFormData.description}
                            onChange={(e) => setTimeFormData({ ...timeFormData, description: e.target.value })}
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 dark:text-foreground bg-white dark:bg-card"
                            rows={4}
                            placeholder="Provide a brief description of the work completed... (optional)"
                          />
                        </div>

                        <div className="mt-8 flex justify-end space-x-4 pt-6 border-t dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => {
                              setShowTimeModal(false);
                              setTimeFormData({
                                description: '',
                                category: 'other' as WorkCategory,
                                hours: '',
                                date: format(new Date(), 'yyyy-MM-dd')
                              });
                            }}
                            className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting || !timeFormData.category || !timeFormData.hours}
                            className="px-6 py-3 text-base font-medium text-white bg-studio-x border border-transparent rounded-lg hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );

  async function handleRegisterTime(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile || !selectedProject) return;

    setSubmitting(true);
    try {
      const hours = parseFloat(timeFormData.hours);
      
      // Get active timebanks for this project
      const activeTimebanks = selectedProject.timebanks
        .filter(tb => tb.status === 'active' && tb.remainingHours > 0)
        .sort((a, b) => a.remainingHours - b.remainingHours);

      if (activeTimebanks.length === 0) {
        throw new Error('No active timebanks available for this project');
      }

      // Check if total available hours is sufficient
      const totalAvailableHours = activeTimebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
      if (hours > totalAvailableHours) {
        throw new Error(`Not enough hours available. Total available: ${totalAvailableHours.toFixed(2)} hours`);
      }

      // Allocate hours across timebanks
      let remainingHours = hours;
      const allocations: { timebankId: string; hours: number }[] = [];

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
        // Create time entry
        const timeEntry = {
          userId: userProfile.id,
          projectId: selectedProject.id,
          timebankId: allocation.timebankId,
          description: timeFormData.description,
          category: timeFormData.category,
          hours: allocation.hours,
          date: new Date(timeFormData.date),
          status: 'approved' as const,
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
        category: 'other' as WorkCategory,
        hours: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      setShowTimeModal(false);
      setSelectedProject(null);
      await fetchDashboardData();
    } catch (error) {
      console.error('Error registering time:', error);
      alert(error instanceof Error ? error.message : 'Failed to register time');
    } finally {
      setSubmitting(false);
    }
  }
}