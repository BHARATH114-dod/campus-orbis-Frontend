import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeRealtime } from '../services/realtime';
import {
  fetchContacts, fetchConversations, openConversation, fetchMessages, sendMessage, markConversationRead,
} from '../services/messagingService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBoundary from '../components/common/ErrorBoundary';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function StatusDot({ status }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${status === 'online' ? 'bg-teal' : 'bg-ink-light/40'}`} />;
}

// Mobile fix: `100vh`/`dvh` support and keyboard-resize behavior vary a lot
// across mobile browsers and in-app WebViews — that inconsistency is
// exactly why this page worked on some phones and not others. `dvh` (used
// in the className below) already self-corrects on the mobile browsers
// that support it (most current Chrome/Safari). This hook is the fallback
// for the ones that don't: it tracks the actual visible viewport height
// via the widely-supported VisualViewport API and exposes it as a CSS
// custom property, so the chat pane can never size itself past what's
// really on screen — including while the on-screen keyboard is open.
function useVisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const setHeight = () => {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--app-vvh', `${h}px`);
    };
    setHeight();
    if (vv) {
      vv.addEventListener('resize', setHeight);
      vv.addEventListener('scroll', setHeight);
    } else {
      window.addEventListener('resize', setHeight);
    }
    return () => {
      if (vv) {
        vv.removeEventListener('resize', setHeight);
        vv.removeEventListener('scroll', setHeight);
      } else {
        window.removeEventListener('resize', setHeight);
      }
    };
  }, []);
}

// A small, reusable "this list failed to load" panel — distinct from the
// "loaded fine, there's just nothing here yet" empty state below, so a
// broken request never looks identical to a genuinely empty inbox.
function ListError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
      <p className="text-xs font-semibold text-crimson">⚠ {message || 'Something went wrong loading this.'}</p>
      <button type="button" onClick={onRetry} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:bg-paper">
        Try again
      </button>
    </div>
  );
}

// items 3/4: Contact HOD / Contact Faculty + conversation history, shared
// by both HOD and Faculty — which tabs and which contacts appear are
// entirely decided server-side (GET /api/messaging/contacts), so a
// faculty account here only ever sees their own department's HOD, and a
// HOD only ever sees other HODs + their own department's faculty.
//
// Wrapped in an ErrorBoundary at export so a render-time error anywhere in
// this page (or a future change to it) shows a recoverable "Try again"
// panel instead of a blank white screen — this page previously had no
// boundary at all, so any uncaught error here took down the whole view
// with nothing on screen and no way back except a manual reload.
export default function Messages() {
  return (
    <ErrorBoundary message="Something went wrong loading Messages.">
      <MessagesInner />
    </ErrorBoundary>
  );
}

function MessagesInner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState('conversations'); // 'conversations' | 'contacts'
  const [contactType, setContactType] = useState('hod');
  const [contacts, setContacts] = useState([]);
  const [contactsError, setContactsError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationsError, setConversationsError] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeOther, setActiveOther] = useState(null); // { username, name, role, department, status }
  // Mobile fix: on a phone, the list and the open conversation used to
  // stack vertically in normal document flow — tapping a contact opened
  // the conversation, but it rendered far below the (often long,
  // unscrollable-on-its-own) list, off the bottom of the screen with
  // nothing telling the person to scroll. That's what read as "conversation
  // won't open" / a blank screen. On mobile we now show exactly one pane
  // at a time; desktop is unaffected (both panes always show side by side
  // there, this state is simply unused above the md breakpoint).
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  useVisualViewportHeight();

  // NOTE: the "is there a signed-in user yet" guard below deliberately
  // comes AFTER every hook in this component (see the `if (!user)` return
  // right before the JSX return) — React requires the exact same hooks to
  // run in the exact same order on every render, so an early return placed
  // before a useState/useEffect would make this component call a
  // different number of hooks depending on whether `user` is set, which
  // throws its own React error. Every hook below is written to tolerate
  // `user` being temporarily null instead.

  const isHod = user?.role === 'hod';

  const loadConversations = () => {
    setConversationsError(null);
    return fetchConversations()
      .then(setConversations)
      .catch((err) => {
        const message = err.message || 'Could not load conversations.';
        setConversationsError(message);
        showToast(message, 'error');
      });
  };

  const loadContacts = () => {
    setLoadingList(true);
    setContactsError(null);
    fetchContacts({ type: isHod ? contactType : 'hod', q: search || undefined })
      .then(setContacts)
      .catch((err) => {
        const message = err.message || 'Could not load contacts.';
        setContactsError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    setLoadingList(true);
    loadConversations().finally(() => setLoadingList(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile-network fallback: the realtime WebSocket can silently fail to
  // connect or drop on a restrictive/slow mobile network (corporate proxy,
  // carrier middlebox, some in-app WebViews) with nothing surfaced to the
  // user — see the design note in services/realtime.js. Every other
  // realtime screen in this app pairs its socket subscription with a slow
  // poll fallback; this page was missing that pairing, so a phone whose
  // network silently blocked the WS upgrade would just never see new
  // conversations/unread counts show up. This closes that gap.
  useEffect(() => {
    const t = setInterval(() => { loadConversations(); }, 20000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view !== 'contacts') return;
    const t = setTimeout(loadContacts, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [view, contactType, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: a message landing in ANY of the user's conversations
  // refreshes the conversation list (for unread counts / ordering); the
  // open thread also listens for its own conversation_id to refetch. Also
  // wired into the real, OS-level push notification system (see
  // sendPushToUsers/notifyUsers in Backend/server.js) — every staff
  // message triggers both this in-app realtime refresh AND a device push
  // to the recipient, with no separate integration needed here: that
  // happens once, centrally, on the backend.
  useEffect(() => {
    if (!user?.username) return undefined;
    return subscribeRealtime(`user:${user.username}`, (msg) => {
      if (msg.type !== 'staff_message') return;
      loadConversations();
    });
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Defensive guard: ProtectedRoute already keeps this page from mounting
  // before the signed-in user is known, but a 401 elsewhere in the app can
  // clear the user out from under an already-mounted page (see api.js's
  // interceptor) — this avoids a "Cannot read properties of null" crash
  // in that narrow window, in favor of the same loading spinner used
  // everywhere else while the app redirects to /login. Placed after every
  // hook above so hook order/count never changes across renders.
  if (!user) return <LoadingSpinner fullPage label="Loading…" />;

  const handleOpenContact = async (contact) => {
    try {
      const conv = await openConversation(contact.username);
      setActiveConversationId(conv.id);
      setActiveOther({ username: contact.username, name: contact.name, role: contact.role, department: contact.department, status: contact.status });
      setView('conversations');
      setMobileView('chat');
    } catch (err) {
      showToast(err.message || 'Could not start this conversation.', 'error');
    }
  };

  const handleOpenConversation = (conv) => {
    setActiveConversationId(conv.id);
    setActiveOther({ username: conv.other_username, name: conv.other_name, role: conv.other_role, department: conv.other_department, status: conv.other_status });
    setMobileView('chat');
  };

  const handleBackToList = () => setMobileView('list');

  return (
    <div>
      <div className={`mb-5 flex-wrap items-center justify-between gap-3 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div>
          <h1 className="text-xl font-bold text-ink">Messages</h1>
          <p className="text-sm text-ink-light">
            {isHod ? 'Message other HODs or your own department\u2019s faculty.' : 'Message your department\u2019s HOD.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('conversations')} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${view === 'conversations' ? 'bg-hero-primary text-white' : 'border border-line text-ink-light'}`}>
            Conversations
          </button>
          <button type="button" onClick={() => setView('contacts')} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${view === 'contacts' ? 'bg-hero-primary text-white' : 'border border-line text-ink-light'}`}>
            {isHod ? 'Contact HOD / Faculty' : 'Contact HOD'}
          </button>
        </div>
      </div>

      {/* Mobile fix: bounded, keyboard-safe height (see useVisualViewportHeight
          above) so each pane scrolls internally instead of the whole page
          growing to fit every message/contact and pushing the compose bar
          off screen. Desktop (md:) is untouched — fixed 600px, both panes
          always visible side by side, exactly as before. */}
      <div className="grid grid-cols-1 gap-4 md:h-[600px] md:grid-cols-[300px_1fr]">
        <div className={`h-[min(75dvh,calc(var(--app-vvh,100vh)-260px))] min-h-0 overflow-y-auto rounded-2xl border border-line bg-paper-card p-3 md:h-full ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
          {view === 'contacts' ? (
            <>
              {isHod && (
                <div className="mb-2 flex gap-2">
                  <button type="button" onClick={() => setContactType('hod')} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold ${contactType === 'hod' ? 'bg-teal/10 text-teal' : 'text-ink-light hover:bg-paper'}`}>Contact HOD</button>
                  <button type="button" onClick={() => setContactType('faculty')} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold ${contactType === 'faculty' ? 'bg-teal/10 text-teal' : 'text-ink-light hover:bg-paper'}`}>Contact Faculty</button>
                </div>
              )}
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isHod && contactType === 'faculty' ? 'Search Faculty' : 'Search HOD'}
                className="mb-2 w-full rounded-full border border-line bg-paper px-3 py-1.5 text-xs outline-none focus:border-hero-primary"
              />
              {loadingList ? (
                <LoadingSpinner label="Loading…" size="sm" />
              ) : contactsError ? (
                <ListError message={contactsError} onRetry={loadContacts} />
              ) : contacts.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-ink-light">Nobody available to contact yet.</p>
              ) : (
                <ul className="space-y-1">
                  {contacts.map((c) => (
                    <li key={c.username}>
                      <button type="button" onClick={() => handleOpenContact(c)} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-paper ${activeOther?.username === c.username ? 'bg-paper' : ''}`}>
                        <StatusDot status={c.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                          <span className="block truncate text-[11px] text-ink-light">{c.role === 'hod' ? 'HOD' : 'Faculty'} · {c.department}{c.college_name ? ` · ${c.college_name}` : ''}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : loadingList ? (
            <LoadingSpinner label="Loading…" size="sm" />
          ) : conversationsError ? (
            <ListError message={conversationsError} onRetry={loadConversations} />
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-light">No conversations yet — start one from Contacts.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => handleOpenConversation(c)} className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-paper ${activeConversationId === c.id ? 'bg-paper' : ''}`}>
                    <StatusDot status={c.other_status} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.other_name}</span>
                        <span className="shrink-0 text-[10px] text-ink-light">{formatTime(c.last_message_at)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-ink-light">{c.last_message_preview || 'Say hello \u2014'}</span>
                        {c.unread_count > 0 && <span className="shrink-0 rounded-full bg-crimson px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unread_count}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`h-[min(75dvh,calc(var(--app-vvh,100vh)-260px))] min-h-0 rounded-2xl border border-line bg-paper-card md:h-full ${mobileView === 'chat' ? 'block' : 'hidden md:block'}`}>
          {activeConversationId ? (
            <ErrorBoundary
              key={activeConversationId /* a fresh boundary per conversation, so switching threads always clears a prior crash */}
              message="Something went wrong loading this conversation."
              onReset={() => setActiveConversationId(null)}
            >
              <ChatThread conversationId={activeConversationId} other={activeOther} onMessageSent={loadConversations} onBack={handleBackToList} />
            </ErrorBoundary>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-sm text-ink-light">
              Select a conversation, or start a new one from {isHod ? 'Contact HOD / Faculty' : 'Contact HOD'}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatThread({ conversationId, other, onMessageSent, onBack }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    setLoadError(null);
    return fetchMessages(conversationId)
      .then(({ messages: msgs }) => setMessages(msgs || []))
      .catch((err) => {
        const message = err.message || 'Could not load messages.';
        setLoadError(message);
        showToast(message, 'error');
      });
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same mobile-network fallback as the conversation list above — an open
  // thread refetches on a slow interval too, so a message from the other
  // person still shows up (just not instantly) on a phone whose network
  // silently dropped the WebSocket.
  useEffect(() => {
    const t = setInterval(() => { load(); }, 8000);
    return () => clearInterval(t);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => bottomRef.current?.scrollIntoView({ block: 'end' }), [messages.length]);

  // item 3/4: near-real-time — a message landing in this exact
  // conversation refetches history immediately instead of waiting on a
  // slower list-level poll.
  useEffect(() => {
    if (!user?.username) return undefined;
    return subscribeRealtime(`user:${user.username}`, (msg) => {
      if (msg.type === 'staff_message' && msg.conversation_id === conversationId) {
        load();
        markConversationRead(conversationId).catch(() => {});
      }
    });
  }, [conversationId, user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same hook-order reasoning as MessagesInner above: this guard runs
  // after every hook in this component, never before.
  if (!user) return <LoadingSpinner fullPage label="Loading…" />;

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      const message = await sendMessage(conversationId, body);
      setMessages((prev) => [...prev, message]);
      onMessageSent();
    } catch (err) {
      showToast(err.message || 'Could not send that message.', 'error');
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversation list"
            className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink hover:bg-paper md:hidden"
          >
            ←
          </button>
        )}
        <StatusDot status={other?.status} />
        <div>
          <p className="text-sm font-bold text-ink">{other?.name || 'Conversation'}</p>
          <p className="text-[11px] text-ink-light">{other?.role === 'hod' ? 'HOD' : other?.role === 'faculty' ? 'Faculty' : ''}{other?.department ? ` · ${other.department}` : ''} · {other?.status === 'online' ? 'Online' : 'Offline'}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading ? (
          <LoadingSpinner label="Loading messages…" size="sm" />
        ) : loadError ? (
          <ListError message={loadError} onRetry={load} />
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-light">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_username === user.username;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-hero-primary text-white' : 'bg-paper text-ink'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/70' : 'text-ink-light'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex shrink-0 gap-2 border-t border-line p-3">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…"
          enterKeyHint="send" autoComplete="off"
          className="flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hero-primary"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
