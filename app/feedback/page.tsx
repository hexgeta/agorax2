'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import { ChevronUp, MessageSquare, Plus, X, Send, Filter, Loader2, Shield, Trash2, Copy, ArrowRight } from 'lucide-react';

// Deterministic username color from string — avoids amber (admin-only)
const USERNAME_COLORS = [
  'text-blue-400', 'text-emerald-400', 'text-violet-400', 'text-rose-400',
  'text-cyan-400', 'text-pink-400', 'text-teal-400', 'text-indigo-400',
  'text-lime-400', 'text-fuchsia-400', 'text-sky-400', 'text-orange-300',
  'text-green-400', 'text-purple-400', 'text-red-300', 'text-yellow-300',
];

function getUsernameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length];
}

// Types
interface FeedbackPost {
  id: number;
  title: string;
  description: string | null;
  category: 'feature' | 'bug' | 'improvement' | 'question' | 'whitelist';
  status: 'open' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'declined' | 'duplicate';
  wallet_address: string;
  vote_count: number;
  comment_count: number;
  duplicate_of: number | null;
  token_ticker: string | null;
  token_contract_address: string | null;
  is_tax_token: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  post_id: number;
  wallet_address: string;
  content: string;
  created_at: string;
}

const CATEGORY_CONFIG = {
  feature: { label: 'Feature Request', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
  bug: { label: 'Bug Report', color: 'text-red-400 bg-red-500/20 border-red-500/30' },
  improvement: { label: 'Improvement', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
  question: { label: 'Question', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' },
  whitelist: { label: 'Whitelist Request', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-gray-400 bg-gray-500/20' },
  under_review: { label: 'Under Review', color: 'text-yellow-400 bg-yellow-500/20' },
  planned: { label: 'Planned', color: 'text-blue-400 bg-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'text-orange-400 bg-orange-500/20' },
  completed: { label: 'Completed', color: 'text-green-400 bg-green-500/20' },
  declined: { label: 'Declined', color: 'text-red-400 bg-red-500/20' },
  duplicate: { label: 'Duplicate', color: 'text-gray-400 bg-gray-500/20' },
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function FeedbackPage() {
  const { address, isConnected } = useAccount();
  const { sessionToken, isVerified, verify } = useWalletAuth();

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  }, [sessionToken]);

  // State
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [userVotes, setUserVotes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'popular' | 'newest' | 'oldest'>('popular');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 20 });

  // New post form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>('feature');
  const [submitting, setSubmitting] = useState(false);
  const [newTokenTicker, setNewTokenTicker] = useState('');
  const [newContractAddress, setNewContractAddress] = useState('');
  const [newIsTaxToken, setNewIsTaxToken] = useState<boolean | null>(null);

  // Comment form
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Voting state
  const [votingPost, setVotingPost] = useState<number | null>(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminActionPost, setAdminActionPost] = useState<number | null>(null);
  const [duplicateIdInput, setDuplicateIdInput] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [duplicateOriginals, setDuplicateOriginals] = useState<Record<number, { id: number; title: string }>>({});

  // Check admin status when wallet connects
  useEffect(() => {
    if (!address) { setIsAdmin(false); return; }
    fetch(`/api/admin/feedback?wallet=${address}`)
      .then(res => res.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [address]);

  const fetchPosts = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      sort,
      page: page.toString(),
      limit: '20',
    });
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (address) params.set('wallet', address);

    try {
      const res = await fetch(`/api/feedback?${params}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
        setUserVotes(data.userVotes || []);
        setDuplicateOriginals(data.duplicateOriginals || {});
        setPagination(data.pagination);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sort, categoryFilter, statusFilter, address]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleVote = async (postId: number) => {
    if (!isConnected || !address) return;
    if (!isVerified) { await verify(); return; }
    setVotingPost(postId);

    try {
      const res = await fetch('/api/feedback/vote', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, vote_count: p.vote_count + (data.voted ? 1 : -1) };
          }
          return p;
        }));
        setUserVotes(prev =>
          data.voted ? [...prev, postId] : prev.filter(id => id !== postId)
        );
      }
    } catch {
      // silently fail
    } finally {
      setVotingPost(null);
    }
  };

  const handleSubmitPost = async () => {
    if (!isConnected || !address || !newTitle.trim()) return;
    if (!isVerified) { await verify(); return; }
    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          category: newCategory,
          ...(newCategory === 'whitelist' && {
            token_ticker: newTokenTicker.trim(),
            token_contract_address: newContractAddress.trim(),
            is_tax_token: newIsTaxToken === true,
          }),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewPost(false);
        setNewTitle('');
        setNewDescription('');
        setNewCategory('feature');
        setNewTokenTicker('');
        setNewContractAddress('');
        setNewIsTaxToken(null);
        fetchPosts();
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const fetchComments = async (postId: number) => {
    setLoadingComments(postId);
    try {
      const res = await fetch(`/api/feedback/comment?post_id=${postId}`);
      const data = await res.json();
      if (data.success) {
        setComments(prev => ({ ...prev, [postId]: data.comments }));
      }
    } catch {
      // silently fail
    } finally {
      setLoadingComments(null);
    }
  };

  const handleToggleExpand = (postId: number) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      if (!comments[postId]) {
        fetchComments(postId);
      }
    }
  };

  const handleSubmitComment = async (postId: number) => {
    if (!isConnected || !address || !commentText.trim()) return;
    if (!isVerified) { await verify(); return; }
    setSubmittingComment(true);

    try {
      const res = await fetch('/api/feedback/comment', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          post_id: postId,
          content: commentText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCommentText('');
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment],
        }));
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
        ));
      }
    } catch {
      // silently fail
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAdminUpdateStatus = async (postId: number, status: string) => {
    if (!address) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ post_id: postId, action: 'update_status', status }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: status as FeedbackPost['status'], duplicate_of: null } : p));
        setAdminActionPost(null);
      }
    } catch { /* silently fail */ } finally { setAdminLoading(false); }
  };

  const handleAdminMarkDuplicate = async (postId: number) => {
    if (!address || !duplicateIdInput) return;
    const dupId = parseInt(duplicateIdInput);
    if (isNaN(dupId) || dupId === postId) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ post_id: postId, action: 'mark_duplicate', duplicate_of: dupId }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'duplicate' as const, duplicate_of: dupId } : p));
        if (data.original_post) {
          setDuplicateOriginals(prev => ({ ...prev, [dupId]: data.original_post }));
        }
        setAdminActionPost(null);
        setDuplicateIdInput('');
      }
    } catch { /* silently fail */ } finally { setAdminLoading(false); }
  };

  const handleAdminDelete = async (postId: number) => {
    if (!address || !confirm('Permanently delete this post and all its votes/comments?')) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setAdminActionPost(null);
      }
    } catch { /* silently fail */ } finally { setAdminLoading(false); }
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Feedback & Feature Requests</h1>
        <p className="text-gray-400">
          Share your ideas, report bugs, and vote on what matters most to you.
        </p>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Sort buttons */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(['popular', 'newest', 'oldest'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                sort === s
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            showFilters || categoryFilter || statusFilter
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
          }`}
        >
          <Filter size={14} />
          Filters
          {(categoryFilter || statusFilter) && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          )}
        </button>

        {/* New Post button */}
        <button
          onClick={() => setShowNewPost(true)}
          disabled={!isConnected}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          New Post
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <LiquidGlassCard className="p-4 rounded-xl">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setCategoryFilter('')}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        !categoryFilter ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setCategoryFilter(categoryFilter === key ? '' : key)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          categoryFilter === key ? cfg.color + ' border-current' : 'bg-white/5 text-gray-400 hover:text-white border-transparent'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setStatusFilter('')}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        !statusFilter ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                          statusFilter === key ? cfg.color : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Post Modal */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowNewPost(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg"
            >
              <LiquidGlassCard className="p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">New Feedback</h2>
                  <button onClick={() => setShowNewPost(false)} className="text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                {/* Category selector */}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setNewCategory(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          newCategory === key ? cfg.color + ' border-current' : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Short, descriptive title..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={200}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <textarea
                    placeholder="Describe your idea or issue in detail... (optional)"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    maxLength={5000}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 text-sm resize-none"
                  />
                </div>

                {/* Whitelist-specific fields */}
                {newCategory === 'whitelist' && (
                  <div className="mb-4 space-y-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Token Ticker *</label>
                      <input
                        type="text"
                        placeholder="e.g. HEX, PLSX, INC..."
                        value={newTokenTicker}
                        onChange={(e) => setNewTokenTicker(e.target.value)}
                        maxLength={20}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Contract Address *</label>
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newContractAddress}
                        onChange={(e) => setNewContractAddress(e.target.value)}
                        maxLength={42}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Is this a tax/fee on-transfer or rebasing token?
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewIsTaxToken(true)}
                          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                            newIsTaxToken === true
                              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                              : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewIsTaxToken(false)}
                          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                            newIsTaxToken === false
                              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                              : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmitPost}
                  disabled={submitting || !newTitle.trim() || newTitle.trim().length < 3 || (newCategory === 'whitelist' && (!newTokenTicker.trim() || !/^0x[a-fA-F0-9]{40}$/.test(newContractAddress.trim()) || newIsTaxToken === null))}
                  className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                  Submit Feedback
                </button>
              </LiquidGlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-500" />
        </div>
      ) : posts.length === 0 ? (
        <LiquidGlassCard className="p-12 rounded-2xl text-center">
          <p className="text-gray-400 text-lg mb-2">No feedback yet</p>
          <p className="text-gray-500 text-sm">Be the first to share your ideas!</p>
        </LiquidGlassCard>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <LiquidGlassCard className="rounded-xl overflow-hidden">
                <div className="flex">
                  {/* Vote button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleVote(post.id); }}
                    disabled={!isConnected || votingPost === post.id}
                    className={`flex flex-col items-center justify-center px-4 py-4 min-w-[64px] border-r border-white/5 transition-colors ${
                      userVotes.includes(post.id)
                        ? 'bg-purple-500/10 text-purple-400'
                        : 'bg-white/[0.02] text-gray-500 hover:text-white hover:bg-white/5'
                    } disabled:cursor-not-allowed`}
                  >
                    <ChevronUp size={18} className={userVotes.includes(post.id) ? 'text-purple-400' : ''} />
                    <span className="text-sm font-semibold">{post.vote_count}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    <div
                      className="cursor-pointer"
                      onClick={() => handleToggleExpand(post.id)}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_CONFIG[post.category].color}`}>
                          {CATEGORY_CONFIG[post.category].label}
                        </span>
                        {post.status !== 'open' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_CONFIG[post.status].color}`}>
                            {STATUS_CONFIG[post.status].label}
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-medium text-sm mb-1 line-clamp-1">{post.title}</h3>
                      {post.status === 'duplicate' && post.duplicate_of && duplicateOriginals[post.duplicate_of] && (
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Copy size={10} />
                          Duplicate of #{post.duplicate_of}: {duplicateOriginals[post.duplicate_of].title}
                        </p>
                      )}
                      {post.description && (
                        <p className="text-gray-400 text-xs line-clamp-2 mb-2">{post.description}</p>
                      )}
                      {post.category === 'whitelist' && post.token_ticker && (
                        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">{post.token_ticker}</span>
                          {post.token_contract_address && (
                            <span className="text-gray-500 font-mono">{post.token_contract_address.slice(0, 6)}...{post.token_contract_address.slice(-4)}</span>
                          )}
                          {post.is_tax_token !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${post.is_tax_token ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-400'}`}>
                              {post.is_tax_token ? 'Tax/Fee Token' : 'Standard Token'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        {post.wallet_address === 'Admin' ? (
                          <span className="font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            Admin
                          </span>
                        ) : (
                          <span className={`font-medium ${getUsernameColor(post.wallet_address)}`}>
                            {post.wallet_address}
                          </span>
                        )}
                        <span>{timeAgo(post.created_at)}</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {post.comment_count}
                        </span>
                        <span className="text-gray-600">#{post.id}</span>
                      </div>
                    </div>

                    {/* Admin controls */}
                    {isAdmin && (
                      <div className="mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setAdminActionPost(adminActionPost === post.id ? null : post.id); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                        >
                          <Shield size={10} />
                          Admin
                        </button>

                        <AnimatePresence>
                          {adminActionPost === post.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-3">
                                {/* Status update */}
                                <div>
                                  <label className="text-[10px] text-amber-400/70 uppercase tracking-wider block mb-1">Set Status</label>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'duplicate').map(([key, cfg]) => (
                                      <button
                                        key={key}
                                        onClick={() => handleAdminUpdateStatus(post.id, key)}
                                        disabled={adminLoading || post.status === key}
                                        className={`px-2 py-0.5 rounded text-[10px] transition-colors disabled:opacity-30 ${
                                          post.status === key ? cfg.color + ' font-medium' : 'bg-white/5 text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        {cfg.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Mark as duplicate */}
                                <div>
                                  <label className="text-[10px] text-amber-400/70 uppercase tracking-wider block mb-1">Mark as Duplicate</label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="number"
                                      placeholder="Original post #ID"
                                      value={duplicateIdInput}
                                      onChange={(e) => setDuplicateIdInput(e.target.value)}
                                      className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white placeholder-gray-600 text-xs focus:outline-none focus:border-amber-500/50 w-24"
                                    />
                                    <button
                                      onClick={() => handleAdminMarkDuplicate(post.id)}
                                      disabled={adminLoading || !duplicateIdInput}
                                      className="px-2 py-1 rounded text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 flex items-center gap-1"
                                    >
                                      <ArrowRight size={10} />
                                      Link
                                    </button>
                                  </div>
                                </div>

                                {/* Delete */}
                                <button
                                  onClick={() => handleAdminDelete(post.id)}
                                  disabled={adminLoading}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-30 transition-colors"
                                >
                                  <Trash2 size={10} />
                                  Delete Post
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Expanded: Comments */}
                    <AnimatePresence>
                      {expandedPost === post.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-white/5">
                            {loadingComments === post.id ? (
                              <div className="flex justify-center py-4">
                                <Loader2 size={16} className="animate-spin text-gray-500" />
                              </div>
                            ) : (
                              <>
                                {/* Comments list */}
                                {(comments[post.id] || []).length === 0 ? (
                                  <p className="text-gray-500 text-xs py-2">No comments yet</p>
                                ) : (
                                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                                    {(comments[post.id] || []).map((comment) => (
                                      <div key={comment.id} className="text-xs">
                                        <div className="flex items-center gap-2 text-gray-500 mb-0.5">
                                          {comment.wallet_address === 'Admin' ? (
                                            <span className="font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                                              Admin
                                            </span>
                                          ) : (
                                            <span className={`font-medium ${getUsernameColor(comment.wallet_address)}`}>
                                              {comment.wallet_address}
                                            </span>
                                          )}
                                          <span>{timeAgo(comment.created_at)}</span>
                                        </div>
                                        <p className="text-gray-300">{comment.content}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add comment */}
                                {isConnected ? (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Add a comment..."
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                                      maxLength={2000}
                                      className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-xs"
                                    />
                                    <button
                                      onClick={() => handleSubmitComment(post.id)}
                                      disabled={submittingComment || !commentText.trim()}
                                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs transition-colors disabled:opacity-40"
                                    >
                                      {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-xs">Connect wallet to comment</p>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </LiquidGlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => fetchPosts(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            onClick={() => fetchPosts(pagination.page + 1)}
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Connect wallet notice */}
      {!isConnected && (
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">Connect your wallet to submit feedback and vote</p>
        </div>
      )}
    </div>
  );
}
