'use client';

import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Timebank, TimeEntry, Project, Client } from '@/types';
import { Clock, FolderOpen, TrendingDown } from 'lucide-react';
import { calculateTimebankStatus, getStatusColor, formatHours } from '@/utils/timebank';
import { format } from 'date-fns';

export default function ClientPortalPage() {
  const [clientEmail, setClientEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [timebanks, setTimebanks] = useState<Timebank[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Find client by email
      const clientQuery = query(collection(db, 'clients'), where('email', '==', clientEmail));
      const clientSnapshot = await getDocs(clientQuery);
      
      if (!clientSnapshot.empty) {
        const clientData = { id: clientSnapshot.docs[0].id, ...clientSnapshot.docs[0].data() } as Client;
        
        // Simple access code check (in production, use proper authentication)
        // For demo, access code is the first 4 letters of client name in uppercase
        const expectedCode = clientData.name.substring(0, 4).toUpperCase();
        
        if (accessCode.toUpperCase() === expectedCode) {
          setClient(clientData);
          setIsAuthenticated(true);
          await fetchClientData(clientData.id);
        } else {
          alert('Invalid access code');
        }
      } else {
        alert('Client not found');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientData = async (clientId: string) => {
    try {
      // Fetch timebanks
      const timebanksQuery = query(collection(db, 'timebanks'), where('clientId', '==', clientId));
      const timebanksSnapshot = await getDocs(timebanksQuery);
      const timebanksList = timebanksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Timebank));
      setTimebanks(timebanksList);

      // Fetch projects
      const projectsQuery = query(collection(db, 'projects'), where('clientId', '==', clientId));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Project));
      setProjects(projectsList);

      // Fetch recent time entries
      if (projectsList.length > 0) {
        const projectIds = projectsList.map(p => p.id);
        const entriesQuery = query(
          collection(db, 'timeEntries'),
          where('projectId', 'in', projectIds),
          where('status', '==', 'approved')
        );
        const entriesSnapshot = await getDocs(entriesQuery);
        const entriesList = entriesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);
        setRecentEntries(entriesList);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-foreground">
            Client Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-muted-foreground">
            View your timebank status and project information
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Access Code
                </label>
                <div className="mt-1">
                  <input
                    id="accessCode"
                    name="accessCode"
                    type="text"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-studio-x focus:border-studio-x sm:text-sm"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  Contact your project manager if you don&apos;t have an access code
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-studio-x hover:bg-studio-x-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-x disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const totalHoursAvailable = timebanks.reduce((sum, tb) => sum + tb.remainingHours, 0);
  const totalHoursUsed = timebanks.reduce((sum, tb) => sum + tb.usedHours, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="bg-white shadow dark:shadow-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Client Portal</h1>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">Welcome, {client?.name}</p>
            </div>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setClient(null);
                setClientEmail('');
                setAccessCode('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Hours Available
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-foreground">
                      {formatHours(totalHoursAvailable)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingDown className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Hours Used
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-foreground">
                      {formatHours(totalHoursUsed)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FolderOpen className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Projects
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-foreground">
                      {projects.filter(p => p.status === 'active').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timebanks */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your Timebanks</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timebanks.map((timebank) => {
              const status = calculateTimebankStatus(timebank);
              const percentageUsed = (timebank.usedHours / timebank.totalHours) * 100;
              
              return (
                <div key={timebank.id} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">
                        {timebank.name}
                      </h3>
                      <div className={`${getStatusColor(status)} rounded-full p-2`}>
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-muted-foreground">Hours Used</span>
                        <span className="font-medium">
                          {formatHours(timebank.usedHours)} / {formatHours(timebank.totalHours)}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${getStatusColor(status)} h-2 rounded-full`}
                          style={{ width: `${percentageUsed}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-muted-foreground">
                        <span>Remaining: {formatHours(timebank.remainingHours)}</span>
                        <span>{percentageUsed.toFixed(0)}% used</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Time Entries */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentEntries.map((entry) => {
                const project = projects.find(p => p.id === entry.projectId);
                return (
                  <li key={entry.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                          {project?.name || 'Unknown Project'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">{entry.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                          {formatHours(entry.hours)} hours
                        </p>
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">
                          {format(new Date(entry.date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}