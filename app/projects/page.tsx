'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Project, Client, User } from '@/types';
import { Plus, Edit2, Trash2, X, Users, Search, Filter, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ProjectsPage() {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Project['status']>('all');
  const [filterClient, setFilterClient] = useState<'all' | string>('all');
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    description: '',
    status: 'active' as Project['status'],
    teamMembers: [] as string[],
  });

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
  }, [userProfile]);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, filterStatus, filterClient]);

  const filterProjects = () => {
    let filtered = [...projects];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(project => project.status === filterStatus);
    }

    // Client filter
    if (filterClient !== 'all') {
      filtered = filtered.filter(project => project.clientId === filterClient);
    }

    setFilteredProjects(filtered);
  };

  const fetchData = async () => {
    try {
      // Fetch projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      let projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Project));
      
      // Filter projects based on user role
      if (userProfile?.role === 'developer' || userProfile?.role === 'project_manager') {
        // Only show projects where the user is a team member
        projectsList = projectsList.filter(project => 
          project.teamMembers?.includes(userProfile.id)
        );
      }
      // Admins see all projects
      
      setProjects(projectsList);
      setFilteredProjects(projectsList);

      // Fetch clients - only for projects the user has access to
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      let clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      
      // Filter clients based on user's projects
      if (userProfile?.role === 'developer' || userProfile?.role === 'project_manager') {
        const userProjectClientIds = new Set(projectsList.map(p => p.clientId));
        clientsList = clientsList.filter(client => userProjectClientIds.has(client.id));
      }
      
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
    
    try {
      const projectData = {
        ...formData,
        updatedAt: new Date(),
      };

      if (editingProject) {
        // Update existing project
        await updateDoc(doc(db, 'projects', editingProject.id), projectData);
      } else {
        // Add new project
        await addDoc(collection(db, 'projects'), {
          ...projectData,
          createdAt: new Date(),
        });
      }
      
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      clientId: project.clientId,
      name: project.name,
      description: project.description || '',
      status: project.status,
      teamMembers: project.teamMembers || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        await fetchData();
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      name: '',
      description: '',
      status: 'active',
      teamMembers: [],
    });
    setEditingProject(null);
    setShowModal(false);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };


  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'completed':
        return 'bg-studio-x-100 dark:bg-studio-x/20 text-studio-x-800 dark:text-studio-x';
      case 'on_hold':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Projects</h1>
            {userProfile?.role === 'admin' && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-card p-4 rounded-lg shadow dark:shadow-gray-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-input focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-foreground bg-white dark:bg-input focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | Project['status'])}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                <select
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-foreground bg-white dark:bg-input focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                >
                  <option value="all">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                Showing {filteredProjects.length} of {projects.length} projects
              </span>
              {(searchTerm || filterStatus !== 'all' || filterClient !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterClient('all');
                  }}
                  className="text-studio-x hover:text-studio-x-600"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-background">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Project
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Team
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/projects/${project.id}`}
                          className="group flex items-center text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-studio-x dark:hover:text-studio-x"
                        >
                          {project.name}
                          <ChevronRight className="ml-1 h-4 w-4 text-gray-400 group-hover:text-studio-x" />
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {getClientName(project.clientId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
                          <span>{project.teamMembers?.length || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {project.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {userProfile?.role === 'admin' && (
                            <>
                              <button
                                onClick={() => handleEdit(project)}
                                className="text-studio-x hover:text-studio-x-700"
                                title="Edit Project"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(project.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete Project"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <Link 
                            href={`/projects/${project.id}`}
                            className="text-studio-x hover:text-studio-x-700 font-medium"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredProjects.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-muted-foreground">No projects found</p>
                </div>
              )}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={resetForm} />
                
                <div className="inline-block align-bottom bg-white dark:bg-card rounded-lg text-left overflow-hidden shadow-xl dark:shadow-gray-800 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleSubmit}>
                    <div className="bg-white dark:bg-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                          {editingProject ? 'Edit Project' : 'Add New Project'}
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
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
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
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Project Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description (optional)
                          </label>
                          <textarea
                            name="description"
                            id="description"
                            rows={3}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Status
                          </label>
                          <select
                            name="status"
                            id="status"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="on_hold">On Hold</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Team Members
                          </label>
                          <div className="space-y-2 max-h-32 overflow-y-auto bg-gray-50 dark:bg-secondary p-2 rounded-md border border-gray-200 dark:border-gray-700">
                            {users.map((user) => (
                              <label key={user.id} className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-studio-x focus:ring-studio-x border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-input"
                                  checked={formData.teamMembers.includes(user.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        teamMembers: [...formData.teamMembers, user.id],
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        teamMembers: formData.teamMembers.filter(id => id !== user.id),
                                      });
                                    }
                                  }}
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                  {user.name} ({user.role.replace('_', ' ')})
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-secondary px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {editingProject ? 'Update' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-card text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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