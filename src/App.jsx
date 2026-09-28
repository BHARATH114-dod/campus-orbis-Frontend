import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import BackgroundLayer from './components/common/BackgroundLayer';
import ToastContainer from './components/common/ToastContainer';
import RouteTransitionOverlay from './components/common/RouteTransitionOverlay';
import ScrollToTop from './components/common/ScrollToTop';
import AppRoutes from './routes/AppRoutes';

// Small wrapper so usePushNotifications() runs inside AuthProvider/
// ToastProvider/NotificationProvider/BrowserRouter (it needs all four:
// auth state, toasts for a denied-permission notice, refresh() for the
// bell badge, and useNavigate() for click-to-navigate) without App itself
// needing to be a descendant of its own providers. Renders nothing.
function PushNotificationSetup() {
  usePushNotifications();
  return null;
}

// Provider order matters here: ThemeProvider first (affects paint before
// anything else), then ToastProvider (Auth's login/logout flows may want to
// toast in later modules), then AuthProvider, which kicks off the /api/me
// session check as soon as it mounts. NotificationProvider comes last since
// it depends on AuthContext's isAuthenticated to decide whether to poll.
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <BrowserRouter>
              <BackgroundLayer />
              <PushNotificationSetup />
              <RouteTransitionOverlay />
              <ScrollToTop />
              <AppRoutes />
              <ToastContainer />
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
