'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FolderOpen, Upload, Trash2, Search, FileText, File, X, Download, Layers3, Clock3, Tag, ArrowUpRight } from 'lucide-react';

const CATEGORIES = [
  { value: 'shareholder_letter', label: 'Shareholder Letters' },
  { value: 'equity_research', label: 'Equity Research' },
  { value: 'investor_memo', label: 'Investor Memos' },
  { value: 'financial_model', label: 'Financial Models' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS = {
  shareholder_letter: 'bg-blue-50 text-blue-700 border-blue-200',
  equity_research: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  investor_memo: 'bg-violet-50 text-violet-700 border-violet-200',
  financial_model: 'bg-amber-50 text-amber-700 border-amber-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DocumentCard({ doc, confirmDeleteId, setConfirmDeleteId, handleDelete }) {
  const catLabel = CATEGORIES.find(c => c.value === doc.category)?.label || doc.category;
  const catColor = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other;
  const isPdf = doc.file_type?.includes('pdf');
  const isImage = doc.file_type?.startsWith('image/');

  return (
    <div className="bg-white rounded-[24px] border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
          {isPdf ? <FileText size={22} className="text-red-500" /> :
           isImage ? <File size={22} className="text-blue-500" /> :
           <File size={22} className="text-gray-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">{doc.title || doc.file_name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>
                  {catLabel}
                </span>
                <span className="text-[11px] text-gray-400">{formatDate(doc.uploaded_at)}</span>
                <span className="text-[11px] text-gray-400">{formatFileSize(doc.file_size)}</span>
                {doc.ticker && (
                  <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    {doc.ticker}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Open"
              >
                <Download size={16} />
              </a>
              {confirmDeleteId === doc.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg"
                  >
                    No
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-[11px] font-semibold text-white bg-red-500 px-2 py-1 rounded-lg"
                  >
                    Yes
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-gray-50/80 border border-gray-100 px-4 py-3 min-h-[72px]">
            {doc.notes ? (
              <p className="text-sm text-gray-600 leading-relaxed">{doc.notes}</p>
            ) : (
              <p className="text-sm text-gray-400">No notes attached.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadTicker, setUploadTicker] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('category', uploadCategory);
      formData.append('ticker', uploadTicker);
      formData.append('notes', uploadNotes);

      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.document) {
        setDocuments(prev => [data.document, ...prev]);
      }

      setUploadTitle('');
      setUploadCategory('other');
      setUploadTicker('');
      setUploadNotes('');
      setUploadFile(null);
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
      setConfirmDeleteId(null);
    } catch {
      // silent
    }
  };

  const filtered = useMemo(() => (
    documents
      .filter(d => {
        if (filterCategory && d.category !== filterCategory) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            (d.title || '').toLowerCase().includes(q) ||
            (d.ticker || '').toLowerCase().includes(q) ||
            (d.notes || '').toLowerCase().includes(q) ||
            (d.file_name || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.uploaded_at) - new Date(a.uploaded_at);
        if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '');
        if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
        return 0;
      })
  ), [documents, filterCategory, searchQuery, sortBy]);

  const groupedDocuments = useMemo(() => (
    CATEGORIES.map(category => ({
      ...category,
      documents: filtered.filter(doc => doc.category === category.value),
    })).filter(group => group.documents.length > 0)
  ), [filtered]);

  const recentDocuments = filtered.slice(0, 5);

  const stats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + (Number(doc.file_size) || 0), 0);
    const withTickers = documents.filter(doc => doc.ticker).length;
    const activeCategories = CATEGORIES.filter(category =>
      documents.some(doc => doc.category === category.value)
    ).length;

    return { totalSize, withTickers, activeCategories };
  }, [documents]);

  if (loading) {
    return (
      <div className="min-h-screen px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 lg:px-12 pb-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Organize research artifacts by type, ticker, and workflow stage
            </p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <Upload size={15} />
            Upload Document
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 mb-8">
          <div className="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,#f7fdf9_0%,#ffffff_58%,#eefaf4_100%)] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Document Hub</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-2">Split files by workflow, not just filename.</h2>
                <p className="text-sm text-gray-600 mt-3 max-w-2xl">
                  Keep letters, research, memos, and models in clearly separated lanes so retrieval is fast when you are moving between watchlist work, research, and position review.
                </p>
              </div>
              <div className="hidden md:flex h-14 w-14 items-center justify-center rounded-2xl bg-white/85 border border-emerald-200 shadow-sm">
                <FolderOpen size={26} className="text-emerald-600" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <Layers3 size={14} />
                  Total Files
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{documents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <Tag size={14} />
                  Tagged
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.withTickers}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <FolderOpen size={14} />
                  Categories
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.activeCategories}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <Download size={14} />
                  Stored
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{formatFileSize(stats.totalSize) || '0 B'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Recent Uploads</h2>
            </div>
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-gray-400">No recent files yet.</p>
            ) : (
              <div className="space-y-3">
                {recentDocuments.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.title || doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}</span>
                        <span>•</span>
                        <span>{formatDate(doc.uploaded_at)}</span>
                        {doc.ticker && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-gray-700">{doc.ticker}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {showUpload && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Document title..."
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Category</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Related Ticker (optional)</label>
                <input
                  type="text"
                  value={uploadTicker}
                  onChange={e => setUploadTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. AMZN"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Notes (optional)</label>
              <textarea
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
                placeholder="Any notes about this document..."
                rows={2}
                className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors"
              >
                <Upload size={14} />
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mb-8">
          <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Search & Filters</h2>
            </div>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search documents, notes, or tickers..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
                />
              </div>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all min-w-[200px]"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all min-w-[180px]"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="category">Sort by Category</option>
              </select>
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 mb-3">Category Split</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => {
                const count = documents.filter(doc => doc.category === category.value).length;
                return (
                  <button
                    key={category.value}
                    onClick={() => setFilterCategory(prev => prev === category.value ? '' : category.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filterCategory === category.value
                        ? `${CATEGORY_COLORS[category.value] || CATEGORY_COLORS.other}`
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {category.label} · {count}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-500">
              {documents.length === 0 ? 'No documents yet' : 'No matches found'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {documents.length === 0 ? 'Upload your first document to get started' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedDocuments.map(group => (
              <section key={group.value}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${CATEGORY_COLORS[group.value] || CATEGORY_COLORS.other}`}>
                      {group.label}
                    </span>
                    <span className="text-sm text-gray-400">{group.documents.length} file{group.documents.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {group.documents.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      confirmDeleteId={confirmDeleteId}
                      setConfirmDeleteId={setConfirmDeleteId}
                      handleDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
