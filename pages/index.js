import { useState, useRef, useEffect } from 'react';

const INITIAL_MSG = 'שלום! 👋 אני כאן לעזור לתעד את סיכום הפגישה וליצור ממנו PDF.\n\nנתחיל — מה שם הפרויקט?';

function buildPdfHtml(data, baseUrl) {
  // Exact coordinates from the original template (794×1123px A4 page)
  const PAGE_W = 794;
  const TABLE_LEFT = 67.757309;
  const TABLE_TOP  = 324.577484;
  const TABLE_W    = 643.454102;
  const TABLE_H    = 663.196411;
  const HEADER_ROW_H = 27.362671;

  // Column widths (left→right in pixel space = rightmost→leftmost visually in RTL)
  // Visual RTL order: אחריות | לביצוע עד | הסיכום | ס'פ
  const COL_NUM  = 40;    // ס'פ   — leftmost in HTML / rightmost visually
  const COL_DESC = 371;   // הסיכום
  const COL_DATE = 116;   // לביצוע עד
  const COL_RESP = 116;   // אחריות — rightmost in HTML / leftmost visually
  // total = 643 ✓

  const DATA_ROWS_H = TABLE_H - HEADER_ROW_H;
  const MAX_ROWS    = 10;
  const ROW_H       = DATA_ROWS_H / MAX_ROWS; // ~63.6px per row

  const tasks = data.tasks.slice(0, MAX_ROWS);

  const rows = tasks.map((task, i) => `
    <tr>
      <td style="width:${COL_RESP}px;text-align:center;vertical-align:middle;padding:3px 5px;font-size:9.5px;">${task.responsible}</td>
      <td style="width:${COL_DATE}px;text-align:center;vertical-align:middle;padding:3px 5px;font-size:9.5px;">${task.dueDate}</td>
      <td style="width:${COL_DESC}px;text-align:right;vertical-align:middle;padding:3px 8px;font-size:9.5px;direction:rtl;">${task.description}</td>
      <td style="width:${COL_NUM}px;text-align:center;vertical-align:middle;padding:3px 5px;font-size:9.5px;">${i + 1}</td>
    </tr>`).join('');

  // Fill remaining empty rows so background grid is fully covered
  const emptyRows = Array.from({ length: MAX_ROWS - tasks.length }, (_, i) => `
    <tr>
      <td style="width:${COL_RESP}px;height:${ROW_H}px;"></td>
      <td style="width:${COL_DATE}px;"></td>
      <td style="width:${COL_DESC}px;"></td>
      <td style="width:${COL_NUM}px;"></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${PAGE_W}px; height: 1123px; overflow: hidden; }
    body {
      position: relative;
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #000;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    /* Full-page background image — the actual letterhead */
    .bg {
      position: absolute; top: 0; left: 0;
      width: ${PAGE_W}px; height: 1123px;
      z-index: 0;
    }
    /* Text overlay layer */
    .layer {
      position: absolute; top: 0; left: 0;
      width: ${PAGE_W}px; height: 1123px;
      z-index: 1;
    }
    /* Tasks table overlaid on top of the background grid */
    .task-table {
      position: absolute;
      top: ${TABLE_TOP}px;
      left: ${TABLE_LEFT}px;
      width: ${TABLE_W}px;
      border-collapse: collapse;
      direction: rtl;
    }
    .task-table th, .task-table td {
      border: 1px solid #000;
      background: transparent;
    }
    .task-table thead tr {
      height: ${HEADER_ROW_H}px;
    }
    .task-table thead th {
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      vertical-align: middle;
      padding: 2px 4px;
    }
    .task-table tbody tr {
      height: ${ROW_H}px;
    }
    @media print {
      html, body { width: ${PAGE_W}px; height: 1123px; }
    }
  </style>
</head>
<body>

  <!-- Original letterhead background (logo, chevron, footer) -->
  <img class="bg" src="${baseUrl}/bg00001.jpg" />

  <div class="layer">

    <!-- Date — top left, LTR -->
    <span style="position:absolute;top:132.6px;left:66.5px;font-size:10px;direction:ltr;">${data.date}</span>

    <!-- לכבוד רשימת התפוצה — right-aligned -->
    <span style="position:absolute;top:165.6px;right:26px;font-size:10px;direction:rtl;">לכבוד רשימת התפוצה</span>

    <!-- Subject line — centered, bold, underlined -->
    <span style="position:absolute;top:199.9px;left:0;width:${PAGE_W}px;text-align:center;font-weight:bold;text-decoration:underline;font-size:10.5px;direction:rtl;">
      הנדון – ${data.project} – סיכום פגישה שבועית - מתאריך ${data.date}
    </span>

    <!-- Participants -->
    <span style="position:absolute;top:234.5px;right:26px;font-size:10px;direction:rtl;">
      משתתפים : ${data.participants}
    </span>

    <!-- Optional description -->
    ${data.description ? `
    <span style="position:absolute;top:268.9px;right:26px;font-size:10px;direction:rtl;max-width:600px;">
      בשלב ביצוע הפגישה : ${data.description}
    </span>` : ''}

    <!-- להלן הסיכומים -->
    <span style="position:absolute;top:290.2px;right:26px;font-size:10px;direction:rtl;">להלן הסיכומים:-</span>

  </div>

  <!-- Tasks table, overlaid on the background grid -->
  <table class="task-table">
    <thead>
      <tr>
        <th style="width:${COL_RESP}px;">אחריות</th>
        <th style="width:${COL_DATE}px;">לביצוע עד...</th>
        <th style="width:${COL_DESC}px;">הסיכום</th>
        <th style="width:${COL_NUM}px;">ס'פ</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${emptyRows}
    </tbody>
  </table>

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
    const html = buildPdfHtml(pdfData, window.location.origin);
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
