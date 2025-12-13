import React, { useState, useEffect } from 'react';
import { Subscriber, SubscriberList, GoogleSettings, GapiAuthData } from '../types';
import * as googleApi from '../services/googleApiService';
import { UsersIcon, PlusIcon, TrashIcon, EditIcon, FilterIcon, XIcon, UploadIcon, CheckIcon } from '../components/IconComponents';

interface SubscriberManagementPageProps {
    subscribers: Subscriber[];
    subscriberLists: SubscriberList[];
    googleSettings: GoogleSettings | null;
    authData: GapiAuthData | null;
    onListsChanged?: () => Promise<void>;
}

export const SubscriberManagementPage: React.FC<SubscriberManagementPageProps> = ({
    subscribers,
    subscriberLists,
    googleSettings,
    authData,
    onListsChanged
}) => {
    // UI States
    const [activeTab, setActiveTab] = useState<'subscribers' | 'lists' | 'import'>('subscribers');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Subscriber Management
    const [subscribersData, setSubscribersData] = useState<Subscriber[]>(subscribers);
    const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>(subscribers);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterList, setFilterList] = useState<string>('');

    // List Management
    const [listsData, setListsData] = useState<SubscriberList[]>(subscriberLists);

    // Modal States
    const [isAddSubscriberModalOpen, setIsAddSubscriberModalOpen] = useState(false);
    const [isEditSubscriberModalOpen, setIsEditSubscriberModalOpen] = useState(false);
    const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
    const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
    const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
    const [editingList, setEditingList] = useState<SubscriberList | null>(null);
    const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);

    // Form States
    const [formData, setFormData] = useState({ email: '', name: '', lists: [] as string[] });
    const [listFormData, setListFormData] = useState({ name: '', description: '' });
    const [bulkImportData, setBulkImportData] = useState('');
    const [selectedListsForImport, setSelectedListsForImport] = useState<string[]>([]);

    // Load subscribers and lists on mount and when auth changes
    useEffect(() => {
        if (authData && googleSettings) {
            loadData();
        }
    }, [authData, googleSettings]);

    // Filter subscribers when search or filter changes
    useEffect(() => {
        let filtered = subscribersData;

        if (searchTerm) {
            filtered = filtered.filter(s =>
                s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(s => s.status === filterStatus);
        }

        if (filterList) {
            filtered = filtered.filter(s => s.lists.includes(filterList));
        }

        setFilteredSubscribers(filtered);
    }, [subscribersData, searchTerm, filterStatus, filterList]);

    const loadData = async () => {
        if (!googleSettings) return;

        setLoading(true);
        setError(null);
        try {
            // Migrate sheet if needed
            await googleApi.migrateSubscriberSheet(googleSettings.subscribersSheetName);

            // Load subscribers and lists
            const [subs, lists] = await Promise.all([
                googleApi.readAllSubscribers(googleSettings.subscribersSheetName),
                googleApi.readAllLists(googleSettings.groupListSheetName || 'Group List')
            ]);

            setSubscribersData(subs);
            setListsData(lists);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // ===== SUBSCRIBER HANDLERS =====

    const handleAddSubscriber = async () => {
        if (!formData.email || !googleSettings) return;

        setLoading(true);
        try {
            const newSubscriber: Subscriber = {
                email: formData.email,
                name: formData.name,
                status: 'active',
                lists: formData.lists.join(','),
                dateAdded: new Date().toISOString(),
                source: 'manual'
            };

            await googleApi.addSubscriber(newSubscriber, googleSettings.subscribersSheetName);
            setSubscribersData([...subscribersData, newSubscriber]);
            setIsAddSubscriberModalOpen(false);
            setFormData({ email: '', name: '', lists: [] });
            showSuccess(`Subscriber ${formData.email} added successfully!`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add subscriber');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSubscriber = async () => {
        if (!editingSubscriber || !googleSettings) return;

        setLoading(true);
        try {
            await googleApi.updateSubscriber(
                editingSubscriber.email,
                { ...editingSubscriber, lists: formData.lists.join(',') },
                googleSettings.subscribersSheetName
            );

            setSubscribersData(subscribersData.map(s =>
                s.email === editingSubscriber.email
                    ? { ...editingSubscriber, lists: formData.lists.join(',') }
                    : s
            ));

            setIsEditSubscriberModalOpen(false);
            setEditingSubscriber(null);
            setFormData({ email: '', name: '', lists: [] });
            showSuccess('Subscriber updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update subscriber');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSubscriber = async (email: string) => {
        if (!googleSettings || !confirm(`Are you sure you want to delete ${email}?`)) return;

        setLoading(true);
        try {
            await googleApi.deleteSubscriber(email, googleSettings.subscribersSheetName);
            setSubscribersData(subscribersData.filter(s => s.email !== email));
            showSuccess('Subscriber deleted successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete subscriber');
        } finally {
            setLoading(false);
        }
    };

    const openEditSubscriberModal = (subscriber: Subscriber) => {
        setEditingSubscriber(subscriber);
        setFormData({
            email: subscriber.email,
            name: subscriber.name || '',
            lists: subscriber.lists ? subscriber.lists.split(',').map(l => l.trim()) : []
        });
        setIsEditSubscriberModalOpen(true);
    };

    // ===== LIST HANDLERS =====

    const handleCreateList = async () => {
        if (!listFormData.name || !googleSettings) return;

        setLoading(true);
        try {
            const newList = await googleApi.createList(
                listFormData.name,
                listFormData.description,
                googleSettings.groupListSheetName || 'Group List'
            );

            setListsData([...listsData, newList]);
            setIsAddListModalOpen(false);
            setListFormData({ name: '', description: '' });
            showSuccess(`List "${listFormData.name}" created successfully!`);

            // Notify parent component that lists changed
            if (onListsChanged) {
                await onListsChanged();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create list');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateList = async () => {
        if (!editingList || !googleSettings) return;

        setLoading(true);
        try {
            await googleApi.updateList(
                editingList.id,
                { name: listFormData.name, description: listFormData.description },
                googleSettings.groupListSheetName || 'Group List'
            );

            setListsData(listsData.map(l =>
                l.id === editingList.id
                    ? { ...editingList, name: listFormData.name, description: listFormData.description }
                    : l
            ));

            setIsEditListModalOpen(false);
            setEditingList(null);
            setListFormData({ name: '', description: '' });
            showSuccess('List updated successfully!');

            // Notify parent component that lists changed
            if (onListsChanged) {
                await onListsChanged();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update list');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteList = async (id: string) => {
        if (!googleSettings) return;

        const list = listsData.find(l => l.id === id);
        if (!list || !confirm(`Are you sure you want to delete "${list.name}"? This will remove it from all subscribers.`)) return;

        setLoading(true);
        try {
            await googleApi.deleteList(id, googleSettings.subscribersSheetName, googleSettings.groupListSheetName || 'Group List');
            setListsData(listsData.filter(l => l.id !== id));
            showSuccess('List deleted successfully!');

            // Notify parent component that lists changed
            if (onListsChanged) {
                await onListsChanged();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete list');
        } finally {
            setLoading(false);
        }
    };

    const openEditListModal = (list: SubscriberList) => {
        setEditingList(list);
        setListFormData({ name: list.name, description: list.description || '' });
        setIsEditListModalOpen(true);
    };

    // ===== BULK IMPORT HANDLER =====

    const handleBulkImport = async () => {
        if (!bulkImportData.trim() || !googleSettings) return;

        setLoading(true);
        setError(null);
        try {
            const emails = bulkImportData
                .split(/[\n,;]/)
                .map(e => e.trim())
                .filter(e => e && e.includes('@'));

            if (emails.length === 0) {
                setError('No valid emails found in input');
                setLoading(false);
                return;
            }

            let imported = 0;
            let failed = 0;

            for (const email of emails) {
                try {
                    const newSubscriber: Subscriber = {
                        email,
                        name: '',
                        status: 'active',
                        lists: selectedListsForImport.join(','),
                        dateAdded: new Date().toISOString(),
                        source: 'import'
                    };

                    await googleApi.addSubscriber(newSubscriber, googleSettings.subscribersSheetName);

                    // Add to lists if needed
                    for (const listId of selectedListsForImport) {
                        await googleApi.addSubscriberToList(
                            email,
                            listId,
                            googleSettings.subscribersSheetName,
                            googleSettings.groupListSheetName || 'Group List'
                        );
                    }

                    imported++;
                } catch {
                    failed++;
                }
            }

            await loadData(); // Refresh data
            setIsBulkImportModalOpen(false);
            setBulkImportData('');
            setSelectedListsForImport([]);
            showSuccess(`Imported ${imported} subscriber(s). ${failed > 0 ? `${failed} failed.` : ''}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import subscribers');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-2">
                    Subscriber Management
                </h1>
                <p className="text-secondary-text">Manage your subscriber lists and organize them into groups for targeted newsletters</p>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-red-600 font-semibold">Error:</span>
                    <span className="text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-green-700">{successMessage}</span>
                </div>
            )}

            {/* Loading Spinner */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-salmon"></div>
                </div>
            )}

            {!loading && googleSettings && authData ? (
                <>
                    {/* Tab Navigation */}
                    <div className="flex gap-2 border-b border-border-light">
                        <button
                            onClick={() => setActiveTab('subscribers')}
                            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'subscribers'
                                    ? 'border-accent-salmon text-accent-salmon'
                                    : 'border-transparent text-secondary-text hover:text-primary-text'
                            }`}
                        >
                            Subscribers ({subscribersData.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('lists')}
                            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'lists'
                                    ? 'border-accent-salmon text-accent-salmon'
                                    : 'border-transparent text-secondary-text hover:text-primary-text'
                            }`}
                        >
                            Lists ({listsData.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('import')}
                            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                                activeTab === 'import'
                                    ? 'border-accent-salmon text-accent-salmon'
                                    : 'border-transparent text-secondary-text hover:text-primary-text'
                            }`}
                        >
                            Bulk Import
                        </button>
                    </div>

                    {/* SUBSCRIBERS TAB */}
                    {activeTab === 'subscribers' && (
                        <div className="space-y-6">
                            {/* Toolbar */}
                            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                                <div className="flex flex-col md:flex-row gap-3 flex-1">
                                    {/* Search */}
                                    <input
                                        type="text"
                                        placeholder="Search by email or name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                    />

                                    {/* Status Filter */}
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as any)}
                                        className="px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>

                                    {/* List Filter */}
                                    <select
                                        value={filterList}
                                        onChange={(e) => setFilterList(e.target.value)}
                                        className="px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                    >
                                        <option value="">All Lists</option>
                                        {listsData.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Add Button */}
                                <button
                                    onClick={() => {
                                        setFormData({ email: '', name: '', lists: [] });
                                        setIsAddSubscriberModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-accent-salmon text-white rounded-lg hover:bg-accent-salmon/90 transition-colors whitespace-nowrap"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Subscriber
                                </button>
                            </div>

                            {/* Subscribers Table */}
                            <div className="bg-white rounded-2xl shadow-lg border border-border-light overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-border-light">
                                            <tr>
                                                <th className="px-6 py-3 text-left font-semibold text-secondary-text">Email</th>
                                                <th className="px-6 py-3 text-left font-semibold text-secondary-text">Name</th>
                                                <th className="px-6 py-3 text-left font-semibold text-secondary-text">Status</th>
                                                <th className="px-6 py-3 text-left font-semibold text-secondary-text">Lists</th>
                                                <th className="px-6 py-3 text-left font-semibold text-secondary-text">Added</th>
                                                <th className="px-6 py-3 text-center font-semibold text-secondary-text">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light">
                                            {filteredSubscribers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-8 text-center text-secondary-text">
                                                        No subscribers found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredSubscribers.map((sub) => (
                                                    <tr key={sub.email} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 font-medium">{sub.email}</td>
                                                        <td className="px-6 py-4">{sub.name || '-'}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                                sub.status === 'active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm">
                                                            {sub.lists ? sub.lists.split(',').map(lid => {
                                                                const list = listsData.find(l => l.id === lid.trim());
                                                                return <span key={lid} className="inline-block mr-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{list?.name || lid.trim()}</span>;
                                                            }) : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm">{new Date(sub.dateAdded).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => openEditSubscriberModal(sub)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                            >
                                                                <EditIcon className="h-4 w-4" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubscriber(sub.email)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LISTS TAB */}
                    {activeTab === 'lists' && (
                        <div className="space-y-6">
                            {/* Add List Button */}
                            <button
                                onClick={() => {
                                    setListFormData({ name: '', description: '' });
                                    setIsAddListModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-accent-salmon text-white rounded-lg hover:bg-accent-salmon/90 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Create New List
                            </button>

                            {/* Lists Grid */}
                            {listsData.length === 0 ? (
                                <div className="bg-white rounded-2xl shadow-lg border border-border-light p-12 text-center">
                                    <UsersIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-secondary-text">No lists created yet. Create one to organize your subscribers.</p>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {listsData.map((list) => (
                                        <div key={list.id} className="bg-white rounded-2xl shadow-lg border border-border-light p-6 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-bold text-lg">{list.name}</h3>
                                                    {list.description && <p className="text-sm text-secondary-text">{list.description}</p>}
                                                </div>
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold whitespace-nowrap ml-2">
                                                    ID: {list.id}
                                                </span>
                                            </div>
                                            <div className="pt-2 border-t border-border-light">
                                                <p className="text-sm text-secondary-text">Members: <span className="font-bold text-primary-text">{list.subscriberCount}</span></p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditListModal(list)}
                                                    className="flex-1 px-3 py-2 border border-border-light rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <EditIcon className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteList(list.id)}
                                                    className="flex-1 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* BULK IMPORT TAB */}
                    {activeTab === 'import' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-lg p-8 border border-border-light space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">Bulk Import Subscribers</h2>
                                    <p className="text-secondary-text">Paste email addresses (one per line, comma-separated, or semicolon-separated). Max 100 at a time.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-primary-text mb-2">Email Addresses</label>
                                    <textarea
                                        value={bulkImportData}
                                        onChange={(e) => setBulkImportData(e.target.value)}
                                        placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                                        className="w-full h-48 p-4 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-primary-text mb-3">Add to Lists (Optional)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {listsData.map(list => (
                                            <button
                                                key={list.id}
                                                onClick={() => {
                                                    if (selectedListsForImport.includes(list.id)) {
                                                        setSelectedListsForImport(selectedListsForImport.filter(id => id !== list.id));
                                                    } else {
                                                        setSelectedListsForImport([...selectedListsForImport, list.id]);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-lg transition-colors ${
                                                    selectedListsForImport.includes(list.id)
                                                        ? 'bg-accent-salmon text-white'
                                                        : 'border border-border-light hover:bg-gray-50'
                                                }`}
                                            >
                                                {list.name}
                                            </button>
                                        ))}
                                    </div>
                                    {listsData.length === 0 && (
                                        <p className="text-sm text-secondary-text text-italic">Create lists first to add subscribers to them during import.</p>
                                    )}
                                </div>

                                <button
                                    onClick={handleBulkImport}
                                    disabled={!bulkImportData.trim()}
                                    className="w-full px-4 py-3 bg-accent-salmon text-white rounded-lg hover:bg-accent-salmon/90 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2 font-semibold"
                                >
                                    <UploadIcon className="h-4 w-4" />
                                    Import Subscribers
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODALS */}

                    {/* Add/Edit Subscriber Modal */}
                    {(isAddSubscriberModalOpen || isEditSubscriberModalOpen) && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold">
                                        {isAddSubscriberModalOpen ? 'Add Subscriber' : 'Edit Subscriber'}
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setIsAddSubscriberModalOpen(false);
                                            setIsEditSubscriberModalOpen(false);
                                            setFormData({ email: '', name: '', lists: [] });
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <XIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Email Address *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            disabled={isEditSubscriberModalOpen}
                                            placeholder="user@example.com"
                                            className="w-full px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue disabled:bg-gray-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="John Doe"
                                            className="w-full px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Add to Lists</label>
                                        <div className="space-y-2">
                                            {listsData.map(list => (
                                                <label key={list.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.lists.includes(list.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({ ...formData, lists: [...formData.lists, list.id] });
                                                            } else {
                                                                setFormData({ ...formData, lists: formData.lists.filter(id => id !== list.id) });
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-border-light"
                                                    />
                                                    <span className="text-sm">{list.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {listsData.length === 0 && (
                                            <p className="text-sm text-secondary-text italic">No lists available. Create one first.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={() => {
                                            setIsAddSubscriberModalOpen(false);
                                            setIsEditSubscriberModalOpen(false);
                                            setFormData({ email: '', name: '', lists: [] });
                                        }}
                                        className="flex-1 px-4 py-2 border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={isAddSubscriberModalOpen ? handleAddSubscriber : handleUpdateSubscriber}
                                        disabled={!formData.email}
                                        className="flex-1 px-4 py-2 bg-accent-salmon text-white rounded-lg hover:bg-accent-salmon/90 disabled:bg-gray-300 transition-colors"
                                    >
                                        {isAddSubscriberModalOpen ? 'Add' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add/Edit List Modal */}
                    {(isAddListModalOpen || isEditListModalOpen) && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold">
                                        {isAddListModalOpen ? 'Create List' : 'Edit List'}
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setIsAddListModalOpen(false);
                                            setIsEditListModalOpen(false);
                                            setListFormData({ name: '', description: '' });
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <XIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">List Name *</label>
                                        <input
                                            type="text"
                                            value={listFormData.name}
                                            onChange={(e) => setListFormData({ ...listFormData, name: e.target.value })}
                                            placeholder="e.g., VIP Subscribers"
                                            className="w-full px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Description</label>
                                        <textarea
                                            value={listFormData.description}
                                            onChange={(e) => setListFormData({ ...listFormData, description: e.target.value })}
                                            placeholder="Describe this list..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light-blue"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={() => {
                                            setIsAddListModalOpen(false);
                                            setIsEditListModalOpen(false);
                                            setListFormData({ name: '', description: '' });
                                        }}
                                        className="flex-1 px-4 py-2 border border-border-light rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={isAddListModalOpen ? handleCreateList : handleUpdateList}
                                        disabled={!listFormData.name}
                                        className="flex-1 px-4 py-2 bg-accent-salmon text-white rounded-lg hover:bg-accent-salmon/90 disabled:bg-gray-300 transition-colors"
                                    >
                                        {isAddListModalOpen ? 'Create' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white rounded-2xl shadow-lg border border-border-light p-12 text-center">
                    <p className="text-secondary-text mb-4">Please sign in with Google to manage subscribers.</p>
                    <p className="text-sm text-secondary-text">Go to Settings & Integrations to connect your Google account.</p>
                </div>
            )}
        </div>
    );
};
