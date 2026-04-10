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

async function checkAllFieldsPresent(userText, apiKey) {
  if (!apiKey || apiKey === 'your_api_key_here') {
    return false
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'user',
            content: `Analyze this text for website project details. Check if it contains ALL 4 of these types of information (accept related terms and contextual meaning):
1) BUSINESS IDENTIFICATION - business name, company name, organization name, clinic name, brand name, etc.
2) CONTACT INFORMATION - phone number, email address, ways to reach, contact methods, etc.
3) DESIGN/WEBSITE INFO - website type, design style, layout description, color theme, features, pages needed, visual requirements, etc.
4) LOCATION/ADDRESS - physical address, office location, street address, city, service area, where business is located, etc.

Respond with ONLY "YES" if the text contains all 4 types of information, otherwise respond "NO". Do not explain.

Text: "${userText}"`
          }
        ],
        max_tokens: 20,
      }),
    })
    const data = await response.json()
    const result = data.choices[0].message.content.trim().toUpperCase()
    return result.includes('YES')
  } catch (error) {
    console.error('Field check API error:', error)
    return false
  }
}

async function getMissingFields(userText, apiKey) {
  if (!apiKey || apiKey === 'your_api_key_here') {
    return ['Business Name', 'Contact Details', 'Web Design Info', 'Address']
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'user',
            content: `Analyze this text for website project details. Identify which of these 4 information types are MISSING (accept related terms and contextual meaning):
1) BUSINESS IDENTIFICATION - business name, company name, organization name, clinic name, brand name, etc.
2) CONTACT INFORMATION - phone number, email address, ways to reach, contact methods, etc.
3) DESIGN/WEBSITE INFO - website type, design style, layout description, color theme, features, pages needed, visual requirements, etc.
4) LOCATION/ADDRESS - physical address, office location, street address, city, service area, where business is located, etc.

Respond with a list of missing categories only. Use exact format: "Business Name", "Contact Details", "Web Design Info", "Address". If all are present, respond with "NONE". Do not explain.

Text: "${userText}"`
          }
        ],
        max_tokens: 50,
      }),
    })
    const data = await response.json()
    const result = data.choices[0].message.content.trim()
    if (result.includes('NONE')) return []
    const missing = []
    if (result.includes('Business')) missing.push('Business Name')
    if (result.includes('Contact') || result.includes('contact')) missing.push('Contact Details')
    if (result.includes('Design') || result.includes('design') || result.includes('website')) missing.push('Web Design Info')
    if (result.includes('Address') || result.includes('address') || result.includes('Location') || result.includes('location')) missing.push('Address')
    return missing
  } catch (error) {
    console.error('Field extraction API error:', error)
    return ['Business Name', 'Contact Details', 'Web Design Info', 'Address']
  }
}

function MessageBubble({ role, content, type = 'default' }) {
  const isUser = role === 'user'
  let bubbleClass = isUser ? 'bubble bubble--user' : 'bubble bubble--ai'
  
  // Add type-specific styling
  if (type === 'status') bubbleClass += ' bubble--status'
  else if (type === 'missing') bubbleClass += ' bubble--missing'
  else if (type === 'success') bubbleClass += ' bubble--success'
  else if (type === 'error') bubbleClass += ' bubble--error'

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
          <MessageBubble key={m.id} role={m.role} content={m.content} type={m.type} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function InputBar({ onSend }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  function sendAndClear() {
    const text = value
    setValue('')
    onSend(text)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }, 0)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAndClear()
    }
  }

  function handleChange(e) {
    const text = e.target.value
    setValue(text)
    // Auto-expand textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }

  const canSend = value.trim().length > 0

  return (
    <div className="inputBar">
      <textarea
        ref={textareaRef}
        className="inputBar__input"
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder="Message Champtrix Launch Pad…"
        rows={1}
      />

      <button
        className="inputBar__send"
        onClick={sendAndClear}
        disabled={!canSend}
        aria-label="Send message"
        type="button"
      >
        ⏎ Send
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
      type: 'default',
      content:
        "Hi! I'm Champtrix Launch Pad.\n\nTell me what you want to build and include:\n- Business Name\n- Contact Details\n- Address\n- Type of Website",
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
      const newUserMessage = {
        id: nowId(),
        role: 'user',
        type: 'default',
        content: trimmed,
        createdAt: Date.now(),
      }
      await pushMessage(newUserMessage)

      const apiKey = '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'
      let aiResponse = 'Sorry, API key not configured or API error occurred.'

      if (apiKey && apiKey !== 'your_api_key_here') {
        // First check if all 4 fields are present
        const allFieldsPresent = await checkAllFieldsPresent(trimmed, apiKey)
        
        if (allFieldsPresent) {
          aiResponse = 'Your website is being created. It will take 5-10 minutes. Status: In Progress. Please wait.'
        } else {
          // Get missing fields
          const missingFields = await getMissingFields(trimmed, apiKey)
          if (missingFields.length > 0) {
            aiResponse = `Missing: ${missingFields.join(', ')}`
          } else {
            aiResponse = 'Please provide all required information: Business Name, Contact Details, Web Design Info, and Address.'
          }
        }
      }

      let msgType = 'default'
      let displayContent = aiResponse
      
      if (aiResponse.includes('Your website is being created')) {
        msgType = 'success'
        displayContent = `✅ Website Creation Initiated\n\n${aiResponse}\n\n⏳ Estimated Time: 5-10 minutes\n📊 Status: Processing your request`
      } else if (aiResponse.includes('Missing:')) {
        msgType = 'missing'
        displayContent = `⚠️ Incomplete Information\n\n${aiResponse}\n\nPlease provide the missing details to proceed.`
      } else if (aiResponse.includes('Sorry') || aiResponse.includes('error')) {
        msgType = 'error'
        displayContent = `❌ Error\n\n${aiResponse}`
      }

      await pushMessage({
        id: nowId(),
        role: 'ai',
        content: displayContent,
        type: msgType,
        createdAt: Date.now(),
      })
    } finally {
      isRespondingRef.current = false
    }
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="appHeader__subtitle">Champtrix Launch Pad</div>
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