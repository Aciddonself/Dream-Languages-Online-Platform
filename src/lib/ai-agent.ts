/**
 * Father-DLA AI Agent Service
 * Multi-provider educational language assistant for Dream Languages Uganda.
 * Supports Google Gemini, OpenAI, and a built-in multilingual language intelligence engine.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  answer: string;
  provider: "gemini" | "openai" | "dla-engine";
  model: string;
}

const SYSTEM_PROMPT = `You are Father-DLA, the official AI Language Tutor and Educational Assistant for Dream Languages Uganda (DLA).
Your mission is to help learners master world languages with patience, clarity, encouragement, and cultural depth.

Key School & Language Context:
- School: Dream Languages Uganda (DLA), based in Kampala, Uganda.
- Official Languages Taught: English, French, German, Kiswahili, Luganda, Spanish, Arabic, Chinese (Mandarin), Dutch, Japanese, and Ugandan Sign Language.
- Levels: CEFR Levels A1 (Beginner), A2 (Elementary), B1 (Intermediate), B2 (Upper Intermediate), C1 (Advanced), C2 (Mastery).
- Learning Modes: Day, Evening, Weekend, and Online Live Classes via Google Meet.
- Tone: Warm, patient, highly pedagogical, culturally respectful, and clear.
- Core Teaching Strengths:
  1. Multilingual Explanations: Always answer in the language requested or the language the user speaks. When teaching a foreign language, provide clear translations, pronunciation hints, and real-life examples.
  2. Grammar & Vocabulary: Break down complex grammatical rules (e.g. German cases, French verb conjugations, Kiswahili noun classes, Luganda prefixes).
  3. Interactive Practice: Suggest short dialogue practice, role-plays, and vocabulary exercises.
  4. Google Meet Live Classes: Encourage students to attend their scheduled live sessions with teachers.

If asked about unknown personal records or school financial balances, politely guide the student to check their student portal dashboard or contact the school administrator.`;

// -------------------------------------------------------------
// 1. Google Gemini Provider
// -------------------------------------------------------------
async function callGemini(messages: ChatMessage[], apiKey: string): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert chat messages to Gemini contents format
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gemini API error:", res.status, errorText);
    return null;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
}

// -------------------------------------------------------------
// 2. OpenAI Provider
// -------------------------------------------------------------
async function callOpenAI(messages: ChatMessage[], apiKey: string): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("OpenAI API error:", res.status, errorText);
    return null;
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  return text ? text.trim() : null;
}

// -------------------------------------------------------------
// 3. Built-in DLA Language Intelligence & Knowledge Engine
// -------------------------------------------------------------
function generateBuiltinResponse(lastMessage: string, history: ChatMessage[]): string {
  const query = lastMessage.toLowerCase().trim();

  // Greetings in multiple languages
  if (query.match(/^(hello|hi|hey|oli otya|bonjour|hallo|jambo|habari|hola|marhaban|ni hao)/i)) {
    return (
      "👋 **Jambo & Welcome! I am Father-DLA**, your AI Language Tutor at Dream Languages Uganda!\n\n" +
      "I am inaugurated and connected to help you master languages like **French, German, Kiswahili, Luganda, English, Spanish, Arabic, and Chinese**.\n\n" +
      "Here is how I can help you today:\n" +
      "- 📚 **Grammar Explanations**: Ask me about verb tenses, noun cases, or sentence structure.\n" +
      "- 🗣️ **Conversational Practice**: Practice dialogues in any language.\n" +
      "- ✍️ **Translation & Vocabulary**: Get nuanced translations with practical examples.\n" +
      "- 🎥 **Live Google Meet Classes**: Learn about your scheduled live sessions and timetable.\n\n" +
      "*Which language or topic would you like to explore right now?*"
    );
  }

  // Live classes & Google Meet inquiries
  if (query.includes("live class") || query.includes("google meet") || query.includes("timetable") || query.includes("schedule") || query.includes("meet link")) {
    return (
      "🎥 **Dream Languages Uganda Live Classes with Google Meet**\n\n" +
      "Our interactive language classes are conducted live via **Google Meet**!\n\n" +
      "**How it works:**\n" +
      "1. **Scheduled by Head of Department & Teachers**: Your Head of Languages/Department schedules sessions with dedicated Google Meet links.\n" +
      "2. **One-Click Portal Access**: As an enrolled student, navigate to your **Timetable** or **Dashboard** to see the **🔴 LIVE NOW** indicator.\n" +
      "3. **Join Class**: Simply click the **Join Class** button. Your attendance is tracked automatically in the system.\n" +
      "4. **Calendar Integration**: You can also add sessions directly to your Google Calendar!\n\n" +
      "Check your portal timetable tab for today's upcoming live sessions."
    );
  }

  // French inquiries
  if (query.includes("french") || query.includes("français") || query.includes("bonjour")) {
    if (query.includes("verb") || query.includes("conjugat") || query.includes("present") || query.includes("passé")) {
      return (
        "🇫🇷 **French Grammar Tip: Regular Verb Conjugation (-ER Verbs)**\n\n" +
        "The largest group of French verbs ends in **-er** (e.g., *parler* = to speak, *aimer* = to love/like).\n\n" +
        "**Present Tense Endings for -ER verbs:**\n" +
        "- **Je** parl**e** *(I speak)*\n" +
        "- **Tu** parl**es** *(You speak - informal)*\n" +
        "- **Il / Elle / On** parl**e** *(He / She / One speaks)*\n" +
        "- **Nous** parl**ons** *(We speak)*\n" +
        "- **Vous** parl**ez** *(You speak - formal/plural)*\n" +
        "- **Ils / Elles** parl**ent** *(They speak)*\n\n" +
        "💡 *Pronunciation note*: The endings **-e, -es, -e,** and **-ent** are all silent! They all sound like [parl]. Only *nous parlons* and *vous parlez* sound different.\n\n" +
        "Would you like to try conjugating *habiter* (to live) or *étudier* (to study)?"
      );
    }
    return (
      "🇫🇷 **Bienvenue au Département de Français à DLA!**\n\n" +
      "At Dream Languages Uganda, our French curriculum covers CEFR levels **A1 through B2**:\n" +
      "- **A1**: Basic greetings, introducing yourself, numbers, ordering food.\n" +
      "- **A2**: Daily routines, past events (*passé composé*), shopping, travel.\n" +
      "- **B1**: Expressing opinions, professional communication, the subjunctive.\n\n" +
      "Would you like to practice French vocabulary, prepare for your DELF exam, or ask a specific grammar question?"
    );
  }

  // German inquiries
  if (query.includes("german") || query.includes("deutsch") || query.includes("case") || query.includes("akkusativ") || query.includes("dativ")) {
    return (
      "🇩🇪 **German Grammar: Understanding the 4 Cases (Kasus)**\n\n" +
      "German uses cases to show what role a noun plays in a sentence:\n\n" +
      "1. **Nominativ (Subject - who is doing the action?)**\n" +
      "   - Masculine: *der* Mann / *ein* Mann\n" +
      "   - Feminine: *die* Frau / *eine* Frau\n" +
      "   - Neuter: *das* Kind / *ein* Kind\n" +
      "   - Plural: *die* Kinder\n\n" +
      "2. **Akkusativ (Direct Object - who or what is affected?)**\n" +
      "   - Only masculine changes! *der* becomes **den**, *ein* becomes **einen**.\n" +
      "   - Example: *Ich sehe **den** Lehrer.* (I see the teacher.)\n\n" +
      "3. **Dativ (Indirect Object - to whom/for whom?)**\n" +
      "   - Masculine: **dem** / **einem**\n" +
      "   - Feminine: **der** / **einer**\n" +
      "   - Neuter: **dem** / **einem**\n" +
      "   - Plural: **den** ... + n\n" +
      "   - Example: *Ich gebe **der** Frau das Buch.* (I give the woman the book.)\n\n" +
      "4. **Genitiv (Possession - whose?)**\n" +
      "   - Masculine/Neuter: **des** ... + (e)s | Feminine/Plural: **der**\n\n" +
      "What German level are you preparing for? (A1, A2, or B1)?"
    );
  }

  // Kiswahili inquiries
  if (query.includes("swahili") || query.includes("kiswahili") || query.includes("jambo") || query.includes("habari")) {
    return (
      "🇰🇪 🇹🇿 **Karibu! Kiswahili Essentials for Beginners**\n\n" +
      "Kiswahili is the lingua franca of East Africa. Here are everyday greetings and phrases:\n\n" +
      "- **Hujambo?** → Response: **Sijambo!** *(How are you? → I am fine!)*\n" +
      "- **Habari za asubuhi?** → **Nzuri!** *(Good morning → Good!)*\n" +
      "- **Habari za jioni?** → **Nzuri sana!** *(Good evening → Very good!)*\n" +
      "- **Jina lako nani?** → **Jina langu ni...** *(What is your name? → My name is...)*\n" +
      "- **Unatoka wapi?** → **Ninataka kutoka Uganda.** *(Where are you from? → I am from Uganda.)*\n" +
      "- **Asante sana!** → **Karibu!** *(Thank you very much! → You are welcome!)*\n\n" +
      "Kiswahili uses a phonetic spelling system, so words sound almost exactly as they are written! Would you like to practice forming sentences?"
    );
  }

  // Luganda inquiries
  if (query.includes("luganda") || query.includes("oli otya") || query.includes("gyebaleko")) {
    return (
      "🇺🇬 **Tukusanyukidde! Luganda Greetings & Culture**\n\n" +
      "Luganda is the widely spoken indigenous language in Central Uganda. Greetings carry deep respect:\n\n" +
      "- **Oli otya?** → Response: **Gyendi!** *(How are you? → I am well!)*\n" +
      "- **Mulina batya?** → **Gyetuli!** *(How are you all? → We are well!)*\n" +
      "- **Wasuze otya nno?** → **Bulungi!** *(How was your night? / Good morning! → Good!)*\n" +
      "- **Osiibye otya nno?** → **Bulungi!** *(How has your day been? / Good afternoon!)*\n" +
      "- **Gyebaleko!** → **Kale, naawe gyebale!** *(Well done / Thank you for your work!)*\n" +
      "- **Weebale nnyo!** → *(Thank you very much!)*\n\n" +
      "Would you like to learn about Luganda noun classes (*Engeli z'Amannya*) or everyday market conversation?"
    );
  }

  // Spanish inquiries
  if (query.includes("spanish") || query.includes("español") || query.includes("hola")) {
    return (
      "🇪🇸 **¡Hola! Bienvenido al Departamento de Español en DLA**\n\n" +
      "Key introductory Spanish phrases:\n" +
      "- **¿Cómo estás?** → **¡Muy bien, gracias! ¿Y tú?** *(How are you? → Very well, thanks! And you?)*\n" +
      "- **Me llamo... / Soy de...** *(My name is... / I am from...)*\n" +
      "- **Mucho gusto en conocerte.** *(Pleased to meet you.)*\n" +
      "- **¿Dónde está la clase de idiomas?** *(Where is the language class?)*\n\n" +
      "**Ser vs. Estar (To Be):**\n" +
      "- **Ser**: Permanent characteristics, identity, nationality, time (*Soy de Uganda*).\n" +
      "- **Estar**: Temporary states, locations, feelings (*Estoy en clase*).\n\n" +
      "Would you like to practice verb conjugations or vocabulary?"
    );
  }

  // Arabic inquiries
  if (query.includes("arabic") || query.includes("marhaban") || query.includes("salam")) {
    return (
      "🇸🇦 **أهلاً وسهلاً (Ahlan wa Sahlan) — Welcome to Arabic at DLA!**\n\n" +
      "Essential phrases in Modern Standard Arabic (الفصحى):\n" +
      "- **السلام عليكم (As-salamu alaykum)** → **وعليكم السلام (Wa alaykumu s-salam)**\n" +
      "- **صباح الخير (Sabah al-khayr)** → **صباح النور (Sabah an-noor)** *(Good morning)*\n" +
      "- **شكراً جزيلاً (Shukran jazeelan)** → **عفواً ('Afwan)** *(Thank you very much → You're welcome)*\n" +
      "- **ما اسمك؟ (Ma ismuka/ismuki?)** → **اسمي... (Ismi...)** *(What is your name? → My name is...)*\n\n" +
      "Arabic is written from right to left with 28 letters. Would you like to practice the alphabet, root system, or vocabulary?"
    );
  }

  // Default helpful tutoring response
  return (
    `**Father-DLA AI Language Tutor**\n\n` +
    `I am here to guide your language learning journey at Dream Languages Uganda! ` +
    `You asked: *"${lastMessage.slice(0, 100)}..."*\n\n` +
    `Here are several ways we can tackle this:\n` +
    `1. **Vocabulary & Meaning**: I can provide precise definitions with example sentences and pronunciation guides.\n` +
    `2. **Grammar Breakdown**: We can analyze sentence structure, verb tenses, and grammatical agreements.\n` +
    `3. **Speaking & Dialogue Practice**: We can role-play realistic scenarios (introducing yourself, shopping, job interviews).\n` +
    `4. **Exam & Live Class Prep**: Ask me to test your knowledge or review topics for your upcoming Google Meet live sessions.\n\n` +
    `Feel free to ask a specific question in French, German, Kiswahili, Luganda, English, Spanish, Arabic, or Chinese!`
  );
}

// -------------------------------------------------------------
// Main Dispatcher: Connects AI Agent
// -------------------------------------------------------------
export async function askFatherDla(messages: ChatMessage[]): Promise<AIResponse> {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Priority 1: Google Gemini API
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const answer = await callGemini(messages, geminiKey);
      if (answer) {
        return {
          answer,
          provider: "gemini",
          model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
        };
      }
    } catch (err) {
      console.warn("Gemini call failed, falling back:", err);
    }
  }

  // Priority 2: OpenAI API
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const answer = await callOpenAI(messages, openAiKey);
      if (answer) {
        return {
          answer,
          provider: "openai",
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        };
      }
    } catch (err) {
      console.warn("OpenAI call failed, falling back:", err);
    }
  }

  // Priority 3: Built-in DLA Language Intelligence & Knowledge Engine
  const answer = generateBuiltinResponse(lastUserMessage, messages);
  return {
    answer,
    provider: "dla-engine",
    model: "dla-multilingual-v1",
  };
}

export function getAiAgentStatus() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

  let activeProvider: "gemini" | "openai" | "dla-engine" = "dla-engine";
  if (hasGemini) activeProvider = "gemini";
  else if (hasOpenAi) activeProvider = "openai";

  return {
    status: "active",
    name: "Father-DLA",
    version: "2.0-inaugurated",
    activeProvider,
    providersConfigured: {
      gemini: hasGemini,
      openAi: hasOpenAi,
      builtinEngine: true,
    },
    supportedLanguages: [
      "English",
      "French",
      "German",
      "Kiswahili",
      "Luganda",
      "Spanish",
      "Arabic",
      "Chinese (Mandarin)",
      "Dutch",
      "Japanese",
    ],
  };
}
