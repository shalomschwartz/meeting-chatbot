require('dotenv').config();
const express = require('express');
const OpenAI  = require('openai');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `אתה עוזר מקצועי לתיעוד סיכומי פגישות עסקיות. תנהל שיחה בעברית בלבד, בצורה ידידותית ותמציתית.

סדר איסוף המידע:
1. שאל מה שם הפרויקט / הנדון
2. שאל מה תאריך הפגישה
3. שאל מי השתתף בפגישה (שמות מופרדים בפסיק)
4. שאל תיאור קצר של נושא הפגישה (לא חובה — אם המשתמש לא רוצה, המשך)
5. אסוף משימות אחת אחת. לכל משימה:
   א. מה המשימה / הסיכום
   ב. מי אחראי
   ג. תאריך יעד לביצוע
   לאחר כל משימה, אשר אותה ושאל אם יש עוד משימות.
6. כשהמשתמש אומר שסיים (למשל: "סיימתי", "אין יותר", "זהו", "אין עוד"), קרא ל-finalize_meeting_summary עם כל הנתונים.

הנחיות:
- אשר כל פריט שהמשתמש מזין לפני שממשיכים
- אם חסר מידע (אחראי / תאריך יעד), שאל עליו בנעימות
- שמור על שיחה קצרה וממוקדת`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'finalize_meeting_summary',
      description: 'קרא לפונקציה זו כאשר המשתמש סיים להזין את כל המשימות וסיכום הפגישה מוכן',
      parameters: {
        type: 'object',
        properties: {
          project:      { type: 'string', description: 'שם הפרויקט / הנדון' },
          date:         { type: 'string', description: 'תאריך הפגישה' },
          participants: { type: 'string', description: 'רשימת המשתתפים מופרדת בפסיק' },
          description:  { type: 'string', description: 'תיאור קצר של נושא הפגישה (ריק אם לא סופק)' },
          tasks: {
            type: 'array',
            description: 'רשימת המשימות',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'תיאור המשימה' },
                responsible: { type: 'string', description: 'שם האחראי' },
                dueDate:     { type: 'string', description: 'תאריך יעד לביצוע' }
              },
              required: ['description', 'responsible', 'dueDate']
            }
          }
        },
        required: ['project', 'date', 'participants', 'tasks']
      }
    }
  }
];

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: TOOLS,
      tool_choice: 'auto'
    });

    const choice = response.choices[0];
    const msg    = choice.message;

    // Tool call → meeting is finalized
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const call = msg.tool_calls[0];
      if (call.function.name === 'finalize_meeting_summary') {
        const data = JSON.parse(call.function.arguments);
        return res.json({ isDone: true, data });
      }
    }

    // Regular text reply
    res.json({ isDone: false, message: msg.content || '' });

  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-pdf', async (req, res) => {
  const { data } = req.body;

  try {
    const html = buildPdfHtml(data);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '22mm', left: '15mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="meeting-summary.pdf"');
    res.send(pdf);

  } catch (error) {
    console.error('PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

function buildPdfHtml(data) {
  const companyName     = process.env.COMPANY_NAME     || 'REUVEN HOCHMAN 1990 Ltd';
  const companySubtitle = process.env.COMPANY_SUBTITLE || 'Building Construction';
  const companyFooter   = process.env.COMPANY_FOOTER   || 'P.O.B. 3095 Herzliya | Tel. 09-9514920 | Fax. 09-9581351 | dan@dhbld.com';

  // RTL column order (right → left): אחריות | לביצוע עד | הסיכום | ספ'
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

    body {
      font-family: Arial, 'Segoe UI', sans-serif;
      direction: rtl;
      font-size: 11pt;
      color: #000;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .company-box {
      background: #1e3a5f;
      color: white;
      padding: 10px 18px;
      text-align: center;
      min-width: 220px;
    }

    .company-name {
      font-size: 15pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }

    .company-subtitle {
      font-size: 7.5pt;
      letter-spacing: 3px;
      margin-top: 4px;
    }

    .date-block { font-size: 10.5pt; padding-top: 4px; }

    .to { margin: 14px 0 8px; font-size: 11pt; }

    .subject {
      text-align: center;
      font-size: 12.5pt;
      font-weight: bold;
      text-decoration: underline;
      margin: 12px 0;
    }

    .participants { margin: 9px 0; font-size: 11pt; }

    .meeting-desc { margin: 9px 0; font-size: 11pt; }

    .list-header { margin: 14px 0 6px; font-size: 11pt; }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #f0f0f0;
      border: 1px solid #000;
      padding: 6px 5px;
      font-weight: bold;
      font-size: 10.5pt;
      text-align: center;
    }

    td {
      border: 1px solid #000;
      padding: 6px 5px;
      font-size: 10pt;
      vertical-align: top;
    }

    .col-num  { text-align: center; width: 32px; }
    .col-date { text-align: center; width: 85px; }
    .col-resp { text-align: center; width: 110px; }
    .col-desc { text-align: right; }

    .footer {
      position: fixed;
      bottom: 6mm;
      left: 0; right: 0;
      text-align: center;
      font-size: 9pt;
      color: #333;
      border-top: 1px solid #aaa;
      padding-top: 4px;
      margin: 0 12mm;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="date-block">${data.date}</div>
    <div class="company-box">
      <div class="company-name">${companyName}</div>
      <div class="company-subtitle">${companySubtitle}</div>
    </div>
  </div>

  <div class="to">לכבוד רשימת התפוצה</div>

  <div class="subject">
    הנדון – ${data.project} – סיכום פגישה שבועית - מתאריך ${data.date}
  </div>

  <div class="participants"><strong>משתתפים:</strong> ${data.participants}</div>

  ${data.description ? `<div class="meeting-desc">בשלב ביצוע הפגישה: ${data.description}</div>` : ''}

  <div class="list-header">להלן הסיכומים:-</div>

  <table>
    <thead>
      <tr>
        <th class="col-resp">אחריות</th>
        <th class="col-date">לביצוע עד...</th>
        <th class="col-desc">הסיכום</th>
        <th class="col-num">ספ'</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">${companyFooter}</div>

</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
