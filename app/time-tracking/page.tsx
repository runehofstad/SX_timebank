'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { TimeEntry, Project, Client, Timebank, User } from '@/types';
import { Plus, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { onTimeEntryLogged } from '@/lib/notifications/trigger';

export default function TimeTrackingPage() {
  const { userProfile } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [timebanks, setTimebanks] = useState<Timebank[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTimebankId, setSelectedTimebankId] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchData = async () => {
    if (!userProfile) {
      console.log('No user profile, skipping data fetch');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // Fetch projects where user is a team member or all projects for admin/PM
      let projectsList: Project[] = [];
      if (userProfile.role === 'developer') {
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        projectsList = projectsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Project))
          .filter(project => project.teamMembers?.includes(userProfile.id));
      } else {
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        projectsList = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Project));
      }
      setProjects(projectsList);

      // Fetch clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(clientsList);

      // Fetch timebanks
      const timebanksSnapshot = await getDocs(collection(db, 'timebanks'));
      const timebanksList = timebanksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Timebank));
      setTimebanks(timebanksList);

      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersList);

      // Fetch time entries
      try {
        let timeEntriesList: TimeEntry[] = [];
        
        if (userProfile.role === 'developer') {
          // For developers, use the indexed query
          const timeEntriesQuery = query(
            collection(db, 'timeEntries'),
            where('userId', '==', userProfile.id),
            orderBy('date', 'desc')
          );
          const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
          timeEntriesList = timeEntriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as TimeEntry));
        } else {
          // For admins/PMs, fetch all and sort in memory to avoid index requirement
          const timeEntriesSnapshot = await getDocs(collection(db, 'timeEntries'));
          timeEntriesList = timeEntriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as TimeEntry));
          
          // Sort by date in memory
          timeEntriesList.sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date);
            return dateB.getTime() - dateA.getTime();
          });
        }
        
        setTimeEntries(timeEntriesList);
      } catch (queryError) {
        console.log('Error fetching time entries:', queryError);
        // Just set empty array if query fails
        setTimeEntries([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    try {
      const hours = parseFloat(formData.hours);
      
      // Check if timebank has enough hours
      const selectedTimebank = timebanks.find(tb => tb.id === selectedTimebankId);
      if (!selectedTimebank || selectedTimebank.remainingHours < hours) {
        alert('Insufficient hours in the selected timebank');
        return;
      }

      // Create time entry
      const timeEntry = {
        userId: userProfile.id,
        projectId: selectedProjectId,
        timebankId: selectedTimebankId,
        description: formData.description,
        hours,
        date: new Date(formData.date),
        status: 'approved' as const, // Auto-approve for now
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'timeEntries'), timeEntry);

      // Update timebank hours
      const newUsedHours = selectedTimebank.usedHours + hours;
      const newRemainingHours = selectedTimebank.totalHours - newUsedHours;
      
      await updateDoc(doc(db, 'timebanks', selectedTimebankId), {
        usedHours: newUsedHours,
        remainingHours: newRemainingHours,
        status: newRemainingHours <= 0 ? 'depleted' : 'active',
        updatedAt: new Date(),
      });
      
      // Trigger notification check for this timebank
      await onTimeEntryLogged(selectedTimebankId);
      
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving time entry:', error);
    }
  };

  const handleApprove = async (entryId: string) => {
    if (!userProfile || userProfile.role === 'developer') return;
    
    try {
      await updateDoc(doc(db, 'timeEntries', entryId), {
        status: 'approved',
        approvedBy: userProfile.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchData();
    } catch (error) {
      console.error('Error approving time entry:', error);
    }
  };

  const handleReject = async (entryId: string) => {
    if (!userProfile || userProfile.role === 'developer') return;
    
    try {
      await updateDoc(doc(db, 'timeEntries', entryId), {
        status: 'rejected',
        approvedBy: userProfile.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchData();
    } catch (error) {
      console.error('Error rejecting time entry:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      hours: '',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedClientId('');
    setSelectedProjectId('');
    setSelectedTimebankId('');
    setShowModal(false);
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const getClientName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 'Unknown Client';
    const client = clients.find(c => c.id === project.clientId);
    return client?.name || 'Unknown Client';
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown User';
  };

  const getStatusColor = (status: TimeEntry['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredProjects = selectedClientId
    ? projects.filter(p => p.clientId === selectedClientId)
    : [];

  const filteredTimebanks = selectedClientId
    ? timebanks.filter(tb => tb.clientId === selectedClientId && tb.status === 'active')
    : [];

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

  if (!userProfile) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Time Tracking</h1>
            <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative">
              <strong className="font-bold">Profile Required!</strong>
              <p className="mt-2">You need to create a user profile before you can track time.</p>
              <a href="/create-profile" className="mt-2 inline-block text-studio-x hover:text-studio-x-600 underline">
                Create your profile here
              </a>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Time Tracking</h1>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
            >
              <Plus className="h-4 w-4 mr-2" />
              Log Time
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-background">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project / Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {userProfile?.role !== 'developer' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                  {timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                        {entry.date instanceof Date 
                          ? format(entry.date, 'MMM dd, yyyy')
                          : format(new Date(entry.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                        {getUserName(entry.userId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                        <div>
                          <p className="font-medium">{getProjectName(entry.projectId)}</p>
                          <p className="text-gray-500 dark:text-muted-foreground">{getClientName(entry.projectId)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-foreground">
                        {entry.hours}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                      {userProfile?.role !== 'developer' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {entry.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApprove(entry.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Check className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleReject(entry.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={resetForm} />
                
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleSubmit}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                          Log Time Entry
                        </h3>
                        <button
                          type="button"
                          onClick={resetForm}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Client
                          </label>
                          <select
                            name="clientId"
                            id="clientId"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                            value={selectedClientId}
                            onChange={(e) => {
                              setSelectedClientId(e.target.value);
                              setSelectedProjectId('');
                              setSelectedTimebankId('');
                            }}
                          >
                            <option value="">Select a client</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedClientId && (
                          <>
                            <div>
                              <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Project
                              </label>
                              <select
                                name="projectId"
                                id="projectId"
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                              >
                                <option value="">Select a project</option>
                                {filteredProjects.map((project) => (
                                  <option key={project.id} value={project.id}>
                                    {project.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="timebankId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Timebank
                              </label>
                              <select
                                name="timebankId"
                                id="timebankId"
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                                value={selectedTimebankId}
                                onChange={(e) => setSelectedTimebankId(e.target.value)}
                              >
                                <option value="">Select a timebank</option>
                                {filteredTimebanks.map((timebank) => (
                                  <option key={timebank.id} value={timebank.id}>
                                    {timebank.name} ({timebank.remainingHours} hrs available)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                        
                        <div>
                          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Date
                          </label>
                          <input
                            type="date"
                            name="date"
                            id="date"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Hours
                          </label>
                          <input
                            type="number"
                            name="hours"
                            id="hours"
                            required
                            min="0.25"
                            step="0.25"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                            value={formData.hours}
                            onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description
                          </label>
                          <textarea
                            name="description"
                            id="description"
                            required
                            rows={3}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        Log Time
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}