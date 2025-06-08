'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { User, Department } from '@/types';
import { Plus, Edit2, Trash2, X, Mail, UserPlus } from 'lucide-react';

export default function UsersPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    role: 'developer' as User['role'],
    department: 'developer_team' as Department | undefined,
  });
  const [inviteData, setInviteData] = useState({
    email: '',
    name: '',
    role: 'developer' as User['role'],
    department: 'developer_team' as Department,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Check if user has permission to send invites
      if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'project_manager')) {
        alert('You do not have permission to send invitations. Only admins and project managers can invite new users.');
        return;
      }
      
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Create invitation record
      await addDoc(collection(db, 'invitations'), {
        email: inviteData.email,
        name: inviteData.name,
        role: inviteData.role,
        department: inviteData.department,
        invitedBy: userProfile?.id,
        invitedAt: new Date(),
        status: 'pending',
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Send invitation email
      try {
        const response = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteData.email,
            name: inviteData.name,
            role: inviteData.role,
            department: inviteData.department,
            token,
            inviterName: userProfile?.name,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Email API error:', errorData);
          // Don't throw here - invitation was still created in Firestore
          console.warn('Email sending failed, but invitation record was created');
        } else {
          console.log('Email sent successfully');
        }
      } catch (emailError) {
        console.error('Failed to send email, but invitation created:', emailError);
      }

      alert(`Invitation created for ${inviteData.email}. They will receive an email with instructions to join.`);
      
      setInviteData({
        email: '',
        name: '',
        role: 'developer',
        department: 'developer_team',
      });
      setShowInviteModal(false);
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      if (error.code === 'permission-denied') {
        alert('You do not have permission to send invitations. Only admins and project managers can invite new users.');
      } else {
        alert(`Failed to send invitation: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditData({
      name: user.name,
      role: user.role,
      department: user.department,
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editData.name,
        role: editData.role,
        department: editData.department,
        updatedAt: new Date(),
      });
      
      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleDelete = async (userId: string) => {
    if (userId === userProfile?.id) {
      alert("You cannot delete your own account");
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300';
      case 'project_manager':
        return 'bg-studio-x-100 dark:bg-studio-x/20 text-studio-x-800 dark:text-studio-x';
      case 'developer':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Users</h1>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <li key={user.id}>
                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-foreground">{user.name}</div>
                          <div className="text-sm text-gray-500 dark:text-muted-foreground">{user.email}</div>
                          {user.department && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {user.department === 'studio_x' ? 'Studio X' : 'Developer Team'}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                          {user.role === 'admin' ? 'Admin' : 
                           user.role === 'project_manager' ? 'Project Manager' : 
                           'Developer'}
                        </span>
                        
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-studio-x hover:text-studio-x-600"
                          title="Edit user"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        
                        {user.id !== userProfile?.id && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete user"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Invite User Modal */}
          {showInviteModal && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => setShowInviteModal(false)} />
                
                <div className="inline-block align-bottom bg-white dark:bg-card rounded-lg text-left overflow-hidden shadow-xl dark:shadow-gray-800 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleInvite}>
                    <div className="bg-white dark:bg-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                          Invite New User
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowInviteModal(false)}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email Address
                          </label>
                          <input
                            type="email"
                            name="email"
                            id="email"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={inviteData.email}
                            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Full Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={inviteData.name}
                            onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Role
                          </label>
                          <select
                            name="role"
                            id="role"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={inviteData.role}
                            onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as User['role'] })}
                          >
                            <option value="developer">Developer</option>
                            <option value="project_manager">Project Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Department
                          </label>
                          <select
                            name="department"
                            id="department"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={inviteData.department}
                            onChange={(e) => setInviteData({ ...inviteData, department: e.target.value as Department })}
                          >
                            <option value="studio_x">Studio X</option>
                            <option value="developer_team">Developer Team</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-secondary px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Send Invitation
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInviteModal(false)}
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

          {/* Edit User Modal */}
          {showEditModal && editingUser && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => setShowEditModal(false)} />
                
                <div className="inline-block align-bottom bg-white dark:bg-card rounded-lg text-left overflow-hidden shadow-xl dark:shadow-gray-800 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleUpdateUser}>
                    <div className="bg-white dark:bg-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                          Edit User
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          className="text-gray-400 hover:text-gray-500 dark:text-muted-foreground"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editingUser.email}
                            disabled
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 sm:text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Full Name
                          </label>
                          <input
                            type="text"
                            id="edit-name"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Role
                          </label>
                          <select
                            id="edit-role"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={editData.role}
                            onChange={(e) => setEditData({ ...editData, role: e.target.value as User['role'] })}
                            disabled={editingUser.id === userProfile?.id}
                          >
                            <option value="developer">Developer</option>
                            <option value="project_manager">Project Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                          {editingUser.id === userProfile?.id && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">You cannot change your own role</p>
                          )}
                        </div>
                        
                        <div>
                          <label htmlFor="edit-department" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Department
                          </label>
                          <select
                            id="edit-department"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-input"
                            value={editData.department || ''}
                            onChange={(e) => setEditData({ ...editData, department: (e.target.value || undefined) as Department | undefined })}
                          >
                            <option value="">No Department</option>
                            <option value="studio_x">Studio X</option>
                            <option value="developer_team">Developer Team</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-secondary px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
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