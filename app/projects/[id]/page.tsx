'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { formatHours, calculateTimebankStatus, getStatusColor, workCategories, getCategoryLabel } from '@/utils/timebank';
import { Dialog, Transition } from '@headlessui/react';
import { WorkCategory } from '@/types';

// Helper function to convert Firestore timestamps to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
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
  const [timeFormData, setTimeFormData] = useState({
    description: '',
    category: 'other' as WorkCategory,
    hours: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [timebankFormData, setTimebankFormData] = useState(() => {
    const today = new Date();
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    return {
      totalHours: '',
      purchaseDate: format(today, 'yyyy-MM-dd'),
      expiryDate: format(oneYearLater, 'yyyy-MM-dd')
    };
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProjectData();
    }
  }, [params.id]);

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

  const handleRegisterTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !project) return;

    setSubmitting(true);
    try {
      const hours = parseFloat(timeFormData.hours);
      
      // Get active timebanks sorted by remaining hours (ascending, to use smaller ones first)
      const activeTimebanks = timebanks
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
        category: 'other' as WorkCategory,
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

  const handleCreateTimebank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSubmitting(true);
    try {
      const totalHours = parseFloat(timebankFormData.totalHours);
      
      // Count existing timebanks for this project's client to generate the number
      const existingTimebankCount = timebanks.length;
      const timebankNumber = existingTimebankCount + 1;
      const generatedName = `${project.name} ${timebankNumber}`;
      
      const timebankData = {
        clientId: project.clientId,
        name: generatedName,
        totalHours: totalHours,
        usedHours: 0,
        remainingHours: totalHours,
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

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const approvedHours = timeEntries
    .filter(entry => entry.status === 'approved')
    .reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = timeEntries
    .filter(entry => entry.status === 'pending')
    .reduce((sum, entry) => sum + entry.hours, 0);

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
            <h2 className="text-2xl font-semibold text-gray-900">Project not found</h2>
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
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
                  <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
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
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowTimeModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Register Time
                </button>
                {userProfile?.role === 'admin' && (
                  <>
                    <button
                      onClick={() => setShowTimebankModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Timebank
                    </button>
                    <Link
                      href={`/projects/${project.id}/edit`}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Project
                    </Link>
                  </>
                )}
              </div>
            </div>

            {project.description && (
              <p className="text-gray-600 mt-4">{project.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Team Members</p>
                    <p className="text-lg font-semibold text-gray-900">{teamMembers.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Total Hours</p>
                    <p className="text-lg font-semibold text-gray-900">{formatHours(totalHours)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Approved</p>
                    <p className="text-lg font-semibold text-gray-900">{formatHours(approvedHours)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-lg font-semibold text-gray-900">{formatHours(pendingHours)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {(['overview', 'timeentries', 'team'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab
                        ? 'border-studio-x text-studio-x'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <div className="bg-white shadow rounded-lg p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Project Timebanks</h3>
                  {timebanks.length > 0 ? (
                    <>
                      {/* Aggregated Timebank Summary */}
                      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Total Available Hours</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Hours</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatHours(timebanks.reduce((sum, tb) => sum + tb.totalHours, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Used Hours</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatHours(timebanks.reduce((sum, tb) => sum + tb.usedHours, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Remaining Hours</p>
                            <p className="text-xl font-semibold text-green-600">
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

                      {/* Individual Timebanks */}
                      <h4 className="font-medium text-gray-700 mb-3">Individual Timebanks</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {timebanks.map((timebank) => {
                          const status = calculateTimebankStatus(timebank);
                          const percentageRemaining = ((timebank.totalHours - timebank.usedHours) / timebank.totalHours) * 100;
                          
                          return (
                            <div key={timebank.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">{timebank.name}</h4>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {formatHours(timebank.remainingHours)} of {formatHours(timebank.totalHours)} hours remaining
                                  </p>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  timebank.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {timebank.status}
                                </span>
                              </div>
                              <div className="mt-3">
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(status)}`}
                                    style={{ width: `${(timebank.usedHours / timebank.totalHours) * 100}%` }}
                                  />
                                </div>
                                <p className={`text-xs mt-1 font-medium ${
                                  status === 'green' ? 'text-green-600' : 
                                  status === 'yellow' ? 'text-yellow-600' : 
                                  'text-red-600'
                                }`}>
                                  {percentageRemaining.toFixed(0)}% remaining
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">No timebanks available for this project</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Project Timeline</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">Time Entries</h3>
                {timeEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hours
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {timeEntries.map((entry) => {
                          const user = teamMembers.find(m => m.id === entry.userId);
                          return (
                            <tr key={entry.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {entry.date ? format(toDate(entry.date), 'MMM dd, yyyy') : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                                  {entry.category ? getCategoryLabel(entry.category) : 'Other'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {entry.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {user?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatHours(entry.hours)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  entry.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {entry.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No time entries recorded yet</p>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>
                {teamMembers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="border rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No team members assigned yet</p>
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
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-2xl font-semibold leading-6 text-gray-900 flex justify-between items-center mb-2"
                      >
                        Register Time
                        <button
                          onClick={() => setShowTimeModal(false)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 mb-6">Record your work hours for {project.name}</p>

                      <form onSubmit={handleRegisterTime} className="space-y-6">
                        {/* Show available hours summary */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <Clock className="h-5 w-5 text-green-600 mr-2" />
                            <div>
                              <p className="text-sm font-medium text-green-900">
                                Available hours: <span className="text-lg font-semibold">
                                  {formatHours(timebanks
                                    .filter(tb => tb.status === 'active')
                                    .reduce((sum, tb) => sum + tb.remainingHours, 0))}
                                </span>
                              </p>
                              <p className="text-xs text-green-700 mt-0.5">
                                Hours will be automatically allocated across available timebanks
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
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
                                    ? 'border-studio-x bg-studio-x-50 text-studio-x-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                }`}
                              >
                                <div className="font-medium">{category.label}</div>
                                <div className="text-xs text-gray-500 mt-1">
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
                                  {category.value === 'other' && 'Other development tasks'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              When did you work?
                            </label>
                            <input
                              type="date"
                              value={timeFormData.date}
                              onChange={(e) => setTimeFormData({ ...timeFormData, date: e.target.value })}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 bg-white"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              How many hours?
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0.25"
                              value={timeFormData.hours}
                              onChange={(e) => setTimeFormData({ ...timeFormData, hours: e.target.value })}
                              className="block w-full px-4 py-3 rounded-lg border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 bg-white"
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
                            className="block w-full px-4 py-3 rounded-lg border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x text-gray-900 bg-white"
                            rows={4}
                            placeholder="Provide a brief description of the work completed..."
                            required
                          />
                        </div>

                        <div className="mt-8 flex justify-end space-x-4 pt-6 border-t">
                          <button
                            type="button"
                            onClick={() => setShowTimeModal(false)}
                            className="px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting || !timeFormData.category || !timeFormData.hours || !timeFormData.description}
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center"
                      >
                        Add Timebank
                        <button
                          onClick={() => setShowTimebankModal(false)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </Dialog.Title>

                      <form onSubmit={handleCreateTimebank} className="mt-4 space-y-4">
                        <div className="bg-gray-50 p-3 rounded-md">
                          <p className="text-sm text-gray-600">
                            Timebank name will be: <span className="font-medium text-gray-900">{project.name} {timebanks.length + 1}</span>
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Total Hours
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={timebankFormData.totalHours}
                            onChange={(e) => setTimebankFormData({ ...timebankFormData, totalHours: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm text-gray-900 bg-white"
                            placeholder="e.g., 100"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
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
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm text-gray-900 bg-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={timebankFormData.expiryDate}
                            onChange={(e) => setTimebankFormData({ ...timebankFormData, expiryDate: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm text-gray-900 bg-white"
                            required
                          />
                          <p className="mt-1 text-xs text-gray-500">Automatically set to 1 year from purchase date, but can be edited</p>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => setShowTimebankModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}