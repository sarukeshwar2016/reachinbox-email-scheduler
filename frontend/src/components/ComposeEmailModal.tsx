import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Upload, Link, Clock, User, Users } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface ComposeProps {
  onClose: () => void;
}

const ComposeEmailModal: React.FC<ComposeProps> = ({ onClose }) => {
  const [senders, setSenders] = useState<any[]>([]);
  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [recipients, setRecipients] = useState<string[]>([]);
  const [uploadStats, setUploadStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Toggle between single email and CSV upload
  const [recipientMode, setRecipientMode] = useState<'single' | 'csv'>('single');
  const [singleEmail, setSingleEmail] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/emails/senders`).then(async (res) => {
      let data = res.data.data;
      if (data.length === 0) {
        const newSender = await axios.post(`${API_BASE_URL}/api/emails/senders`, {
          email: 'demo@reachinbox.ai',
          name: 'Demo Sender',
        });
        data = [newSender.data.data];
      }
      setSenders(data);
      if (data.length > 0) setSenderId(data[0].id);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const parsedEmails: string[] = [];
      let invalidCount = 0;

      lines.forEach((line) => {
        const parts = line.split(',');
        parts.forEach((part) => {
          const email = part.trim();
          if (!email) return;
          if (email.toLowerCase() === 'email') return; // skip header
          if (emailRegex.test(email)) {
            parsedEmails.push(email);
          } else {
            invalidCount++;
          }
        });
      });

      const uniqueEmails = [...new Set(parsedEmails)];
      const duplicateCount = parsedEmails.length - uniqueEmails.length;

      setUploadStats({
        total: lines.length,
        valid: uniqueEmails.length,
        duplicates: duplicateCount,
        invalid: invalidCount,
      });
      setRecipients(uniqueEmails);
    };
    reader.readAsText(file);
  };

  const getRecipientsForSubmit = (): string[] => {
    if (recipientMode === 'single') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(singleEmail.trim()) ? [singleEmail.trim()] : [];
    }
    return recipients;
  };

  const handleSubmit = async () => {
    const finalRecipients = getRecipientsForSubmit();
    if (finalRecipients.length === 0)
      return setError(
        recipientMode === 'single' ? 'Enter a valid email address' : 'Please upload recipients'
      );
    if (!subject) return setError('Subject required');
    if (!body) return setError('Body required');
    if (!senderId) return setError('Sender required');

    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/api/emails/schedule`, {
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
        senderId,
        recipients: finalRecipients,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">Compose New Email</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-gray-400 hover:text-gray-600">
              <Link className="w-4 h-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Send Later'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>
          )}

          {/* From */}
          <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <span className="text-gray-500 text-sm w-12">From</span>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-sm rounded-md px-3 py-1.5 outline-none focus:border-primary"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </select>
          </div>

          {/* To — with Single / CSV toggle */}
          <div className="border-b border-gray-100 pb-3 space-y-2">
            <div className="flex items-center gap-4">
              <span className="text-gray-500 text-sm w-12">To</span>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => {
                    setRecipientMode('single');
                    setRecipients([]);
                    setUploadStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                    recipientMode === 'single'
                      ? 'bg-primary text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-3 h-3" /> Single
                </button>
                <button
                  onClick={() => {
                    setRecipientMode('csv');
                    setSingleEmail('');
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                    recipientMode === 'csv'
                      ? 'bg-primary text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-3 h-3" /> CSV Upload
                </button>
              </div>
            </div>

            {/* Single email input */}
            {recipientMode === 'single' && (
              <div className="ml-16">
                <input
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            )}

            {/* CSV upload */}
            {recipientMode === 'csv' && (
              <div className="ml-16 flex items-center gap-3 flex-wrap">
                {recipients.length > 0 && (
                  <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-1 rounded-full">
                    {recipients.length} recipients
                  </span>
                )}
                <label className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 cursor-pointer">
                  <Upload className="w-4 h-4" /> Upload CSV
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}

            {/* CSV parse stats */}
            {recipientMode === 'csv' && uploadStats.total > 0 && (
              <div className="text-xs text-gray-500 flex gap-4 ml-16">
                <span>Valid: {uploadStats.valid}</span>
                <span className="text-orange-500">Duplicates: {uploadStats.duplicates}</span>
                <span className="text-red-500">Invalid: {uploadStats.invalid}</span>
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
            <span className="text-gray-500 text-sm w-12">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>

          {/* Settings row */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">Delay (ms)</span>
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">Hourly Limit</span>
              <input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">Start Time</span>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Body */}
          <div className="bg-[#F9FAFB] border border-gray-100 rounded-xl p-4 min-h-[250px]">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="w-full h-full min-h-[200px] bg-transparent resize-none outline-none text-sm text-gray-800"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeEmailModal;
