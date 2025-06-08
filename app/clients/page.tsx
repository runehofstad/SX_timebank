'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Client, Timebank } from '@/types';
import { Plus, Edit2, Trash2, X, Filter, ArrowUpDown, DollarSign, Activity } from 'lucide-react';

type FilterType = 'alphabetic' | 'balance-low-high' | 'balance-high-low' | 'activity';

interface ClientWithBalance extends Client {
  totalBalance?: number;
  lastActivity?: Date;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithBalance[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('alphabetic');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);
  
  useEffect(() => {
    applyFilter(clients, filterType);
  }, [filterType, clients]);
  
  const applyFilter = (clientsList: ClientWithBalance[], filter: FilterType) => {
    if (!clientsList || !Array.isArray(clientsList)) {
      setFilteredClients([]);
      return;
    }
    let sorted = [...clientsList];
    
    switch (filter) {
      case 'alphabetic':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'balance-low-high':
        sorted.sort((a, b) => (a.totalBalance || 0) - (b.totalBalance || 0));
        break;
      case 'balance-high-low':
        sorted.sort((a, b) => (b.totalBalance || 0) - (a.totalBalance || 0));
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
    
    setFilteredClients(sorted);
  };

  const fetchClients = async () => {
    try {
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClientWithBalance));
      
      // Fetch timebank data for each client to calculate balance
      const clientsWithData = await Promise.all(
        clientsList.map(async (client) => {
          // Get timebanks for this client
          const timebanksQuery = query(
            collection(db, 'timebanks'),
            where('clientId', '==', client.id)
          );
          const timebanksSnapshot = await getDocs(timebanksQuery);
          const timebanks = timebanksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Timebank));
          
          // Calculate total balance (remaining hours)
          const totalBalance = timebanks.reduce((sum, tb) => sum + (tb.remainingHours || 0), 0);
          
          // Get last activity (most recent timebank update)
          const lastActivity = timebanks.reduce((latest, tb) => {
            const tbDate = tb.updatedAt ? (tb.updatedAt as any).toDate() : null;
            return tbDate && (!latest || tbDate > latest) ? tbDate : latest;
          }, null as Date | null);
          
          return {
            ...client,
            totalBalance,
            lastActivity
          };
        })
      );
      
      setClients(clientsWithData);
      applyFilter(clientsWithData, filterType);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingClient) {
        // Update existing client
        await updateDoc(doc(db, 'clients', editingClient.id), {
          ...formData,
          updatedAt: new Date(),
        });
      } else {
        // Add new client
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      await fetchClients();
      resetForm();
      setFilterType('alphabetic'); // Reset to alphabetic after adding/editing
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (clientId: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteDoc(doc(db, 'clients', clientId));
        await fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
    });
    setEditingClient(null);
    setShowModal(false);
  };

  return (
    <ProtectedRoute requiredRoles={['admin', 'project_manager']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">Clients</h1>
            <div className="flex items-center space-x-3">
              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-border text-sm font-medium rounded-md text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-card focus:ring-studio-x"
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
              
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card shadow dark:shadow-gray-800 overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredClients.map((client) => (
                  <li key={client.id}>
                    <div className="px-4 py-4 flex items-center sm:px-6">
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                        <div className="truncate">
                          <div className="flex text-sm">
                            <p className="font-medium text-studio-x truncate">{client.name}</p>
                          </div>
                          <div className="mt-2 flex">
                            <div className="flex items-center text-sm text-gray-500 dark:text-muted-foreground">
                              <p>{client.email}</p>
                              {client.phone && (
                                <>
                                  <span className="mx-2">•</span>
                                  <p>{client.phone}</p>
                                </>
                              )}
                            </div>
                          </div>
                          {(client.totalBalance !== undefined || client.lastActivity) && (
                            <div className="mt-2 flex items-center space-x-4 text-sm">
                              {client.totalBalance !== undefined && (
                                <div className="flex items-center">
                                  <span className="text-gray-500 dark:text-muted-foreground">Balance:</span>
                                  <span className={`ml-1 font-medium ${
                                    client.totalBalance > 0 ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {client.totalBalance.toFixed(1)}h
                                  </span>
                                </div>
                              )}
                              {client.lastActivity && (
                                <div className="flex items-center text-gray-500 dark:text-muted-foreground">
                                  <span>Last activity:</span>
                                  <span className="ml-1">
                                    {new Date(client.lastActivity).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-5 flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-studio-x hover:text-studio-x-700"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {filteredClients.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 dark:text-muted-foreground">
                  No clients found
                </div>
              )}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={resetForm} />
                
                <div className="inline-block align-bottom bg-white dark:bg-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleSubmit}>
                    <div className="bg-white dark:bg-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-foreground">
                          {editingClient ? 'Edit Client' : 'Add New Client'}
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
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-card"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email
                          </label>
                          <input
                            type="email"
                            name="email"
                            id="email"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-card"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Phone (optional)
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            id="phone"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-card"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Address (optional)
                          </label>
                          <textarea
                            name="address"
                            id="address"
                            rows={3}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900 dark:text-foreground bg-white dark:bg-card"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-secondary px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {editingClient ? 'Update' : 'Add'}
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