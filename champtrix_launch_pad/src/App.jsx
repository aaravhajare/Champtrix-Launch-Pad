import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenize(text) {
  const cleaned = normalizeText(text).replace(/[^a-z0-9\s]/g, ' ')
  return cleaned.split(' ').filter(Boolean)
}

function mockRerank({ query, documents }) {
  // Future integration (NO real calls now):
  // POST https://openrouter.ai/api/v1/rerank
  // model: "cohere/rerank-4-pro"
  // body: { query, documents }
  const qTokens = new Set(tokenize(query))

  const scored = documents.map((doc) => {
    const dTokens = tokenize(`${doc.title} ${doc.text}`)
    let score = 0
    for (const t of dTokens) {
      if (qTokens.has(t)) score += 1
    }
    return { ...doc, score }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, 3)
}

function detectMissingBusinessInfo(userText) {
  const text = userText.trim()
  const t = normalizeText(text)

  const hasBusinessName =
    /\bbusiness name\b/i.test(text) ||
    /\b(my|our)\s+business\s+(is|name\s+is)\b/i.test(text) ||
    /\bcompany\s+name\b/i.test(text)

  const hasContactInfo =
    /\bcontact\b/i.test(text) ||
    /\b(email|e-mail)\b/i.test(text) ||
    /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(text) ||
    /\b(\+?\d[\d\s().-]{7,}\d)\b/.test(text)

  const hasAddress =
    /\baddress\b/i.test(text) ||
    /\b(street|st\.|road|rd\.|ave|avenue|blvd|boulevard|lane|ln\.|city|zip|postal)\b/i.test(
      t,
    ) ||
    /\b\d{1,6}\s+[a-zA-Z0-9.\s-]{3,}\b/.test(text)

  const hasWebsiteType =
    /\btype of website\b/i.test(text) ||
    /\b(website|site)\s+(type|is|for)\b/i.test(text) ||
    /\b(ecommerce|e-commerce|portfolio|landing page|business site|restaurant|booking|saas|blog)\b/i.test(
      t,
    )

  const missing = []
  if (!hasBusinessName) missing.push('Business Name')
  if (!hasContactInfo) missing.push('Contact Details')
  if (!hasAddress) missing.push('Address')
  if (!hasWebsiteType) missing.push('Type of Website')
  return missing
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  const bubbleClass = isUser ? 'bubble bubble--user' : 'bubble bubble--ai'

  return (
    <div className={isUser ? 'row row--right' : 'row row--left'}>
      <div className={bubbleClass}>
        <div className="bubble__text">{content}</div>
      </div>
    </div>
  )
}

function ChatWindow({ messages }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  return (
    <div className="chatWindow" role="log" aria-live="polite" aria-relevant="additions">
      <div className="chatWindow__inner">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function InputBar({ onSend }) {
  const [value, setValue] = useState('')

  function sendAndClear() {
    const text = value
    setValue('')
    onSend(text)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAndClear()
    }
  }

  const canSend = value.trim().length > 0

  return (
    <div className="inputBar">
      <textarea
        className="inputBar__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Message Champtrix AI Agent…"
        rows={1}
      />

      <button
        className="inputBar__send"
        onClick={sendAndClear}
        disabled={!canSend}
        aria-label="Send message"
        type="button"
      >
        Send
      </button>
    </div>
  )
}

export default function App() {
  const mockDocuments = useMemo(
    () => [
      {
        id: 'doc-1',
        title: 'Website Types (Examples)',
        text: 'Common types: landing page, ecommerce store, portfolio, restaurant menu, booking site, SaaS marketing site.',
      },
      {
        id: 'doc-2',
        title: 'Business Info Checklist',
        text: 'To generate a business website, we typically need business name, contact info (phone/email), address/location, and the website type.',
      },
      {
        id: 'doc-3',
        title: 'Contact Details Formats',
        text: 'Provide phone number with country code if possible, and a business email address like hello@yourdomain.com.',
      },
      {
        id: 'doc-4',
        title: 'Address Tips',
        text: 'Include street, city, state/province, and postal code. If online-only, specify service area instead.',
      },
    ],
    [],
  )

  const [messages, setMessages] = useState(() => [
    {
      id: nowId(),
      role: 'ai',
      content:
        "Hi! I'm Champtrix AI Agent.\n\nTell me what you want to build and include:\n- Business Name\n- Contact Details\n- Address\n- Type of Website",
      createdAt: Date.now(),
    },
  ])

  const isRespondingRef = useRef(false)

  async function pushMessage(next) {
    setMessages((prev) => [...prev, next])
    await sleep(80)
  }

  async function handleSend(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    if (isRespondingRef.current) return

    isRespondingRef.current = true
    try {
      await pushMessage({
        id: nowId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      })

      await sleep(250)
      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: '🧠 Understanding your request...',
        createdAt: Date.now(),
      })

      const topDocs = mockRerank({ query: trimmed, documents: mockDocuments })
      await sleep(250)
      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: `📚 Context selected (mock rerank):\n- ${topDocs.map((d) => d.title).join('\n- ')}`,
        createdAt: Date.now(),
      })

      const missing = detectMissingBusinessInfo(trimmed)
      await sleep(350)
      if (missing.length > 0) {
        await pushMessage({
          id: nowId(),
          role: 'ai',
          content:
            `❗ Missing Information:\nPlease provide:\n\n` +
            missing.map((m) => `- ${m}`).join('\n'),
          createdAt: Date.now(),
        })
        return
      }

      await sleep(300)
      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: '⏱️ Estimated Time: 2–10 minutes',
        createdAt: Date.now(),
      })

      await sleep(300)
      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: ['✅ Plan:', '1. Analyze input', '2. Structure website data', '3. Generate output'].join(
          '\n',
        ),
        createdAt: Date.now(),
      })

      await sleep(300)
      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: '🔗 Your website link will be generated after processing',
        createdAt: Date.now(),
      })
    } finally {
      isRespondingRef.current = false
    }
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="appHeader__title">Champtrix AI 💬</div>
        <div className="appHeader__subtitle">Champtrix AI Agent</div>
      </header>

      <main className="appMain" aria-label="Chat">
        <ChatWindow messages={messages} />
      </main>

      <footer className="appFooter">
        <InputBar onSend={handleSend} />
      </footer>
    </div>
  )
}