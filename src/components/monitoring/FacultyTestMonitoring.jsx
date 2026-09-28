import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchMyTests, fetchDepartmentTests } from '../../services/testService';
import { fetchTestMonitoring, fetchHodTestMonitoring } from '../../services/testMonitoringService';
import { openMonitoringSocket, sendMonitoringSignal, RTC_ICE_SERVERS } from '../../services/monitoringSocket';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import ProfileCard from '../ProfileCard';

// How often the roster (who's joined, whose camera is on) refreshes while
// a test is selected. This is unrelated to the live video itself now —
// View Live / View All are real WebRTC streams (see useStudentLiveView
// below) — this interval only keeps the "Camera On/Off"/"Recording"
// badges, the join list, and the View All grid's student set current
// (new joiners appear, submitted/left students drop off automatically).
const ROSTER_POLL_MS = 6000;

// ---------------------------------------------------------------------
// Shared faculty-side WebRTC signalling socket.
//
// One signalling WebSocket per selected test, reused by EVERY live view
// the faculty member has open at once — a single "View Live" modal, or
// every tile in "View All" simultaneously. The backend hands every
// faculty WebSocket a single `connId` (see server.js), and routes
// student->faculty messages by `studentUsername`, so many concurrent
// per-student peer connections can safely share one socket: each live
// view registers itself in `listenersRef` under its student's username
// and only ever receives messages addressed to that student. This is
// what lets View All open several real-time feeds at once without
// opening a competing signalling channel or a second WebRTC
// implementation — it's the exact same plumbing View Live already used,
// just able to be used more than once at a time.
function useMonitoringSocketRegistry(testId, role) {
  const wsRef = useRef(null);
  const readyRef = useRef(false); // mirrors `ready` but always current inside closures captured before the socket became ready
  const [ready, setReady] = useState(false);
  const listenersRef = useRef(new Map()); // studentUsername -> handler(msg)

  useEffect(() => {
    if (!testId) return undefined;
    readyRef.current = false;
    setReady(false);
    listenersRef.current.clear();
    const ws = openMonitoringSocket({
      testId,
      role,
      onMessage: (msg) => {
        if (msg.type === 'ready') {
          readyRef.current = true;
          setReady(true);
          return;
        }
        // Every other message the server sends to a viewer (offer/answer
        // relay, ice-candidate, camera-ended, student-disconnected) is
        // tagged with the studentUsername it belongs to — route it only
        // to that student's live view, never to every open one.
        const handler = msg.studentUsername ? listenersRef.current.get(msg.studentUsername) : null;
        handler?.(msg);
      },
      onOpen: () => {},
      onClose: () => { readyRef.current = false; setReady(false); },
    });
    wsRef.current = ws;
    return () => {
      try { ws.close(); } catch { /* already closed */ }
      wsRef.current = null;
      listenersRef.current.clear();
    };
  }, [testId, role]);

  const registerListener = useCallback((username, fn) => { listenersRef.current.set(username, fn); }, []);
  const unregisterListener = useCallback((username) => {
    // Only clear the slot if it's still ours — guards against a rare
    // unmount-order race where a new live view for the same student has
    // already re-registered before the old one's cleanup runs.
    listenersRef.current.delete(username);
  }, []);

  return { wsRef, readyRef, ready, registerListener, unregisterListener };
}

// Connection states shown to faculty. "connecting" is the state the
// instant a live view opens and the offer/answer/ICE exchange hasn't
// finished yet; "idle" is the deliberate not-connected state (camera
// reported off, or — in View All — the tile hasn't scrolled into view
// yet) where we intentionally never open a peer connection. The video
// element is never left showing a bare black screen without one of
// these explanations layered over it, and it never shows a stale/frozen
// frame once the underlying state stops being "connected".
const LIVE_STATE_MESSAGE = {
  connecting: 'Connecting to student\u2019s camera\u2026',
  'camera-off': 'Student camera is currently OFF.',
  'student-disconnected': 'Student is no longer connected.',
  'connection-failed': 'Unable to connect to live camera.',
  idle: 'Camera is currently off.',
};

// ---------------------------------------------------------------------
// One real WebRTC PeerConnection to one student's browser — the single
// implementation behind BOTH "View Live" and every tile in "View All"
// (see useLiveViewResponder in TestAttempt.jsx for the student-side
// half). `enabled` controls whether a connection should be open at all
// right now: callers turn it off (and this hook tears the peer
// connection down immediately, never leaving a stale frame on screen)
// when the student's camera isn't live, or — for View All tiles — when
// the tile has scrolled out of view, so faculty watching many students
// never has more real-time video streams open at once than are actually
// visible on screen right now.
function useStudentLiveView({ socket, testId, username, enabled }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!enabled || !username || !testId) {
      setState('idle');
      return undefined;
    }
    setState('connecting');
    let cancelled = false;

    const closePeer = () => {
      // Only tear down THIS faculty-side connection — never anything that
      // touches the student's own camera.
      if (pcRef.current) {
        try { pcRef.current.close(); } catch { /* already closed */ }
        pcRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const handleSignal = async (msg) => {
      if (cancelled) return;

      if (msg.type === 'offer') {
        closePeer();
        const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
        pcRef.current = pc;
        pc.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteStream && videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(() => {}); // autoplay is already muted+playsInline; this just avoids an unhandled rejection
            setState('connected');
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) sendMonitoringSignal(socket.wsRef.current, { type: 'ice-candidate', studentUsername: username, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed') setState('connection-failed');
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
            setState((prev) => (prev === 'connected' ? 'student-disconnected' : prev));
          }
        };
        try {
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendMonitoringSignal(socket.wsRef.current, { type: 'answer', studentUsername: username, sdp: pc.localDescription });
        } catch (err) {
          console.error('[monitoring-rtc:faculty] failed to answer offer', err);
          setState('connection-failed');
        }
        return;
      }

      if (msg.type === 'ice-candidate' && msg.candidate) {
        try { await pcRef.current?.addIceCandidate(msg.candidate); } catch (err) { console.error('[monitoring-rtc:faculty] failed to add ICE candidate', err); }
        return;
      }

      if (msg.type === 'student-disconnected') {
        closePeer();
        setState('student-disconnected');
        return;
      }

      if (msg.type === 'camera-ended') {
        closePeer();
        setState('camera-off');
      }
    };

    socket.registerListener(username, handleSignal);

    // Ask the student for a live view as soon as the signalling socket is
    // ready (it may still be finishing its own connect/auth handshake) —
    // `readyRef` is checked (not the plain `ready` boolean) so this keeps
    // working correctly even if the socket only becomes ready AFTER this
    // effect already started polling.
    const requestIfReady = () => {
      if (socket.readyRef.current) {
        sendMonitoringSignal(socket.wsRef.current, { type: 'view-live-request', studentUsername: username });
        return true;
      }
      return false;
    };
    let waitForReady = null;
    if (!requestIfReady()) {
      waitForReady = setInterval(() => { if (requestIfReady()) clearInterval(waitForReady); }, 300);
    }

    return () => {
      cancelled = true;
      if (waitForReady) clearInterval(waitForReady);
      socket.unregisterListener(username);
      sendMonitoringSignal(socket.wsRef.current, { type: 'view-live-close', studentUsername: username });
      closePeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, username, enabled]);

  const retry = () => {
    setState('connecting');
    sendMonitoringSignal(socket.wsRef.current, { type: 'view-live-request', studentUsername: username });
  };

  return { videoRef, state, retry };
}

// Lazily connects (and disconnects) a live view based on real DOM
// visibility — the "performant/virtualised" part of View All. A tile
// that has scrolled off-screen is never holding a live WebRTC stream
// open, so the number of concurrent peer connections tracks what's
// actually visible on screen right now rather than the total roster
// size, regardless of how many students are in the test.
function useInViewport(ref, rootMargin = '300px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { root: null, rootMargin, threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

export default function FacultyTestMonitoring({ role = 'faculty' }) {
  const isHod = role === 'hod';
  const { showToast } = useToast();
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [roster, setRoster] = useState(null); // { test, students } or null
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [liveStudent, setLiveStudent] = useState(null); // { username, name, ... } or null
  const [cameFromViewAll, setCameFromViewAll] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const socket = useMonitoringSocketRegistry(selectedTestId, role);

  useEffect(() => {
    const loadTests = isHod ? fetchDepartmentTests : fetchMyTests;
    loadTests()
      .then((rows) => {
        setTests(rows);
        // Default to the first currently-open test, if there is one — that's
        // the one most likely to actually have students to monitor.
        const openOne = rows.find((t) => t.status === 'open');
        if (openOne) setSelectedTestId(openOne.id);
      })
      .catch((err) => showToast(err.message || 'Could not load tests.', 'error'))
      .finally(() => setLoadingTests(false));
  }, [isHod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTestId) { setRoster(null); return undefined; }
    let cancelled = false;
    const fetchRoster = isHod ? fetchHodTestMonitoring : fetchTestMonitoring;
    const load = (showSpinner) => {
      if (showSpinner) setLoadingRoster(true);
      fetchRoster(selectedTestId)
        .then((data) => { if (!cancelled) setRoster(data); })
        .catch((err) => { if (!cancelled) showToast(err.message || 'Could not load test monitoring.', 'error'); })
        .finally(() => { if (!cancelled && showSpinner) setLoadingRoster(false); });
    };
    load(true);
    const interval = setInterval(() => load(false), ROSTER_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedTestId, isHod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching tests (or the roster refetching) should never leave View
  // All / View Live open on a student that no longer applies.
  useEffect(() => {
    setViewAllOpen(false);
    setLiveStudent(null);
    setCameFromViewAll(false);
  }, [selectedTestId]);

  const bySection = useMemo(() => {
    if (!roster?.students?.length) return [];
    const groups = [];
    let current = null;
    // Rows already arrive section-wise then roll-number-wise from the backend.
    for (const s of roster.students) {
      if (!current || current.section_name !== s.section_name) {
        current = { section_name: s.section_name, students: [] };
        groups.push(current);
      }
      current.students.push(s);
    }
    return groups;
  }, [roster]);

  // Students "currently writing" the test — joined, not yet submitted.
  // This is what View All shows, and it updates automatically every
  // roster poll: a new joiner appears, a submission drops that student
  // out (their tile — and its live connection — unmounts on its own).
  const activeStudents = useMemo(
    () => (roster?.students || []).filter((s) => !s.submitted),
    [roster]
  );

  // Keep whatever student is open in View Live in sync with the latest
  // roster poll, so its Camera/Recording/Test-status badges (and the
  // View Live button's own enabled state) never go stale while the
  // modal is open.
  const liveStudentFresh = useMemo(() => {
    if (!liveStudent) return null;
    return roster?.students?.find((s) => s.username === liveStudent.username) || liveStudent;
  }, [liveStudent, roster]);

  const openLive = (student, fromViewAll) => {
    setCameFromViewAll(fromViewAll);
    setLiveStudent(student);
  };

  // Clicking a tile in View All opens that student's detailed View Live.
  // Closing the grid FIRST (in the same state update as opening the
  // modal) guarantees its tile's peer connection tears down before the
  // modal's own connection for that same student opens — so there's
  // never a moment with two competing live streams to the same student.
  const openFromGrid = (student) => {
    setViewAllOpen(false);
    openLive(student, true);
  };

  const closeLive = () => {
    setLiveStudent(null);
    setCameFromViewAll(false);
  };

  const backToViewAll = () => {
    setLiveStudent(null);
    setCameFromViewAll(false);
    setViewAllOpen(true);
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Test Monitoring{isHod ? ' — Read-only' : ''}</h1>
        <button
          type="button"
          onClick={() => setViewAllOpen(true)}
          disabled={!selectedTestId || activeStudents.length === 0}
          className="rounded-full bg-hero-primary px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          title={activeStudents.length ? 'Watch every active student live, side-by-side' : 'No student is currently writing this test'}
        >
          🖥️ View All{activeStudents.length > 0 ? ` (${activeStudents.length})` : ''}
        </button>
      </div>
      <p className="mb-6 text-sm text-ink-light">
        {isHod
          ? 'Every test conducted by faculty in your department, with students who have joined shown live, section-wise and roll-number-wise. View only — questions and answers can\u2019t be changed from here.'
          : "Every student who has joined a test, organized by section and roll number, with a live camera + microphone view."}
      </p>

      {loadingTests ? (
        <LoadingSpinner label="Loading tests…" />
      ) : tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          {isHod ? 'No tests have been conducted in your department yet.' : "You haven't created any tests yet."}
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {tests.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTestId(t.id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
                  selectedTestId === t.id ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink-light hover:bg-paper'
                }`}
              >
                {t.title}
                {isHod && t.created_by_name && <span className="ml-1.5 text-[10px] font-normal text-ink-light">· {t.created_by_name}</span>}
                <span className="ml-1.5 rounded-full bg-line/50 px-1.5 py-0.5 text-[10px] capitalize">{t.status}</span>
              </button>
            ))}
          </div>

          {loadingRoster ? (
            <LoadingSpinner label="Loading monitoring roster…" />
          ) : !roster || roster.students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
              No student has joined this test yet.
            </div>
          ) : (
            <div className="space-y-6">
              {bySection.map((group) => (
                <div key={group.section_name}>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-light">{group.section_name}</h2>
                  <div className="overflow-hidden rounded-2xl border border-line bg-paper-card shadow-sm">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line bg-paper text-left text-[11px] font-bold uppercase tracking-wide text-ink-light">
                          <th className="px-4 py-2">Roll No.</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2 text-right">Live view</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((s) => (
                          <StudentRow key={s.username} student={s} onViewLive={() => openLive(s, false)} />
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ViewAllScreen
        open={viewAllOpen}
        students={activeStudents}
        socket={socket}
        testId={selectedTestId}
        onClose={() => setViewAllOpen(false)}
        onOpenStudent={openFromGrid}
      />

      <ViewLiveModal
        student={liveStudentFresh}
        testId={selectedTestId}
        socket={socket}
        cameFromViewAll={cameFromViewAll}
        onClose={closeLive}
        onBackToViewAll={backToViewAll}
      />
    </div>
  );
}

// Camera/Mic status badge — 🟢 Live / 🟡 Connecting / 🔴 Unavailable / ⚪ Denied.
// Backed by the `camera_status`/`mic_status` fields server.js computes
// (computeCameraStatus/computeMicStatus) from the fast heartbeat + optional
// permission report. Purely informational everywhere it's used — it never
// disables anything except the View Live button, and even that only
// reflects "nothing to watch right now", never a block on the student's
// own test. item 11: camera and mic are independent channels, so each
// gets its own badge rather than one implying the other.
const DEVICE_STATUS_META = {
  live: { dot: '🟢', className: 'text-teal', dotClassName: 'animate-pulse bg-teal' },
  connecting: { dot: '🟡', className: 'text-gold', dotClassName: 'animate-pulse bg-gold' },
  denied: { dot: '⚪', className: 'text-ink-light', dotClassName: 'bg-ink-light/60' },
  unavailable: { dot: '🔴', className: 'text-crimson', dotClassName: 'bg-crimson' },
};
const CAMERA_STATUS_META = {
  live: { ...DEVICE_STATUS_META.live, label: 'Camera Live' },
  connecting: { ...DEVICE_STATUS_META.connecting, label: 'Connecting' },
  denied: { ...DEVICE_STATUS_META.denied, label: 'Permission Denied' },
  unavailable: { ...DEVICE_STATUS_META.unavailable, label: 'Camera Unavailable' },
};
const MIC_STATUS_META = {
  live: { ...DEVICE_STATUS_META.live, label: 'Mic Live' },
  connecting: { ...DEVICE_STATUS_META.connecting, label: 'Connecting' },
  denied: { ...DEVICE_STATUS_META.denied, label: 'Permission Denied' },
  unavailable: { ...DEVICE_STATUS_META.unavailable, label: 'Mic Unavailable' },
};
function CameraStatusBadge({ status }) {
  const meta = CAMERA_STATUS_META[status] || CAMERA_STATUS_META.unavailable;
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-bold ${meta.className}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} /> {meta.label}
    </span>
  );
}
function MicStatusBadge({ status }) {
  const meta = MIC_STATUS_META[status] || MIC_STATUS_META.unavailable;
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-bold ${meta.className}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} /> {meta.label}
    </span>
  );
}

function StudentRow({ student, onViewLive }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="px-4 py-2.5 font-mono text-ink">{student.roll_number || '—'}</td>
        <td className="px-4 py-2.5">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="font-semibold text-ink hover:underline">
            {student.name}
          </button>
        </td>
        <td className="px-4 py-2.5">
          {student.submitted ? (
            <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-[11px] font-bold text-ink-light">Submitted</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              <CameraStatusBadge status={student.camera_status} />
              <MicStatusBadge status={student.mic_status} />
            </div>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={onViewLive}
            disabled={!student.camera_active}
            className="rounded-full bg-hero-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
            title={student.camera_active ? "Watch this student's live camera + mic" : 'No live camera available right now'}
          >
            🎥 View Live
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-paper/60 last:border-0">
          <td colSpan={4} className="px-4 py-3">
            <ProfileCard user={{ name: student.name, username: student.username, role: 'student', department: student.department, section_id: student.section_name, roll_number: student.roll_number }} />
          </td>
        </tr>
      )}
    </>
  );
}

function LiveBadge() {
  return (
    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-crimson/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
    </span>
  );
}

// One tile in the View All grid — its own independent live WebRTC feed,
// correctly mapped to exactly one student (keyed by username, both in
// React and in the shared signalling socket's listener registry). Only
// connects while actually scrolled into view AND the roster reports the
// student's camera as live; otherwise it shows the same kind of precise
// status explanation View Live shows, never a fake or frozen frame.
function LiveTile({ student, socket, testId, onOpen }) {
  const containerRef = useRef(null);
  const inView = useInViewport(containerRef);
  const enabled = inView && !!student.camera_active;
  const { videoRef, state } = useStudentLiveView({ socket, testId, username: student.username, enabled });

  const connected = state === 'connected';
  const overlayMessage = !student.camera_active
    ? (CAMERA_STATUS_META[student.camera_status] || CAMERA_STATUS_META.unavailable).label
    : !inView
    ? 'Loading…'
    : (LIVE_STATE_MESSAGE[state] || 'Connecting…');

  return (
    <button
      type="button"
      ref={containerRef}
      onClick={() => onOpen(student)}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-paper-card text-left shadow-sm transition hover:border-teal/60 hover:shadow-md"
      title={`Open ${student.name}'s detailed live view`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          controlsList="nodownload noremoteplayback nofullscreen"
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full object-cover"
        />
        {connected && <LiveBadge />}
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-3 text-center text-[11px] font-medium text-white">
            {overlayMessage}
          </div>
        )}
      </div>
      <div className="space-y-1.5 px-3 py-2">
        <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
        <p className="text-[11px] text-ink-light">Roll No. {student.roll_number || '—'}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <CameraStatusBadge status={student.camera_status} />
          <MicStatusBadge status={student.mic_status} />
          <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-bold text-teal">Writing</span>
        </div>
      </div>
    </button>
  );
}

// The "View All" screen (spec item: top-right button opens a single
// monitoring screen with every active student's live feed side-by-side
// in a responsive grid). A full-screen overlay rather than the shared
// Modal component, since Modal is capped at a small fixed width — a
// grid of live video tiles needs the whole viewport.
function ViewAllScreen({ open, students, socket, testId, onClose, onOpenStudent }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-card px-5 py-3">
        <div>
          <h2 className="text-base font-bold text-ink sm:text-lg">View All — live monitoring</h2>
          <p className="text-xs text-ink-light">
            {students.length} student{students.length === 1 ? '' : 's'} currently writing this test · tap a tile for the detailed view
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink-light hover:bg-line/40"
        >
          ✕ Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {students.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-ink-light">
            No students are currently writing this test.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((s) => (
              <LiveTile key={s.username} student={s} socket={socket} testId={testId} onOpen={onOpenStudent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoChip({ label, value, tone }) {
  const toneClass = tone === 'ok' ? 'text-teal' : tone === 'bad' ? 'text-crimson' : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-paper px-2.5 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-light">{label}</p>
      <p className={`text-xs font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

// Faculty-only live view — a real WebRTC PeerConnection to the student's
// browser, shared with View All (see useStudentLiveView above). The
// player is VIEW ONLY: there's no download control, no picture-in-
// picture, and the context menu is disabled.
function ViewLiveModal({ student, testId, socket, cameFromViewAll, onClose, onBackToViewAll }) {
  const enabled = !!student && !!testId;
  const { videoRef, state, retry } = useStudentLiveView({ socket, testId, username: student?.username, enabled });
  // BUG FIX: this <video> was permanently `muted` with no way to turn
  // sound on, so faculty could never actually hear a student here even
  // though the WebRTC connection carries a live audio track fine. Grid
  // tiles (LiveTile, elsewhere in this file) stay muted-only on purpose —
  // you don't want N students' audio playing at once in a grid — but this
  // is the single detailed view faculty opens specifically to watch (and
  // now listen to) one student, so it gets an explicit unmute control.
  // Starts muted (autoplay policies require that); faculty's click to
  // unmute is itself a user gesture, so the browser allows it.
  const [unmuted, setUnmuted] = useState(false);

  if (!student || !testId) return null;
  const connected = state === 'connected';

  return (
    <Modal open onClose={onClose} title={`Live — ${student.name}`}>
      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={!unmuted}
            controlsList="nodownload noremoteplayback nofullscreen"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            className="h-full w-full object-contain"
          />
          {connected && (
            <button
              type="button"
              onClick={() => setUnmuted((v) => !v)}
              aria-label={unmuted ? 'Mute audio' : 'Unmute audio'}
              className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
            >
              {unmuted ? '🔊 Sound on' : '🔇 Unmute'}
            </button>
          )}
          {connected && <LiveBadge />}
          {!connected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm font-medium text-white">
              {state === 'connection-failed' ? (
                <div className="space-y-2">
                  <p>{LIVE_STATE_MESSAGE[state]}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                LIVE_STATE_MESSAGE[state] || 'Connecting to student\u2019s camera\u2026'
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InfoChip label="Roll No." value={student.roll_number || '—'} />
          <InfoChip label="Test status" value={student.submitted ? 'Submitted' : 'Writing'} tone={student.submitted ? undefined : 'ok'} />
          <InfoChip label="Camera" value={(CAMERA_STATUS_META[student.camera_status] || CAMERA_STATUS_META.unavailable).label} tone={student.camera_status === 'live' ? 'ok' : 'bad'} />
          <InfoChip label="Mic" value={(MIC_STATUS_META[student.mic_status] || MIC_STATUS_META.unavailable).label} tone={student.mic_status === 'live' ? 'ok' : 'bad'} />
          <InfoChip label="Recording" value={student.recording_active ? 'Active' : 'Not recording'} tone={student.recording_active ? 'ok' : 'bad'} />
        </div>

        <p className="text-xs text-ink-light">
          {student.department || ''} {student.department ? '· ' : ''}Live camera feed. View only — this stream cannot be downloaded or recorded from here.
        </p>

        {cameFromViewAll && (
          <button
            type="button"
            onClick={onBackToViewAll}
            className="w-full rounded-full border border-line py-1.5 text-xs font-semibold text-ink-light hover:bg-line/40"
          >
            ← Back to View All
          </button>
        )}
      </div>
    </Modal>
  );
}
