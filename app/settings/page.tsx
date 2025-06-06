'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/ui/DashboardLayout';
import { Save, Mail, Bell, Globe } from 'lucide-react';

interface SystemSettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  
  // Email settings
  emailNotifications: boolean;
  lowHoursThreshold: number; // Percentage for yellow warning
  criticalHoursThreshold: number; // Percentage for red warning
  notificationEmails: string[]; // Additional emails to notify
  
  // Timebank settings
  defaultTimebankExpiry: number; // Days
  allowNegativeBalance: boolean;
  requireApprovalForTimeEntries: boolean;
  
  // Client portal settings
  enableClientPortal: boolean;
  clientPortalUrl: string;
  
}

export default function SettingsPage() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    emailNotifications: true,
    lowHoursThreshold: 25,
    criticalHoursThreshold: 10,
    notificationEmails: [],
    defaultTimebankExpiry: 365,
    allowNegativeBalance: false,
    requireApprovalForTimeEntries: false,
    enableClientPortal: false,
    clientPortalUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'system', 'settings'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as SystemSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        ...settings,
        updatedAt: new Date(),
        updatedBy: userProfile?.id,
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addNotificationEmail = () => {
    if (newEmail && !settings.notificationEmails.includes(newEmail)) {
      setSettings({
        ...settings,
        notificationEmails: [...settings.notificationEmails, newEmail],
      });
      setNewEmail('');
    }
  };

  const removeNotificationEmail = (email: string) => {
    setSettings({
      ...settings,
      notificationEmails: settings.notificationEmails.filter(e => e !== email),
    });
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['admin']}>
        <DashboardLayout>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-x"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="bg-white shadow rounded-lg">
            {/* Company Information */}
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                Company Information
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Email</label>
                  <input
                    type="email"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Phone</label>
                  <input
                    type="tel"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Address</label>
                  <input
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                    value={settings.companyAddress}
                    onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Email Notifications */}
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Notifications
              </h3>
              <div className="mt-6 space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-studio-x focus:ring-studio-x border-gray-300 rounded"
                    checked={settings.emailNotifications}
                    onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Enable email notifications
                  </label>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Low Hours Warning (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                      value={settings.lowHoursThreshold}
                      onChange={(e) => setSettings({ ...settings, lowHoursThreshold: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Critical Hours Warning (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                      value={settings.criticalHoursThreshold}
                      onChange={(e) => setSettings({ ...settings, criticalHoursThreshold: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notification Recipients
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      placeholder="Enter email address"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm text-gray-900"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={addNotificationEmail}
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-studio-x hover:bg-studio-x-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {settings.notificationEmails.map((email) => (
                      <div key={email} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <span className="text-sm">{email}</span>
                        <button
                          onClick={() => removeNotificationEmail(email)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Timebank Settings */}
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Timebank Settings
              </h3>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Timebank Expiry (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm sm:max-w-xs text-gray-900"
                    value={settings.defaultTimebankExpiry}
                    onChange={(e) => setSettings({ ...settings, defaultTimebankExpiry: parseInt(e.target.value) })}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-studio-x focus:ring-studio-x border-gray-300 rounded"
                      checked={settings.allowNegativeBalance}
                      onChange={(e) => setSettings({ ...settings, allowNegativeBalance: e.target.checked })}
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Allow negative timebank balance
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-studio-x focus:ring-studio-x border-gray-300 rounded"
                      checked={settings.requireApprovalForTimeEntries}
                      onChange={(e) => setSettings({ ...settings, requireApprovalForTimeEntries: e.target.checked })}
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Require approval for time entries
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-studio-x focus:ring-studio-x border-gray-300 rounded"
                      checked={settings.enableClientPortal}
                      onChange={(e) => setSettings({ ...settings, enableClientPortal: e.target.checked })}
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable client portal
                    </label>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}