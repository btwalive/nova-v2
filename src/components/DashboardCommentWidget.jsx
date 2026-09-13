import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, X, Plus, Trash2, CheckCircle, Clock, AlertCircle, Sparkles, Filter, Pin } from 'lucide-react';

export default function DashboardCommentWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'list'
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [section, setSection] = useState('Recruiter Scorecard');
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('Medium'); // 'Low' | 'Medium' | 'High' | 'Wishlist'
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinnedElement, setPinnedElement] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch comments from backend / localStorage fallback
  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/comments');
      if (res.ok) {
        const data = await res.json();
        if (data.comments) {
          setComments(data.comments);
          localStorage.setItem('hirewave_dashboard_comments', JSON.stringify(data.comments));
          return;
        }
      }
    } catch (e) {
      console.warn("API fetch failed, reading local fallback comments:", e);
    } finally {
      setLoading(false);
    }

    // Fallback to local storage if API server isn't reachable
    try {
      const localData = localStorage.getItem('hirewave_dashboard_comments');
      if (localData) {
        setComments(JSON.parse(localData));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchComments();
  }, []);

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const payload = {
      section,
      author: author.trim() || 'Recruiter / User',
      title: title.trim(),
      text: text.trim(),
      priority,
      elementId: pinnedElement ? pinnedElement.id || pinnedElement.tagName : null,
    };

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [data.comment, ...prev]);
        }
      } else {
        throw new Error("Server returned non-ok");
      }
    } catch (e) {
      console.warn("Saving comment locally:", e);
      const localComment = {
        id: 'CMT-LOCAL-' + Date.now(),
        ...payload,
        status: 'New',
        createdAt: new Date().toISOString()
      };
      setComments((prev) => {
        const updated = [localComment, ...prev];
        localStorage.setItem('hirewave_dashboard_comments', JSON.stringify(updated));
        return updated;
      });
    }

    setText('');
    setTitle('');
    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setActiveTab('list');
    }, 1200);
  };

  // Handle status toggle / deletion
  const handleDeleteComment = async (id) => {
    try {
      await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    } catch (e) {}
    setComments((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      localStorage.setItem('hirewave_dashboard_comments', JSON.stringify(updated));
      return updated;
    });
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}
    setComments((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c));
      localStorage.setItem('hirewave_dashboard_comments', JSON.stringify(updated));
      return updated;
    });
  };

  // Element Pinning Handler
  const togglePinMode = () => {
    setIsPinMode(!isPinMode);
    if (!isPinMode) {
      alert("📍 Pin Mode Enabled! Move mouse and click any section on your screen to attach your feature request.");
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4), 0 2px 8px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem',
          fontWeight: 700,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1) translateY(0)')}
      >
        <MessageSquare size={20} />
        <span>Add Feature Feedback ({comments.length})</span>
      </button>

      {/* Drawer Overlay Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '100%',
              background: '#0f172a',
              borderLeft: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
              color: '#f8fafc'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1e293b'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={22} color="#6366f1" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                    Dashboard Feature Request & Notes
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Add feedback or point out features for our dev team to build.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
              <button
                onClick={() => setActiveTab('new')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: activeTab === 'new' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: activeTab === 'new' ? '#818cf8' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  borderBottom: activeTab === 'new' ? '2px solid #6366f1' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} /> New Feature Note
              </button>

              <button
                onClick={() => setActiveTab('list')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: activeTab === 'list' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: activeTab === 'list' ? '#818cf8' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  borderBottom: activeTab === 'list' ? '2px solid #6366f1' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={16} /> All Comments ({comments.length})
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {activeTab === 'new' ? (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {submitSuccess && (
                    <div style={{ background: '#10b98122', border: '1px solid #10b981', color: '#34d399', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} /> Feature Note Saved Successfully!
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Dashboard Section / Module
                    </label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
                    >
                      <option value="Recruiter Scorecard">Nova Recruiter Scorecard</option>
                      <option value="Voice Assessment Engine">Voice Assessment & Mic Check</option>
                      <option value="Candidate Database">Candidate Registry & Resume Parser</option>
                      <option value="WhatsApp Automation">WhatsApp Dispatch & Group Sync</option>
                      <option value="JD Generator">Job Description Generator</option>
                      <option value="General UI & Styling">General UI & Layout Improvements</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Feature Title / Summary
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Add Export to PDF for candidate scorecard"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Detailed Feature Feedback or Request *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe what point or feature should be added here, how it should work, and why..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Priority / Urgency
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
                      >
                        <option value="Wishlist">Wishlist / Idea</option>
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>

                      </select>
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Your Name / Role
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lead Recruiter"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '8px'
                    }}
                  >
                    <Send size={16} /> Submit Feature Note
                  </button>
                </form>
              ) : (
                /* List Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                      <MessageSquare size={36} style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>No feature notes submitted yet.</p>
                      <span style={{ fontSize: '0.78rem' }}>Click "New Feature Note" to drop your first idea!</span>
                    </div>
                  ) : (
                    comments.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: '#334155',
                              color: '#38bdf8',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            {item.section}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background:
                                  item.priority === 'High' ? '#ef444433' : item.priority === 'Medium' ? '#f59e0b33' : '#10b98133',
                                color:
                                  item.priority === 'High' ? '#f87171' : item.priority === 'Medium' ? '#fbbf24' : '#34d399'
                              }}
                            >
                              {item.priority}
                            </span>

                            <button
                              onClick={() => handleDeleteComment(item.id)}
                              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                              title="Delete note"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {item.title && (
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>
                            {item.title}
                          </h4>
                        )}

                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                          {item.text}
                        </p>

                        <div
                          style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            marginTop: '4px',
                            paddingTop: '6px',
                            borderTop: '1px solid #334155'
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            By {item.author} • {new Date(item.createdAt).toLocaleDateString()}
                          </span>

                          <select
                            value={item.status || 'New'}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            style={{
                              background: '#0f172a',
                              color: item.status === 'Completed' ? '#34d399' : '#fbbf24',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              padding: '2px 4px',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="New">Status: New</option>
                            <option value="Planned">Status: Planned 🛠️</option>
                            <option value="Completed">Status: Completed ✅</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
