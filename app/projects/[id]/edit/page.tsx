'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Project, Client, User } from '@/types';
import { ArrowLeft, Save, X, UserPlus, UserMinus } from 'lucide-react';

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as Project['status'],
    clientId: '',
    teamMembers: [] as string[],
  });

  useEffect(() => {
    if (userProfile?.role !== 'admin') {
      router.push('/projects');
      return;
    }
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Fetch project
      const projectDoc = await getDoc(doc(db, 'projects', params.id));
      if (!projectDoc.exists()) {
        router.push('/projects');
        return;
      }
      
      const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project;
      setProject(projectData);
      setFormData({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status,
        clientId: projectData.clientId,
        teamMembers: projectData.teamMembers || [],
      });

      // Fetch clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(clientsList);

      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateDoc(doc(db, 'projects', params.id), {
        ...formData,
        updatedAt: new Date(),
      });
      
      router.push(`/projects/${params.id}`);
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(userId)
        ? prev.teamMembers.filter(id => id !== userId)
        : [...prev.teamMembers, userId]
    }));
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 rounded-lg">
            <form onSubmit={handleSubmit}>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Edit Project</h1>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Project Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Client
                        </label>
                        <select
                          id="client"
                          name="client"
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                          value={formData.clientId}
                          onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        >
                          <option value="">Select a client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </label>
                        <select
                          id="status"
                          name="status"
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="on_hold">On Hold</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-studio-x focus:ring-studio-x sm:text-sm bg-white dark:bg-input text-gray-900 dark:text-foreground"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4">Team Members</h3>
                    <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                      <div className="space-y-2">
                        {users.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm dark:shadow-gray-700/50 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-foreground">{user.name}</p>
                                <p className="text-sm text-gray-500 dark:text-muted-foreground">{user.role.replace('_', ' ')}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleTeamMember(user.id)}
                              className={`inline-flex items-center px-3 py-1 border rounded-full text-sm font-medium ${
                                formData.teamMembers.includes(user.id)
                                  ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                                  : 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                              }`}
                            >
                              {formData.teamMembers.includes(user.id) ? (
                                <>
                                  <UserMinus className="h-4 w-4 mr-1" />
                                  Remove
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Add
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-gray-500 dark:text-muted-foreground">
                        {formData.teamMembers.length} team member{formData.teamMembers.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}