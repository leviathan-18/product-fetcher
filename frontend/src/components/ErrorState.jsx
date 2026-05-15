function ErrorState({ message }) {
  if (!message) return null;

  return (
    <div className="mt-6 rounded-xl border border-rose-700/40 bg-rose-900/20 p-4 text-rose-200">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default ErrorState;
