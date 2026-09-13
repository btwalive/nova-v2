import React from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle } from 'lucide-react';

export default function ResumeViewerModal({ candidate, onClose }) {
  if (!candidate) return null;

  const url = candidate.resumeDataUrl || candidate.resumeUrl;
  const fileName = candidate.resumeFileName || `${candidate.fullName ? candidate.fullName.replace(/\s+/g, '_') : 'Candidate'}_Resume.pdf`;
  const fileType = candidate.resumeFileType || (fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  const handleDownload = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (!url) return;
    const win = window.open();
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${fileName} - ${candidate.fullName || 'Candidate Resume'}</title>
            <style>
              body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #525659; }
              iframe { width: 100%; height: 100%; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${url}"></iframe>
          </body>
        </html>
      `);
    }
  };

  const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf') || (url && url.startsWith('data:application/pdf'));
  const isImage = fileType.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: '20px'
    }} onClick={onClose}>
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '960px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Viewer Control Toolbar */}
        <div style={{
          background: '#f8fafc',
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {candidate.fullName || 'Candidate'} — Resume
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{fileName}</span>
                {candidate.resumeFileSize && (
                  <>
                    <span>•</span>
                    <span style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>{candidate.resumeFileSize}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {url && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <Download size={14} /> Download PDF
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ExternalLink size={14} /> Open Fullscreen
                </button>
              </>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Embedded Viewer Body */}
        <div style={{ flex: 1, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', position: 'relative' }}>
          {!url ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '400px' }}>
              <AlertCircle size={40} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Resume Document Not Stored</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                The candidate did not attach a resume or the file preview is unavailable.
              </p>
            </div>
          ) : isPdf ? (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              title="Resume Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff'
              }}
            />
          ) : isImage ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={url}
                alt="Candidate Resume"
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', borderRadius: '6px', background: '#fff' }}
              />
            </div>
          ) : (
            <iframe
              src={url}
              title="Resume Document"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
