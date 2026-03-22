import { useState, useRef, useEffect } from 'react';

const INITIAL_MSG = 'שלום! 👋 אני כאן לעזור לתעד את סיכום הפגישה וליצור ממנו PDF.\n\nנתחיל — מה שם הפרויקט?';

function buildPdfHtml(data, baseUrl) {
  const PAGE_W       = 794;
  const PAGE_H       = 1123;
  const TABLE_LEFT   = 67.757309;
  const TABLE_W      = 643.454102;
  const HEADER_ROW_H = 27.362671;

  // Column widths from the original template (exact values from HTML source)
  // RTL visual order (right→left): אחריות | לביצוע עד | הסיכום | ס'פ
  const COL_RESP = 71;    // אחריות
  const COL_DATE = 71;    // לביצוע עד
  const COL_DESC = 466;   // הסיכום (305.9 + the ~160px extra space in the template)
  const COL_NUM  = 35;    // ס'פ

  // Page 1: table starts lower (below date/subject/participants text)
  const P1_TABLE_TOP = 324.577484;
  const P1_TABLE_H   = 663.196411;
  const P1_DATA_H    = P1_TABLE_H - HEADER_ROW_H;
  const P1_MAX       = 10;
  const P1_ROW_H     = P1_DATA_H / P1_MAX;

  // Page 2: table starts near top, right after the logo
  const P2_TABLE_TOP = 128;
  const P2_TABLE_H   = 370;
  const P2_DATA_H    = P2_TABLE_H - HEADER_ROW_H;
  const P2_MAX       = 5;
  const P2_ROW_H     = P2_DATA_H / P2_MAX;

  const tdStyle = (w, align = 'center') =>
    `style="width:${w}px;text-align:${align};vertical-align:middle;padding:3px 6px;font-size:9.5px;background:white;"`;

  // Columns in explicit physical left→right order (no CSS direction tricks):
  // ס'פ (leftmost) | הסיכום (wide) | לביצוע עד | אחריות (rightmost)
  const th = (w, label) =>
    `<th style="width:${w}px;border:1px solid #000;font-size:10px;font-weight:bold;text-align:center;vertical-align:middle;padding:2px 4px;background:white;">${label}</th>`;

  function makeRows(tasks, startIdx, rowH, maxRows) {
    const filled = tasks.map((task, i) => `
    <tr style="height:${rowH}px;">
      <td style="width:${COL_NUM}px;text-align:center;vertical-align:middle;padding:3px 4px;font-size:9.5px;background:white;">${startIdx + i + 1}</td>
      <td style="width:${COL_DESC}px;text-align:right;vertical-align:middle;padding:3px 8px;font-size:9.5px;background:white;direction:rtl;">${task.description}</td>
      <td style="width:${COL_DATE}px;text-align:center;vertical-align:middle;padding:3px 4px;font-size:9.5px;background:white;">${task.dueDate}</td>
      <td style="width:${COL_RESP}px;text-align:center;vertical-align:middle;padding:3px 4px;font-size:9.5px;background:white;">${task.responsible}</td>
    </tr>`).join('');

    const empty = Array.from({ length: maxRows - tasks.length }, () => `
    <tr style="height:${rowH}px;">
      <td style="background:white;border:1px solid #000;"></td>
      <td style="background:white;border:1px solid #000;"></td>
      <td style="background:white;border:1px solid #000;"></td>
      <td style="background:white;border:1px solid #000;"></td>
    </tr>`).join('');

    return filled + empty;
  }

  function makeTable(top, rows) {
    return `
  <table style="position:absolute;top:${top}px;left:${TABLE_LEFT}px;width:${TABLE_W}px;
                border-collapse:collapse;z-index:1;">
    <thead>
      <tr style="height:${HEADER_ROW_H}px;">
        ${th(COL_NUM,  "ס'פ")}
        ${th(COL_DESC, 'הסיכום')}
        ${th(COL_DATE, 'לביצוע עד...')}
        ${th(COL_RESP, 'אחריות')}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
  }

  const page1Tasks = data.tasks.slice(0, P1_MAX);
  const page2Tasks = data.tasks.slice(P1_MAX, P1_MAX + P2_MAX);
  const needsPage2 = data.tasks.length > P1_MAX;

  const commonStyle = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000;
           print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { width: ${PAGE_W}px; height: ${PAGE_H}px; position: relative;
            overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .bg { position: absolute; top: 0; left: 0; width: ${PAGE_W}px; height: ${PAGE_H}px; z-index: 0; }
    td { border: 1px solid #000; background: transparent; }`;

  const page1 = `
  <div class="page">
    <img class="bg" src="${baseUrl}/bg00001.jpg" />

    <span style="position:absolute;top:132.6px;left:66.5px;z-index:1;font-size:10px;direction:ltr;">${data.date}</span>
    <span style="position:absolute;top:165.6px;right:26px;z-index:1;font-size:10px;direction:rtl;">לכבוד רשימת התפוצה</span>
    <span style="position:absolute;top:199.9px;left:0;width:${PAGE_W}px;text-align:center;z-index:1;font-weight:bold;font-size:10.5px;direction:rtl;">
      הנדון – ${data.project} – סיכום פגישה שבועית - מתאריך ${data.date}
    </span>
    <span style="position:absolute;top:234.5px;right:26px;z-index:1;font-size:10px;direction:rtl;">משתתפים : ${data.participants}</span>
    ${data.description ? `<span style="position:absolute;top:268.9px;right:26px;z-index:1;font-size:10px;direction:rtl;max-width:600px;">בשלב ביצוע הפגישה : ${data.description}</span>` : ''}
    <span style="position:absolute;top:290.2px;right:26px;z-index:1;font-size:10px;direction:rtl;">להלן הסיכומים:-</span>

    ${makeTable(P1_TABLE_TOP, makeRows(page1Tasks, 0, P1_ROW_H, P1_MAX))}
  </div>`;

  const page2 = needsPage2 ? `
  <div class="page">
    <img class="bg" src="${baseUrl}/bg00002.jpg" />
    ${makeTable(P2_TABLE_TOP, makeRows(page2Tasks, P1_MAX, P2_ROW_H, P2_MAX))}
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="he">
<head>
  <meta charset="UTF-8">
  <style>${commonStyle}</style>
</head>
<body>
  ${page1}
  ${page2}
</body>
</html>`;
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Include apiMsg so Claude receives the greeting as conversation context
    setMessages([{ role: 'bot', text: INITIAL_MSG, apiMsg: { role: 'assistant', content: INITIAL_MSG } }]);
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

  async function generatePDF() {
    setPdfGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf').then(m => ({ jsPDF: m.jsPDF }))
      ]);

      const html = buildPdfHtml(pdfData, window.location.origin);

      // Render in a hidden iframe so images load with correct origin
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;height:2246px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      await new Promise(resolve => {
        iframe.onload = resolve;
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
      });

      // Wait for images inside the iframe to load
      await Promise.all(
        Array.from(iframe.contentDocument.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        )
      );

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
      const pages = iframe.contentDocument.querySelectorAll('.page');

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, width: 794, height: 1123 });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 794, 1123);
      }

      pdf.save(`סיכום-פגישה-${pdfData.date || ''}.pdf`);
      document.body.removeChild(iframe);
    } catch (e) {
      console.error(e);
      alert('שגיאה ביצירת ה-PDF — נסה שוב');
    } finally {
      setPdfGenerating(false);
    }
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
                  <button className="pdf-btn" onClick={generatePDF} disabled={pdfGenerating}>
                    {pdfGenerating ? 'מייצר PDF...' : '📄 צור PDF'}
                  </button>
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
