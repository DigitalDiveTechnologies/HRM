'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

export default function EmployeeCommunityPage() {
  const { t, locale } = useLocale();

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
  const [openComments, setOpenComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  // Polls State
  const [polls, setPolls] = useState([]);
  const [votingBusy, setVotingBusy] = useState({});

  // Events State
  const [events, setEvents] = useState([]);
  const [rsvpBusy, setRsvpBusy] = useState({});

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

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
      setError(e.message || 'Failed to load community updates');
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
      showSuccess(locale === 'ar' ? 'تم نشر المنشور بنجاح!' : 'Post shared with the team!');
      await loadFeed();
    } catch (err) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setPostingBusy(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
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
      loadFeed();
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

  // Poll Action
  const handleVote = async (pollId, optionId) => {
    setVotingBusy((prev) => ({ ...prev, [pollId]: true }));
    try {
      await api(`/community/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ selectedOptionId: optionId })
      });
      showSuccess(locale === 'ar' ? 'تم تسجيل تصويتك بنجاح!' : 'Vote recorded!');
      await loadPolls();
    } catch (err) {
      setError(err.message || 'Failed to record vote');
    } finally {
      setVotingBusy((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  // Event RSVP Action
  const handleRsvp = async (eventId, status) => {
    setRsvpBusy((prev) => ({ ...prev, [eventId]: true }));
    try {
      await api(`/community/events/${eventId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showSuccess(locale === 'ar' ? `تم تحديث الحضور: ${status}` : `RSVP saved: ${status.toUpperCase()}`);
      await loadEvents();
    } catch (err) {
      setError(err.message || 'Failed to update RSVP');
    } finally {
      setRsvpBusy((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'kudos':
        return { label: locale === 'ar' ? '⭐ ثناء وتقدير' : '⭐ Kudos & Shoutout', bg: '#fef3c7', text: '#b45309' };
      case 'celebration':
        return { label: locale === 'ar' ? '🎉 احتفال وإنجاز' : '🎉 Celebration & Milestone', bg: '#f3e8ff', text: '#7e22ce' };
      default:
        return { label: locale === 'ar' ? '💬 تحديث عام' : '💬 Team Update', bg: '#e0f2fe', text: '#0369a1' };
    }
  };

  return (
    <PortalShell
      title={locale === 'ar' ? 'مجتمع الموظفين والفعاليات' : 'Employee Community & Social Wall'}
      subtitle={locale === 'ar' ? 'تواصل مع زملائك، شارك التقدير، صوّت في استطلاعات الرأي وسجّل حضورك في الفعاليات' : 'Connect with colleagues, share kudos, vote in pulse polls, and RSVP to corporate gatherings.'}
    >
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
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

      {/* Tabs */}
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
          📰 {locale === 'ar' ? 'الحائط الاجتماعي' : 'Social Wall'} ({posts.length})
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
          📊 {locale === 'ar' ? 'استطلاعات الرأي' : 'Pulse Polls'} ({polls.length})
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
          🗓️ {locale === 'ar' ? 'فعاليات الشركة' : 'Company Events'} ({events.length})
        </button>
        <Link
          href="/surveys"
          style={{
            padding: '12px 20px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            borderBottom: '3px solid transparent',
            color: 'var(--muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          📋 {locale === 'ar' ? 'استبيانات الرفاهية' : 'Wellbeing Surveys'}
        </Link>
      </div>

      {/* TAB 1: SOCIAL WALL */}
      {activeTab === 'feed' && (
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'grid', gap: 20 }}>
          {/* Post Composer */}
          <div className="panel-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
              {locale === 'ar' ? 'شارك تحديثاً أو احتفل بإنجاز مع زملائك' : 'Share an Update or Celebrate a Win'}
            </h3>
            <form onSubmit={handleCreatePost}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { key: 'general', label: locale === 'ar' ? '💬 عام' : '💬 General' },
                  { key: 'kudos', label: locale === 'ar' ? '⭐ ثناء' : '⭐ Kudos' },
                  { key: 'celebration', label: locale === 'ar' ? '🎉 احتفال' : '🎉 Celebration' }
                ].map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setPostType(type.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: '1px solid',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderColor: postType === type.key ? '#0284c7' : 'var(--border)',
                      background: postType === type.key ? 'rgba(2, 132, 199, 0.12)' : 'var(--surface)',
                      color: postType === type.key ? '#0284c7' : 'inherit'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder={
                  postType === 'kudos'
                    ? locale === 'ar' ? 'وجّه كلمة شكر وتقدير لزميل أو فريق…' : 'Give a shoutout to a colleague or team for their great work...'
                    : locale === 'ar' ? 'ما الجديد؟ شارك أفكارك مع زملائك…' : "What's on your mind? Share an update with your colleagues..."
                }
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'inherit',
                  fontSize: 14,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />

              {/* Task 5.5: Photo attachment preview */}
              {postImageUrl && (
                <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                  <img
                    src={postImageUrl}
                    alt="Post Preview"
                    style={{ maxHeight: 150, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }}
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
                      width: 22,
                      height: 22,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    background: 'var(--surface)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0284c7',
                    border: '1px solid var(--border)'
                  }}
                >
                  📷 {imageUploadBusy ? (locale === 'ar' ? 'جاري الرفع…' : 'Uploading…') : (locale === 'ar' ? 'إرفاق صورة' : 'Attach Photo')}
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

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={postingBusy || imageUploadBusy || !postContent.trim()}
                  style={{ padding: '8px 24px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                >
                  {postingBusy ? (locale === 'ar' ? 'جاري النشر…' : 'Posting…') : (locale === 'ar' ? 'نشر التحديث' : 'Share Post')}
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              {locale === 'ar' ? 'جاري تحميل الحائط الاجتماعي…' : 'Loading community feed…'}
            </div>
          ) : posts.length === 0 ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              {locale === 'ar' ? 'لا توجد منشورات حتى الآن. كن أول من يشارك تحديثاً!' : 'No community posts yet. Be the first to share an update!'}
            </div>
          ) : (
            posts.map((post) => {
              const badge = getBadgeStyle(post.postType);
              const comments = post.comments || [];
              const isCommentsOpen = !!openComments[post.id];

              return (
                <div key={post.id} className="panel-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#0284c7',
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
                        {post.jobTitle || 'Team Member'} {post.departmentName ? `• ${post.departmentName}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-line' }}>
                    {post.content}
                  </div>

                  {post.imageUrl && (
                    <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img
                        src={post.imageUrl}
                        alt="Post media"
                        style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  )}

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
                      <span>{post.likesCount || 0}</span>
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
                      <span>{comments.length}</span>
                    </button>
                  </div>

                  {isCommentsOpen && (
                    <div style={{ marginTop: 14, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
                      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                        {comments.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                            {locale === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Start the conversation!'}
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
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.authorName}</div>
                              <div>{c.commentText}</div>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder={locale === 'ar' ? 'اكتب تعليقاً…' : 'Write a comment…'}
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
                          onClick={() => handleAddComment(post.id)}
                          style={{
                            background: '#0284c7',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {locale === 'ar' ? 'إرسال' : 'Send'}
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

      {/* TAB 2: PULSE POLLS */}
      {activeTab === 'polls' && (
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'grid', gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading pulse polls…</div>
          ) : polls.length === 0 ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              No pulse polls currently active.
            </div>
          ) : (
            polls.map((poll) => {
              const isBusy = !!votingBusy[poll.id];

              return (
                <div key={poll.id} className="panel-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                      {poll.isActive ? 'PULSE POLL' : 'CLOSED'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Total Votes: {poll.totalVotes || 0}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>{poll.question}</h3>

                  <div style={{ display: 'grid', gap: 10 }}>
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
                                    ✓ {locale === 'ar' ? 'صوتك' : 'Your Vote'}
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
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: EVENTS */}
      {activeTab === 'events' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
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
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        📍 {ev.location}
                      </div>
                    </div>
                  </div>

                  {ev.description && (
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5, flex: 1 }}>
                      {ev.description}
                    </p>
                  )}

                  <div
                    style={{
                      background: 'var(--surface-muted, #f8fafc)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      marginBottom: 14,
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{locale === 'ar' ? 'المشاركون:' : 'Attending:'}</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>
                        {ev.attendingCount || 0} {ev.maxAttendees ? `/ ${ev.maxAttendees}` : ''}
                      </span>
                    </div>
                  </div>

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
                        color: myStatus === 'attending' ? '#fff' : 'inherit'
                      }}
                    >
                      ✓ {locale === 'ar' ? 'سأحضر' : 'Going'}
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
                        color: myStatus === 'maybe' ? '#fff' : 'inherit'
                      }}
                    >
                      ? {locale === 'ar' ? 'ربما' : 'Maybe'}
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
                        color: myStatus === 'declined' ? '#fff' : 'inherit'
                      }}
                    >
                      ✕ {locale === 'ar' ? 'اعتذار' : 'Decline'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </PortalShell>
  );
}
