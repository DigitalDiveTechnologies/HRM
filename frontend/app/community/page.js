'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate } from '../../lib/format';

export default function CommunityPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'polls' | 'events'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Feed State
  const [posts, setPosts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postingBusy, setPostingBusy] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [openComments, setOpenComments] = useState({}); // { [postId]: true/false }
  const [commentInputs, setCommentInputs] = useState({}); // { [postId]: string }

  // Polls State
  const [polls, setPolls] = useState([]);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [newPollExpiry, setNewPollExpiry] = useState('');
  const [votingBusy, setVotingBusy] = useState({});

  // Events State
  const [events, setEvents] = useState([]);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: '',
    maxAttendees: ''
  });
  const [rsvpBusy, setRsvpBusy] = useState({});

  // Event Attendees State
  const [attendeesModalOpen, setAttendeesModalOpen] = useState(false);
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState(null);
  const [attendeesList, setAttendeesList] = useState([]);
  const [attendeesSummary, setAttendeesSummary] = useState({ attending: 0, maybe: 0, declined: 0, total: 0 });
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesFilter, setAttendeesFilter] = useState('all');
  const [attendeesSearch, setAttendeesSearch] = useState('');

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const openAttendeesModal = async (ev) => {
    setSelectedEventForAttendees(ev);
    setAttendeesModalOpen(true);
    setAttendeesLoading(true);
    setAttendeesFilter('all');
    setAttendeesSearch('');
    try {
      const data = await api(`/community/events/${ev.id}/attendees`);
      setAttendeesList(Array.isArray(data.attendees) ? data.attendees : []);
      setAttendeesSummary({
        attending: data.attending_count || 0,
        maybe: data.maybe_count || 0,
        declined: data.declined_count || 0,
        total: data.total_rsvps || 0
      });
    } catch (e) {
      console.error('Failed to load attendees:', e);
      setAttendeesList([]);
    } finally {
      setAttendeesLoading(false);
    }
  };

  const filteredAttendees = attendeesList.filter((a) => {
    if (attendeesFilter !== 'all' && (a.status || '').toLowerCase() !== attendeesFilter) {
      return false;
    }
    if (attendeesSearch.trim()) {
      const q = attendeesSearch.toLowerCase();
      const name = (a.full_name || '').toLowerCase();
      const code = (a.employee_code || '').toLowerCase();
      const dept = (a.department_name || '').toLowerCase();
      const job = (a.job_title || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !dept.includes(q) && !job.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Loaders
  const loadFeed = useCallback(async () => {
    try {
      const data = await api('/community/feed');
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load feed:', e);
    }
  }, []);

  const loadPolls = useCallback(async () => {
    try {
      const data = await api('/community/polls');
      setPolls(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load polls:', e);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await api('/community/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load events:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadFeed(), loadPolls(), loadEvents()]);
    } catch (e) {
      setError(e.message || 'Failed to load community data');
    } finally {
      setLoading(false);
    }
  }, [loadFeed, loadPolls, loadEvents]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Feed Actions
  // Task 5.5: Direct Binary Social Image Upload
  const handleImageUpload = async (file) => {
    if (!file) return;
    setImageUploadBusy(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/community/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload photo');
      }
      const data = await res.json();
      setPostImageUrl(data.imageUrl || data.url);
      showSuccess('Photo uploaded and attached to post.');
    } catch (err) {
      setError(err.message || 'Error uploading photo');
    } finally {
      setImageUploadBusy(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    setPostingBusy(true);
    setError('');
    try {
      await api('/community/posts', {
        method: 'POST',
        body: JSON.stringify({
          post_type: postType,
          content: postContent.trim(),
          image_url: postImageUrl.trim() || null
        })
      });
      setPostContent('');
      setPostImageUrl('');
      setPostType('general');
      showSuccess('Post shared successfully!');
      await loadFeed();
    } catch (err) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setPostingBusy(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const willLike = !p.userHasLiked;
          return {
            ...p,
            userHasLiked: willLike,
            likesCount: willLike ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
          };
        })
      );
      const res = await api(`/community/posts/${postId}/like`, { method: 'POST' });
      if (res) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, userHasLiked: res.liked, likesCount: res.likes_count }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      loadFeed(); // Rollback on failure
    }
  };

  const handleAddComment = async (postId) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    try {
      const res = await api(`/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ commentText: text })
      });
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      if (res) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, comments: [...(p.comments || []), res] }
              : p
          )
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to post comment');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await api(`/community/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showSuccess('Post removed.');
    } catch (err) {
      setError(err.message || 'Failed to delete post');
    }
  };

  // Polls Actions
  const handleVote = async (pollId, optionId) => {
    setVotingBusy((prev) => ({ ...prev, [pollId]: true }));
    try {
      await api(`/community/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ selectedOptionId: optionId })
      });
      showSuccess('Your vote has been recorded!');
      await loadPolls();
    } catch (err) {
      setError(err.message || 'Failed to record vote');
    } finally {
      setVotingBusy((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const opts = newPollOptions.map((o) => o.trim()).filter(Boolean);
    if (!newPollQuestion.trim() || opts.length < 2) {
      setError('Please provide a question and at least 2 voting options.');
      return;
    }

    try {
      await api('/community/polls', {
        method: 'POST',
        body: JSON.stringify({
          question: newPollQuestion.trim(),
          options: opts,
          expiresAt: newPollExpiry || null
        })
      });
      setPollModalOpen(false);
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      setNewPollExpiry('');
      showSuccess('Poll created and published!');
      await loadPolls();
    } catch (err) {
      setError(err.message || 'Failed to create poll');
    }
  };

  const handleDeletePoll = async (pollId) => {
    if (!window.confirm('Delete this pulse poll?')) return;
    try {
      await api(`/community/polls/${pollId}`, { method: 'DELETE' });
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
      showSuccess('Poll deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete poll');
    }
  };

  // Events Actions
  const handleRsvp = async (eventId, status) => {
    setRsvpBusy((prev) => ({ ...prev, [eventId]: true }));
    try {
      await api(`/community/events/${eventId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showSuccess(`RSVP updated: ${status.toUpperCase()}`);
      await loadEvents();
    } catch (err) {
      setError(err.message || 'Failed to submit RSVP');
    } finally {
      setRsvpBusy((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.eventDate || !newEvent.location.trim()) {
      setError('Please fill in Event Title, Date & Time, and Location.');
      return;
    }

    try {
      await api('/community/events', {
        method: 'POST',
        body: JSON.stringify({
          title: newEvent.title.trim(),
          description: newEvent.description.trim() || null,
          eventDate: new Date(newEvent.eventDate).toISOString(),
          location: newEvent.location.trim(),
          maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees, 10) : null
        })
      });
      setEventModalOpen(false);
      setNewEvent({ title: '', description: '', eventDate: '', location: '', maxAttendees: '' });
      showSuccess('Company Event scheduled!');
      await loadEvents();
    } catch (err) {
      setError(err.message || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Cancel and delete this corporate event?')) return;
    try {
      await api(`/community/events/${eventId}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      showSuccess('Event cancelled.');
    } catch (err) {
      setError(err.message || 'Failed to delete event');
    }
  };

  const getPostBadge = (type) => {
    switch (type) {
      case 'kudos':
        return { label: '⭐ Kudos & Recognition', bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)' };
      case 'celebration':
        return { label: '🎉 Celebration & Milestone', bg: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.3)' };
      default:
        return { label: '💬 General Update', bg: 'rgba(2, 132, 199, 0.12)', text: '#0284c7', border: 'rgba(2, 132, 199, 0.25)' };
    }
  };

  return (
    <AppShell
      title="Employee Community & Social Wall"
      subtitle="Connect with teammates, celebrate achievements, participate in polls, and join company events."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'polls' && (
            <button className="btn-primary" onClick={() => setPollModalOpen(true)}>
              + Create Pulse Poll
            </button>
          )}
          {activeTab === 'events' && (
            <button className="btn-primary" onClick={() => setEventModalOpen(true)}>
              + Create Event
            </button>
          )}
          <button className="btn-secondary" onClick={refreshAll}>
            Refresh
          </button>
        </div>
      }
    >
      {/* Toast Messages */}
      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            color: '#065f46',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontWeight: 600
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('feed')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: activeTab === 'feed' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'feed' ? '#0284c7' : 'var(--muted)'
          }}
        >
          📰 Social Wall ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab('polls')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: activeTab === 'polls' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'polls' ? '#0284c7' : 'var(--muted)'
          }}
        >
          📊 Pulse Polls ({polls.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: activeTab === 'events' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'events' ? '#0284c7' : 'var(--muted)'
          }}
        >
          🗓️ Corporate Events ({events.length})
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: SOCIAL WALL (FEED) */}
      {/* ============================================================ */}
      {activeTab === 'feed' && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: 20 }}>
          {/* Create Post Card */}
          <div className="panel-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Share an Update or Celebrate a Win</h3>
            <form onSubmit={handleCreatePost}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { key: 'general', label: '💬 General' },
                  { key: 'kudos', label: '⭐ Kudos' },
                  { key: 'celebration', label: '🎉 Celebration' }
                ].map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setPostType(type.key)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 20,
                      border: '1px solid',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      borderColor: postType === type.key ? '#00b8db' : 'var(--line, #cbd5e1)',
                      background: postType === type.key ? 'rgba(0, 184, 219, 0.12)' : 'var(--surface, #ffffff)',
                      color: postType === type.key ? '#00b8db' : 'var(--ink, #0f172a)'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                className="form-input"
                placeholder={
                  postType === 'kudos'
                    ? 'Give a shoutout to a colleague or team for their great work...'
                    : postType === 'celebration'
                    ? 'Share exciting team or milestone news...'
                    : "What's on your mind? Share an update with your colleagues..."
                }
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 14,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />

              {/* Task 5.5: Thumbnail preview when photo is attached */}
              {postImageUrl && (
                <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                  <img
                    src={postImageUrl}
                    alt="Post Attachment Preview"
                    style={{ maxHeight: 160, borderRadius: 8, border: '1px solid #cbd5e1', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => setPostImageUrl('')}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12
                    }}
                    title="Remove Photo"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      background: '#f1f5f9',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--brand)',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    📷 {imageUploadBusy ? 'Uploading…' : 'Attach Photo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: 'none' }}
                      disabled={imageUploadBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {!postImageUrl && (
                    <input
                      type="url"
                      className="form-input"
                      placeholder="Or paste photo URL..."
                      value={postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        flex: 1
                      }}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={postingBusy || imageUploadBusy || !postContent.trim()}
                  style={{ padding: '9px 22px', flexShrink: 0 }}
                >
                  {postingBusy ? 'Posting…' : 'Share Post'}
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading community feed…</div>
          ) : posts.length === 0 ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              No community posts yet. Be the first to share an update!
            </div>
          ) : (
            posts.map((post) => {
              const badge = getPostBadge(post.postType);
              const comments = post.comments || [];
              const isCommentsOpen = !!openComments[post.id];

              return (
                <div key={post.id} className="panel-card" style={{ padding: 20 }}>
                  {/* Post Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {post.authorName ? post.authorName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{post.authorName}</span>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              borderRadius: 12,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {post.jobTitle || 'Team Member'} {post.departmentName ? `• ${post.departmentName}` : ''} •{' '}
                          {formatDate(post.createdAt)}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete post"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          fontSize: 13,
                          padding: 4
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-line' }}>
                    {post.content}
                  </div>

                  {/* Optional Image */}
                  {post.imageUrl && (
                    <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img
                        src={post.imageUrl}
                        alt="Post media"
                        style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  )}

                  {/* Like & Comment Bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      borderTop: '1px solid var(--border)',
                      paddingTop: 12
                    }}
                  >
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        background: post.userHasLiked ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        color: post.userHasLiked ? '#ef4444' : 'var(--muted)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      <span>{post.userHasLiked ? '❤️' : '🤍'}</span>
                      <span>{post.likesCount || 0} {post.likesCount === 1 ? 'Like' : 'Likes'}</span>
                    </button>

                    <button
                      onClick={() => setOpenComments((prev) => ({ ...prev, [post.id]: !isCommentsOpen }))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      <span>💬</span>
                      <span>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {isCommentsOpen && (
                    <div style={{ marginTop: 14, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
                      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                        {comments.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                            No comments yet. Start the conversation!
                          </div>
                        ) : (
                          comments.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                background: 'var(--surface-muted, #f8fafc)',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 13
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontWeight: 600 }}>{c.authorName}</span>
                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(c.createdAt)}</span>
                              </div>
                              <div style={{ color: 'var(--foreground)' }}>{c.commentText}</div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Comment Input */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Write a comment…"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            fontSize: 13
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleAddComment(post.id)}
                          style={{ padding: '8px 16px', fontSize: 13 }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PULSE POLLS & LIVE VOTING */}
      {/* ============================================================ */}
      {activeTab === 'polls' && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading pulse polls…</div>
          ) : polls.length === 0 ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              No active polls. Click &quot;+ Create Pulse Poll&quot; to launch one.
            </div>
          ) : (
            polls.map((poll) => {
              const hasVoted = poll.userVotedOptionId != null;
              const isBusy = !!votingBusy[poll.id];

              return (
                <div key={poll.id} className="panel-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            background: poll.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            color: poll.isActive ? '#059669' : '#64748b',
                            borderRadius: 12,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700
                          }}
                        >
                          {poll.isActive ? 'ACTIVE POLL' : 'CLOSED'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Created by {poll.creatorName} • {formatDate(poll.createdAt)}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{poll.question}</h3>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePoll(poll.id)}
                        title="Delete poll"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {/* Poll Options */}
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {poll.Options &&
                      poll.Options.map((opt) => {
                        const isSelected = poll.userVotedOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => !isBusy && poll.isActive && handleVote(poll.id, opt.id)}
                            style={{
                              position: 'relative',
                              padding: '12px 16px',
                              borderRadius: 8,
                              border: isSelected ? '2px solid #0284c7' : '1px solid var(--border)',
                              background: 'var(--surface)',
                              cursor: poll.isActive ? 'pointer' : 'default',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Vote Progress Fill */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${opt.Percentage || 0}%`,
                                background: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'rgba(100, 116, 139, 0.08)',
                                transition: 'width 0.4s ease'
                              }}
                            />

                            <div
                              style={{
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                zIndex: 1
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    border: isSelected ? '5px solid #0284c7' : '2px solid var(--border)',
                                    display: 'inline-block'
                                  }}
                                />
                                <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: 14 }}>
                                  {opt.text}
                                </span>
                                {isSelected && (
                                  <span style={{ fontSize: 11, color: '#0284c7', fontWeight: 700 }}>
                                    ✓ Your Vote
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                                {opt.Percentage || 0}% ({opt.votesCount || 0})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                    Total Votes: <strong>{poll.totalVotes || 0}</strong>{' '}
                    {poll.expiresAt && `• Expires ${formatDate(poll.expiresAt)}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: CORPORATE EVENTS & RSVP */}
      {/* ============================================================ */}
      {activeTab === 'events' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', gridColumn: '1 / -1' }}>
              Loading company events…
            </div>
          ) : events.length === 0 ? (
            <div
              className="panel-card"
              style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', gridColumn: '1 / -1' }}
            >
              No upcoming company events scheduled.
            </div>
          ) : (
            events.map((ev) => {
              const eventDateObj = new Date(ev.eventDate);
              const month = eventDateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
              const day = eventDateObj.getDate();
              const myStatus = (ev.myRsvp || '').toLowerCase();
              const isBusy = !!rsvpBusy[ev.id];

              return (
                <div key={ev.id} className="panel-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                    {/* Date Badge */}
                    <div
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        borderRadius: 8,
                        width: 56,
                        height: 56,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{month}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{day}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{ev.title}</h3>
                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>📍 {ev.location}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        title="Delete event"
                        style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {ev.description && (
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, flex: 1 }}>
                      {ev.description}
                    </p>
                  )}

                  {/* Attendance Stats */}
                  <div
                    style={{
                      background: 'var(--surface-muted, #f8fafc)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      marginBottom: 14,
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Attending:</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>
                        {ev.attendingCount || 0} {ev.maxAttendees ? `/ ${ev.maxAttendees}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, color: 'var(--muted)' }}>
                      <span>Maybe: {ev.maybeCount || 0}</span>
                      <span>Declined: {ev.declinedCount || 0}</span>
                    </div>
                  </div>

                  {/* RSVP Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRsvp(ev.id, 'attending')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 6,
                        border: '1px solid',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderColor: myStatus === 'attending' ? '#10b981' : 'var(--border)',
                        background: myStatus === 'attending' ? '#10b981' : 'transparent',
                        color: myStatus === 'attending' ? '#fff' : 'var(--foreground)'
                      }}
                    >
                      ✓ Going
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRsvp(ev.id, 'maybe')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 6,
                        border: '1px solid',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderColor: myStatus === 'maybe' ? '#f59e0b' : 'var(--border)',
                        background: myStatus === 'maybe' ? '#f59e0b' : 'transparent',
                        color: myStatus === 'maybe' ? '#fff' : 'var(--foreground)'
                      }}
                    >
                      ? Maybe
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRsvp(ev.id, 'declined')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 6,
                        border: '1px solid',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderColor: myStatus === 'declined' ? '#ef4444' : 'var(--border)',
                        background: myStatus === 'declined' ? '#ef4444' : 'transparent',
                        color: myStatus === 'declined' ? '#fff' : 'var(--foreground)'
                      }}
                    >
                      ✕ Can&apos;t Go
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openAttendeesModal(ev)}
                      style={{
                        width: '100%',
                        marginTop: 10,
                        padding: '7px 12px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      👥 View Attendees & Guest List ({ev.attendingCount || 0} Going)
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE PULSE POLL */}
      {/* ============================================================ */}
      {pollModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPollModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Interactive Pulse Poll</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPollModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePoll}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Poll Question *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Which team bonding activity would you prefer?"
                    value={newPollQuestion}
                    onChange={(e) => setNewPollQuestion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Voting Options *</label>
                  {newPollOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...newPollOptions];
                          next[i] = e.target.value;
                          setNewPollOptions(next);
                        }}
                        style={{ flex: 1 }}
                      />
                      {newPollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewPollOptions(newPollOptions.filter((_, idx) => idx !== i))}
                          style={{
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            borderRadius: 6,
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newPollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setNewPollOptions([...newPollOptions, ''])}
                      style={{
                        border: '1px dashed #00b8db',
                        background: 'rgba(0, 184, 219, 0.05)',
                        color: '#00b8db',
                        padding: '8px 14px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4
                      }}
                    >
                      + Add Another Option
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={newPollExpiry}
                    onChange={(e) => setNewPollExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setPollModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Publish Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE CORPORATE EVENT */}
      {/* ============================================================ */}
      {eventModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEventModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Corporate Social Event</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEventModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateEvent}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Event Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Synergy UAE Annual Town Hall & Gala"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grand Ballroom, The Ritz-Carlton DIFC, Dubai"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Max Attendees Capacity</label>
                  <input
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={newEvent.maxAttendees}
                    onChange={(e) => setNewEvent({ ...newEvent, maxAttendees: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Event itinerary, dress code, refreshments details..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEventModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Publish Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EVENT ATTENDEES & GUEST LIST */}
      {/* ============================================================ */}
      {attendeesModalOpen && selectedEventForAttendees && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttendeesModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Event Guest List & RSVP Audit</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {selectedEventForAttendees.title} • {formatDate(selectedEventForAttendees.eventDate)} • 📍 {selectedEventForAttendees.location}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAttendeesModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
              {/* RSVP Metric Pills Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                  marginBottom: 18
                }}
              >
                <div
                  style={{
                    background: 'var(--surface-muted, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Responses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{attendeesSummary.total}</div>
                </div>

                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid #10b981',
                    borderRadius: 8,
                    padding: '10px 14px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#059669', textTransform: 'uppercase', fontWeight: 600 }}>Confirmed Going</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                    {attendeesSummary.attending} {selectedEventForAttendees.maxAttendees ? `/ ${selectedEventForAttendees.maxAttendees}` : ''}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid #f59e0b',
                    borderRadius: 8,
                    padding: '10px 14px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#d97706', textTransform: 'uppercase', fontWeight: 600 }}>Maybe</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{attendeesSummary.maybe}</div>
                </div>

                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '10px 14px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#dc2626', textTransform: 'uppercase', fontWeight: 600 }}>Declined</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>{attendeesSummary.declined}</div>
                </div>
              </div>

              {/* Filters Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'inline-flex', background: 'var(--surface-muted, #f1f5f9)', padding: 3, borderRadius: 8, gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => setAttendeesFilter('all')}
                    style={{
                      border: 'none',
                      background: attendeesFilter === 'all' ? '#00b8db' : 'transparent',
                      color: attendeesFilter === 'all' ? '#fff' : 'var(--foreground)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    All ({attendeesSummary.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendeesFilter('attending')}
                    style={{
                      border: 'none',
                      background: attendeesFilter === 'attending' ? '#059669' : 'transparent',
                      color: attendeesFilter === 'attending' ? '#fff' : 'var(--foreground)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Going ({attendeesSummary.attending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendeesFilter('maybe')}
                    style={{
                      border: 'none',
                      background: attendeesFilter === 'maybe' ? '#d97706' : 'transparent',
                      color: attendeesFilter === 'maybe' ? '#fff' : 'var(--foreground)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Maybe ({attendeesSummary.maybe})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendeesFilter('declined')}
                    style={{
                      border: 'none',
                      background: attendeesFilter === 'declined' ? '#dc2626' : 'transparent',
                      color: attendeesFilter === 'declined' ? '#fff' : 'var(--foreground)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Declined ({attendeesSummary.declined})
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search attendee name, department..."
                  value={attendeesSearch}
                  onChange={(e) => setAttendeesSearch(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    width: 220
                  }}
                />
              </div>

              {/* Attendees List / Table */}
              {attendeesLoading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                  Loading attendees guest list...
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--muted)',
                    background: 'var(--surface-muted, #f8fafc)',
                    borderRadius: 8
                  }}
                >
                  No attendee responses match the selected filter.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Employee</th>
                        <th style={{ padding: '8px 12px' }}>Department & Role</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Responded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.map((att) => {
                        const isAtt = att.status === 'attending';
                        const isMay = att.status === 'maybe';
                        const badgeBg = isAtt
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isMay
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)';
                        const badgeColor = isAtt ? '#059669' : isMay ? '#d97706' : '#dc2626';
                        const badgeText = isAtt ? '✓ Going' : isMay ? '? Maybe' : '✕ Declined';

                        return (
                          <tr key={att.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{att.full_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {att.employee_code && <span style={{ marginRight: 6 }}>{att.employee_code}</span>}
                                {att.email && <span>{att.email}</span>}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 500 }}>{att.department_name}</div>
                              {att.job_title && (
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{att.job_title}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  background: badgeBg,
                                  color: badgeColor,
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  fontWeight: 700,
                                  fontSize: 11
                                }}
                              >
                                {badgeText}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>
                              {formatDate(att.responded_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAttendeesModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
