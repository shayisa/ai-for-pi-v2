import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Subscriber, SubscriberList } from '../types';
import * as subscriberApi from '../services/subscriberClientService';
import { UsersIcon, PlusIcon, TrashIcon, EditIcon, XIcon, UploadIcon, CheckIcon, RefreshIcon } from '../components/IconComponents';
import { fadeInUp, modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface SubscriberManagementPageProps {
    onListsChanged?: () => Promise<void>;
}

export const SubscriberManagementPage: React.FC<SubscriberManagementPageProps> = ({
    onListsChanged
}) => {
    // UI States
    const [activeTab, setActiveTab] = useState<'subscribers' | 'lists' | 'import'>('subscribers');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Subscriber Management
    const [subscribersData, setSubscribersData] = useState<Subscriber[]>([]);
    const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterList, setFilterList] = useState<string>('');

    // List Management
    const [listsData, setListsData] = useState<SubscriberList[]>([]);

    // Modal States
    const [isAddSubscriberModalOpen, setIsAddSubscriberModalOpen] = useState(false);
    const [isEditSubscriberModalOpen, setIsEditSubscriberModalOpen] = useState(false);
    const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
    const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
    const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
    const [editingList, setEditingList] = useState<SubscriberList | null>(null);

    // Form States
    const [formData, setFormData] = useState({ email: '', name: '', lists: [] as string[] });
    const [listFormData, setListFormData] = useState({ name: '', description: '' });
    const [bulkImportData, setBulkImportData] = useState('');
    const [selectedListsForImport, setSelectedListsForImport] = useState<string[]>([]);

    // Load data from SQLite on mount
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [subsResponse, listsResponse] = await Promise.all([
                subscriberApi.getSubscribers({ status: 'all' }),
                subscriberApi.getLists()
            ]);

            setSubscribersData(subsResponse.subscribers);
            setListsData(listsResponse.lists);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // ===== SUBSCRIBER HANDLERS =====

    const handleAddSubscriber = async () => {
        if (!formData.email) return;

        setLoading(true);
        try {
            const newSubscriber = await subscriberApi.addSubscriber({
                email: formData.email,
                name: formData.name || undefined,
                status: 'active',
                lists: formData.lists.join(','),
                source: 'manual'
            });

            setSubscribersData([newSubscriber, ...subscribersData]);
            setIsAddSubscriberModalOpen(false);
            setFormData({ email: '', name: '', lists: [] });
            showSuccess(`Subscriber ${formData.email} added successfully`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add subscriber');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSubscriber = async () => {
        if (!editingSubscriber) return;

        setLoading(true);
        try {
            const updated = await subscriberApi.updateSubscriber(
                editingSubscriber.email,
                {
                    name: formData.name || undefined,
                    lists: formData.lists.join(',')
                }
            );

            setSubscribersData(subscribersData.map(s =>
                s.email === editingSubscriber.email ? updated : s
            ));

            setIsEditSubscriberModalOpen(false);
            setEditingSubscriber(null);
            setFormData({ email: '', name: '', lists: [] });
            showSuccess('Subscriber updated successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update subscriber');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSubscriber = async (email: string) => {
        if (!confirm(`Are you sure you want to delete ${email}?`)) return;

        setLoading(true);
        try {
            await subscriberApi.deleteSubscriber(email);
            setSubscribersData(subscribersData.filter(s => s.email !== email));
            showSuccess('Subscriber deleted successfully');
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
            lists: subscriber.lists ? subscriber.lists.split(',').map(l => l.trim()).filter(Boolean) : []
        });
        setIsEditSubscriberModalOpen(true);
    };

    // ===== LIST HANDLERS =====

    const handleCreateList = async () => {
        if (!listFormData.name) return;

        setLoading(true);
        try {
            const newList = await subscriberApi.createList(
                listFormData.name,
                listFormData.description || undefined
            );

            setListsData([newList, ...listsData]);
            setIsAddListModalOpen(false);
            setListFormData({ name: '', description: '' });
            showSuccess(`List "${listFormData.name}" created successfully`);

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
        if (!editingList) return;

        setLoading(true);
        try {
            const updated = await subscriberApi.updateList(
                editingList.id,
                { name: listFormData.name, description: listFormData.description || undefined }
            );

            setListsData(listsData.map(l =>
                l.id === editingList.id ? updated : l
            ));

            setIsEditListModalOpen(false);
            setEditingList(null);
            setListFormData({ name: '', description: '' });
            showSuccess('List updated successfully');

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
        const list = listsData.find(l => l.id === id);
        if (!list || !confirm(`Are you sure you want to delete "${list.name}"? This will remove it from all subscribers.`)) return;

        setLoading(true);
        try {
            await subscriberApi.deleteList(id);
            setListsData(listsData.filter(l => l.id !== id));
            showSuccess('List deleted successfully');

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
        if (!bulkImportData.trim()) return;

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

            const subscribers = emails.map(email => ({
                email,
                name: undefined,
                listId: selectedListsForImport[0]
            }));

            const result = await subscriberApi.importSubscribers(subscribers);

            await loadData();
            setBulkImportData('');
            setSelectedListsForImport([]);
            showSuccess(`Imported ${result.added} subscriber(s). ${result.skipped > 0 ? `${result.skipped} skipped (duplicates).` : ''}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import subscribers');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'subscribers', label: 'Subscribers', count: subscribersData.length },
        { id: 'lists', label: 'Lists', count: listsData.length },
        { id: 'import', label: 'Bulk Import', count: null },
    ];

    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="font-display text-h1 text-ink">
                            Subscriber Management
                        </h1>
                        <p className="font-serif text-body text-slate mt-2">
                            Manage your subscriber lists and organize them into groups for targeted newsletters
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
                    >
                        <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </header>

            {/* Messages */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-50 border-l-2 border-editorial-red p-4 flex items-start justify-between"
                    >
                        <div className="flex items-start gap-3">
                            <span className="font-sans text-ui font-medium text-editorial-red">Error:</span>
                            <span className="font-sans text-ui text-charcoal">{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="text-editorial-red hover:text-red-800">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </motion.div>
                )}

                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-pearl border-l-2 border-ink p-4 flex items-center gap-3"
                    >
                        <CheckIcon className="h-5 w-5 text-ink flex-shrink-0" />
                        <span className="font-sans text-ui text-ink">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading Indicator */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin" />
                </div>
            )}

            {!loading && (
                <>
                    {/* Tab Navigation */}
                    <nav className="flex gap-8 border-b border-border-subtle">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`relative pb-4 font-sans text-ui transition-colors ${
                                    activeTab === tab.id
                                        ? 'text-ink font-medium'
                                        : 'text-slate hover:text-ink'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== null && (
                                    <span className="ml-2 text-caption text-slate">({tab.count})</span>
                                )}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-editorial-red"
                                    />
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* SUBSCRIBERS TAB */}
                    {activeTab === 'subscribers' && (
                        <div className="space-y-6">
                            {/* Toolbar */}
                            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                                <div className="flex flex-col md:flex-row gap-3 flex-1 w-full lg:w-auto">
                                    <input
                                        type="text"
                                        placeholder="Search by email or name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 bg-pearl border border-border-subtle px-4 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
                                    />
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as any)}
                                        className="bg-pearl border border-border-subtle px-4 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                    <select
                                        value={filterList}
                                        onChange={(e) => setFilterList(e.target.value)}
                                        className="bg-pearl border border-border-subtle px-4 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                                    >
                                        <option value="">All Lists</option>
                                        {listsData.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={() => {
                                        setFormData({ email: '', name: '', lists: [] });
                                        setIsAddSubscriberModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors whitespace-nowrap"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Subscriber
                                </button>
                            </div>

                            {/* Subscribers Table */}
                            <div className="bg-paper border border-border-subtle overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border-subtle bg-pearl">
                                                <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">Lists</th>
                                                <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">Added</th>
                                                <th className="px-6 py-4 text-center font-sans text-caption text-slate uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {filteredSubscribers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center font-serif text-body text-slate">
                                                        No subscribers found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredSubscribers.map((sub) => (
                                                    <tr key={sub.email} className="hover:bg-pearl transition-colors">
                                                        <td className="px-6 py-4 font-sans text-ui font-medium text-ink">{sub.email}</td>
                                                        <td className="px-6 py-4 font-sans text-ui text-charcoal">{sub.name || '—'}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`font-sans text-caption px-2 py-1 ${
                                                                sub.status === 'active'
                                                                    ? 'bg-pearl text-ink'
                                                                    : 'bg-pearl text-slate'
                                                            }`}>
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {sub.lists ? sub.lists.split(',').filter(Boolean).map(lid => {
                                                                const list = listsData.find(l => l.id === lid.trim());
                                                                return (
                                                                    <span
                                                                        key={lid}
                                                                        className="inline-block mr-1 px-2 py-1 bg-pearl text-ink font-sans text-caption"
                                                                    >
                                                                        {list?.name || lid.trim()}
                                                                    </span>
                                                                );
                                                            }) : '—'}
                                                        </td>
                                                        <td className="px-6 py-4 font-sans text-caption text-slate">
                                                            {new Date(sub.dateAdded).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => openEditSubscriberModal(sub)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 font-sans text-caption text-editorial-navy hover:underline"
                                                            >
                                                                <EditIcon className="h-3 w-3" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubscriber(sub.email)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 font-sans text-caption text-editorial-red hover:underline ml-2"
                                                            >
                                                                <TrashIcon className="h-3 w-3" />
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
                            <button
                                onClick={() => {
                                    setListFormData({ name: '', description: '' });
                                    setIsAddListModalOpen(true);
                                }}
                                className="flex items-center gap-2 bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Create New List
                            </button>

                            {listsData.length === 0 ? (
                                <div className="bg-paper border border-border-subtle p-12 text-center">
                                    <UsersIcon className="h-12 w-12 mx-auto text-silver mb-4" />
                                    <p className="font-serif text-body text-slate">
                                        No lists created yet. Create one to organize your subscribers.
                                    </p>
                                </div>
                            ) : (
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                                >
                                    {listsData.map((list) => (
                                        <motion.div
                                            key={list.id}
                                            variants={staggerItem}
                                            className="bg-paper border border-border-subtle p-6"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-display text-h3 text-ink">{list.name}</h3>
                                                    {list.description && (
                                                        <p className="font-serif text-body text-slate mt-1">{list.description}</p>
                                                    )}
                                                </div>
                                                <span className="font-sans text-caption text-slate bg-pearl px-2 py-1">
                                                    {list.id}
                                                </span>
                                            </div>
                                            <div className="pt-4 border-t border-border-subtle mb-4">
                                                <p className="font-sans text-ui text-slate">
                                                    Members: <span className="font-medium text-ink">{list.subscriberCount}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => openEditListModal(list)}
                                                    className="flex-1 flex items-center justify-center gap-2 border border-border-subtle px-3 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors"
                                                >
                                                    <EditIcon className="h-4 w-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteList(list.id)}
                                                    className="flex-1 flex items-center justify-center gap-2 border border-editorial-red text-editorial-red px-3 py-2 font-sans text-ui hover:bg-editorial-red hover:text-paper transition-colors"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* BULK IMPORT TAB */}
                    {activeTab === 'import' && (
                        <div className="bg-paper border border-border-subtle p-8 space-y-6">
                            <div>
                                <h2 className="font-display text-h2 text-ink mb-2">Bulk Import Subscribers</h2>
                                <p className="font-serif text-body text-slate">
                                    Paste email addresses (one per line, comma-separated, or semicolon-separated). Max 100 at a time.
                                </p>
                            </div>

                            <div>
                                <label className="block font-sans text-ui font-medium text-ink mb-2">
                                    Email Addresses
                                </label>
                                <textarea
                                    value={bulkImportData}
                                    onChange={(e) => setBulkImportData(e.target.value)}
                                    placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                                    className="w-full h-48 p-4 bg-pearl border border-border-subtle font-mono text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block font-sans text-ui font-medium text-ink mb-3">
                                    Add to Lists (Optional)
                                </label>
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
                                            className={`px-4 py-2 font-sans text-ui transition-colors ${
                                                selectedListsForImport.includes(list.id)
                                                    ? 'bg-ink text-paper'
                                                    : 'border border-border-subtle text-ink hover:bg-pearl'
                                            }`}
                                        >
                                            {list.name}
                                        </button>
                                    ))}
                                </div>
                                {listsData.length === 0 && (
                                    <p className="font-serif text-body text-slate italic mt-2">
                                        Create lists first to add subscribers to them during import.
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleBulkImport}
                                disabled={!bulkImportData.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-ink text-paper font-sans text-ui font-medium py-3 px-4 hover:bg-charcoal disabled:bg-silver transition-colors"
                            >
                                <UploadIcon className="h-4 w-4" />
                                Import Subscribers
                            </button>
                        </div>
                    )}

                    {/* MODALS */}

                    {/* Add/Edit Subscriber Modal */}
                    <AnimatePresence>
                        {(isAddSubscriberModalOpen || isEditSubscriberModalOpen) && (
                            <motion.div
                                variants={modalOverlay}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                                onClick={() => {
                                    setIsAddSubscriberModalOpen(false);
                                    setIsEditSubscriberModalOpen(false);
                                    setFormData({ email: '', name: '', lists: [] });
                                }}
                            >
                                <motion.div
                                    variants={modalContent}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="bg-paper border border-border-subtle p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="font-display text-h2 text-ink">
                                            {isAddSubscriberModalOpen ? 'Add Subscriber' : 'Edit Subscriber'}
                                        </h2>
                                        <button
                                            onClick={() => {
                                                setIsAddSubscriberModalOpen(false);
                                                setIsEditSubscriberModalOpen(false);
                                                setFormData({ email: '', name: '', lists: [] });
                                            }}
                                            className="text-slate hover:text-ink transition-colors"
                                        >
                                            <XIcon className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block font-sans text-ui font-medium text-ink mb-2">
                                                Email Address *
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={isEditSubscriberModalOpen}
                                                placeholder="user@example.com"
                                                className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink disabled:bg-pearl disabled:text-slate"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-sans text-ui font-medium text-ink mb-2">Name</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="John Doe"
                                                className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-sans text-ui font-medium text-ink mb-3">Add to Lists</label>
                                            <div className="space-y-2">
                                                {listsData.map(list => (
                                                    <label key={list.id} className="flex items-center gap-3 cursor-pointer">
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
                                                            className="w-4 h-4 border-border-subtle accent-ink"
                                                        />
                                                        <span className="font-sans text-ui text-ink">{list.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            {listsData.length === 0 && (
                                                <p className="font-serif text-body text-slate italic">No lists available.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-8">
                                        <button
                                            onClick={() => {
                                                setIsAddSubscriberModalOpen(false);
                                                setIsEditSubscriberModalOpen(false);
                                                setFormData({ email: '', name: '', lists: [] });
                                            }}
                                            className="flex-1 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={isAddSubscriberModalOpen ? handleAddSubscriber : handleUpdateSubscriber}
                                            disabled={!formData.email}
                                            className="flex-1 bg-ink text-paper px-4 py-2 font-sans text-ui hover:bg-charcoal disabled:bg-silver transition-colors"
                                        >
                                            {isAddSubscriberModalOpen ? 'Add' : 'Update'}
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Add/Edit List Modal */}
                    <AnimatePresence>
                        {(isAddListModalOpen || isEditListModalOpen) && (
                            <motion.div
                                variants={modalOverlay}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                                onClick={() => {
                                    setIsAddListModalOpen(false);
                                    setIsEditListModalOpen(false);
                                    setListFormData({ name: '', description: '' });
                                }}
                            >
                                <motion.div
                                    variants={modalContent}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="bg-paper border border-border-subtle p-8 max-w-md w-full"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="font-display text-h2 text-ink">
                                            {isAddListModalOpen ? 'Create List' : 'Edit List'}
                                        </h2>
                                        <button
                                            onClick={() => {
                                                setIsAddListModalOpen(false);
                                                setIsEditListModalOpen(false);
                                                setListFormData({ name: '', description: '' });
                                            }}
                                            className="text-slate hover:text-ink transition-colors"
                                        >
                                            <XIcon className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block font-sans text-ui font-medium text-ink mb-2">
                                                List Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={listFormData.name}
                                                onChange={(e) => setListFormData({ ...listFormData, name: e.target.value })}
                                                placeholder="e.g., VIP Subscribers"
                                                className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-sans text-ui font-medium text-ink mb-2">Description</label>
                                            <textarea
                                                value={listFormData.description}
                                                onChange={(e) => setListFormData({ ...listFormData, description: e.target.value })}
                                                placeholder="Describe this list..."
                                                rows={3}
                                                className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-8">
                                        <button
                                            onClick={() => {
                                                setIsAddListModalOpen(false);
                                                setIsEditListModalOpen(false);
                                                setListFormData({ name: '', description: '' });
                                            }}
                                            className="flex-1 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={isAddListModalOpen ? handleCreateList : handleUpdateList}
                                            disabled={!listFormData.name}
                                            className="flex-1 bg-ink text-paper px-4 py-2 font-sans text-ui hover:bg-charcoal disabled:bg-silver transition-colors"
                                        >
                                            {isAddListModalOpen ? 'Create' : 'Update'}
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </motion.div>
    );
};
