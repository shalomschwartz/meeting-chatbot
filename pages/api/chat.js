import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
- שמור על שיחה קצרה וממוקדת
- אל תשתמש ב-markdown (ללא כוכביות, ללא #, ללא קו תחתון) — טקסט רגיל בלבד`;

const TOOLS = [
  {
    name: 'finalize_meeting_summary',
    description: 'קרא לפונקציה זו כאשר המשתמש סיים להזין את כל המשימות וסיכום הפגישה מוכן',
    input_schema: {
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
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    });

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (toolUse && toolUse.name === 'finalize_meeting_summary') {
      return res.json({ isDone: true, data: toolUse.input });
    }

    const textBlock = response.content.find(b => b.type === 'text');
    res.json({ isDone: false, message: textBlock?.text || '' });

  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({ error: error.message });
  }
}
