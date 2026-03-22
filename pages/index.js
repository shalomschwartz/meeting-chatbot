import { useState, useRef, useEffect } from 'react';

const INITIAL_MSG = 'שלום! 👋 אני כאן לעזור לתעד את סיכום הפגישה וליצור ממנו PDF.\n\nנתחיל — מה שם הפרויקט?';

const COMPANY_NAME     = process.env.NEXT_PUBLIC_COMPANY_NAME     || 'REUVEN HOCHMAN 1990 Ltd';
const COMPANY_SUBTITLE = process.env.NEXT_PUBLIC_COMPANY_SUBTITLE || 'Building Construction';
const COMPANY_FOOTER   = process.env.NEXT_PUBLIC_COMPANY_FOOTER   || 'P.O.B. 3095 Herzliya | Tel. 09-9514920 | Fax. 09-9581351 | dan@dhbld.com';

function buildPdfHtml(data) {
  const rows = data.tasks.map((task, i) => `
    <tr>
      <td class="col-resp">${task.responsible}</td>
      <td class="col-date">${task.dueDate}</td>
      <td class="col-desc">${task.description}</td>
      <td class="col-num">${i + 1}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Segoe UI', sans-serif; direction: rtl; font-size: 11pt; color: #000; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
    .company-box { background: #1e3a5f; color: white; padding: 10px 18px; text-align: center; min-width: 220px; }
    .company-name { font-size: 15pt; font-weight: bold; letter-spacing: 0.5px; }
    .company-subtitle { font-size: 7.5pt; letter-spacing: 3px; margin-top: 4px; }
    .date-block { font-size: 10.5pt; padding-top: 4px; }
    .to { margin: 14px 0 8px; font-size: 11pt; }
    .subject { text-align: center; font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 12px 0; }
    .participants { margin: 9px 0; font-size: 11pt; }
    .meeting-desc { margin: 9px 0; font-size: 11pt; }
    .list-header { margin: 14px 0 6px; font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; border: 1px solid #000; padding: 6px 5px; font-weight: bold; font-size: 10.5pt; text-align: center; }
    td { border: 1px solid #000; padding: 6px 5px; font-size: 10pt; vertical-align: top; }
    .col-num  { text-align: center; width: 32px; }
    .col-date { text-align: center; width: 85px; }
    .col-resp { text-align: center; width: 110px; }
    .col-desc { text-align: right; }
    .footer { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #333; border-top: 1px solid #aaa; padding-top: 4px; margin: 0 12mm; }
    @media print { body { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="date-block">${data.date}</div>
    <div class="company-box">
      <div class="company-name">${COMPANY_NAME}</div>
      <div class="company-subtitle">${COMPANY_SUBTITLE}</div>
    </div>
  </div>
  <div class="to">לכבוד רשימת התפוצה</div>
  <div class="subject">הנדון – ${data.project} – סיכום פגישה שבועית - מתאריך ${data.date}</div>
  <div class="participants"><strong>משתתפים:</strong> ${data.participants}</div>
  ${data.description ? `<div class="meeting-desc">בשלב ביצוע הפגישה: ${data.description}</div>` : ''}
  <div class="list-header">להלן הסיכומים:-</div>
  <table>
    <thead>
      <tr>
        <th class="col-resp">אחריות</th>
        <th class="col-date">לביצוע עד...</th>
        <th class="col-desc">הסיכום</th>
        <th class="col-num">ס'פ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${COMPANY_FOOTER}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'bot', text: INITIAL_MSG }]);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || done || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages.filter(m => m.role !== 'bot' || m.apiMsg).map(m => m.apiMsg || { role: m.role, content: m.text }), userMsg];

    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'bot', text: 'שגיאה: ' + data.error }]);
        return;
      }

      if (data.isDone) {
        setDone(true);
        setPdfData(data.data);
        setMessages(prev => [...prev, { role: 'bot', text: 'מצוין! רשמתי את כל המשימות. ניתן עכשיו לייצא ל-PDF.' }, { role: 'pdf' }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'bot', text: data.message, apiMsg: { role: 'assistant', content: data.message } }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'שגיאה בתקשורת — נסה שוב.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function generatePDF() {
    const html = buildPdfHtml(pdfData);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f7; direction: rtl; }
        .header { background: #1e3a5f; color: white; padding: 14px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
        .header-icon { font-size: 24px; }
        .header-title { font-size: 17px; font-weight: 600; }
        .header-sub { font-size: 12px; opacity: 0.65; margin-top: 2px; }
        .chat-wrap { display: flex; flex-direction: column; height: 100vh; }
        .chat-area { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 10px; }
        .bubble { max-width: 74%; padding: 10px 14px; border-radius: 18px; line-height: 1.6; font-size: 14.5px; word-break: break-word; white-space: pre-wrap; }
        .bubble.bot { background: #fff; color: #1a1a1a; align-self: flex-start; border-bottom-right-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.09); }
        .bubble.user { background: #1e3a5f; color: #fff; align-self: flex-end; border-bottom-left-radius: 4px; }
        .bubble.typing { color: #888; font-style: italic; background: #fff; align-self: flex-start; box-shadow: 0 1px 4px rgba(0,0,0,0.09); }
        .pdf-card { background: #fff; border-radius: 14px; padding: 20px 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .pdf-card p { color: #555; font-size: 13.5px; }
        .pdf-btn { background: #27ae60; color: #fff; border: none; border-radius: 10px; padding: 11px 30px; font-size: 15px; font-family: inherit; cursor: pointer; font-weight: 600; }
        .pdf-btn:hover { background: #219a52; }
        .input-row { padding: 12px 14px; background: #fff; border-top: 1px solid #e0e0e0; display: flex; gap: 9px; align-items: center; }
        .msg-input { flex: 1; padding: 10px 16px; border: 1.5px solid #d0d0d0; border-radius: 24px; font-size: 14.5px; font-family: inherit; direction: rtl; outline: none; background: #fafafa; }
        .msg-input:focus { border-color: #1e3a5f; background: #fff; }
        .msg-input:disabled { background: #f0f0f0; color: #999; }
        .send-btn { background: #1e3a5f; color: #fff; border: none; border-radius: 24px; padding: 10px 22px; font-size: 14.5px; font-family: inherit; cursor: pointer; white-space: nowrap; font-weight: 500; }
        .send-btn:hover { background: #2a4f80; }
        .send-btn:disabled { background: #bbb; cursor: not-allowed; }
      `}</style>

      <div className="chat-wrap">
        <div className="header">
          <div className="header-icon">🗂️</div>
          <div>
            <div className="header-title">עוזר סיכום פגישות</div>
            <div className="header-sub">תיעוד משימות וייצוא ל-PDF</div>
          </div>
        </div>

        <div className="chat-area" ref={chatRef}>
          {messages.map((msg, i) => {
            if (msg.role === 'pdf') {
              return (
                <div key={i} className="pdf-card">
                  <p>סיכום הפגישה מוכן לייצוא</p>
                  <button className="pdf-btn" onClick={generatePDF}>📄 צור PDF</button>
                </div>
              );
            }
            return (
              <div key={i} className={`bubble ${msg.role}`}>{msg.text}</div>
            );
          })}
          {loading && <div className="bubble typing">מקליד...</div>}
        </div>

        <div className="input-row">
          <input
            ref={inputRef}
            className="msg-input"
            placeholder="הקלד הודעה..."
            value={input}
            disabled={loading || done}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            autoComplete="off"
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || done}>שלח ▶</button>
        </div>
      </div>
    </>
  );
}
