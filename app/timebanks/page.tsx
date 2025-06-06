'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Timebank, Client } from '@/types';
import { Plus, Edit2, Trash2, X, Clock } from 'lucide-react';
import { calculateTimebankStatus, getStatusColor, formatHours } from '@/utils/timebank';

export default function TimebanksPage() {
  const [timebanks, setTimebanks] = useState<Timebank[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTimebank, setEditingTimebank] = useState<Timebank | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    totalHours: '',
    purchaseDate: '',
    expiryDate: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch timebanks
      const timebanksSnapshot = await getDocs(collection(db, 'timebanks'));
      const timebanksList = timebanksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Timebank));
      setTimebanks(timebanksList);

      // Fetch clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsList = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(clientsList);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const timebankData = {
        clientId: formData.clientId,
        name: formData.name,
        totalHours: parseFloat(formData.totalHours),
        usedHours: editingTimebank?.usedHours || 0,
        remainingHours: editingTimebank 
          ? parseFloat(formData.totalHours) - (editingTimebank.usedHours || 0)
          : parseFloat(formData.totalHours),
        status: 'active' as const,
        purchaseDate: new Date(formData.purchaseDate),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        updatedAt: new Date(),
      };

      if (editingTimebank) {
        // Update existing timebank
        await updateDoc(doc(db, 'timebanks', editingTimebank.id), timebankData);
      } else {
        // Add new timebank
        await addDoc(collection(db, 'timebanks'), {
          ...timebankData,
          createdAt: new Date(),
        });
      }
      
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving timebank:', error);
    }
  };

  const handleEdit = (timebank: Timebank) => {
    setEditingTimebank(timebank);
    setFormData({
      clientId: timebank.clientId,
      name: timebank.name,
      totalHours: timebank.totalHours.toString(),
      purchaseDate: timebank.purchaseDate instanceof Date 
        ? timebank.purchaseDate.toISOString().split('T')[0]
        : new Date(timebank.purchaseDate).toISOString().split('T')[0],
      expiryDate: timebank.expiryDate 
        ? (timebank.expiryDate instanceof Date 
          ? timebank.expiryDate.toISOString().split('T')[0]
          : new Date(timebank.expiryDate).toISOString().split('T')[0])
        : '',
    });
    setShowModal(true);
  };

  const handleDelete = async (timebankId: string) => {
    if (window.confirm('Are you sure you want to delete this timebank?')) {
      try {
        await deleteDoc(doc(db, 'timebanks', timebankId));
        await fetchData();
      } catch (error) {
        console.error('Error deleting timebank:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      name: '',
      totalHours: '',
      purchaseDate: '',
      expiryDate: '',
    });
    setEditingTimebank(null);
    setShowModal(false);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  return (
    <ProtectedRoute requiredRoles={['admin', 'project_manager']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Timebanks</h1>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Timebank
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {timebanks.map((timebank) => {
                const status = calculateTimebankStatus(timebank);
                const percentageUsed = (timebank.usedHours / timebank.totalHours) * 100;
                
                return (
                  <div key={timebank.id} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {timebank.name}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {getClientName(timebank.clientId)}
                          </p>
                        </div>
                        <div className={`flex-shrink-0 ${getStatusColor(status)} rounded-full p-2`}>
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Hours Used</span>
                          <span className="font-medium">
                            {formatHours(timebank.usedHours)} / {formatHours(timebank.totalHours)}
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${getStatusColor(status)} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${percentageUsed}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-between">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(status)}`}>
                          {timebank.status}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(timebank)}
                            className="text-studio-x hover:text-studio-x-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(timebank.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {editingTimebank ? 'Edit Timebank' : 'Add New Timebank'}
                        </h3>
                        <button
                          type="button"
                          onClick={resetForm}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                            Client
                          </label>
                          <select
                            name="clientId"
                            id="clientId"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
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
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Timebank Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="totalHours" className="block text-sm font-medium text-gray-700">
                            Total Hours
                          </label>
                          <input
                            type="number"
                            name="totalHours"
                            id="totalHours"
                            required
                            min="0"
                            step="0.5"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                            value={formData.totalHours}
                            onChange={(e) => setFormData({ ...formData, totalHours: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">
                            Purchase Date
                          </label>
                          <input
                            type="date"
                            name="purchaseDate"
                            id="purchaseDate"
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                            value={formData.purchaseDate}
                            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">
                            Expiry Date (optional)
                          </label>
                          <input
                            type="date"
                            name="expiryDate"
                            id="expiryDate"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-x text-base font-medium text-white hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {editingTimebank ? 'Update' : 'Add'}
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