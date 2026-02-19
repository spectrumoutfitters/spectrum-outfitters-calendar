import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';

const RichContent = ({ text }) => {
  const rendered = useMemo(() => {
    if (!text) return [];
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push({ type: 'list', items: [...listItems], key: `list-${elements.length}` });
        listItems = [];
      }
    };

    const inlineFormat = (str) => {
      const parts = [];
      let remaining = str;
      let idx = 0;
      const boldRe = /\*\*(.+?)\*\*/g;
      let match;
      let lastIdx = 0;
      while ((match = boldRe.exec(remaining)) !== null) {
        if (match.index > lastIdx) {
          parts.push({ text: remaining.slice(lastIdx, match.index), bold: false, key: idx++ });
        }
        parts.push({ text: match[1], bold: true, key: idx++ });
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < remaining.length) {
        parts.push({ text: remaining.slice(lastIdx), bold: false, key: idx++ });
      }
      return parts.length > 0 ? parts : [{ text: str, bold: false, key: 0 }];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push({ type: 'h2', text: trimmed.slice(3), key: `h2-${i}` });
      } else if (trimmed.startsWith('### ')) {
        flushList();
        elements.push({ type: 'h3', text: trimmed.slice(4), key: `h3-${i}` });
      } else if (trimmed.startsWith('---')) {
        flushList();
        elements.push({ type: 'hr', key: `hr-${i}` });
      } else if (/^[-•●]\s/.test(trimmed)) {
        const indent = line.length - trimmed.length;
        listItems.push({ text: trimmed.slice(2), indent: Math.floor(indent / 2), key: `li-${i}`, parts: inlineFormat(trimmed.slice(2)) });
      } else if (/^\d+\.\s/.test(trimmed)) {
        const indent = line.length - trimmed.length;
        const num = trimmed.match(/^(\d+)\./)[1];
        listItems.push({ text: trimmed.replace(/^\d+\.\s/, ''), indent: Math.floor(indent / 2), num, key: `oli-${i}`, parts: inlineFormat(trimmed.replace(/^\d+\.\s/, '')) });
      } else if (trimmed.startsWith('> ')) {
        flushList();
        elements.push({ type: 'callout', text: trimmed.slice(2), key: `call-${i}`, parts: inlineFormat(trimmed.slice(2)) });
      } else if (trimmed === '') {
        flushList();
        elements.push({ type: 'spacer', key: `sp-${i}` });
      } else {
        flushList();
        elements.push({ type: 'p', text: trimmed, key: `p-${i}`, parts: inlineFormat(trimmed) });
      }
    }
    flushList();
    return elements;
  }, [text]);

  const renderInline = (parts) =>
    parts.map(p => p.bold ? <strong key={p.key} className="font-semibold text-gray-900">{p.text}</strong> : <span key={p.key}>{p.text}</span>);

  return (
    <div className="space-y-1.5">
      {rendered.map(el => {
        switch (el.type) {
          case 'h2':
            return <h2 key={el.key} className="text-lg font-bold text-gray-900 mt-4 mb-1 pb-1 border-b border-gray-200">{el.text}</h2>;
          case 'h3':
            return <h3 key={el.key} className="text-sm font-bold text-gray-800 mt-3 mb-0.5 uppercase tracking-wide">{el.text}</h3>;
          case 'hr':
            return <hr key={el.key} className="my-3 border-gray-200" />;
          case 'list':
            return (
              <ul key={el.key} className="space-y-0.5">
                {el.items.map(li => (
                  <li key={li.key} className="flex gap-2 text-sm text-gray-700" style={{ paddingLeft: `${li.indent * 16}px` }}>
                    <span className="text-primary mt-0.5 flex-shrink-0">{li.num ? `${li.num}.` : '•'}</span>
                    <span>{renderInline(li.parts)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'callout':
            return (
              <div key={el.key} className="bg-primary-subtle border-l-4 border-primary rounded-r-lg px-3 py-2 text-sm text-gray-700">
                {renderInline(el.parts)}
              </div>
            );
          case 'spacer':
            return <div key={el.key} className="h-1" />;
          case 'p':
          default:
            return <p key={el.key} className="text-sm text-gray-700 leading-relaxed">{renderInline(el.parts)}</p>;
        }
      })}
    </div>
  );
};

const UpdatesModal = ({ onClose, onMarkAllRead }) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      const response = await api.get('/updates');
      setUpdates(response.data.updates);
      if (response.data.updates.length > 0) {
        setSelectedUpdate(response.data.updates[0]);
      }
    } catch (error) {
      console.error('Error loading updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (updateId) => {
    try {
      await api.post(`/updates/${updateId}/read`);
      setUpdates(prev => prev.map(u => 
        u.id === updateId ? { ...u, is_read: true } : u
      ));
    } catch (error) {
      console.error('Error marking update as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/updates/read-all');
      setUpdates(prev => prev.map(u => ({ ...u, is_read: true })));
      if (onMarkAllRead) onMarkAllRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getUpdateTypeColor = (type) => {
    const colors = {
      feature: 'bg-primary-subtle text-primary-dark',
      bugfix: 'bg-green-100 text-green-800',
      improvement: 'bg-purple-100 text-purple-800',
      announcement: 'bg-amber-100 text-amber-800',
      maintenance: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors.feature;
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'critical') {
      return <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">Critical</span>;
    }
    if (priority === 'high') {
      return <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">High</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">Loading updates...</div>
        </div>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">System Updates</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-center py-8 text-gray-600">
            No updates available at this time.
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-brand-black text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadUpdates = updates.filter(u => !u.is_read && u.show_on_login === 1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">System Updates</h2>
            {unreadUpdates.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {unreadUpdates.length} new update{unreadUpdates.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {unreadUpdates.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Mark All Read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Updates List */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-4 space-y-2">
              {updates.map((update) => (
                <div
                  key={update.id}
                  onClick={() => {
                    setSelectedUpdate(update);
                    if (!update.is_read) {
                      markAsRead(update.id);
                    }
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    selectedUpdate?.id === update.id
                      ? 'bg-primary-subtle border-2 border-primary'
                      : update.is_read
                      ? 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      : 'bg-primary-subtle border-2 border-primary/40 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-gray-800">
                          {update.title}
                        </h3>
                        {!update.is_read && (
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateTime(update.created_at)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${getUpdateTypeColor(update.update_type)}`}>
                          {update.update_type}
                        </span>
                        {getPriorityBadge(update.priority)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Update Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedUpdate ? (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      {selectedUpdate.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{formatDateTime(selectedUpdate.created_at)}</span>
                      {selectedUpdate.version && (
                        <>
                          <span>•</span>
                          <span>Version {selectedUpdate.version}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-3 py-1 text-sm rounded ${getUpdateTypeColor(selectedUpdate.update_type)}`}>
                    {selectedUpdate.update_type}
                  </span>
                  {getPriorityBadge(selectedUpdate.priority)}
                </div>

                <div className="prose max-w-none">
                  <RichContent text={selectedUpdate.content} />
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select an update to view details
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-brand-black text-white rounded-lg hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatesModal;
