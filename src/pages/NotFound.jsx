import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-extrabold text-teal">404</p>
      <h1 className="mt-2 text-xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-light">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-hero-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to home
      </Link>
    </div>
  );
}
